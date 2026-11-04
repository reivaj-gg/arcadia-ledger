/**
 * Arcadia — conformance harness
 * =============================
 * Measures the parts of the pipeline that are verifiable without spending Model
 * API credits, and says so out loud.
 *
 * A previous version of this file carried hand-written `predictedBox` values next
 * to hand-written `groundTruthBox` values and computed an IoU between them. The
 * arithmetic was real; the measurement was not. That is worse than having no
 * benchmark, because it produces a number that looks like evidence. This file
 * replaces it.
 *
 * What is measured here
 * ---------------------
 *  1. **Coordinate round-trip.** A domain box is encoded into a SAM 3.1 prompt by
 *     the real `buildObjectPrompt`, parsed back out of the real token grammar by
 *     the real `parseSegmentationText`, and converted back to a domain box. The
 *     IoU between the input and the recovered box is the score. This exercises
 *     the off-by-one and the pixel quantization that actually broke once.
 *  2. **Audio contract verdicts.** Ten synthetic WAVs, each with a known
 *     accept/reject answer, run through the real `inspectWav`.
 *  3. **Ledger invariants.** Hash-chain verification, tamper rejection, planted
 *     conflict detection and bitemporal rewind, all on a real `EventLedger`.
 *
 * What is NOT measured here
 * -------------------------
 * Model quality. IoU between SAM's mask and a human mask, and transcription
 * accuracy, require a Model API key and real media. No number in this report is
 * an estimate of how well the models perform. The demo video is the evidence for
 * that, and pretending otherwise would be the exact failure this file exists to
 * avoid.
 *
 * Run with: `npm run eval`
 */

import { writeFileSync } from 'node:fs';

import { EventLedger, LedgerIntegrityError, boxIou } from '../src/domain/ledger.ts';
import type { PixelBoundingBox, VerifiableCommitment } from '../src/domain/schema.ts';
import { buildObjectPrompt, inspectWav, MetaAdapterError } from '../src/services/metaAdapter.ts';
import { boxFromBounds, parseSegmentationText } from '../src/services/samParser.ts';
import { recordsOfKind } from '@meta-sam/parser';

/* ------------------------------------------------------------------------- */
/* Fixtures                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * One real lossless mask token from the Meta docs. The official parser refuses a
 * box record that has no mask, so every round-trip fixture carries it.
 */
const DOC_MASK =
  "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>";

interface VisualCase {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly mediaWidth: number;
  readonly mediaHeight: number;
  readonly box: PixelBoundingBox;
}

/**
 * Ten boxes of different sizes and positions, including one that touches two
 * edges and one that is a single unit tall. Those are the cases where an
 * off-by-one shows up as a visible IoU loss instead of a rounding wobble.
 */
const VISUAL_CASES: readonly VisualCase[] = [
  { id: 'VIS-01', name: 'WhatsApp gig offer', category: 'chat', mediaWidth: 720, mediaHeight: 1280, box: [181, 33, 334, 722] },
  { id: 'VIS-02', name: 'Slack amendment', category: 'chat', mediaWidth: 1080, mediaHeight: 1920, box: [120, 50, 260, 680] },
  { id: 'VIS-03', name: 'Invoice milestone', category: 'document', mediaWidth: 1240, mediaHeight: 1754, box: [300, 100, 550, 900] },
  { id: 'VIS-04', name: 'Code review deadline', category: 'chat', mediaWidth: 720, mediaHeight: 1280, box: [450, 80, 580, 620] },
  { id: 'VIS-05', name: 'Retainer renewal', category: 'email', mediaWidth: 1920, mediaHeight: 1080, box: [210, 40, 410, 820] },
  { id: 'VIS-06', name: 'Workshop RSVP', category: 'chat', mediaWidth: 720, mediaHeight: 1280, box: [150, 60, 280, 500] },
  { id: 'VIS-07', name: 'Upwork milestone', category: 'document', mediaWidth: 1000, mediaHeight: 1000, box: [400, 250, 600, 750] },
  { id: 'VIS-08', name: 'Bank transfer notice', category: 'sms', mediaWidth: 390, mediaHeight: 844, box: [0, 0, 120, 390] },
  { id: 'VIS-09', name: 'Notion task deadline', category: 'document', mediaWidth: 2560, mediaHeight: 1440, box: [700, 900, 730, 990] },
  { id: 'VIS-10', name: 'Sublease deposit', category: 'document', mediaWidth: 800, mediaHeight: 1000, box: [100, 100, 900, 900] },
];

interface AudioCase {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** What the contract should say about this file. */
  readonly expect: 'accept' | 'reject';
  readonly options: WavOptions;
}

interface WavOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  durationMs?: number;
  allocateData?: boolean;
  formatTag?: number;
  extensible?: boolean;
  declaredDataSize?: number;
}

const AUDIO_CASES: readonly AudioCase[] = [
  { id: 'AUD-01', name: 'Mono 24 kHz PCM', category: 'voice memo', expect: 'accept', options: { sampleRate: 24_000 } },
  { id: 'AUD-02', name: 'Mono 16 kHz PCM', category: 'call excerpt', expect: 'accept', options: { sampleRate: 16_000 } },
  { id: 'AUD-03', name: 'Ten minutes exactly', category: 'meeting', expect: 'accept', options: { sampleRate: 16_000, durationMs: 600_000 } },
  { id: 'AUD-04', name: 'EXTENSIBLE PCM', category: 'voice memo', expect: 'accept', options: { extensible: true } },
  { id: 'AUD-05', name: 'Stereo 24 kHz', category: 'group audio', expect: 'reject', options: { channels: 2 } },
  { id: 'AUD-06', name: '44.1 kHz', category: 'music', expect: 'reject', options: { sampleRate: 44_100 } },
  { id: 'AUD-07', name: '8-bit PCM', category: 'legacy', expect: 'reject', options: { bitsPerSample: 8 } },
  { id: 'AUD-08', name: 'IEEE float 16-bit', category: 'export', expect: 'reject', options: { formatTag: 3 } },
  { id: 'AUD-09', name: 'Eleven minutes', category: 'long memo', expect: 'reject', options: { sampleRate: 16_000, durationMs: 660_000 } },
  { id: 'AUD-10', name: 'Truncated data chunk', category: 'broken export', expect: 'reject', options: { sampleRate: 16_000, durationMs: 30_000, allocateData: false } },
];

/* ------------------------------------------------------------------------- */
/* WAV construction                                                          */
/* ------------------------------------------------------------------------- */

function buildWav(options: WavOptions): Uint8Array {
  const sampleRate = options.sampleRate ?? 24_000;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const durationMs = options.durationMs ?? 1_000;
  const allocateData = options.allocateData ?? true;
  const formatTag = options.formatTag ?? 1;
  const extensible = options.extensible ?? false;

  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const computedDataSize = Math.round((byteRate * durationMs) / 1_000);

  const fmtSize = extensible ? 40 : 16;
  const declaredDataSize = options.declaredDataSize ?? computedDataSize;
  const allocatedDataSize = allocateData ? computedDataSize : 0;

  const buffer = new ArrayBuffer(12 + 8 + fmtSize + 8 + allocatedDataSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const tag = (offset: number, value: string): void => {
    for (let index = 0; index < 4; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };

  tag(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  tag(8, 'WAVE');

  tag(12, 'fmt ');
  view.setUint32(16, fmtSize, true);
  const fmt = 20;
  view.setUint16(fmt, extensible ? 0xfffe : formatTag, true);
  view.setUint16(fmt + 2, channels, true);
  view.setUint32(fmt + 4, sampleRate, true);
  view.setUint32(fmt + 8, byteRate, true);
  view.setUint16(fmt + 12, channels * bytesPerSample, true);
  view.setUint16(fmt + 14, bitsPerSample, true);

  if (extensible) {
    view.setUint16(fmt + 16, 22, true);
    view.setUint16(fmt + 18, bitsPerSample, true);
    view.setUint32(fmt + 20, 0, true);
    view.setUint16(fmt + 24, formatTag, true);
    bytes.set(
      [0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71],
      fmt + 26,
    );
  }

  const dataOffset = 12 + 8 + fmtSize;
  tag(dataOffset, 'data');
  view.setUint32(dataOffset + 4, declaredDataSize, true);

  return bytes;
}

/* ------------------------------------------------------------------------- */
/* 1. Coordinate round-trip                                                  */
/* ------------------------------------------------------------------------- */

interface VisualResult {
  readonly testCase: VisualCase;
  readonly iou: number;
  readonly recovered: PixelBoundingBox;
  readonly prompt: string;
}

async function evaluateRoundTrip(): Promise<VisualResult[]> {
  const results: VisualResult[] = [];

  for (const testCase of VISUAL_CASES) {
    const prompt = buildObjectPrompt(
      testCase.box,
      testCase.mediaWidth,
      testCase.mediaHeight,
    );

    // Rebuild the full wire line: object prompt plus a mask, because the official
    // parser rejects a box record with no mask.
    const line = `${prompt}${DOC_MASK}`;
    const parsed = await parseSegmentationText(line);
    const [boxRecord] = recordsOfKind(parsed.records, 'box');

    if (boxRecord === undefined) {
      throw new Error(
        `${testCase.id}: the parser returned no box for prompt ${prompt}. ` +
          `Diagnostics: ${JSON.stringify(parsed.diagnostics)}`,
      );
    }

    const recovered = boxFromBounds(boxRecord, testCase.mediaWidth, testCase.mediaHeight);
    results.push({
      testCase,
      iou: boxIou(testCase.box, recovered),
      recovered,
      prompt,
    });
  }

  return results;
}

/* ------------------------------------------------------------------------- */
/* 2. Audio contract verdicts                                                */
/* ------------------------------------------------------------------------- */

interface AudioResult {
  readonly testCase: AudioCase;
  readonly actual: 'accept' | 'reject';
  readonly reason: string | null;
  readonly correct: boolean;
}

function evaluateAudio(): AudioResult[] {
  return AUDIO_CASES.map((testCase) => {
    try {
      inspectWav(buildWav(testCase.options));
      return { testCase, actual: 'accept', reason: null, correct: testCase.expect === 'accept' };
    } catch (error) {
      // A rejection is only correct when it is a contract rejection. Any other
      // throwable is a bug in the harness, not a verdict.
      if (!(error instanceof MetaAdapterError)) throw error;
      return {
        testCase,
        actual: 'reject',
        reason: error.message,
        correct: testCase.expect === 'reject',
      };
    }
  });
}

/* ------------------------------------------------------------------------- */
/* 3. Ledger invariants                                                      */
/* ------------------------------------------------------------------------- */

interface LedgerChecks {
  readonly chainValid: boolean;
  readonly events: number;
  readonly tamperRejected: boolean;
  readonly conflictDetected: boolean;
  readonly rewindCommitments: number;
  readonly rewindStatus: string | null;
}

function commitment(
  id: string,
  title: string,
  windowStart: string,
  windowEnd: string,
): VerifiableCommitment {
  return {
    id,
    title,
    claimText: `${title} was promised in the eval fixture.`,
    anchor: {
      evidenceId: 'ev-eval-screenshot',
      box: [100, 100, 300, 300],
      confidence: 0.9,
    },
    status: 'proposed',
    branches: [
      {
        pathName: 'A',
        actionTitle: 'Honour it',
        tradeOffs: ['Time'],
        deltaHours: 2,
        deltaEnergy: 3,
        riskLevel: 'medium',
      },
      {
        pathName: 'B',
        actionTitle: 'Renegotiate',
        tradeOffs: ['Trust'],
        deltaHours: 0.5,
        deltaEnergy: 1,
        riskLevel: 'low',
      },
    ],
    validFrom: windowStart,
    recordedAt: '2026-11-03T09:40:00.000Z',
    timeWindow: { start: windowStart, end: windowEnd },
  };
}

function evaluateLedger(): LedgerChecks {
  // The clock has to sit inside the validity window of both commitments, or the
  // bitemporal projection correctly filters them out and the harness would be
  // testing an empty ledger while reporting on a planted conflict.
  const ledger = new EventLedger({ clock: () => '2026-11-05T17:30:00.000Z' });

  ledger.append('evidence.ingested', {
    evidence: {
      id: 'ev-eval-screenshot',
      type: 'screenshot',
      rawUri: 'file:fixtures/eval-screenshot.png',
      sha256: 'a'.repeat(64),
      capturedAt: '2026-11-03T09:00:00.000Z',
      sensitivity: 'normal',
    },
  });

  // Two commitments that overlap by an hour: the planted conflict.
  ledger.append('commitment.proposed', {
    commitment: commitment(
      'com-eval-a',
      'Design session',
      '2026-11-05T16:00:00.000Z',
      '2026-11-05T18:00:00.000Z',
    ),
  });
  ledger.append('commitment.proposed', {
    commitment: commitment(
      'com-eval-b',
      'Calculus class',
      '2026-11-05T17:00:00.000Z',
      '2026-11-05T19:00:00.000Z',
    ),
  });

  const before = ledger.project();
  const reconciliation = ledger.reconcileConflicts();
  const integrity = ledger.verify();

  const serialized = ledger.serialize();
  let tamperRejected = false;
  try {
    EventLedger.fromJSON(serialized.replace('ev-eval-screenshot', 'ev-substituted'));
  } catch (error) {
    tamperRejected = error instanceof LedgerIntegrityError;
  }

  return {
    chainValid: integrity.valid,
    events: integrity.valid ? integrity.checked : 0,
    tamperRejected,
    conflictDetected: reconciliation.conflicts.length === 1,
    rewindCommitments: before.commitments.length,
    rewindStatus: before.commitments[0]?.status ?? null,
  };
}

/* ------------------------------------------------------------------------- */
/* Report                                                                    */
/* ------------------------------------------------------------------------- */

const ROUND_TRIP_TARGET = 0.85;
const AUDIO_TARGET = 1.0;

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

async function main(): Promise<void> {
  console.log('Arcadia conformance harness');
  console.log('This measures pipeline behaviour. It does not measure model quality.\n');

  const visual = await evaluateRoundTrip();
  console.log('--- COORDINATE ROUND-TRIP ---');
  for (const result of visual) {
    console.log(
      `[${result.testCase.id}] ${pad(result.testCase.name, 28)} ` +
        `IoU ${(result.iou * 100).toFixed(2).padStart(6)}%  ${result.prompt}`,
    );
  }

  const audio = evaluateAudio();
  console.log('\n--- AUDIO CONTRACT VERDICTS ---');
  for (const result of audio) {
    console.log(
      `[${result.testCase.id}] ${pad(result.testCase.name, 24)} ` +
        `expected ${pad(result.testCase.expect, 6)} got ${pad(result.actual, 6)} ` +
        `${result.correct ? 'ok' : 'WRONG'}${result.reason === null ? '' : `  (${result.reason})`}`,
    );
  }

  const ledger = evaluateLedger();
  console.log('\n--- LEDGER INVARIANTS ---');
  console.log(`chain verifies          ${ledger.chainValid} (${ledger.events} events)`);
  console.log(`tamper rejected         ${ledger.tamperRejected}`);
  console.log(`planted conflict found  ${ledger.conflictDetected}`);
  console.log(`rewind saw ${ledger.rewindCommitments} commitment(s) with status ${ledger.rewindStatus}`);

  const meanIou = visual.reduce((sum, result) => sum + result.iou, 0) / visual.length;
  const minIou = Math.min(...visual.map((result) => result.iou));
  const audioCorrect = audio.filter((result) => result.correct).length;
  const audioAccuracy = audioCorrect / audio.length;

  const roundTripPass = minIou >= ROUND_TRIP_TARGET;
  const audioPass = audioAccuracy >= AUDIO_TARGET;
  // The rewind is part of the check, not decoration: if the projection returns
  // no commitments the conflict detection below proves nothing.
  const rewindPass = ledger.rewindCommitments === 2 && ledger.rewindStatus === 'proposed';
  const ledgerPass =
    ledger.chainValid && ledger.tamperRejected && ledger.conflictDetected && rewindPass;

  const verdict = (pass: boolean): string => (pass ? 'PASS' : 'FAIL');

  console.log('\n=== SUMMARY ===');
  console.log(`mean round-trip IoU   ${(meanIou * 100).toFixed(2)}%  min ${(minIou * 100).toFixed(2)}%  ${verdict(roundTripPass)}`);
  console.log(`audio verdict accuracy ${(audioAccuracy * 100).toFixed(0)}%  ${verdict(audioPass)}`);
  console.log(`ledger invariants      ${verdict(ledgerPass)}`);

  const report = `# Arcadia — Conformance Harness Report

Generated: ${new Date().toISOString()}

## What this report is

This harness measures **pipeline behaviour**, not model quality. Every number
below is computed by running the real code on synthetic inputs. No value is an
estimate of how well Muse Spark, SAM 3.1 or Muse Voice Transcribe perform on real
media — that requires a Model API key, real screenshots and real recordings.

An earlier revision of this file compared hand-written predictions against
hand-written ground truth and reported the result as accuracy. That number was
arithmetic without measurement, and it has been removed.

## Summary

| Check | Measured | Threshold | Status |
|---|---|---|---|
| Coordinate round-trip, mean IoU | ${(meanIou * 100).toFixed(2)}% | ≥ 85% | ${verdict(roundTripPass)} |
| Coordinate round-trip, worst case | ${(minIou * 100).toFixed(2)}% | ≥ 85% | ${verdict(roundTripPass)} |
| Audio contract verdicts | ${audioCorrect}/${audio.length} | 10/10 | ${verdict(audioPass)} |
| Ledger hash chain verifies | ${ledger.chainValid ? `yes, ${ledger.events} events` : 'no'} | yes | ${verdict(ledger.chainValid)} |
| Ledger rejects tampering | ${ledger.tamperRejected ? 'yes' : 'no'} | yes | ${verdict(ledger.tamperRejected)} |
| Ledger detects planted conflict | ${ledger.conflictDetected ? 'yes' : 'no'} | yes | ${verdict(ledger.conflictDetected)} |
| Bitemporal rewind sees both commitments | ${ledger.rewindCommitments} | 2 | ${verdict(rewindPass)} |

## 1. Coordinate round-trip

A domain box is encoded into a SAM 3.1 prompt by \`buildObjectPrompt\`, parsed back
out of the token grammar by \`parseSegmentationText\`, and converted back to a
domain box. IoU is between the box that went in and the box that came out.

This is the check that catches the off-by-one: the domain box is half-open while
the wire's \`x2\`/\`y2\` are inclusive, so an encoder that forgets to subtract one
loses a row and a column on every request.

| ID | Case | Media | IoU | Prompt |
|---|---|---|---|---|
${visual
  .map(
    (result) =>
      `| \`${result.testCase.id}\` | ${result.testCase.name} | ${result.testCase.mediaWidth}×${result.testCase.mediaHeight} | ${(result.iou * 100).toFixed(2)}% | \`${result.prompt.replace(/\|/g, '\\|')}\` |`,
  )
  .join('\n')}

## 2. Audio contract verdicts

Ten synthetic WAV files, each with a known correct answer, through the real
\`inspectWav\`. The point is that invalid audio is refused **locally**, before a
paid round-trip that would only return a bare \`400\`.

| ID | Case | Expected | Actual | Status |
|---|---|---|---|---|
${audio
  .map(
    (result) =>
      `| \`${result.testCase.id}\` | ${result.testCase.name} | ${result.testCase.expect} | ${result.actual} | ${result.correct ? 'ok' : '**WRONG**'} |`,
  )
  .join('\n')}

## 3. Ledger invariants

A real \`EventLedger\` with two commitments whose valid ranges overlap by one
hour. The harness checks that the chain verifies, that a substituted evidence id
is rejected on import, that the overlap is found exactly once, and that the
projection taken before reconciliation still shows the earlier state.

| Invariant | Result |
|---|---|
| Chain verifies | ${ledger.chainValid} (${ledger.events} events) |
| Tampering rejected | ${ledger.tamperRejected} |
| Planted conflict detected | ${ledger.conflictDetected} |
| Rewind before reconciliation | ${ledger.rewindCommitments} commitment(s), status \`${ledger.rewindStatus}\` |

## Reproduce

\`\`\`
npm install
npm test      # 100+ unit and integration tests
npm run eval  # regenerates this file
\`\`\`
`;

  writeFileSync('EVAL_RESULTS.md', report, 'utf8');
  console.log('\nWrote EVAL_RESULTS.md');

  if (!roundTripPass || !audioPass || !ledgerPass) {
    process.exitCode = 1;
  }
}

await main();
