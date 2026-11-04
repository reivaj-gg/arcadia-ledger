/**
 * Arcadia — Verifiable Spatial Ledger
 * ===================================
 * End-to-End Custody Chain Integration Test
 *
 * Validates the entire life cycle of verifiable provenance:
 * 1. Multimodal Evidence Ingestion (Image + Audio)
 * 2. Meta Handshake: Muse Spark (interprets) -> SAM 3.1 (segments to pixel) -> Muse Voice (turns)
 * 3. Immutable Append-Only Ledger with SHA-256 Hash Chaining
 * 4. Deterministic Conflict & Schedule Collision Detection
 * 5. Bitemporal Rewind (asOf) State Projection
 * 6. Cryptographic Tamper-Resistance & Rejection
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EventLedger,
  GENESIS_HASH,
  detectConflicts,
  LedgerIntegrityError,
} from '../src/domain/ledger.ts';
import {
  MOCK_CLASS_ANCHOR_TURN,
  MOCK_CLASS_DRAFT,
  MOCK_DILEMMA_DRAFT,
  MOCK_EVIDENCE_AUDIO,
  MOCK_EVIDENCE_SCREENSHOT,
  MOCK_REFINED_BOX,
  MOCK_SCREENSHOT_BOX,
  MOCK_SEGMENTATION_CONFIDENCE,
  MOCK_TRANSCRIPTION_TURNS,
} from '../src/services/fixtures.ts';
import { MetaAdapter } from '../src/services/metaAdapter.ts';
import type { ProvenanceAnchor, VerifiableCommitment } from '../src/domain/schema.ts';

test('E2E Lifecycle: complete verifiable custody chain', async () => {
  // --- Step 0: Initialize Ledger with Simulated Monotonic Clock & Adapter ---
  let simulatedTime = Date.parse('2026-11-03T09:40:00-03:00');
  const clock = () => new Date(simulatedTime).toISOString();
  const ledger = new EventLedger({ clock });
  const adapter = new MetaAdapter({ mock: true });

  assert.equal(ledger.size, 0);
  assert.equal(ledger.head, null);

  // --- Step 1: Ingest Screenshot Evidence ---
  simulatedTime += 60_000; // 09:41
  const ev1 = ledger.append('evidence.ingested', {
    evidence: MOCK_EVIDENCE_SCREENSHOT,
  });
  assert.equal(ev1.seq, 1);
  assert.equal(ev1.prevHash, GENESIS_HASH);
  assert.match(ev1.hash, /^[0-9a-f]{64}$/);

  // --- Step 2: Ingest Voice Note Evidence ---
  simulatedTime += 60_000; // 09:42
  const ev2 = ledger.append('evidence.ingested', {
    evidence: MOCK_EVIDENCE_AUDIO,
  });
  assert.equal(ev2.seq, 2);
  assert.equal(ev2.prevHash, ev1.hash);

  // --- Step 3: Meta Handshake (Spark -> SAM 3.1) ---
  // Muse Spark extracts draft and proposed box
  const sparkResult = await adapter.extractCausalCommitment(
    'Oye Javier, me ayudas con el diseno para el jueves? Te pago $200. Entrega a las 4 PM.',
    { evidenceId: ev1.payloadHash, kind: 'screenshot', sensitivity: 'normal' },
  );
  assert.ok(sparkResult.draft.title);
  assert.deepEqual(sparkResult.proposedBox, MOCK_SCREENSHOT_BOX);

  // SAM 3.1 receives box prompt and outputs pixel mask
  const samResult = await adapter.segmentRegion(new Uint8Array([1, 2, 3]), sparkResult.proposedBox!);
  assert.ok(samResult.matched);
  assert.ok(samResult.confidence >= 0.95);
  assert.deepEqual(samResult.box, MOCK_REFINED_BOX);

  // --- Step 4: Seal Commitment 1 anchored to SAM 3.1 Pixel Mask ---
  simulatedTime += 60_000; // 09:43
  const anchor1: ProvenanceAnchor = {
    evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
    box: samResult.box,
    confidence: samResult.confidence,
  };

  const commitment1: VerifiableCommitment = {
    ...sparkResult.draft,
    id: 'com-mariana-gig-thursday',
    anchor: anchor1,
    status: 'proposed',
    recordedAt: clock(),
    validFrom: clock(),
  };

  const comEvent1 = ledger.append('commitment.proposed', { commitment: commitment1 });
  assert.equal(comEvent1.seq, 3);
  assert.equal(comEvent1.prevHash, ev2.hash);

  // Record point in time before the second commitment
  simulatedTime += 60_000; // 09:44
  const checkpointBeforeConflict = clock();

  // --- Step 5: Meta Handshake (Muse Voice Transcribe) ---
  const voiceResult = await adapter.transcribeAudio(new Uint8Array([4, 5, 6]), {
    sensitivity: 'normal',
  });
  assert.ok(voiceResult.turns.length >= 2);
  const classTurn = voiceResult.turns[1]!;
  assert.equal(classTurn.speaker, 'A');
  assert.ok(classTurn.text.includes('cálculo'));

  // --- Step 6: Seal Commitment 2 anchored to Audio Turn ---
  simulatedTime += 3600_000; // 10:44
  const anchor2: ProvenanceAnchor = {
    evidenceId: MOCK_EVIDENCE_AUDIO.id,
    audioTurn: classTurn,
    confidence: 0.985,
  };

  const commitment2: VerifiableCommitment = {
    ...MOCK_CLASS_DRAFT,
    id: 'com-calculus-class-thursday',
    anchor: anchor2,
    status: 'proposed',
    recordedAt: clock(),
    validFrom: clock(),
  };

  const comEvent2 = ledger.append('commitment.proposed', { commitment: commitment2 });
  assert.equal(comEvent2.seq, 4);
  assert.equal(comEvent2.prevHash, comEvent1.hash);

  // --- Step 7: Detect Schedule Conflict ---
  simulatedTime += 60_000; // 10:45
  const currentCommitments = [commitment1, commitment2];
  const conflicts = detectConflicts(currentCommitments, clock());
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.kind, 'schedule.overlap');
  assert.ok(conflicts[0]!.detail.includes('overlap'));

  // Seal conflict into ledger
  const conflictEvent = ledger.append('conflict.detected', { conflict: conflicts[0]! });
  assert.equal(conflictEvent.seq, 5);

  // --- Step 8: Ledger Integrity Check ---
  const integrity = ledger.verify();
  assert.equal(integrity.valid, true);
  assert.equal(integrity.checked, 5);

  // --- Step 9: Bitemporal Rewind (asOf) ---
  // Query state as of before the conflict was recorded
  const statePast = ledger.asOf(checkpointBeforeConflict);
  assert.equal(statePast.commitments.length, 1);
  assert.equal(statePast.conflicts.length, 0);
  assert.equal(statePast.commitments[0]!.id, commitment1.id);

  // Query state now
  simulatedTime += 60_000; // 10:46
  const stateNow = ledger.asOf(clock());
  assert.equal(stateNow.commitments.length, 2);
  assert.equal(stateNow.conflicts.length, 1);

  // --- Step 10: Cryptographic Tamper Resistance ---
  const serialized = ledger.serialize();
  const tampered = serialized.replace('mariana-gig', 'hacked-gig');

  assert.throws(
    () => {
      EventLedger.fromJSON(tampered);
    },
    (err: unknown) => err instanceof LedgerIntegrityError,
  );
});
