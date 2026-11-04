/**
 * Arcadia — Verifiable Spatial Ledger
 * ===================================
 * Phase 1 / Domain schema.
 *
 * Every value that enters the ledger is validated here, before it can be
 * sealed by the hash chain. The ledger never stores a "best effort" object:
 * if it does not satisfy the schema, it does not exist.
 *
 * Coordinate convention
 * ---------------------
 * `PixelBoundingBox` is `[ymin, xmin, ymax, xmax]`, normalized to the
 * 0..1000 integer space. This is deliberate: it is the same normalized
 * space SAM 3.1 uses for location tokens, so a box can travel from
 * Muse Spark (which reasons in text coordinates) to SAM 3.1 (which needs
 * media pixels) through a single, reversible transform — see
 * `src/services/metaAdapter.ts`.
 *
 * Keeping the domain in normalized space also means the ledger stays valid
 * when the same evidence is re-rendered at a different resolution.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------------- */
/* Primitives                                                                */
/* ------------------------------------------------------------------------- */

/** Size of the normalized coordinate space on each axis. */
export const COORD_SPACE_MAX = 1000 as const;

const ISO_8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO-8601 timestamp WITH an explicit offset.
 *
 * We reject naive timestamps on purpose. A commitment that says
 * "2026-11-05T16:00:00" is ambiguous the moment the user travels, and an
 * ambiguous timestamp is an unverifiable claim. The offset is part of the
 * evidence.
 */
export const IsoDateTime = z
  .string()
  .regex(ISO_8601_RE, 'must be an ISO-8601 datetime with an explicit offset')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a parseable datetime');

/** Lowercase hex SHA-256 digest. */
export const Sha256Hex = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be a lowercase hex SHA-256 digest');

const Coord = z.number().int().min(0).max(COORD_SPACE_MAX);

/**
 * `[ymin, xmin, ymax, xmax]` in the 0..1000 normalized space.
 *
 * Invariants enforced: ymin < ymax, xmin < xmax, all integers, all in range.
 * A degenerate box (zero area) is not a location — it cannot anchor anything.
 */
export const PixelBoundingBox = z
  .tuple([Coord, Coord, Coord, Coord])
  .superRefine(([ymin, xmin, ymax, xmax], ctx) => {
    if (ymin >= ymax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [0],
        message: 'ymin must be strictly less than ymax',
      });
    }
    if (xmin >= xmax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [1],
        message: 'xmin must be strictly less than xmax',
      });
    }
  });

/* ------------------------------------------------------------------------- */
/* Evidence                                                                  */
/* ------------------------------------------------------------------------- */

export const EvidenceType = z.enum(['screenshot', 'audio', 'document']);

/**
 * `local-only` is a hard policy flag, not a hint.
 *
 * Evidence marked `local-only` may be used to compute an anchor, but the raw
 * bytes must never leave the device (e.g. the original audio of a private
 * conversation). The adapter layer is responsible for honouring it; the
 * ledger records it so the policy survives export/import.
 */
export const EvidenceSensitivity = z.enum(['normal', 'local-only']);

export const Evidence = z
  .object({
    id: z.string().min(1),
    type: EvidenceType,
    /** `data:` URI, `https:` URL or `file:` reference. */
    rawUri: z.string().min(1),
    /** SHA-256 of the raw bytes. The root of the custody chain. */
    sha256: Sha256Hex,
    capturedAt: IsoDateTime,
    sensitivity: EvidenceSensitivity,
  })
  .strict();

/* ------------------------------------------------------------------------- */
/* Provenance                                                                */
/* ------------------------------------------------------------------------- */

/**
 * A speech turn as returned by Muse Voice Transcribe.
 *
 * IMPORTANT (verified against the Meta Model API docs): the model returns
 * *turn-level* timestamps, not word-level timestamps. `startMs`/`endMs`
 * bracket an utterance. Word-level timestamps, per-word confidence and
 * emotion detection are explicitly not available. Any UI copy that promises
 * "the exact word" is a lie; "the exact utterance" is the truth.
 */
export const AudioTurn = z
  .object({
    /** Session-scoped label (`A`, `B`, …) from DIARIZATION mode. Not an identity. */
    speaker: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    text: z.string().min(1),
  })
  .strict()
  .superRefine((turn, ctx) => {
    if (turn.endMs <= turn.startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endMs'],
        message: 'endMs must be strictly greater than startMs',
      });
    }
  });

/**
 * The link between a claim and the physical world.
 *
 * Exactly one of `box` / `audioTurn` is expected in practice, but the schema
 * requires *at least one*: an anchor with neither is not provenance, it is
 * an opinion. This invariant is the whole thesis, so it is enforced in the
 * type system and at runtime.
 */
export const ProvenanceAnchor = z
  .object({
    evidenceId: z.string().min(1),
    box: PixelBoundingBox.optional(),
    audioTurn: AudioTurn.optional(),
    /** Model-reported confidence in [0, 1]. Never invented by the UI. */
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((anchor, ctx) => {
    if (anchor.box === undefined && anchor.audioTurn === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'an anchor must carry a pixel box or an audio turn',
      });
    }
  });

/* ------------------------------------------------------------------------- */
/* Causal branches                                                           */
/* ------------------------------------------------------------------------- */

export const PathName = z.enum(['A', 'B']);
export const RiskLevel = z.enum(['low', 'medium', 'high']);

export const CausalBranch = z
  .object({
    pathName: PathName,
    actionTitle: z.string().min(1),
    tradeOffs: z.array(z.string().min(1)),
    /** Signed delta in hours against the user's baseline. */
    deltaHours: z.number().finite(),
    /** Signed delta in energy units against the user's baseline. */
    deltaEnergy: z.number().finite(),
    riskLevel: RiskLevel,
  })
  .strict();

/* ------------------------------------------------------------------------- */
/* Commitments                                                               */
/* ------------------------------------------------------------------------- */

export const CommitmentStatus = z.enum(['proposed', 'verified', 'conflicted']);

export const TimeWindow = z
  .object({
    start: IsoDateTime,
    end: IsoDateTime,
  })
  .strict()
  .refine((w) => Date.parse(w.end) > Date.parse(w.start), {
    message: 'timeWindow.end must be after timeWindow.start',
  });

/**
 * Extension over the original brief: `timeWindow`.
 *
 * The brief asked for schedule-conflict detection but the listed fields had
 * no interval, and a commitment without an interval cannot collide with
 * anything. Rather than parse free text (non-deterministic, unverifiable),
 * we add an optional, explicit interval. Optional keeps every previously
 * valid commitment valid.
 */
export const VerifiableCommitment = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(120),
    claimText: z.string().min(1).max(2000),
    anchor: ProvenanceAnchor,
    status: CommitmentStatus,
    branches: z.tuple([CausalBranch, CausalBranch]),
    /** Valid time: when the fact is true in the world. */
    validFrom: IsoDateTime,
    /** Transaction time: when this version was recorded. */
    recordedAt: IsoDateTime,
    timeWindow: TimeWindow.optional(),
  })
  .strict();

/** A commitment as proposed by Muse Spark, before it is anchored and sealed. */
export const DraftCommitment = VerifiableCommitment.omit({
  id: true,
  anchor: true,
  status: true,
  recordedAt: true,
});

/* ------------------------------------------------------------------------- */
/* Conflicts                                                                 */
/* ------------------------------------------------------------------------- */

export const ConflictKind = z.enum(['schedule.overlap', 'evidence.contradiction']);

export const ConflictRecord = z
  .object({
    /** Deterministic: SHA-256 of `kind + sorted commitment ids`. */
    id: Sha256Hex,
    kind: ConflictKind,
    commitmentIds: z.tuple([z.string().min(1), z.string().min(1)]),
    detail: z.string().min(1),
    detectedAt: IsoDateTime,
  })
  .strict();

/* ------------------------------------------------------------------------- */
/* Events                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Event payload registry.
 *
 * `append()` is typed against these keys, so an unknown event type is a
 * compile error. Hydration re-validates every payload: a ledger imported
 * from localStorage is untrusted input, not a trusted snapshot.
 */
export const LEDGER_PAYLOADS = {
  'evidence.ingested': z.object({ evidence: Evidence }).strict(),
  'commitment.proposed': z.object({ commitment: VerifiableCommitment }).strict(),
  'commitment.verified': z
    .object({
      commitmentId: z.string().min(1),
      anchor: ProvenanceAnchor,
      verifiedAt: IsoDateTime,
    })
    .strict(),
  'commitment.conflicted': z
    .object({
      commitmentId: z.string().min(1),
      conflictId: Sha256Hex,
    })
    .strict(),
  'commitment.retracted': z
    .object({
      commitmentId: z.string().min(1),
      reason: z.string().min(1),
    })
    .strict(),
  'conflict.detected': z.object({ conflict: ConflictRecord }).strict(),
} as const;

export type LedgerEventType = keyof typeof LEDGER_PAYLOADS;
export type LedgerPayload<T extends LedgerEventType> = z.infer<(typeof LEDGER_PAYLOADS)[T]>;

/**
 * One sealed link in the custody chain.
 *
 * `payload` is `unknown` in the wire shape so that an event read from disk
 * can be validated before it is trusted; inside the ledger every payload has
 * already been parsed by its registry schema.
 */
export const DomainEvent = z
  .object({
    seq: z.number().int().min(1),
    type: z.string().min(1),
    payload: z.unknown(),
    payloadHash: Sha256Hex,
    prevHash: Sha256Hex,
    hash: Sha256Hex,
    timestamp: IsoDateTime,
  })
  .strict();

/* ------------------------------------------------------------------------- */
/* Projections                                                               */
/* ------------------------------------------------------------------------- */

export const LedgerSnapshot = z
  .object({
    /** Transaction time cutoff: what the ledger knew. */
    recordedBefore: IsoDateTime,
    /** Valid time cutoff: what was true in the world. */
    validAt: IsoDateTime,
    events: z.array(DomainEvent),
    evidences: z.array(Evidence),
    commitments: z.array(VerifiableCommitment),
    conflicts: z.array(ConflictRecord),
  })
  .strict();

/* ------------------------------------------------------------------------- */
/* Inferred types                                                            */
/* ------------------------------------------------------------------------- */

export type PixelBoundingBox = z.infer<typeof PixelBoundingBox>;
export type EvidenceType = z.infer<typeof EvidenceType>;
export type EvidenceSensitivity = z.infer<typeof EvidenceSensitivity>;
export type Evidence = z.infer<typeof Evidence>;
export type AudioTurn = z.infer<typeof AudioTurn>;
export type ProvenanceAnchor = z.infer<typeof ProvenanceAnchor>;
export type PathName = z.infer<typeof PathName>;
export type RiskLevel = z.infer<typeof RiskLevel>;
export type CausalBranch = z.infer<typeof CausalBranch>;
export type CommitmentStatus = z.infer<typeof CommitmentStatus>;
export type TimeWindow = z.infer<typeof TimeWindow>;
export type VerifiableCommitment = z.infer<typeof VerifiableCommitment>;
export type DraftCommitment = z.infer<typeof DraftCommitment>;
export type ConflictKind = z.infer<typeof ConflictKind>;
export type ConflictRecord = z.infer<typeof ConflictRecord>;
export type DomainEvent = z.infer<typeof DomainEvent>;
export type LedgerSnapshot = z.infer<typeof LedgerSnapshot>;
