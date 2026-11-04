/**
 * Arcadia — Verifiable Spatial Ledger
 * ===================================
 * Phase 1 / Event ledger.
 *
 * Design notes
 * ------------
 * 1. APPEND-ONLY. There is no `update` and no `delete`. A correction is a new
 *    event that supersedes an old one. This is what makes the chain auditable:
 *    history cannot be rewritten, only extended.
 *
 * 2. HASH CHAIN. Each event seals `seq + prevHash + payloadHash + timestamp`
 *    with SHA-256. `prevHash` is the previous event's `hash`, so altering any
 *    historical byte invalidates every event after it. The genesis link uses
 *    64 zeros.
 *
 *    Concatenation is unambiguous without separators because `prevHash` and
 *    `payloadHash` are fixed-width (64 lowercase hex chars) and `seq` and
 *    `timestamp` are generated, not user input.
 *
 * 3. BITEMPORAL. Two independent time axes:
 *      - transaction time  = when the ledger *learned* something (`timestamp`)
 *      - valid time        = when the fact is *true in the world* (`validFrom`)
 *    `asOf(t)` answers: "at instant t, what did the ledger know about facts
 *    that were true at instant t?". That is the Rewind, and it is why a
 *    commitment proposed today can be projected as it looked yesterday.
 *
 * 4. IDEMPOTENT CONFLICTS. Replaying the same state must not append the same
 *    conflict twice. Every conflict carries a deterministic id derived from
 *    `kind + sorted commitment ids`.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import {
  ConflictRecord,
  DomainEvent,
  LEDGER_PAYLOADS,
  PixelBoundingBox,
  ProvenanceAnchor,
  VerifiableCommitment,
} from './schema.ts';
import type { Evidence, LedgerEventType, LedgerSnapshot } from './schema.ts';

/* ------------------------------------------------------------------------- */
/* Constants                                                                 */
/* ------------------------------------------------------------------------- */

/** Previous hash of the first event: 64 zeros. */
export const GENESIS_HASH = '0'.repeat(64);

/** Two claims read from the same source region must agree at least this much. */
export const EVIDENCE_OVERLAP_THRESHOLD = 0.5;

const LEDGER_FORMAT_VERSION = 1;

/* ------------------------------------------------------------------------- */
/* Hashing                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Deterministic JSON: object keys sorted lexicographically, recursively.
 *
 * Without this, `{a:1,b:2}` and `{b:2,a:1}` would hash differently and the
 * chain would depend on property insertion order — a bug that only shows up
 * after a refactor.
 */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (node: unknown): string => {
    if (node === null) return 'null';

    switch (typeof node) {
      case 'string':
        return JSON.stringify(node);
      case 'number': {
        if (!Number.isFinite(node)) {
          throw new TypeError('canonicalJson: non-finite numbers are not hashable');
        }
        return JSON.stringify(node);
      }
      case 'boolean':
        return node ? 'true' : 'false';
      case 'object': {
        if (seen.has(node)) {
          throw new TypeError('canonicalJson: circular reference');
        }
        seen.add(node);

        let out: string;
        if (Array.isArray(node)) {
          out = `[${node.map(walk).join(',')}]`;
        } else if (node instanceof Date) {
          throw new TypeError('canonicalJson: use ISO strings, not Date instances');
        } else {
          const entries = Object.entries(node as Record<string, unknown>);
          for (const [key, child] of entries) {
            if (child === undefined) {
              throw new TypeError(`canonicalJson: undefined value at key "${key}"`);
            }
          }
          entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
          out = `{${entries
            .map(([key, child]) => `${JSON.stringify(key)}:${walk(child)}`)
            .join(',')}}`;
        }

        seen.delete(node);
        return out;
      }
      default:
        throw new TypeError(`canonicalJson: unsupported type "${typeof node}"`);
    }
  };

  return walk(value);
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

/** The sealed digest of one event. Kept in one place so tests can recompute it. */
export function computeEventHash(
  seq: number,
  prevHash: string,
  payloadHash: string,
  timestamp: string,
): string {
  return sha256Hex(`${seq}${prevHash}${payloadHash}${timestamp}`);
}

/* ------------------------------------------------------------------------- */
/* Storage                                                                   */
/* ------------------------------------------------------------------------- */

/** Minimal persistence contract. The ledger never talks to `localStorage` directly. */
export interface LedgerStore {
  read(): string | null;
  write(serialized: string): void;
  clear(): void;
}

export class MemoryLedgerStore implements LedgerStore {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(serialized: string): void {
    this.value = serialized;
  }

  clear(): void {
    this.value = null;
  }
}

/** Structural subset of `Storage`, so this file stays free of DOM globals. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageLedgerStore implements LedgerStore {
  private readonly storage: StorageLike;
  private readonly key: string;

  constructor(storage: StorageLike, key = 'arcadia.ledger.v1') {
    this.storage = storage;
    this.key = key;
  }

  read(): string | null {
    return this.storage.getItem(this.key);
  }

  write(serialized: string): void {
    this.storage.setItem(this.key, serialized);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

export class LedgerIntegrityError extends Error {
  readonly reason: string;
  readonly atSeq: number | null;

  constructor(reason: string, atSeq: number | null = null) {
    super(`Ledger integrity violation: ${reason}${atSeq === null ? '' : ` (seq ${atSeq})`}`);
    this.name = 'LedgerIntegrityError';
    this.reason = reason;
    this.atSeq = atSeq;
  }
}

/* ------------------------------------------------------------------------- */
/* Verification                                                              */
/* ------------------------------------------------------------------------- */

export type LedgerVerification =
  | { valid: true; checked: number }
  | { valid: false; checked: number; reason: string; atSeq: number };

/* ------------------------------------------------------------------------- */
/* Bitemporal query                                                          */
/* ------------------------------------------------------------------------- */

export interface BitemporalQuery {
  /** Transaction time cutoff. Defaults to "now" per the ledger clock. */
  recordedBefore?: string;
  /** Valid time cutoff. Defaults to "now" per the ledger clock. */
  validAt?: string;
}

/* ------------------------------------------------------------------------- */
/* Conflict rules                                                            */
/* ------------------------------------------------------------------------- */

/** Intersection-over-union of two normalized boxes, treated as half-open. */
export function boxIou(a: PixelBoundingBox, b: PixelBoundingBox): number {
  const [ay1, ax1, ay2, ax2] = a;
  const [by1, bx1, by2, bx2] = b;

  const iy1 = Math.max(ay1, by1);
  const ix1 = Math.max(ax1, bx1);
  const iy2 = Math.min(ay2, by2);
  const ix2 = Math.min(ax2, bx2);

  const interW = Math.max(0, ix2 - ix1);
  const interH = Math.max(0, iy2 - iy1);
  const intersection = interW * interH;

  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  const union = areaA + areaB - intersection;

  return union <= 0 ? 0 : intersection / union;
}

function normalizeClaim(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function conflictKey(kind: string, ids: readonly [string, string]): string {
  return `${kind}:${[...ids].sort().join('|')}`;
}

export function conflictId(kind: string, ids: readonly [string, string]): string {
  return sha256Hex(conflictKey(kind, ids));
}

function anchorsShareSource(a: ProvenanceAnchor, b: ProvenanceAnchor): boolean {
  if (a.evidenceId !== b.evidenceId) return false;
  if (a.box !== undefined && b.box !== undefined) {
    return boxIou(a.box, b.box) >= EVIDENCE_OVERLAP_THRESHOLD;
  }
  if (a.audioTurn !== undefined && b.audioTurn !== undefined) {
    return a.audioTurn.startMs === b.audioTurn.startMs;
  }
  return false;
}

/**
 * Pure conflict detection over a projected state.
 *
 * Two rules, both deterministic and explainable to a human:
 *
 *  - `schedule.overlap`      — two commitments whose explicit intervals
 *                              intersect. Not "probably"; intersect.
 *  - `evidence.contradiction`— two different claims extracted from the same
 *                              source region (same evidence + IoU >= 0.5, or
 *                              the same audio turn). One source, two readings.
 *                              The system must not pick a winner.
 */
export function detectConflicts(
  commitments: readonly VerifiableCommitment[],
  detectedAt: string,
): ConflictRecord[] {
  const out: ConflictRecord[] = [];

  for (let i = 0; i < commitments.length; i += 1) {
    for (let j = i + 1; j < commitments.length; j += 1) {
      const a = commitments[i];
      const b = commitments[j];
      if (a === undefined || b === undefined) continue;

      // Rule 1 — explicit schedule collision.
      if (a.timeWindow !== undefined && b.timeWindow !== undefined) {
        const start = Math.max(Date.parse(a.timeWindow.start), Date.parse(b.timeWindow.start));
        const end = Math.min(Date.parse(a.timeWindow.end), Date.parse(b.timeWindow.end));
        if (start < end) {
          const ids: [string, string] = [a.id, b.id];
          out.push({
            id: conflictId('schedule.overlap', ids),
            kind: 'schedule.overlap',
            commitmentIds: ids,
            detail:
              `"${a.title}" and "${b.title}" overlap for ` +
              `${Math.round((end - start) / 60_000)} minutes.`,
            detectedAt,
          });
          continue;
        }
      }

      // Rule 2 — one source, two readings.
      if (
        anchorsShareSource(a.anchor, b.anchor) &&
        normalizeClaim(a.claimText) !== normalizeClaim(b.claimText)
      ) {
        const ids: [string, string] = [a.id, b.id];
        out.push({
          id: conflictId('evidence.contradiction', ids),
          kind: 'evidence.contradiction',
          commitmentIds: ids,
          detail:
            `"${a.title}" and "${b.title}" are both read from the same ` +
            `region of evidence ${a.anchor.evidenceId}, with different claims.`,
          detectedAt,
        });
      }
    }
  }

  return out;
}

/* ------------------------------------------------------------------------- */
/* Ledger                                                                    */
/* ------------------------------------------------------------------------- */

export interface EventLedgerOptions {
  /** Injected clock. Deterministic in tests, monotonic in production. */
  clock?: () => string;
  store?: LedgerStore;
  /** Pre-verified events (used by `fromJSON`). */
  events?: readonly DomainEvent[];
}

export interface ReconcileResult {
  /** All conflicts visible in the current projection. */
  conflicts: ConflictRecord[];
  /** Only the events appended by this call (empty when already reconciled). */
  appended: DomainEvent[];
}

export class EventLedger {
  private readonly events: DomainEvent[];
  private readonly clock: () => string;
  private readonly store: LedgerStore | null;

  constructor(options: EventLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.store = options.store ?? null;

    if (options.events !== undefined) {
      this.events = [...options.events];
    } else if (this.store !== null) {
      const raw = this.store.read();
      this.events = raw === null ? [] : EventLedger.decode(raw);
    } else {
      this.events = [];
    }

    const verification = this.verify();
    if (!verification.valid) {
      throw new LedgerIntegrityError(verification.reason, verification.atSeq);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Reads                                                            */
  /* ---------------------------------------------------------------- */

  get size(): number {
    return this.events.length;
  }

  get head(): DomainEvent | null {
    return this.events.length === 0 ? null : (this.events[this.events.length - 1] ?? null);
  }

  listEvents(): readonly DomainEvent[] {
    return [...this.events];
  }

  /* ---------------------------------------------------------------- */
  /* Write                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Seal one event into the chain and persist it.
   *
   * The payload is validated before it is hashed: an invalid payload never
   * becomes part of the custody chain, so a malformed write cannot poison
   * every subsequent hash.
   */
  append<T extends LedgerEventType>(type: T, payload: unknown): DomainEvent {
    const schema = LEDGER_PAYLOADS[type];
    const parsed: unknown = schema.parse(payload);

    const previous = this.head;
    const seq = (previous?.seq ?? 0) + 1;
    const timestamp = this.clock();
    const payloadHash = sha256Hex(canonicalJson(parsed));
    const prevHash = previous?.hash ?? GENESIS_HASH;
    const hash = computeEventHash(seq, prevHash, payloadHash, timestamp);

    const event: DomainEvent = {
      seq,
      type,
      payload: parsed,
      payloadHash,
      prevHash,
      hash,
      timestamp,
    };

    this.events.push(event);
    this.persist();
    return event;
  }

  /* ---------------------------------------------------------------- */
  /* Integrity                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Recompute the whole chain from genesis.
   *
   * Checks, in order: sequence continuity, previous-hash linkage, payload
   * hash, event hash, and payload schema. A ledger that fails any of these
   * is not "mostly fine" — it is untrusted, and the constructor refuses it.
   */
  verify(): LedgerVerification {
    let prevHash = GENESIS_HASH;

    for (let index = 0; index < this.events.length; index += 1) {
      const event = this.events[index];
      if (event === undefined) {
        return { valid: false, checked: index, reason: 'missing event', atSeq: index + 1 };
      }

      const expectedSeq = index + 1;
      if (event.seq !== expectedSeq) {
        return {
          valid: false,
          checked: index,
          reason: `sequence gap: expected ${expectedSeq}, found ${event.seq}`,
          atSeq: event.seq,
        };
      }

      if (event.prevHash !== prevHash) {
        return {
          valid: false,
          checked: index,
          reason: 'broken link: prevHash does not match the previous event hash',
          atSeq: event.seq,
        };
      }

      const schema = LEDGER_PAYLOADS[event.type as LedgerEventType] as
        | { safeParse: (v: unknown) => { success: boolean } }
        | undefined;
      if (schema === undefined) {
        return {
          valid: false,
          checked: index,
          reason: `unknown event type "${event.type}"`,
          atSeq: event.seq,
        };
      }
      if (!schema.safeParse(event.payload).success) {
        return {
          valid: false,
          checked: index,
          reason: 'payload does not satisfy its registered schema',
          atSeq: event.seq,
        };
      }

      let payloadHash: string;
      try {
        payloadHash = sha256Hex(canonicalJson(event.payload));
      } catch {
        return {
          valid: false,
          checked: index,
          reason: 'payload is not canonically hashable',
          atSeq: event.seq,
        };
      }

      if (payloadHash !== event.payloadHash) {
        return {
          valid: false,
          checked: index,
          reason: 'payload hash mismatch (payload was modified)',
          atSeq: event.seq,
        };
      }

      const expectedHash = computeEventHash(
        event.seq,
        event.prevHash,
        event.payloadHash,
        event.timestamp,
      );
      if (expectedHash !== event.hash) {
        return {
          valid: false,
          checked: index,
          reason: 'event hash mismatch (seal was forged or timestamp modified)',
          atSeq: event.seq,
        };
      }

      prevHash = event.hash;
    }

    return { valid: true, checked: this.events.length };
  }

  /* ---------------------------------------------------------------- */
  /* Bitemporal projection                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Replay the chain up to a transaction-time cutoff, then filter by valid
   * time.
   *
   * Active-at-`validAt` semantics:
   *  - a commitment with a `timeWindow` is active while `validAt < end`;
   *  - a commitment without one is active from `validFrom` onwards.
   */
  project(query: BitemporalQuery = {}): LedgerSnapshot {
    const now = this.clock();
    const recordedBefore = query.recordedBefore ?? now;
    const validAt = query.validAt ?? now;

    const recordedCutoff = Date.parse(recordedBefore);
    const validCutoff = Date.parse(validAt);

    if (Number.isNaN(recordedCutoff) || Number.isNaN(validCutoff)) {
      throw new RangeError('project(): invalid bitemporal cutoff');
    }

    const visible = this.events.filter((event) => Date.parse(event.timestamp) <= recordedCutoff);

    const evidences = new Map<string, Evidence>();
    const commitments = new Map<string, VerifiableCommitment>();
    const conflicts: ConflictRecord[] = [];

    for (const event of visible) {
      switch (event.type) {
        case 'evidence.ingested': {
          const payload = event.payload as { evidence: Evidence };
          evidences.set(payload.evidence.id, payload.evidence);
          break;
        }
        case 'commitment.proposed': {
          const payload = event.payload as { commitment: VerifiableCommitment };
          commitments.set(payload.commitment.id, { ...payload.commitment });
          break;
        }
        case 'commitment.verified': {
          const payload = event.payload as {
            commitmentId: string;
            anchor: ProvenanceAnchor;
          };
          const existing = commitments.get(payload.commitmentId);
          if (existing !== undefined) {
            commitments.set(payload.commitmentId, {
              ...existing,
              anchor: payload.anchor,
              status: 'verified',
            });
          }
          break;
        }
        case 'commitment.conflicted': {
          const payload = event.payload as { commitmentId: string };
          const existing = commitments.get(payload.commitmentId);
          if (existing !== undefined) {
            commitments.set(payload.commitmentId, { ...existing, status: 'conflicted' });
          }
          break;
        }
        case 'commitment.retracted': {
          const payload = event.payload as { commitmentId: string };
          commitments.delete(payload.commitmentId);
          break;
        }
        case 'conflict.detected': {
          const payload = event.payload as { conflict: ConflictRecord };
          conflicts.push(payload.conflict);
          break;
        }
        default:
          // Forward-compatible: an event type we do not project yet is
          // preserved in `events` but contributes nothing to the state.
          break;
      }
    }

    const active = [...commitments.values()].filter((commitment) => {
      if (Date.parse(commitment.validFrom) > validCutoff) return false;
      if (commitment.timeWindow !== undefined) {
        return validCutoff < Date.parse(commitment.timeWindow.end);
      }
      return true;
    });

    return {
      recordedBefore,
      validAt,
      events: visible,
      evidences: [...evidences.values()],
      commitments: active,
      conflicts,
    };
  }

  /**
   * The Rewind: state of the world as the ledger knew it at `timestamp`,
   * restricted to facts valid at that same instant.
   */
  asOf(timestamp: string): LedgerSnapshot {
    return this.project({ recordedBefore: timestamp, validAt: timestamp });
  }

  /* ---------------------------------------------------------------- */
  /* Conflict reconciliation                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Detect conflicts in the current projection and seal them.
   *
   * Idempotent: conflicts already present in the chain are not re-appended,
   * so calling this after every ingestion is safe.
   */
  reconcileConflicts(): ReconcileResult {
    const snapshot = this.project();
    const detectedAt = this.clock();
    const found = detectConflicts(snapshot.commitments, detectedAt);

    const known = new Set(snapshot.conflicts.map((c) => c.id));
    const fresh = found.filter((conflict) => !known.has(conflict.id));

    const appended: DomainEvent[] = [];

    for (const conflict of fresh) {
      appended.push(this.append('conflict.detected', { conflict }));
    }

    // Flip the affected commitments to `conflicted`, but only once.
    const alreadyConflicted = new Set(
      snapshot.commitments.filter((c) => c.status === 'conflicted').map((c) => c.id),
    );
    const toFlag = new Set<string>();
    for (const conflict of fresh) {
      for (const id of conflict.commitmentIds) {
        if (!alreadyConflicted.has(id)) toFlag.add(id);
      }
    }

    for (const commitmentId of toFlag) {
      const conflict = fresh.find((c) => c.commitmentIds.includes(commitmentId));
      if (conflict === undefined) continue;
      appended.push(
        this.append('commitment.conflicted', { commitmentId, conflictId: conflict.id }),
      );
    }

    return { conflicts: found, appended };
  }

  /* ---------------------------------------------------------------- */
  /* Serialization                                                    */
  /* ---------------------------------------------------------------- */

  serialize(): string {
    return JSON.stringify({ version: LEDGER_FORMAT_VERSION, events: this.events });
  }

  static decode(serialized: string): DomainEvent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new LedgerIntegrityError('serialized ledger is not valid JSON');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new LedgerIntegrityError('serialized ledger must be an object');
    }

    const envelope = parsed as { version?: unknown; events?: unknown };
    if (envelope.version !== LEDGER_FORMAT_VERSION) {
      throw new LedgerIntegrityError(
        `unsupported ledger format version: ${String(envelope.version)}`,
      );
    }
    if (!Array.isArray(envelope.events)) {
      throw new LedgerIntegrityError('serialized ledger has no events array');
    }

    return envelope.events.map((raw, index) => {
      const result = DomainEvent.safeParse(raw);
      if (!result.success) {
        throw new LedgerIntegrityError(
          `event ${index + 1} does not satisfy the DomainEvent schema`,
          index + 1,
        );
      }
      return result.data;
    });
  }

  static fromJSON(serialized: string, options: Omit<EventLedgerOptions, 'events'> = {}): EventLedger {
    return new EventLedger({ ...options, events: EventLedger.decode(serialized) });
  }

  private persist(): void {
    if (this.store === null) return;
    this.store.write(this.serialize());
  }
}
