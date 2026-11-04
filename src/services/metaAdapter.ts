/**
 * Arcadia — Verifiable Spatial Ledger
 * ===================================
 * Phase 1 / Meta Model API adapter.
 *
 * Why raw `fetch` instead of the OpenAI SDK
 * -----------------------------------------
 * The SDK is the documented happy path, but two surfaces do not map cleanly:
 *
 *   1. SAM 3.1 rides the Responses API with string-valued `metadata`
 *      (`include_confidence: "true"`, `mask_encoding: "one_bit"`) and returns
 *      special-token text, not JSON. The SDK adds nothing and hides the wire.
 *   2. `POST /v1/asr/transcribe` is `multipart/form-data` with a JSON `request`
 *      part plus a raw WAV part. That shape is outside the SDK's typed surface.
 *
 * This adapter is deliberately server-only. A Model API key in a Vite client
 * bundle is a leaked key; the constructor refuses to run in a browser window.
 * `server/index.ts` is the only intended host.
 *
 * Verified API facts this file depends on
 * ---------------------------------------
 *  - Muse Voice Transcribe returns TURN-level timestamps (`startMs`/`endMs`),
 *    not word-level. Audio must be mono 16-bit PCM WAV at 16 kHz or 24 kHz,
 *    <= 10 minutes and <= 32 MB per request.
 *  - SAM 3.1 is prompted through `input_text` using the token grammar
 *    `<0f><id><|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>` with media-pixel
 *    coordinates. It does not read text; it returns geometry.
 *  - Muse Spark reasons about the scene and proposes the box. That is the
 *    documented handshake: Spark interprets, SAM locates.
 *
 * Privacy policy
 * --------------
 * Evidence marked `local-only` never crosses the wire. In mock mode nothing
 * leaves the process, so local-only fixtures still work — which is exactly
 * why the demo can be honest about a private voice note.
 */

import {
  AudioTurn,
  CausalBranch,
  COORD_SPACE_MAX,
  DraftCommitment,
  PixelBoundingBox,
} from '../domain/schema.ts';
import type { EvidenceSensitivity, EvidenceType } from '../domain/schema.ts';

import {
  buildObjectPrompt as buildOfficialObjectPrompt,
  ObjectPromptError,
  recordsOfKind,
} from '@meta-sam/parser';

import {
  MOCK_CLASS_ANCHOR_TURN,
  MOCK_CLASS_DRAFT,
  MOCK_DILEMMA_DRAFT,
  MOCK_REFINED_BOX,
  MOCK_SCREENSHOT_BOX,
  MOCK_SEGMENTATION_CONFIDENCE,
  MOCK_TRANSCRIPTION_TURNS,
} from './fixtures.ts';
import {
  boxFromBounds,
  decodeMaskGeometry,
  parseSegmentationText,
  type MaskGeometry,
} from './samParser.ts';

/* ------------------------------------------------------------------------- */
/* Constants                                                                 */
/* ------------------------------------------------------------------------- */

export const META_BASE_URL = 'https://api.meta.ai/v1';

export const MODEL = {
  spark: 'muse-spark-1.3',
  sam: 'sam-3.1',
  asr: 'muse-voice-transcribe-1.0',
} as const;

/** Public list pricing, USD. Used to put a real cost on every receipt. */
export const PRICING = {
  sparkInputPerMillionTokens: 1.25,
  sparkOutputPerMillionTokens: 4.25,
  samPerImage: 0.0025,
  asrPerHour: 0.18,
} as const;

/** Hard API limits, enforced locally so we fail before spending a request. */
export const ASR_LIMITS = {
  maxBytes: 32 * 1024 * 1024,
  maxDurationMs: 10 * 60 * 1000,
  sampleRates: [16_000, 24_000] as const,
  channels: 1,
  bitsPerSample: 16,
} as const;

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

export type MetaAdapterErrorCode =
  | 'missing_api_key'
  | 'key_in_client'
  | 'http_error'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_response'
  | 'unsupported_media'
  | 'payload_too_large'
  | 'audio_too_long'
  | 'invalid_audio';

export class MetaAdapterError extends Error {
  readonly code: MetaAdapterErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    code: MetaAdapterErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'MetaAdapterError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId ?? null;
  }
}

/**
 * Raised when a caller tries to send `local-only` evidence to a remote model.
 *
 * This is a policy failure, not a network failure: the correct behaviour is
 * to refuse, never to retry, and never to silently substitute a fixture.
 */
export class PrivacyViolationError extends Error {
  readonly evidenceId: string;
  readonly operation: string;

  constructor(evidenceId: string, operation: string) {
    super(
      `Evidence "${evidenceId}" is marked local-only and cannot be sent to ${operation}. ` +
        'Process it on-device or ask the user to re-classify it.',
    );
    this.name = 'PrivacyViolationError';
    this.evidenceId = evidenceId;
    this.operation = operation;
  }
}

/* ------------------------------------------------------------------------- */
/* Receipts                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * The cost of producing evidence is itself evidence.
 *
 * Every call returns one of these and the ledger seals it, so a receipt can
 * answer "how was this claim produced, by which model, at what price, when".
 */
export interface ModelCallReceipt {
  model: string;
  operation: 'transcribe' | 'segment' | 'extract';
  startedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  requestId: string | null;
  mock: boolean;
}

/* ------------------------------------------------------------------------- */
/* Public result types                                                       */
/* ------------------------------------------------------------------------- */

export interface TranscriptionResult {
  turns: AudioTurn[];
  /** Concatenated turns. Convenience for prompts; the turns remain the evidence. */
  fullText: string;
  audioDurationMs: number;
  receipt: ModelCallReceipt;
}

export type SegmentationResult =
  | {
      matched: true;
      box: PixelBoundingBox;
      confidence: number;
      maskEncoding: 'one_bit' | 'lossless';
      /**
       * The decoded mask: raster summary plus source-pixel contours. `null` only
       * in mock mode, where no mask exists and inventing one would be a lie.
       */
      geometry: MaskGeometry | null;
      receipt: ModelCallReceipt;
    }
  | {
      matched: false;
      receipt: ModelCallReceipt;
    };

/** Everything Muse Spark is allowed to read about one piece of evidence. */
export interface EvidenceContext {
  evidenceId: string;
  kind: EvidenceType;
  capturedAt: string;
  /** Enforced before any network call. Defaults to `normal` when omitted. */
  sensitivity?: EvidenceSensitivity;
  /** Present when the evidence is audio. */
  turns?: AudioTurn[];
  /** Text Muse Spark read out of the image/document. */
  ocrText?: string;
  /** Free-form note from the user, clearly separated from machine evidence. */
  note?: string;
}

export interface ExtractionResult {
  draft: DraftCommitment;
  /** Where Spark says the claim lives. SAM refines this into a mask. */
  proposedBox: PixelBoundingBox | null;
  reasoning: string;
  receipt: ModelCallReceipt;
}

/* ------------------------------------------------------------------------- */
/* Configuration                                                             */
/* ------------------------------------------------------------------------- */

export interface MetaAdapterConfig {
  apiKey?: string;
  /** When true, no network call is made. Defaults to true if no key is set. */
  mock?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
  retries?: number;
  timeoutMs?: number;
  /** Artificial latency so the mock exercises real loading states. */
  mockLatencyMs?: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_RETRIES = 2;

/* ------------------------------------------------------------------------- */
/* Pure helpers — exported for tests                                         */
/* ------------------------------------------------------------------------- */

export interface ImageSize {
  width: number;
  height: number;
  mime: 'image/png' | 'image/jpeg';
}

/**
 * Read intrinsic dimensions without decoding the image.
 *
 * SAM 3.1 requires `w` and `h` in media pixels, and rejects a prompt whose
 * aspect ratio differs from the media. Decoding a full bitmap just to learn
 * two integers would be wasteful, so we read the header instead.
 */
export function readImageSize(bytes: Uint8Array): ImageSize {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (bytes.length >= 24 && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
      mime: 'image/png',
    };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;

    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = bytes[offset + 1] ?? 0;
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }

      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isStartOfFrame) {
        return {
          height: view.getUint16(offset + 5, false),
          width: view.getUint16(offset + 7, false),
          mime: 'image/jpeg',
        };
      }

      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }

  throw new MetaAdapterError(
    'unsupported_media',
    'Only PNG and JPEG are supported. Convert the image before uploading.',
  );
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

/**
 * Validate the WAV container against the ASR endpoint's contract.
 *
 * The API returns a bare `400` for anything else; catching it here turns a
 * paid round-trip into an immediate, actionable error.
 */
export function inspectWav(bytes: Uint8Array): WavInfo {
  if (bytes.length > ASR_LIMITS.maxBytes) {
    throw new MetaAdapterError(
      'payload_too_large',
      `Audio exceeds 32 MB (${bytes.length} bytes). Split the recording.`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number): string =>
    String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );

  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new MetaAdapterError(
      'invalid_audio',
      'Audio must be a RIFF/WAVE container. Convert with: ffmpeg -i in.m4a -ac 1 -ar 24000 -c:a pcm_s16le out.wav',
    );
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = tag(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (chunkId === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      byteRate = view.getUint32(body + 8, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }

    // Chunks are word-aligned.
    offset = body + chunkSize + (chunkSize % 2);
  }

  if (channels !== ASR_LIMITS.channels) {
    throw new MetaAdapterError('invalid_audio', `Audio must be mono, got ${channels} channels.`);
  }
  if (!(ASR_LIMITS.sampleRates as readonly number[]).includes(sampleRate)) {
    throw new MetaAdapterError(
      'invalid_audio',
      `Audio must be 16 kHz or 24 kHz, got ${sampleRate} Hz.`,
    );
  }
  if (bitsPerSample !== ASR_LIMITS.bitsPerSample) {
    throw new MetaAdapterError(
      'invalid_audio',
      `Audio must be 16-bit PCM, got ${bitsPerSample}-bit.`,
    );
  }
  if (byteRate <= 0) {
    throw new MetaAdapterError('invalid_audio', 'WAV header has an invalid byte rate.');
  }

  const durationMs = Math.round((dataSize / byteRate) * 1000);
  if (durationMs > ASR_LIMITS.maxDurationMs) {
    throw new MetaAdapterError(
      'audio_too_long',
      `Audio is ${Math.round(durationMs / 1000)}s; the endpoint caps at 600s. Split it.`,
    );
  }

  return { sampleRate, channels, bitsPerSample, durationMs };
}

/**
 * Build the SAM 3.1 box prompt in media pixels.
 *
 * The formatting is delegated to `@meta-sam/parser`'s `buildObjectPrompt`
 * instead of being hand-assembled here. The grammar is small but the off-by-one
 * is not: our domain box is half-open, while the wire's `x2`/`y2` are
 * **inclusive**. The official builder takes a half-open box and writes
 * `x2 = right - 1`, which is the conversion we would otherwise get wrong by one
 * pixel on every request.
 *
 * @param box Domain box: `[ymin, xmin, ymax, xmax]`, normalized `0..1000`.
 */
export function buildObjectPrompt(
  box: PixelBoundingBox,
  width: number,
  height: number,
  objectId = 1,
): string {
  if (width <= 0 || height <= 0) {
    throw new MetaAdapterError('unsupported_media', 'Image has no area.');
  }

  const [ymin, xmin, ymax, xmax] = box;

  const toPxX = (value: number): number =>
    Math.min(width, Math.max(0, Math.round((value / COORD_SPACE_MAX) * width)));
  const toPxY = (value: number): number =>
    Math.min(height, Math.max(0, Math.round((value / COORD_SPACE_MAX) * height)));

  const left = Math.min(width - 1, toPxX(xmin));
  const top = Math.min(height - 1, toPxY(ymin));
  // A zero-area box is not a location. Widen to one pixel before the builder
  // sees it, because the builder correctly rejects an empty box.
  const right = Math.min(width, Math.max(left + 1, toPxX(xmax)));
  const bottom = Math.min(height, Math.max(top + 1, toPxY(ymax)));

  try {
    return buildOfficialObjectPrompt({
      size: { width, height },
      objects: [{ id: objectId, prompts: [{ box: { left, top, right, bottom } }] }],
    });
  } catch (error) {
    // The builder rejects non-integers and out-of-media coordinates. Both mean
    // the caller handed us a box that cannot describe this image.
    if (error instanceof ObjectPromptError) {
      throw new MetaAdapterError('unsupported_media', `Cannot encode the box prompt: ${error.message}`);
    }
    throw error;
  }
}

function toBase64(bytes: Uint8Array): string {
  const bufferCtor = (
    globalThis as { Buffer?: { from(input: Uint8Array): { toString(enc: string): string } } }
  ).Buffer;

  if (bufferCtor !== undefined) {
    return bufferCtor.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const btoaFn = (globalThis as { btoa?: (input: string) => string }).btoa;
  if (btoaFn === undefined) {
    throw new MetaAdapterError('invalid_response', 'No base64 encoder available in this runtime.');
  }
  return btoaFn(binary);
}

function extractOutputText(json: unknown): string {
  if (typeof json !== 'object' || json === null) {
    throw new MetaAdapterError('invalid_response', 'Responses API returned a non-object body.');
  }

  const body = json as Record<string, unknown>;
  if (typeof body.output_text === 'string') return body.output_text;

  if (Array.isArray(body.output)) {
    const chunks: string[] = [];
    for (const item of body.output) {
      if (typeof item !== 'object' || item === null) continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (typeof part !== 'object' || part === null) continue;
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string') chunks.push(text);
      }
    }
    return chunks.join('');
  }

  throw new MetaAdapterError('invalid_response', 'Could not locate output text in the response.');
}

function readUsage(json: unknown): { inputTokens: number | null; outputTokens: number | null } {
  if (typeof json !== 'object' || json === null) {
    return { inputTokens: null, outputTokens: null };
  }
  const usage = (json as { usage?: unknown }).usage;
  if (typeof usage !== 'object' || usage === null) {
    return { inputTokens: null, outputTokens: null };
  }
  const record = usage as Record<string, unknown>;
  const input = record.input_tokens ?? record.prompt_tokens;
  const output = record.output_tokens ?? record.completion_tokens;
  return {
    inputTokens: typeof input === 'number' ? input : null,
    outputTokens: typeof output === 'number' ? output : null,
  };
}

/* ------------------------------------------------------------------------- */
/* Muse Spark extraction contract                                            */
/* ------------------------------------------------------------------------- */

/**
 * JSON Schema sent as `response_format.json_schema`.
 *
 * Strict subset rules (verified against the docs): root must be a plain
 * object, every object sets `additionalProperties: false`, `required` lists
 * every property, and `oneOf`/`allOf` are forbidden anywhere. `anyOf` is
 * allowed below the root, which is how we express nullable fields.
 */
const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'claimText',
    'validFrom',
    'timeWindow',
    'branches',
    'proposedBox',
    'reasoning',
  ],
  properties: {
    title: { type: 'string', maxLength: 120 },
    claimText: { type: 'string', maxLength: 2000 },
    validFrom: {
      type: 'string',
      description: 'ISO-8601 datetime with an explicit offset, e.g. 2026-11-05T16:00:00-03:00',
    },
    timeWindow: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['start', 'end'],
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
        { type: 'null' },
      ],
    },
    branches: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'pathName',
          'actionTitle',
          'tradeOffs',
          'deltaHours',
          'deltaEnergy',
          'riskLevel',
        ],
        properties: {
          pathName: { type: 'string', enum: ['A', 'B'] },
          actionTitle: { type: 'string' },
          tradeOffs: { type: 'array', items: { type: 'string' } },
          deltaHours: { type: 'number' },
          deltaEnergy: { type: 'number' },
          riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    proposedBox: {
      anyOf: [
        {
          type: 'array',
          minItems: 4,
          maxItems: 4,
          items: { type: 'integer', minimum: 0, maximum: 1000 },
        },
        { type: 'null' },
      ],
    },
    reasoning: { type: 'string' },
  },
} as const;

const SPARK_SYSTEM_PROMPT = `You are the extraction layer of a verifiable ledger. Your output becomes evidence, not conversation.

Hard rules:
1. Never invent a fact. If the evidence does not state a date, an amount, a deadline or a commitment, do not produce one.
2. Every claim must be traceable to the provided evidence. If the evidence is ambiguous, say so in "reasoning" and keep "claimText" limited to what is literally supported.
3. Produce exactly two causal branches: pathName "A" and pathName "B". They must represent genuinely different actions, not the same action restated.
4. "deltaHours" and "deltaEnergy" are signed estimates relative to the user's current plan. Negative means it costs the user.
5. "proposedBox" must locate the region of the evidence that supports the claim, in the normalized 0..1000 space, as [ymin, xmin, ymax, xmax]. If the evidence is audio, return null: the anchor will be an audio turn instead.
6. "validFrom" is when the commitment starts to be true in the world, with an explicit UTC offset. Never emit a naive timestamp.
7. "timeWindow" is the interval the commitment occupies, if the evidence states one. If no interval is stated, return null. Do not infer an interval from vague language.`;

/* ------------------------------------------------------------------------- */
/* Adapter                                                                   */
/* ------------------------------------------------------------------------- */

export class MetaAdapter {
  private readonly apiKey: string;
  private readonly mock: boolean;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly mockLatencyMs: number;

  constructor(config: MetaAdapterConfig = {}) {
    const isBrowser = typeof (globalThis as { window?: unknown }).window !== 'undefined';

    const hasKey = typeof config.apiKey === 'string' && config.apiKey.trim().length > 0;
    const mock = config.mock ?? !hasKey;

    if (!mock) {
      if (isBrowser) {
        throw new MetaAdapterError(
          'key_in_client',
          'Refusing to construct MetaAdapter with an API key inside a browser context. ' +
            'Proxy through server/index.ts so the key never ships in the bundle.',
        );
      }
      if (!hasKey) {
        throw new MetaAdapterError('missing_api_key', 'MODEL_API_KEY is required when mock is off.');
      }
    }

    this.apiKey = hasKey ? (config.apiKey as string) : '';
    this.mock = mock;
    this.baseUrl = (config.baseUrl ?? META_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.clock = config.clock ?? (() => new Date());
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.mockLatencyMs = config.mockLatencyMs ?? 0;

    if (this.fetchImpl === undefined) {
      throw new MetaAdapterError('invalid_response', 'No fetch implementation available.');
    }
  }

  get isMock(): boolean {
    return this.mock;
  }

  /* ------------------------------------------------------------------ */
  /* 1. Audio -> turns                                                   */
  /* ------------------------------------------------------------------ */

  async transcribeAudio(
    audio: Uint8Array,
    options: { sensitivity?: EvidenceSensitivity; evidenceId?: string } = {},
  ): Promise<TranscriptionResult> {
    const startedAt = this.clock();
    const startMs = Date.now();

    this.assertRemoteAllowed(options.sensitivity, 'Muse Voice Transcribe', options.evidenceId);

    if (this.mock) {
      await this.sleep();
      return {
        turns: MOCK_TRANSCRIPTION_TURNS,
        fullText: MOCK_TRANSCRIPTION_TURNS.map((turn) => turn.text).join(' '),
        audioDurationMs: 11_200,
        receipt: this.mockReceipt('transcribe', MODEL.asr, startedAt, startMs, null),
      };
    }

    // Fail locally, before spending a request, on anything the endpoint rejects.
    const info = inspectWav(audio);

    const form = new FormData();
    const requestPart = {
      mode: 'DIARIZATION',
      model: MODEL.asr,
      audioEncoding: 'WAV',
    };
    form.append(
      'request',
      new Blob([JSON.stringify(requestPart)], { type: 'application/json' }),
      'request.json',
    );
    // Copy into an ArrayBuffer we own. `audio.buffer` is `ArrayBufferLike`,
    // which admits `SharedArrayBuffer`; `BlobPart` does not. The copy is also
    // a cheap correctness win: the body cannot change under us while the
    // request is in flight.
    const audioCopy = new Uint8Array(audio.byteLength);
    audioCopy.set(audio);

    form.append(
      'audio',
      new Blob([audioCopy.buffer], { type: 'audio/wav' }),
      'audio.wav',
    );

    const response = await this.request(`${this.baseUrl}/asr/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    const json: unknown = await response.json();
    const turns = this.toAudioTurns(json, info.durationMs);

    return {
      turns,
      fullText: turns.map((turn) => turn.text).join(' '),
      audioDurationMs: this.readAudioDuration(json, info.durationMs),
      receipt: this.buildReceipt('transcribe', MODEL.asr, startedAt, startMs, json, {
        costUsd: (info.durationMs / 3_600_000) * PRICING.asrPerHour,
        requestId: response.headers.get('x-request-id'),
      }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Image + box -> mask                                              */
  /* ------------------------------------------------------------------ */

  async segmentRegion(
    image: Uint8Array,
    boxPrompt: PixelBoundingBox,
    options: { sensitivity?: EvidenceSensitivity; evidenceId?: string } = {},
  ): Promise<SegmentationResult> {
    const startedAt = this.clock();
    const startMs = Date.now();

    this.assertRemoteAllowed(options.sensitivity, 'SAM 3.1', options.evidenceId);

    if (this.mock) {
      await this.sleep();
      return {
        matched: true,
        box: MOCK_REFINED_BOX,
        confidence: MOCK_SEGMENTATION_CONFIDENCE,
        maskEncoding: 'one_bit',
        // The mock has no real mask, and a fabricated contour would end up in a
        // hash-chained ledger as if it had been observed. Null is the honest
        // value; the UI draws the box instead.
        geometry: null,
        receipt: this.mockReceipt('segment', MODEL.sam, startedAt, startMs, PRICING.samPerImage),
      };
    }

    const size = readImageSize(image);
    const prompt = buildObjectPrompt(boxPrompt, size.width, size.height);
    const dataUrl = `data:${size.mime};base64,${toBase64(image)}`;

    const body = {
      model: MODEL.sam,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      stream: false,
      // Both values are strings by contract, not booleans.
      metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
    };

    const response = await this.request(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json: unknown = await response.json();
    const text = extractOutputText(json);

    // The official parser is the authority on this grammar. It reports
    // malformed tokens as diagnostics instead of throwing, so a partially
    // corrupt line still yields whatever it could parse.
    const parsed = await parseSegmentationText(text);
    const boxes = recordsOfKind(parsed.records, 'box');

    // We prompt with object id 1, so that is the answer we want. If the model
    // echoes a different id but returned exactly one object, that object is
    // unambiguously the one we asked about; with two or more we refuse to guess,
    // because anchoring a claim to the wrong region is worse than no anchor.
    const requested = boxes.find((record) => record.objectId === '1');
    const match = requested ?? (boxes.length === 1 ? boxes[0] : undefined);

    if (match === undefined) {
      // Zero matches is a normal result, not an error: the concept is absent.
      return {
        matched: false,
        receipt: this.buildReceipt('segment', MODEL.sam, startedAt, startMs, json, {
          costUsd: PRICING.samPerImage,
          requestId: response.headers.get('x-request-id'),
        }),
      };
    }

    const maskRecord = recordsOfKind(parsed.records, 'mask').find(
      (record) => record.objectId === match.objectId,
    );

    // A mask we cannot decode must not become a box we pretend was refined. If
    // decoding fails we keep the box and report no geometry, rather than
    // substituting a rectangle for a shape nobody measured.
    let geometry: MaskGeometry | null = null;
    if (maskRecord !== undefined) {
      try {
        geometry = decodeMaskGeometry(maskRecord, {
          mediaWidth: size.width,
          mediaHeight: size.height,
        });
      } catch {
        geometry = null;
      }
    }

    return {
      matched: true,
      box: boxFromBounds(match, size.width, size.height),
      // 0 means "the model did not report one". We never fabricate confidence.
      confidence: match.confidence ?? 0,
      maskEncoding: maskRecord?.mask.encoding ?? 'one_bit',
      geometry,
      receipt: this.buildReceipt('segment', MODEL.sam, startedAt, startMs, json, {
        costUsd: PRICING.samPerImage,
        requestId: response.headers.get('x-request-id'),
      }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Evidence text -> causal commitment                               */
  /* ------------------------------------------------------------------ */

  async extractCausalCommitment(
    evidenceText: string,
    evidenceContext: EvidenceContext,
  ): Promise<ExtractionResult> {
    const startedAt = this.clock();
    const startMs = Date.now();

    this.assertRemoteAllowed(
      evidenceContext.sensitivity,
      'Muse Spark',
      evidenceContext.evidenceId,
    );

    if (this.mock) {
      await this.sleep();
      const isAudio = evidenceContext.kind === 'audio';
      const draft = isAudio ? MOCK_CLASS_DRAFT : MOCK_DILEMMA_DRAFT;
      return {
        draft,
        proposedBox: isAudio ? null : MOCK_SCREENSHOT_BOX,
        reasoning: isAudio
          ? `Turn ${MOCK_CLASS_ANCHOR_TURN.startMs}-${MOCK_CLASS_ANCHOR_TURN.endMs} ms states the class interval explicitly.`
          : 'The message states the deliverable, the amount and the deadline in one utterance.',
        receipt: this.mockReceipt('extract', MODEL.spark, startedAt, startMs, null),
      };
    }

    const userPrompt = [
      'EVIDENCE TEXT (verbatim, do not paraphrase beyond the claim):',
      evidenceText,
      '',
      'EVIDENCE CONTEXT (JSON):',
      JSON.stringify(evidenceContext, null, 2),
      '',
      'Extract one verifiable commitment with exactly two causal branches.',
    ].join('\n');

    const body = {
      model: MODEL.spark,
      messages: [
        { role: 'system', content: SPARK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'CausalCommitment',
          strict: true,
          schema: EXTRACTION_JSON_SCHEMA,
        },
      },
    };

    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json: unknown = await response.json();
    const content = this.readChatContent(json);
    const parsed = this.parseExtraction(content);

    return {
      ...parsed,
      receipt: this.buildReceipt('extract', MODEL.spark, startedAt, startMs, json, {
        costUsd: null,
        requestId: response.headers.get('x-request-id'),
      }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * The privacy gate. Mock mode passes because nothing leaves the process;
   * a real call to a remote model does not.
   */
  private assertRemoteAllowed(
    sensitivity: EvidenceSensitivity | undefined,
    operation: string,
    evidenceId: string | undefined,
  ): void {
    if (sensitivity !== 'local-only' || this.mock) return;
    throw new PrivacyViolationError(evidenceId ?? '<unknown>', operation);
  }

  private async sleep(): Promise<void> {
    if (this.mockLatencyMs <= 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.mockLatencyMs);
    });
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: MetaAdapterError | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });

        if (response.ok) return response;

        const requestId = response.headers.get('x-request-id');
        const retryable = response.status === 429 || response.status >= 500;
        const bodyText = await response.text();

        lastError = new MetaAdapterError(
          response.status === 429 ? 'rate_limited' : 'http_error',
          `Meta Model API ${response.status}: ${bodyText.slice(0, 500)}`,
          { status: response.status, retryable, requestId },
        );

        if (!retryable || attempt === this.retries) throw lastError;

        const retryAfter = Number(response.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(8_000, 500 * 2 ** attempt) + Math.random() * 250;
        await new Promise<void>((resolve) => setTimeout(resolve, backoff));
      } catch (error) {
        if (error instanceof MetaAdapterError) throw error;

        const aborted = error instanceof Error && error.name === 'AbortError';
        lastError = new MetaAdapterError(
          aborted ? 'timeout' : 'http_error',
          aborted ? `Request timed out after ${this.timeoutMs} ms.` : String(error),
          { retryable: aborted },
        );

        if (!aborted || attempt === this.retries) throw lastError;
        await new Promise<void>((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new MetaAdapterError('http_error', 'Request failed with no error recorded.');
  }

  private readChatContent(json: unknown): string {
    if (typeof json !== 'object' || json === null) {
      throw new MetaAdapterError('invalid_response', 'Chat Completions returned a non-object body.');
    }
    const choices = (json as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new MetaAdapterError('invalid_response', 'Response contained no choices.');
    }
    const first = choices[0] as { message?: { content?: unknown } } | undefined;
    const content = first?.message?.content;
    if (typeof content !== 'string') {
      throw new MetaAdapterError('invalid_response', 'Response contained no message content.');
    }
    return content;
  }

  private parseExtraction(content: string): Omit<ExtractionResult, 'receipt'> {
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new MetaAdapterError('invalid_response', 'Structured output was not valid JSON.');
    }

    if (typeof raw !== 'object' || raw === null) {
      throw new MetaAdapterError('invalid_response', 'Structured output was not an object.');
    }

    const record = raw as Record<string, unknown>;
    const branches = record.branches;
    if (!Array.isArray(branches) || branches.length !== 2) {
      throw new MetaAdapterError(
        'invalid_response',
        'Structured output must contain exactly two causal branches.',
      );
    }

    const branchA = CausalBranch.safeParse(branches[0]);
    const branchB = CausalBranch.safeParse(branches[1]);
    if (!branchA.success || !branchB.success) {
      throw new MetaAdapterError('invalid_response', 'A causal branch failed domain validation.');
    }
    if (branchA.data.pathName === branchB.data.pathName) {
      throw new MetaAdapterError(
        'invalid_response',
        'Both causal branches share the same pathName; expected A and B.',
      );
    }

    const ordered: [CausalBranch, CausalBranch] =
      branchA.data.pathName === 'A'
        ? [branchA.data, branchB.data]
        : [branchB.data, branchA.data];

    const proposedBoxRaw = record.proposedBox;
    let proposedBox: PixelBoundingBox | null = null;
    if (proposedBoxRaw !== null && proposedBoxRaw !== undefined) {
      const parsedBox = PixelBoundingBox.safeParse(proposedBoxRaw);
      if (!parsedBox.success) {
        throw new MetaAdapterError(
          'invalid_response',
          'proposedBox did not satisfy the normalized 0..1000 box schema.',
        );
      }
      proposedBox = parsedBox.data;
    }

    const timeWindowRaw = record.timeWindow;
    const draft = DraftCommitment.parse({
      title: record.title,
      claimText: record.claimText,
      branches: ordered,
      validFrom: record.validFrom,
      ...(timeWindowRaw === null || timeWindowRaw === undefined
        ? {}
        : { timeWindow: timeWindowRaw }),
    });

    return {
      draft,
      proposedBox,
      reasoning: typeof record.reasoning === 'string' ? record.reasoning : '',
    };
  }

  private toAudioTurns(json: unknown, fallbackDurationMs: number): AudioTurn[] {
    if (typeof json !== 'object' || json === null) {
      throw new MetaAdapterError('invalid_response', 'ASR returned a non-object body.');
    }

    const record = json as { turns?: unknown; transcript?: unknown };
    const turns = record.turns;

    if (Array.isArray(turns) && turns.length > 0) {
      const parsed: AudioTurn[] = [];
      for (const raw of turns) {
        if (typeof raw !== 'object' || raw === null) continue;
        const turn = raw as Record<string, unknown>;
        const candidate = AudioTurn.safeParse({
          speaker: typeof turn.speaker === 'string' ? turn.speaker : 'A',
          startMs: turn.startMs,
          endMs: turn.endMs,
          text: turn.transcript,
        });
        if (candidate.success) parsed.push(candidate.data);
      }
      if (parsed.length > 0) return parsed;
    }

    // PUSH_TO_TALK returns no turns array. Synthesize a single turn covering
    // the whole file so the anchor still points at real audio.
    if (typeof record.transcript === 'string' && record.transcript.trim().length > 0) {
      return [
        {
          speaker: 'A',
          startMs: 0,
          endMs: Math.max(1, fallbackDurationMs),
          text: record.transcript,
        },
      ];
    }

    throw new MetaAdapterError('invalid_response', 'ASR returned neither turns nor a transcript.');
  }

  private readAudioDuration(json: unknown, fallbackMs: number): number {
    if (typeof json === 'object' && json !== null) {
      const value = (json as { audioDurationMs?: unknown }).audioDurationMs;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return fallbackMs;
  }

  private buildReceipt(
    operation: ModelCallReceipt['operation'],
    model: string,
    startedAt: Date,
    startedAtMs: number,
    json: unknown,
    options: { costUsd: number | null; requestId: string | null },
  ): ModelCallReceipt {
    const { inputTokens, outputTokens } = readUsage(json);

    let costUsd = options.costUsd;
    if (costUsd === null && inputTokens !== null && outputTokens !== null) {
      costUsd =
        (inputTokens / 1_000_000) * PRICING.sparkInputPerMillionTokens +
        (outputTokens / 1_000_000) * PRICING.sparkOutputPerMillionTokens;
    }

    return {
      model,
      operation,
      startedAt: startedAt.toISOString(),
      latencyMs: Date.now() - startedAtMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd === null ? null : Number(costUsd.toFixed(6)),
      requestId: options.requestId,
      mock: false,
    };
  }

  private mockReceipt(
    operation: ModelCallReceipt['operation'],
    model: string,
    startedAt: Date,
    startedAtMs: number,
    costUsd: number | null,
  ): ModelCallReceipt {
    return {
      model,
      operation,
      startedAt: startedAt.toISOString(),
      latencyMs: Date.now() - startedAtMs,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: costUsd === null ? null : Number(costUsd.toFixed(6)),
      requestId: null,
      mock: true,
    };
  }
}
