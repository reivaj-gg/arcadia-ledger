/**
 * Ledger tests — deterministic by construction.
 *
 * Nothing here reads the wall clock. `EventLedger` takes a clock through its
 * options precisely so that "bitemporal rewind" can be asserted as a fact
 * instead of a race: a test that calls `new Date()` to build its own cutoff is
 * testing the scheduler, not the ledger.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  boxIou,
  canonicalJson,
  computeEventHash,
  detectConflicts,
  EventLedger,
  GENESIS_HASH,
  LedgerIntegrityError,
  LocalStorageLedgerStore,
  MemoryLedgerStore,
  sha256Hex,
  type StorageLike,
} from '../src/domain/ledger.ts';
import type {
  DomainEvent,
  Evidence,
  ProvenanceAnchor,
  VerifiableCommitment,
} from '../src/domain/schema.ts';
import {
  MOCK_CLASS_ANCHOR_TURN,
  MOCK_CLASS_DRAFT,
  MOCK_DILEMMA_DRAFT,
  MOCK_EVIDENCE_AUDIO,
  MOCK_EVIDENCE_SCREENSHOT,
  MOCK_REFINED_BOX,
} from '../src/services/fixtures.ts';

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

/** A clock the test moves by hand. */
class TestClock {
  private current: number;

  constructor(iso: string) {
    this.current = Date.parse(iso);
  }

  now = (): string => new Date(this.current).toISOString();

  set(iso: string): void {
    this.current = Date.parse(iso);
  }
}

const SCREENSHOT_ANCHOR: ProvenanceAnchor = {
  evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
  box: MOCK_REFINED_BOX,
  confidence: 0.96,
};

const AUDIO_ANCHOR: ProvenanceAnchor = {
  evidenceId: MOCK_EVIDENCE_AUDIO.id,
  audioTurn: MOCK_CLASS_ANCHOR_TURN,
  confidence: 0.98,
};

function commitment(
  id: string,
  draft: typeof MOCK_DILEMMA_DRAFT,
  anchor: ProvenanceAnchor,
  recordedAt: string,
): VerifiableCommitment {
  return { ...draft, id, anchor, status: 'proposed', recordedAt };
}

/** Build a ledger with the two colliding fixtures already sealed. */
function seededLedger(clock: TestClock): EventLedger {
  const ledger = new EventLedger({ clock: clock.now });

  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });
  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_AUDIO });

  ledger.append('commitment.proposed', {
    commitment: commitment('com-design', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now()),
  });
  ledger.append('commitment.proposed', {
    commitment: commitment('com-class', MOCK_CLASS_DRAFT, AUDIO_ANCHOR, clock.now()),
  });

  return ledger;
}

/* ------------------------------------------------------------------------- */
/* Chain construction                                                        */
/* ------------------------------------------------------------------------- */

test('genesis: an empty ledger is valid and has no head', () => {
  const ledger = new EventLedger();

  assert.equal(ledger.size, 0);
  assert.equal(ledger.head, null);
  assert.deepEqual(ledger.verify(), { valid: true, checked: 0 });
});

test('chain: the first event links to the 64-zero genesis hash', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  const event = ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });

  assert.equal(GENESIS_HASH, '0'.repeat(64));
  assert.equal(event.seq, 1);
  assert.equal(event.prevHash, GENESIS_HASH);
  assert.match(event.hash, /^[0-9a-f]{64}$/);
  assert.equal(event.timestamp, '2026-11-04T10:00:00.000Z');
});

test('chain: hash is exactly SHA256(seq + prevHash + payloadHash + timestamp)', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });
  const second = ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_AUDIO });

  const recomputed = computeEventHash(
    second.seq,
    second.prevHash,
    second.payloadHash,
    second.timestamp,
  );

  assert.equal(recomputed, second.hash);
  // And the payload digest is the canonical JSON digest, not a raw JSON one.
  assert.equal(
    second.payloadHash,
    sha256Hex(canonicalJson({ evidence: MOCK_EVIDENCE_AUDIO })),
  );
});

test('chain: every event links to its predecessor', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  const events = ledger.listEvents();
  assert.equal(events.length, 4);

  let previous = GENESIS_HASH;
  for (const [index, event] of events.entries()) {
    assert.equal(event.seq, index + 1);
    assert.equal(event.prevHash, previous);
    previous = event.hash;
  }

  assert.equal(ledger.verify().valid, true);
});

test('chain: canonical JSON is order-independent', () => {
  const a = canonicalJson({ b: 2, a: 1, nested: { z: true, y: null } });
  const b = canonicalJson({ nested: { y: null, z: true }, a: 1, b: 2 });

  assert.equal(a, b);
  assert.equal(a, '{"a":1,"b":2,"nested":{"y":null,"z":true}}');
});

test('chain: canonical JSON refuses values that cannot be hashed', () => {
  assert.throws(() => canonicalJson({ a: undefined }), TypeError);
  assert.throws(() => canonicalJson({ a: Number.NaN }), TypeError);
  assert.throws(() => canonicalJson(new Date()), TypeError);

  const circular: Record<string, unknown> = {};
  circular['self'] = circular;
  assert.throws(() => canonicalJson(circular), TypeError);
});

/* ------------------------------------------------------------------------- */
/* Write validation                                                          */
/* ------------------------------------------------------------------------- */

test('append: an invalid payload is rejected and the chain is untouched', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  assert.throws(() => {
    // Missing every required field of `VerifiableCommitment`.
    ledger.append('commitment.proposed', { commitment: { id: 'not-enough' } });
  });

  assert.equal(ledger.size, 0);
  assert.equal(ledger.verify().valid, true);
});

test('append: a naive timestamp is rejected, an offset is required', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  assert.throws(() => {
    ledger.append('commitment.proposed', {
      commitment: {
        ...commitment('com-naive', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now()),
        validFrom: '2026-11-05T16:00:00',
      },
    });
  });

  assert.equal(ledger.size, 0);
});

test('append: an anchor with neither a box nor an audio turn is not provenance', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  assert.throws(() => {
    ledger.append('commitment.proposed', {
      commitment: commitment('com-orphan', MOCK_DILEMMA_DRAFT, {
        evidenceId: 'ev-nowhere',
        confidence: 0.9,
      }, clock.now()),
    });
  });
});

/* ------------------------------------------------------------------------- */
/* Tamper detection                                                          */
/* ------------------------------------------------------------------------- */

function tamper(mutate: (events: DomainEvent[]) => void): string {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  const envelope = JSON.parse(ledger.serialize()) as { events: DomainEvent[] };
  mutate(envelope.events);
  return JSON.stringify(envelope);
}

test('tamper: modifying a sealed payload breaks the chain', () => {
  const serialized = tamper((events) => {
    const target = events[0];
    assert.ok(target !== undefined);
    (target.payload as { evidence: Evidence }).evidence.sha256 = sha256Hex('forged');
  });

  assert.throws(() => EventLedger.fromJSON(serialized), LedgerIntegrityError);
});

test('tamper: modifying a timestamp breaks the seal even if the payload is intact', () => {
  const serialized = tamper((events) => {
    const target = events[2];
    assert.ok(target !== undefined);
    target.timestamp = '2020-01-01T00:00:00.000Z';
  });

  assert.throws(() => EventLedger.fromJSON(serialized), LedgerIntegrityError);
});

test('tamper: deleting a middle event breaks sequence continuity', () => {
  const serialized = tamper((events) => {
    events.splice(1, 1);
  });

  assert.throws(
    () => EventLedger.fromJSON(serialized),
    (error: unknown) =>
      error instanceof LedgerIntegrityError && error.reason.includes('sequence gap'),
  );
});

test('tamper: rewriting prevHash breaks the link', () => {
  const serialized = tamper((events) => {
    const target = events[1];
    assert.ok(target !== undefined);
    target.prevHash = sha256Hex('not-the-previous-event');
  });

  assert.throws(
    () => EventLedger.fromJSON(serialized),
    (error: unknown) => error instanceof LedgerIntegrityError && error.reason.includes('broken link'),
  );
});

test('tamper: an unknown event type is refused, not ignored', () => {
  const serialized = tamper((events) => {
    const target = events[0];
    assert.ok(target !== undefined);
    target.type = 'commitment.forged';
  });

  assert.throws(
    () => EventLedger.fromJSON(serialized),
    (error: unknown) => error instanceof LedgerIntegrityError && error.reason.includes('unknown event type'),
  );
});

/* ------------------------------------------------------------------------- */
/* Bitemporal projection                                                     */
/* ------------------------------------------------------------------------- */

test('asOf: transaction time hides facts the ledger had not learned yet', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });

  clock.set('2026-11-04T11:00:00.000Z');
  ledger.append('commitment.proposed', {
    commitment: commitment('com-design', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now()),
  });

  clock.set('2026-11-04T12:00:00.000Z');
  ledger.append('commitment.proposed', {
    commitment: commitment('com-class', MOCK_CLASS_DRAFT, AUDIO_ANCHOR, clock.now()),
  });

  // Before anything but the screenshot existed.
  assert.equal(ledger.asOf('2026-11-04T10:30:00.000Z').commitments.length, 0);
  assert.equal(ledger.asOf('2026-11-04T10:30:00.000Z').evidences.length, 1);

  // After the first commitment, before the second.
  const mid = ledger.asOf('2026-11-04T11:30:00.000Z');
  assert.equal(mid.commitments.length, 1);
  assert.equal(mid.commitments[0]?.id, 'com-design');

  // After both.
  assert.equal(ledger.asOf('2026-11-04T12:30:00.000Z').commitments.length, 2);
});

test('asOf: valid time hides commitments whose interval already closed', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  // Both fixtures occupy 2026-11-05 15:00-17:00 -03:00.
  const during = ledger.asOf('2026-11-05T19:00:00.000Z');
  assert.equal(during.commitments.length, 2);

  // After the window closes, they are no longer active, but the events remain.
  const after = ledger.asOf('2026-11-06T00:00:00.000Z');
  assert.equal(after.commitments.length, 0);
  assert.equal(after.events.length, 4);
});

test('asOf: a commitment is not active before its validFrom', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  // The fixtures become valid on 2026-11-03, so a cutoff before that must
  // exclude them even though the events are already recorded.
  const snapshot = ledger.project({
    recordedBefore: '2026-11-04T23:59:59.000Z',
    validAt: '2026-11-02T00:00:00.000Z',
  });

  assert.equal(snapshot.commitments.length, 0);
});

test('project: a commitment can be retracted and disappears from the projection', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  assert.equal(ledger.project().commitments.length, 2);

  ledger.append('commitment.retracted', {
    commitmentId: 'com-design',
    reason: 'The client cancelled the job.',
  });

  const ids = ledger.project().commitments.map((item) => item.id);
  assert.deepEqual(ids, ['com-class']);
});

/* ------------------------------------------------------------------------- */
/* Conflict rules                                                            */
/* ------------------------------------------------------------------------- */

test('boxIou: identical boxes are 1, disjoint boxes are 0', () => {
  assert.equal(boxIou([0, 0, 100, 100], [0, 0, 100, 100]), 1);
  assert.equal(boxIou([0, 0, 100, 100], [500, 500, 600, 600]), 0);

  // Half overlap: intersection 100x50 = 5000, union = 10000 + 5000 - 5000 = 10000.
  const half = boxIou([0, 0, 100, 100], [0, 0, 100, 50]);
  assert.equal(half, 0.5);
});

test('conflicts: two overlapping time windows are reported with the real duration', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);

  const found = detectConflicts(ledger.project().commitments, clock.now());

  assert.equal(found.length, 1);
  const conflict = found[0];
  assert.ok(conflict !== undefined);
  assert.equal(conflict.kind, 'schedule.overlap');
  assert.deepEqual([...conflict.commitmentIds].sort(), ['com-class', 'com-design']);
  assert.match(conflict.detail, /60 minutes/);
});

test('conflicts: the same region read twice with different claims is a contradiction', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });

  const base = commitment('com-a', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now());
  const { timeWindow: _ignored, ...withoutWindow } = base;

  ledger.append('commitment.proposed', { commitment: { ...withoutWindow, id: 'com-a' } });
  ledger.append('commitment.proposed', {
    commitment: {
      ...withoutWindow,
      id: 'com-b',
      claimText: 'Mariana ofrece $120, no $200.',
      // Same source, same region, one pixel of difference.
      anchor: {
        evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
        box: [MOCK_REFINED_BOX[0] + 1, MOCK_REFINED_BOX[1], MOCK_REFINED_BOX[2], MOCK_REFINED_BOX[3]],
        confidence: 0.93,
      },
    },
  });

  const found = detectConflicts(ledger.project().commitments, clock.now());

  assert.equal(found.length, 1);
  assert.equal(found[0]?.kind, 'evidence.contradiction');
});

test('conflicts: identical claims from the same region are not a contradiction', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = new EventLedger({ clock: clock.now });

  const base = commitment('com-a', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now());
  const { timeWindow: _ignored, ...withoutWindow } = base;

  ledger.append('commitment.proposed', { commitment: { ...withoutWindow, id: 'com-a' } });
  ledger.append('commitment.proposed', { commitment: { ...withoutWindow, id: 'com-b' } });

  assert.deepEqual(detectConflicts(ledger.project().commitments, clock.now()), []);
});

test('reconcile: seals the conflict, flags both commitments, and is idempotent', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const ledger = seededLedger(clock);
  const sizeBefore = ledger.size;

  const first = ledger.reconcileConflicts();
  assert.equal(first.conflicts.length, 1);
  // One `conflict.detected` plus one `commitment.conflicted` per participant.
  assert.equal(first.appended.length, 3);
  assert.equal(ledger.size, sizeBefore + 3);

  const statuses = ledger.project().commitments.map((item) => item.status);
  assert.deepEqual(statuses, ['conflicted', 'conflicted']);

  const second = ledger.reconcileConflicts();
  assert.equal(second.conflicts.length, 1);
  assert.equal(second.appended.length, 0, 'replaying must not append the same conflict twice');
  assert.equal(ledger.size, sizeBefore + 3);
});

test('reconcile: conflict ids are deterministic across ledgers', () => {
  const a = seededLedger(new TestClock('2026-11-04T10:00:00.000Z')).reconcileConflicts();
  const b = seededLedger(new TestClock('2026-11-04T10:00:00.000Z')).reconcileConflicts();

  assert.equal(a.conflicts[0]?.id, b.conflicts[0]?.id);
});

/* ------------------------------------------------------------------------- */
/* Persistence                                                               */
/* ------------------------------------------------------------------------- */

test('persistence: a memory store round-trips the chain byte for byte', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const store = new MemoryLedgerStore();

  const ledger = new EventLedger({ clock: clock.now, store });
  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });
  ledger.append('commitment.proposed', {
    commitment: commitment('com-design', MOCK_DILEMMA_DRAFT, SCREENSHOT_ANCHOR, clock.now()),
  });

  const reopened = new EventLedger({ clock: clock.now, store });
  assert.equal(reopened.size, ledger.size);
  assert.deepEqual(reopened.listEvents(), ledger.listEvents());
  assert.equal(reopened.verify().valid, true);
});

test('persistence: a tampered store is refused at construction time', () => {
  const clock = new TestClock('2026-11-04T10:00:00.000Z');
  const store = new MemoryLedgerStore();

  const ledger = new EventLedger({ clock: clock.now, store });
  ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });

  const corrupted = store.read()?.replace(MOCK_EVIDENCE_SCREENSHOT.id, 'ev-substituted');
  assert.ok(corrupted !== undefined);
  store.write(corrupted);

  assert.throws(() => new EventLedger({ clock: clock.now, store }), LedgerIntegrityError);
});

test('persistence: localStorage adapter speaks only the Storage contract', () => {
  const backing = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
    removeItem: (key) => {
      backing.delete(key);
    },
  };

  const store = new LocalStorageLedgerStore(storage, 'arcadia.test');
  assert.equal(store.read(), null);

  store.write('{"version":1,"events":[]}');
  assert.equal(store.read(), '{"version":1,"events":[]}');

  store.clear();
  assert.equal(store.read(), null);
  assert.equal(backing.size, 0);
});

test('decode: garbage is rejected with a typed error, never silently ignored', () => {
  assert.throws(() => EventLedger.decode('not json'), LedgerIntegrityError);
  assert.throws(() => EventLedger.decode('[]'), LedgerIntegrityError);
  assert.throws(() => EventLedger.decode('{"version":99,"events":[]}'), LedgerIntegrityError);
  assert.throws(() => EventLedger.decode('{"version":1}'), LedgerIntegrityError);
});
