/**
 * End-to-end custody chain.
 *
 * This is the story the product tells, executed once, in order:
 *
 *   ingest evidence
 *     -> Muse Spark interprets the evidence and proposes a region
 *     -> SAM 3.1 refines that region into a mask
 *     -> Muse Voice Transcribe returns turn-level audio anchors
 *     -> the claims are sealed into a SHA-256 hash chain
 *     -> a real schedule collision is detected and sealed
 *     -> the ledger is rewound to a previous transaction time
 *
 * Everything is driven by an injected clock, so "rewind" is an assertion
 * instead of a race, and the adapter runs in mock mode, so the test needs no
 * key and no network.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { EventLedger, GENESIS_HASH, LedgerIntegrityError } from '../src/domain/ledger.ts';
import type { ProvenanceAnchor, VerifiableCommitment } from '../src/domain/schema.ts';
import {
  MOCK_CLASS_DRAFT,
  MOCK_EVIDENCE_AUDIO,
  MOCK_EVIDENCE_SCREENSHOT,
  MOCK_REFINED_BOX,
  MOCK_SCREENSHOT_BOX,
} from '../src/services/fixtures.ts';
import { MetaAdapter } from '../src/services/metaAdapter.ts';

/** A minimal PNG header. Real dimensions, so the call shape matches live use. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

test('e2e: evidence -> Spark -> SAM -> hash chain -> conflict -> rewind', async () => {
  /* --------------------------------------------------------------------- */
  /* Step 0 — a ledger and an adapter, both deterministic                  */
  /* --------------------------------------------------------------------- */

  let simulatedTime = Date.parse('2026-11-03T09:40:00-03:00');
  const clock = (): string => new Date(simulatedTime).toISOString();

  const ledger = new EventLedger({ clock });
  const adapter = new MetaAdapter({ mock: true });

  assert.equal(ledger.size, 0);
  assert.equal(ledger.head, null);

  /* --------------------------------------------------------------------- */
  /* Step 1 — ingest the two pieces of evidence                            */
  /* --------------------------------------------------------------------- */

  simulatedTime += 60_000; // 09:41
  const screenshotEvent = ledger.append('evidence.ingested', {
    evidence: MOCK_EVIDENCE_SCREENSHOT,
  });

  assert.equal(screenshotEvent.seq, 1);
  assert.equal(screenshotEvent.prevHash, GENESIS_HASH);
  assert.match(screenshotEvent.hash, /^[0-9a-f]{64}$/);

  simulatedTime += 60_000; // 09:42
  const audioEvent = ledger.append('evidence.ingested', {
    evidence: MOCK_EVIDENCE_AUDIO,
  });

  assert.equal(audioEvent.seq, 2);
  assert.equal(audioEvent.prevHash, screenshotEvent.hash);

  /* --------------------------------------------------------------------- */
  /* Step 2 — Muse Spark reads the screenshot and proposes a region        */
  /* --------------------------------------------------------------------- */

  const extraction = await adapter.extractCausalCommitment(
    'Hey Javier, can you help me with the design for Thursday? Paying $200. Delivery by 4 PM.',
    {
      evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
      kind: 'screenshot',
      capturedAt: MOCK_EVIDENCE_SCREENSHOT.capturedAt,
      sensitivity: MOCK_EVIDENCE_SCREENSHOT.sensitivity,
    },
  );

  assert.equal(extraction.receipt.model, 'muse-spark-1.3');
  assert.equal(extraction.receipt.operation, 'extract');
  assert.ok(extraction.draft.branches.length === 2);
  assert.notEqual(
    extraction.draft.branches[0].pathName,
    extraction.draft.branches[1].pathName,
    'the two paths must be genuinely different actions',
  );

  // Spark only proposes; it does not claim pixel precision.
  assert.deepEqual(extraction.proposedBox, MOCK_SCREENSHOT_BOX);

  /* --------------------------------------------------------------------- */
  /* Step 3 — SAM 3.1 refines the proposed box into a mask                 */
  /* --------------------------------------------------------------------- */

  assert.ok(extraction.proposedBox !== null, 'a screenshot claim must propose a region');

  const segmentation = await adapter.segmentRegion(png(720, 1280), extraction.proposedBox, {
    evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
    sensitivity: MOCK_EVIDENCE_SCREENSHOT.sensitivity,
  });

  assert.equal(segmentation.receipt.model, 'sam-3.1');
  assert.equal(segmentation.matched, true);
  if (!segmentation.matched) return;

  // The refined box is strictly tighter or equal — it is geometry, not a guess.
  assert.deepEqual(segmentation.box, MOCK_REFINED_BOX);
  // Mock mode reports a confidence, so this assertion is about the mock fixture;
  // the narrowing keeps the type honest without inventing a fallback.
  assert.ok(segmentation.confidence !== null && segmentation.confidence > 0.9);

  /* --------------------------------------------------------------------- */
  /* Step 4 — seal the first commitment, anchored to that mask             */
  /* --------------------------------------------------------------------- */

  simulatedTime += 60_000; // 09:43
  const screenshotAnchor: ProvenanceAnchor = {
    evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
    box: segmentation.box,
    confidence: segmentation.confidence,
  };

  const designCommitment: VerifiableCommitment = {
    ...extraction.draft,
    id: 'com-mariana-design',
    anchor: screenshotAnchor,
    status: 'proposed',
    recordedAt: clock(),
    validFrom: clock(),
  };

  const designEvent = ledger.append('commitment.proposed', { commitment: designCommitment });
  assert.equal(designEvent.seq, 3);
  assert.equal(designEvent.prevHash, audioEvent.hash);

  simulatedTime += 60_000; // 09:44
  const checkpointBeforeSecondCommitment = clock();

  /* --------------------------------------------------------------------- */
  /* Step 5 — Muse Voice Transcribe returns turn-level audio anchors       */
  /* --------------------------------------------------------------------- */

  const transcription = await adapter.transcribeAudio(new Uint8Array(44), {
    sensitivity: MOCK_EVIDENCE_AUDIO.sensitivity,
    evidenceId: MOCK_EVIDENCE_AUDIO.id,
  });

  assert.equal(transcription.receipt.model, 'muse-voice-transcribe-1.0');
  assert.ok(transcription.turns.length >= 2);

  // Turn-level, not word-level: every anchor is an interval with a speaker.
  for (const turn of transcription.turns) {
    assert.ok(turn.endMs > turn.startMs);
    assert.ok(turn.speaker.length > 0);
  }

  const classTurn = transcription.turns[1];
  assert.ok(classTurn !== undefined);
  assert.match(classTurn.text, /Calculus/i);

  /* --------------------------------------------------------------------- */
  /* Step 6 — seal the second commitment, anchored to that audio turn      */
  /* --------------------------------------------------------------------- */

  simulatedTime += 3_600_000; // 10:44
  const classAnchor: ProvenanceAnchor = {
    evidenceId: MOCK_EVIDENCE_AUDIO.id,
    audioTurn: classTurn,
    confidence: 0.985,
  };

  const classCommitment: VerifiableCommitment = {
    ...MOCK_CLASS_DRAFT,
    id: 'com-calculus-class',
    anchor: classAnchor,
    status: 'proposed',
    recordedAt: clock(),
    validFrom: clock(),
  };

  const classEvent = ledger.append('commitment.proposed', { commitment: classCommitment });
  assert.equal(classEvent.seq, 4);
  assert.equal(classEvent.prevHash, designEvent.hash);

  // An audio claim is anchored to a turn, never to a fabricated box.
  assert.equal(classCommitment.anchor.box, undefined);
  assert.ok(classCommitment.anchor.audioTurn !== undefined);

  /* --------------------------------------------------------------------- */
  /* Step 7 — the schedule collision is detected and sealed                */
  /* --------------------------------------------------------------------- */

  simulatedTime += 60_000; // 10:45
  const reconciliation = ledger.reconcileConflicts();

  assert.equal(reconciliation.conflicts.length, 1);

  const conflict = reconciliation.conflicts[0];
  assert.ok(conflict !== undefined);
  assert.equal(conflict.kind, 'schedule.overlap');
  assert.deepEqual([...conflict.commitmentIds].sort(), ['com-calculus-class', 'com-mariana-design']);
  assert.match(conflict.detail, /60 minutes/);

  // One `conflict.detected` plus one `commitment.conflicted` per participant.
  assert.equal(reconciliation.appended.length, 3);

  const projected = ledger.project();
  assert.equal(projected.commitments.length, 2);
  assert.deepEqual(
    projected.commitments.map((item) => item.status),
    ['conflicted', 'conflicted'],
  );

  // Replaying the same state must not duplicate the finding.
  assert.equal(ledger.reconcileConflicts().appended.length, 0);

  /* --------------------------------------------------------------------- */
  /* Step 8 — the chain still verifies after all of that                   */
  /* --------------------------------------------------------------------- */

  const integrity = ledger.verify();
  assert.equal(integrity.valid, true);
  if (!integrity.valid) return;
  assert.equal(integrity.checked, 7);

  /* --------------------------------------------------------------------- */
  /* Step 9 — bitemporal rewind                                            */
  /* --------------------------------------------------------------------- */

  const past = ledger.asOf(checkpointBeforeSecondCommitment);

  // At 09:44 the ledger knew one commitment and no conflict...
  assert.equal(past.commitments.length, 1);
  assert.equal(past.conflicts.length, 0);
  assert.equal(past.commitments[0]?.id, 'com-mariana-design');

  // ...and that commitment was still `proposed`. The same fact, read at a
  // later transaction time, is now `conflicted`. That difference is the whole
  // point of keeping transaction time separate from valid time.
  assert.equal(past.commitments[0]?.status, 'proposed');

  simulatedTime += 60_000; // 10:46
  const now = ledger.asOf(clock());
  assert.equal(now.commitments.length, 2);
  assert.equal(now.conflicts.length, 1);
  assert.deepEqual(
    now.commitments.map((item) => item.status),
    ['conflicted', 'conflicted'],
  );

  /* --------------------------------------------------------------------- */
  /* Step 10 — tampering is rejected, not repaired silently                */
  /* --------------------------------------------------------------------- */

  const serialized = ledger.serialize();
  const tampered = serialized.replace(MOCK_EVIDENCE_SCREENSHOT.id, 'ev-substituted');

  assert.notEqual(tampered, serialized);
  assert.throws(() => EventLedger.fromJSON(tampered), LedgerIntegrityError);

  // The original is untouched by the failed import.
  assert.equal(ledger.verify().valid, true);
});
