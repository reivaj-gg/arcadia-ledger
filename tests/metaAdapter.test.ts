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
import { readWav } from '../src/services/audioContract.ts';
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
   * When false the header declares `durationMs` but no samples are written,
   * which makes the file truncated rather than long. Used to test exactly that.
   */
  allocateData?: boolean;
  /** WAVE format tag. Defaults to 1 (PCM). */
  formatTag?: number;
  /** Write a 40-byte WAVE_FORMAT_EXTENSIBLE fmt chunk carrying `formatTag` as its sub-format. */
  extensible?: boolean;
  /** Override the declared data size, e.g. 0xFFFFFFFF or a size larger than the file. */
  declaredDataSize?: number;
  /** Insert a LIST chunk between fmt and data, the way most editors do. */
  withListChunk?: boolean;
}

/**
 * Build a WAV byte-for-byte, with enough knobs to reproduce the malformed files
 * that real recorders produce. The header is written by hand rather than by a
 * library because the point of these tests is the header.
 */
function wav(options: WavOptions = {}): Uint8Array {
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
  const listSize = options.withListChunk === true ? 12 : 0;
  const declaredDataSize = options.declaredDataSize ?? computedDataSize;
  const allocatedDataSize = allocateData ? computedDataSize : 0;

  const buffer = new ArrayBuffer(12 + 8 + fmtSize + listSize + 8 + allocatedDataSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const tag = (offset: number, value: string): void => {
    for (let index = 0; index < 4; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };

  tag(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  tag(8, 'WAVE');

  let offset = 12;

  tag(offset, 'fmt ');
  view.setUint32(offset + 4, fmtSize, true);
  const fmt = offset + 8;
  view.setUint16(fmt, extensible ? 0xfffe : formatTag, true);
  view.setUint16(fmt + 2, channels, true);
  view.setUint32(fmt + 4, sampleRate, true);
  view.setUint32(fmt + 8, byteRate, true);
  view.setUint16(fmt + 12, channels * bytesPerSample, true);
  view.setUint16(fmt + 14, bitsPerSample, true);

  if (extensible) {
    view.setUint16(fmt + 16, 22, true); // cbSize
    view.setUint16(fmt + 18, bitsPerSample, true); // valid bits
    view.setUint32(fmt + 20, 0, true); // channel mask
    // SubFormat GUID, whose first two bytes carry the real format tag.
    view.setUint16(fmt + 24, formatTag, true);
    bytes.set(
      [0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71],
      fmt + 26,
    );
  }

  offset += 8 + fmtSize;

  if (listSize > 0) {
    tag(offset, 'LIST');
    view.setUint32(offset + 4, 4, true);
    tag(offset + 8, 'INFO');
    offset += listSize;
  }

  tag(offset, 'data');
  view.setUint32(offset + 4, declaredDataSize, true);

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

test('live: transcription sends a multipart request part and keeps an unlabelled turn', async () => {
  const body = JSON.stringify({
    audioDurationMs: 2_400,
    turns: [
      { speaker: 'B', startMs: 0, endMs: 1_200, transcript: 'I can take the design.' },
      // No speaker label. It must not be attributed to A by default.
      { startMs: 1_200, endMs: 2_400, transcript: 'Send it by Friday.' },
    ],
  });

  let sentForm: FormData | null = null;
  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: (_url, init) => {
      sentForm = init?.body instanceof FormData ? init.body : null;
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    },
  });

  const result = await adapter.transcribeAudio(wav());

  assert.ok(sentForm !== null, 'the ASR request must be multipart/form-data');
  const requestPart = (sentForm as FormData).get('request');
  assert.ok(requestPart instanceof Blob, 'the JSON request part must be a Blob');
  const requestJson = JSON.parse(await (requestPart as Blob).text()) as Record<string, unknown>;
  assert.equal(requestJson.mode, 'DIARIZATION');
  assert.equal(requestJson.audioEncoding, 'WAV');
  assert.equal(requestJson.model, MODEL.asr);
  assert.ok((sentForm as FormData).get('audio') instanceof Blob);

  assert.equal(result.turns.length, 2);
  assert.equal(result.turns[0]?.speaker, 'B');
  assert.equal(result.turns[1]?.speaker, 'unknown', 'absence of a label is not speaker A');
  assert.equal(result.turns[1]?.text, 'Send it by Friday.');
  assert.equal(result.audioDurationMs, 2_400);
});

test('mock: segmentation refines the proposed box to a mask', async () => {
  const adapter = new MetaAdapter({ mock: true });
  const result = await adapter.segmentRegion(png(720, 1280), MOCK_REFINED_BOX);

  assert.equal(result.matched, true);
  if (!result.matched) return;

  assert.deepEqual(result.box, MOCK_REFINED_BOX);
  assert.equal(result.maskEncoding, 'one_bit');
  assert.equal(result.geometry, null, 'the mock has no mask, so it claims no geometry');
  assert.ok(result.confidence !== null && result.confidence > 0.9);
  assert.equal(result.receipt.model, MODEL.sam);
});

test('live: segmentation returns the decoded mask geometry, not just a box', async () => {
  // The documented SAM line, served as a non-streaming Responses body.
  const body = JSON.stringify({
    output_text:
      "<0f>1<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>" +
      DOC_MASK,
  });

  let sentBody = '';
  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: (_url, init) => {
      sentBody = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    },
  });

  const result = await adapter.segmentRegion(png(320, 334), [683, 659, 763, 847]);

  assert.equal(result.matched, true);
  if (!result.matched) return;

  // The prompt must have asked for a half-open box converted to inclusive wire
  // corners: right 847/1000 of 320 px is 271, so x2 is 270, not 271.
  assert.match(sentBody, /"text":"<0f>1<\|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334\|>"/);

  assert.ok(result.geometry !== null, 'a real mask must decode into geometry');
  const geometry = result.geometry;
  assert.equal(geometry.objectId, '1');
  assert.equal(geometry.raster.width, 60);
  assert.equal(geometry.raster.height, 27);
  assert.ok(geometry.raster.coverage > 0.9);
  assert.ok(geometry.contours.length >= 1);
  assert.deepEqual(geometry.box, [683, 659, 763, 847]);

  // The served token has no `c=` field, so the model reported no confidence.
  // It must stay null: 0 would claim a measurement that never happened.
  assert.equal(result.confidence, null);
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
/* Live extraction (Spark structured outputs)                                */
/* ------------------------------------------------------------------------- */

/** A well-formed structured output, with branches emitted out of order. */
const SPARK_PAYLOAD = {
  title: 'Design session for the landing page',
  claimText: 'Mariana asked for the landing page design by Friday at 18:00.',
  branches: [
    {
      pathName: 'B',
      actionTitle: 'Renegotiate the deadline',
      tradeOffs: ['Slower launch'],
      deltaHours: -2,
      deltaEnergy: -1,
      riskLevel: 'medium',
    },
    {
      pathName: 'A',
      actionTitle: 'Deliver on Friday',
      tradeOffs: ['Two late nights'],
      deltaHours: 4,
      deltaEnergy: 5,
      riskLevel: 'high',
    },
  ],
  validFrom: '2026-11-04T12:00:00.000Z',
  timeWindow: { start: '2026-11-04T12:00:00.000Z', end: '2026-11-06T21:00:00.000Z' },
  proposedBox: [100, 200, 300, 400],
  reasoning: 'The message names the deliverable and the deadline in one sentence.',
};

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

test('live: Spark structured output is validated and branches are ordered A then B', async () => {
  let sentBody = '';
  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: (_url, init) => {
      sentBody = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(chatResponse(JSON.stringify(SPARK_PAYLOAD)));
    },
  });

  const result = await adapter.extractCausalCommitment('text', {
    evidenceId: 'ev-live-extract',
    kind: 'screenshot',
    capturedAt: '2026-11-04T11:00:00.000Z',
  });

  // The request must ask for a strict schema, not a free-form JSON object.
  const sent = JSON.parse(sentBody) as {
    response_format?: { type?: string; json_schema?: { strict?: boolean } };
  };
  assert.equal(sent.response_format?.type, 'json_schema');
  assert.equal(sent.response_format?.json_schema?.strict, true);

  assert.deepEqual(
    result.draft.branches.map((branch) => branch.pathName),
    ['A', 'B'],
    'branches are ordered by path, not by the order the model emitted them',
  );
  assert.deepEqual(result.proposedBox, [100, 200, 300, 400]);
  assert.equal(result.receipt.mock, false);
  assert.equal(result.receipt.model, MODEL.spark);
});

test('live: two branches with the same pathName are refused, not silently reordered', async () => {
  const duplicated = {
    ...SPARK_PAYLOAD,
    branches: [
      { ...SPARK_PAYLOAD.branches[0], pathName: 'A' },
      { ...SPARK_PAYLOAD.branches[1], pathName: 'A' },
    ],
  };

  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: () => Promise.resolve(chatResponse(JSON.stringify(duplicated))),
  });

  await assert.rejects(
    () =>
      adapter.extractCausalCommitment('text', {
        evidenceId: 'ev-live-extract',
        kind: 'screenshot',
        capturedAt: '2026-11-04T11:00:00.000Z',
      }),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_response',
  );
});

test('live: a proposed box outside 0..1000 is refused instead of clamped', async () => {
  const outOfRange = { ...SPARK_PAYLOAD, proposedBox: [100, 200, 1200, 400] };

  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: () => Promise.resolve(chatResponse(JSON.stringify(outOfRange))),
  });

  await assert.rejects(
    () =>
      adapter.extractCausalCommitment('text', {
        evidenceId: 'ev-live-extract',
        kind: 'screenshot',
        capturedAt: '2026-11-04T11:00:00.000Z',
      }),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_response',
  );
});

test('live: non-JSON content is an invalid response, never a guess', async () => {
  const adapter = new MetaAdapter({
    apiKey: 'test-key',
    mock: false,
    retries: 0,
    fetchImpl: () => Promise.resolve(chatResponse('Sure! Here is the commitment:')),
  });

  await assert.rejects(
    () =>
      adapter.extractCausalCommitment('text', {
        evidenceId: 'ev-live-extract',
        kind: 'screenshot',
        capturedAt: '2026-11-04T11:00:00.000Z',
      }),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_response',
  );
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
  // A complete 11-minute file: the samples must actually be there, otherwise the
  // file is truncated and that is a different (and more urgent) complaint.
  const tooLong = wav({ sampleRate: 16_000, durationMs: 11 * 60 * 1_000 });

  assert.throws(
    () => inspectWav(tooLong),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'audio_too_long',
  );
});

test('wav: a truncated data chunk is refused instead of transcribed', () => {
  // The header claims 30 seconds; the file carries none. Deriving duration from
  // the declared size would report a file that does not exist.
  const truncated = wav({ sampleRate: 16_000, durationMs: 30_000, allocateData: false });

  assert.throws(
    () => inspectWav(truncated),
    (error: unknown) =>
      error instanceof MetaAdapterError &&
      error.code === 'invalid_audio' &&
      /truncated/.test(error.message),
  );
});

test('wav: a partially truncated file reports the bytes that survived', () => {
  const inspection = readWav(wav({ sampleRate: 16_000, durationMs: 2_000, allocateData: false }));

  assert.equal(inspection.truncated, true);
  assert.equal(inspection.dataBytes, 0);
  assert.equal(inspection.declaredDataBytes, 64_000);
});

test('wav: a 16-bit float file is rejected, since the bit depth alone looks fine', () => {
  // Format tag 3 is IEEE float. It has the same 16-bit container as PCM, which
  // is exactly why a bits-only check would wave it through.
  const float = wav({ formatTag: 3 });

  assert.throws(
    () => inspectWav(float),
    (error: unknown) =>
      error instanceof MetaAdapterError &&
      error.code === 'invalid_audio' &&
      /PCM/.test(error.message),
  );
});

test('wav: WAVE_FORMAT_EXTENSIBLE with a PCM sub-format is accepted', () => {
  // Recorders emit EXTENSIBLE for perfectly ordinary mono 24 kHz audio. Rejecting
  // it would refuse valid evidence for a header detail that does not matter.
  const extensible = wav({ extensible: true, formatTag: 1 });

  const info = inspectWav(extensible);
  assert.equal(info.sampleRate, 24_000);
  assert.equal(info.channels, 1);
  assert.equal(info.bitsPerSample, 16);
});

test('wav: WAVE_FORMAT_EXTENSIBLE with a float sub-format is still rejected', () => {
  const extensibleFloat = wav({ extensible: true, formatTag: 3 });

  assert.throws(
    () => inspectWav(extensibleFloat),
    (error: unknown) => error instanceof MetaAdapterError && error.code === 'invalid_audio',
  );
});

test('wav: a LIST chunk between fmt and data is skipped, not parsed as audio', () => {
  const withList = wav({ withListChunk: true });

  const info = inspectWav(withList);
  assert.equal(info.durationMs, 1_000);
});

test('wav: a streaming 0xFFFFFFFF data size is read as "until end of file"', () => {
  const streaming = wav({ sampleRate: 24_000, durationMs: 1_000, declaredDataSize: 0xffffffff });

  const inspection = readWav(streaming);
  assert.equal(inspection.truncated, false);
  assert.equal(inspection.dataBytes, 48_000);
  assert.equal(inspection.durationMs, 1_000);
});

test('wav: the published limits are the ones enforced', () => {
  assert.deepEqual([...ASR_LIMITS.sampleRates], [16_000, 24_000]);
  assert.equal(ASR_LIMITS.channels, 1);
  assert.equal(ASR_LIMITS.bitsPerSample, 16);
  assert.equal(ASR_LIMITS.maxBytes, 32 * 1024 * 1024);
  assert.equal(ASR_LIMITS.maxDurationMs, 600_000);
});
