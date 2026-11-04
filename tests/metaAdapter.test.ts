/**
 * Adapter tests.
 *
 * Two classes of assertion live here:
 *
 *  1. Wire contracts — the exact token grammar SAM 3.1 expects, the exact
 *     container ASR accepts, the exact byte offsets of a PNG/JPEG header.
 *     These are the things that break silently and cost money per attempt.
 *  2. Failure policy — the adapter must refuse, never substitute. A mock
 *     fallback on API error would make the demo dishonest.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASR_LIMITS,
  buildObjectPrompt,
  inspectWav,
  MetaAdapter,
  MetaAdapterError,
  MODEL,
  PrivacyViolationError,
  readImageSize,
} from '../src/services/metaAdapter.ts';
import { boxFromBounds, parseSegmentationText } from '../src/services/samParser.ts';
import { recordsOfKind } from '@meta-sam/parser';
import {
  MOCK_CLASS_DRAFT,
  MOCK_DILEMMA_DRAFT,
  MOCK_EVIDENCE_SCREENSHOT,
  MOCK_REFINED_BOX,
} from '../src/services/fixtures.ts';

/* ------------------------------------------------------------------------- */
/* Synthetic media                                                           */
/* ------------------------------------------------------------------------- */

/** Minimal PNG: signature + IHDR, enough for the header reader. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false); // IHDR payload length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

/** Minimal JPEG: SOI + APP0 + SOF0, enough for the marker walker. */
function jpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array<number>(14).fill(0)];
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11, // length
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03, // components
    ...new Array<number>(9).fill(0),
  ];

  const bytes = new Uint8Array(2 + app0.length + sof0.length);
  bytes.set([0xff, 0xd8], 0);
  bytes.set(app0, 2);
  bytes.set(sof0, 2 + app0.length);
  return bytes;
}

interface WavOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  durationMs?: number;
  /**
   * When false the header declares `durationMs` but no samples are written.
   * `inspectWav` derives duration from the header, which is exactly the
   * contract the endpoint uses, so this keeps the long-audio test cheap.
   */
  allocateData?: boolean;
}

function wav(options: WavOptions = {}): Uint8Array {
  const sampleRate = options.sampleRate ?? 24_000;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const durationMs = options.durationMs ?? 1_000;
  const allocateData = options.allocateData ?? true;

  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const dataSize = Math.round((byteRate * durationMs) / 1_000);

  const buffer = new ArrayBuffer(44 + (allocateData ? dataSize : 0));
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const tag = (offset: number, value: string): void => {
    for (let index = 0; index < 4; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };

  tag(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  tag(8, 'WAVE');

  tag(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);

  tag(36, 'data');
  view.setUint32(40, dataSize, true);

  return bytes;
}

/* ------------------------------------------------------------------------- */
/* Mock mode                                                                 */
/* ------------------------------------------------------------------------- */

test('mock: an adapter with no key defaults to mock and says so', () => {
  const adapter = new MetaAdapter();
  assert.equal(adapter.isMock, true);
});

test('mock: transcription returns turn-level timestamps, never word-level', async () => {
  const adapter = new MetaAdapter({ mock: true, mockLatencyMs: 0 });
  const result = await adapter.transcribeAudio(wav());

  assert.equal(result.turns.length, 3);
  assert.equal(result.audioDurationMs, 11_200);
  assert.equal(result.receipt.mock, true);
  assert.equal(result.receipt.model, MODEL.asr);

  for (const turn of result.turns) {
    assert.ok(turn.endMs > turn.startMs);
    // The transcript is the evidence; the turn bounds are what we can prove.
    assert.ok(turn.text.length > 0);
  }

  assert.match(result.fullText, /clase de cálculo/);
});

test('mock: segmentation refines the proposed box to a mask', async () => {
  const adapter = new MetaAdapter({ mock: true });
  const result = await adapter.segmentRegion(png(720, 1280), MOCK_REFINED_BOX);

  assert.equal(result.matched, true);
  if (!result.matched) return;

  assert.deepEqual(result.box, MOCK_REFINED_BOX);
  assert.equal(result.maskEncoding, 'one_bit');
  assert.ok(result.confidence > 0.9);
  assert.equal(result.receipt.model, MODEL.sam);
});

test('mock: Spark returns a different draft for a screenshot than for audio', async () => {
  const adapter = new MetaAdapter({ mock: true });

  const fromImage = await adapter.extractCausalCommitment('message text', {
    evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
    kind: 'screenshot',
    capturedAt: MOCK_EVIDENCE_SCREENSHOT.capturedAt,
  });

  const fromAudio = await adapter.extractCausalCommitment('transcript', {
    evidenceId: 'ev-voice-dilemma',
    kind: 'audio',
    capturedAt: '2026-11-03T21:14:00-03:00',
  });

  assert.equal(fromImage.draft.title, MOCK_DILEMMA_DRAFT.title);
  assert.ok(fromImage.proposedBox !== null, 'a screenshot claim has a pixel anchor');

  assert.equal(fromAudio.draft.title, MOCK_CLASS_DRAFT.title);
  assert.equal(fromAudio.proposedBox, null, 'an audio claim is anchored to a turn, not a box');

  assert.equal(fromImage.receipt.model, MODEL.spark);
  assert.equal(fromImage.receipt.mock, true);
});

/* ------------------------------------------------------------------------- */
/* Failure policy                                                            */
/* ------------------------------------------------------------------------- */

test('policy: a live adapter with no key refuses to exist', () => {
  assert.throws(
    () => new MetaAdapter({ mock: false }),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'missing_api_key',
  );
});

test('policy: local-only evidence never reaches the network', async () => {
  let calls = 0;
  const adapter = new MetaAdapter({
    mock: false,
    apiKey: 'test-key',
    fetchImpl: () => {
      calls += 1;
      return Promise.resolve(new Response('{}', { status: 200 }));
    },
  });

  await assert.rejects(
    () =>
      adapter.transcribeAudio(wav(), {
        sensitivity: 'local-only',
        evidenceId: 'ev-private-note',
      }),
    (error: unknown) => {
      assert.ok(error instanceof PrivacyViolationError);
      assert.equal(error.evidenceId, 'ev-private-note');
      return true;
    },
  );

  assert.equal(calls, 0, 'the gate must fire before any fetch');
});

test('policy: mock mode may read local-only fixtures because nothing leaves the process', async () => {
  const adapter = new MetaAdapter({ mock: true });
  const result = await adapter.transcribeAudio(wav(), { sensitivity: 'local-only' });
  assert.equal(result.turns.length, 3);
});

test('policy: an API error surfaces as an error, never as fixture data', async () => {
  const adapter = new MetaAdapter({
    mock: false,
    apiKey: 'test-key',
    retries: 0,
    fetchImpl: () =>
      Promise.resolve(new Response('{"error":{"message":"upstream exploded"}}', { status: 500 })),
  });

  await assert.rejects(
    () => adapter.transcribeAudio(wav()),
    (error: unknown) =>
      error instanceof MetaAdapterError &&
      error.code === 'http_error' &&
      error.status === 500 &&
      error.retryable === true,
  );
});

test('policy: 429 is classified as rate_limited so callers can back off', async () => {
  const adapter = new MetaAdapter({
    mock: false,
    apiKey: 'test-key',
    retries: 0,
    fetchImpl: () => Promise.resolve(new Response('slow down', { status: 429 })),
  });

  await assert.rejects(
    () => adapter.transcribeAudio(wav()),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'rate_limited',
  );
});

/* ------------------------------------------------------------------------- */
/* SAM 3.1 prompt grammar                                                    */
/* ------------------------------------------------------------------------- */

/**
 * A real lossless mask token, lifted from the Meta docs example. The official
 * parser rejects a box token that has no mask (`malformed_record`), so any
 * fixture that needs a box record must carry one.
 */
const DOC_MASK =
  "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>";

test('sam: the box prompt uses the documented token grammar in media pixels', () => {
  const prompt = buildObjectPrompt([100, 200, 300, 400], 1000, 1000);
  // The domain box is half-open (xmax 400 excludes 400), while the wire's x2 is
  // inclusive. The official builder writes right - 1, so 399 is correct and 400
  // would have asked SAM to segment a pixel that belongs to the next region.
  assert.equal(prompt, '<0f>1<|box;x1=200;y1=100;x2=399;y2=299;w=1000;h=1000|>');
});

test('sam: a box that fills the media stops at the last pixel, never past it', () => {
  const prompt = buildObjectPrompt([0, 0, 1000, 1000], 720, 1280);
  assert.equal(prompt, '<0f>1<|box;x1=0;y1=0;x2=719;y2=1279;w=720;h=1280|>');
});

test('sam: a degenerate box still yields at least one pixel of area', () => {
  const prompt = buildObjectPrompt([500, 500, 500, 500], 100, 100);
  // ymin == ymax would be a zero-area location; the builder widens it to one
  // pixel before handing it to the official encoder, which rejects empty boxes.
  assert.equal(prompt, '<0f>1<|box;x1=50;y1=50;x2=50;y2=50;w=100;h=100|>');
});

test('sam: the parsed box converts media pixels back into normalized space', async () => {
  // A box token alone is `malformed_record` in the official parser: the mask is
  // what makes the object complete. So every fixture below carries a real one.
  const text = `<0f>0<|box;x1=10;y1=20;x2=30;y2=40;c=0.95;w=100;h=200|>${DOC_MASK}`;
  const result = await parseSegmentationText(text);
  const [record] = recordsOfKind(result.records, 'box');

  assert.ok(record !== undefined);
  assert.equal(record.objectId, '0');
  assert.equal(record.confidence, 0.95);

  // Wire corners are inclusive, the parsed box is half-open: right = 30 + 1.
  assert.equal(record.right, 31);
  assert.equal(record.bottom, 41);
  assert.deepEqual(boxFromBounds(record, 100, 200), [100, 100, 205, 310]);
});

test('sam: an absent confidence stays undefined instead of being invented', async () => {
  const text = `<0f>0<|box;x1=1;y1=1;x2=2;y2=2;w=100;h=200|>${DOC_MASK}`;
  const result = await parseSegmentationText(text);
  const [record] = recordsOfKind(result.records, 'box');

  assert.ok(record !== undefined);
  assert.equal(record.confidence, undefined, 'absence is not zero');
});

test('sam: prose becomes a text record, never a box', async () => {
  const result = await parseSegmentationText('I could not find that object.');

  assert.equal(recordsOfKind(result.records, 'box').length, 0);
  assert.equal(recordsOfKind(result.records, 'mask').length, 0);

  // The prose is preserved rather than discarded: a refusal from the model is
  // evidence too, and the UI shows it instead of an empty canvas.
  const [text] = recordsOfKind(result.records, 'text');
  assert.ok(text !== undefined);
  assert.match(text.text, /could not find/);
});

/* ------------------------------------------------------------------------- */
/* Image headers                                                             */
/* ------------------------------------------------------------------------- */

test('image: PNG dimensions are read from the IHDR chunk', () => {
  assert.deepEqual(readImageSize(png(720, 1280)), {
    width: 720,
    height: 1280,
    mime: 'image/png',
  });
});

test('image: JPEG dimensions are read from the start-of-frame marker', () => {
  assert.deepEqual(readImageSize(jpeg(1080, 1920)), {
    width: 1080,
    height: 1920,
    mime: 'image/jpeg',
  });
});

test('image: an unsupported container fails loudly', () => {
  assert.throws(
    () => readImageSize(new Uint8Array([1, 2, 3, 4, 5])),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'unsupported_media',
  );
});

/* ------------------------------------------------------------------------- */
/* ASR container contract                                                    */
/* ------------------------------------------------------------------------- */

test('wav: a canonical mono 24 kHz 16-bit file is accepted', () => {
  const info = inspectWav(wav());
  assert.equal(info.sampleRate, 24_000);
  assert.equal(info.channels, 1);
  assert.equal(info.bitsPerSample, 16);
  assert.equal(info.durationMs, 1_000);
});

test('wav: 16 kHz is also accepted, since the endpoint allows both rates', () => {
  const info = inspectWav(wav({ sampleRate: 16_000, durationMs: 2_500 }));
  assert.equal(info.sampleRate, 16_000);
  assert.equal(info.durationMs, 2_500);
});

test('wav: stereo is rejected before spending a request', () => {
  assert.throws(
    () => inspectWav(wav({ channels: 2 })),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_audio',
  );
});

test('wav: 44.1 kHz is rejected, the endpoint only accepts 16k and 24k', () => {
  assert.throws(
    () => inspectWav(wav({ sampleRate: 44_100 })),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_audio',
  );
});

test('wav: 8-bit audio is rejected, PCM must be 16-bit', () => {
  assert.throws(
    () => inspectWav(wav({ bitsPerSample: 8 })),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_audio',
  );
});

test('wav: a non-RIFF container is rejected with the ffmpeg recipe in the message', () => {
  assert.throws(
    () => inspectWav(new Uint8Array(64)),
    (error: unknown) =>
      error instanceof MetaAdapterError &&
      error.code === 'invalid_audio' &&
      error.message.includes('ffmpeg'),
  );
});

test('wav: audio beyond the 10 minute cap is rejected locally', () => {
  const tooLong = wav({ sampleRate: 16_000, durationMs: 11 * 60 * 1_000, allocateData: false });

  assert.throws(
    () => inspectWav(tooLong),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'audio_too_long',
  );
});

test('wav: the published limits are the ones enforced', () => {
  assert.deepEqual([...ASR_LIMITS.sampleRates], [16_000, 24_000]);
  assert.equal(ASR_LIMITS.channels, 1);
  assert.equal(ASR_LIMITS.bitsPerSample, 16);
  assert.equal(ASR_LIMITS.maxBytes, 32 * 1024 * 1024);
  assert.equal(ASR_LIMITS.maxDurationMs, 600_000);
});
