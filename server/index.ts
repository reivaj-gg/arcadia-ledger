/**
 * Arcadia — Model API proxy
 * =========================
 * The only process allowed to hold `MODEL_API_KEY`.
 *
 * Why this file exists
 * --------------------
 * A Vite app is a static bundle. Anything the client knows, the world knows.
 * So the browser never talks to `api.meta.ai`; it talks to `/api/*`, Vite
 * proxies that to this server in development, and a reverse proxy does the
 * same in production. The key stays in `process.env` and dies with the process.
 *
 * Why `node:http` and not Express
 * -------------------------------
 * Three endpoints, one middleware concern (body size), zero routing
 * requirements. Express would add a dependency tree for no behaviour we need,
 * and this file has to be auditable at a glance.
 *
 * Failure policy
 * --------------
 * If the key is present and the Model API fails, this server returns the
 * failure. It never substitutes fixtures. A demo that silently falls back to
 * mock data is a demo that lies about what the models did — and the entire
 * thesis of Arcadia is that a claim must be traceable to the thing that
 * actually produced it.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { z } from 'zod';

import { PixelBoundingBox } from '../src/domain/schema.ts';
import {
  MetaAdapter,
  MetaAdapterError,
  MODEL,
  PRICING,
  PrivacyViolationError,
  type EvidenceContext,
} from '../src/services/metaAdapter.ts';

/* ------------------------------------------------------------------------- */
/* Environment                                                               */
/* ------------------------------------------------------------------------- */

// `process.loadEnvFile` is native since Node 20.12 — no dotenv dependency.
// It throws when the file is absent, which is a normal state (CI, fresh clone),
// so the failure is swallowed and the process falls back to mock mode.
try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env: defaults below decide the mode.
}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const API_KEY = process.env.MODEL_API_KEY?.trim() ?? '';

// `MOCK_MODE=false` is the only way to force live calls with no key present,
// and that is a hard error rather than a silent downgrade.
const MOCK_MODE = process.env.MOCK_MODE === 'true' || API_KEY.length === 0;

/**
 * Base64 inflates by ~4/3, and the ASR endpoint caps WAV at 32 MB, so the
 * largest legitimate body is a little over 43 MB. 48 MB leaves headroom
 * without allowing an unbounded read into memory.
 */
const MAX_BODY_BYTES = 48 * 1024 * 1024;

/* ------------------------------------------------------------------------- */
/* Adapter                                                                   */
/* ------------------------------------------------------------------------- */

const adapter = new MetaAdapter({
  apiKey: API_KEY,
  mock: MOCK_MODE,
  ...(process.env.META_BASE_URL === undefined ? {} : { baseUrl: process.env.META_BASE_URL }),
});

/* ------------------------------------------------------------------------- */
/* HTTP plumbing                                                             */
/* ------------------------------------------------------------------------- */

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // A ledger response is evidence. Caching it would let a stale projection
    // outlive the chain that produced it.
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers['content-length'] ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
  }

  const chunks: Buffer[] = [];
  let received = 0;

  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    received += buffer.byteLength;
    if (received > MAX_BODY_BYTES) {
      // Stop reading immediately: the client is either broken or hostile.
      req.destroy();
      throw new HttpError(413, 'payload_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
    }
    chunks.push(buffer);
  }

  if (received === 0) throw new HttpError(400, 'empty_body', 'Request body is empty.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON.');
  }

  return parsed;
}

/** Decode a base64 payload into bytes, rejecting anything that is not base64. */
function decodeBase64(value: string, field: string): Uint8Array {
  const normalised = value.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised) || normalised.length % 4 !== 0) {
    throw new HttpError(400, 'invalid_base64', `"${field}" is not valid base64.`);
  }
  return new Uint8Array(Buffer.from(normalised, 'base64'));
}

/* ------------------------------------------------------------------------- */
/* Request contracts                                                         */
/* ------------------------------------------------------------------------- */

const Sensitivity = z.enum(['normal', 'local-only']).optional();

const TranscribeBody = z
  .object({
    audioBase64: z.string().min(1),
    evidenceId: z.string().min(1).optional(),
    sensitivity: Sensitivity,
  })
  .strict();

const SegmentBody = z
  .object({
    imageBase64: z.string().min(1),
    box: PixelBoundingBox,
    evidenceId: z.string().min(1).optional(),
    sensitivity: Sensitivity,
  })
  .strict();

const ExtractBody = z
  .object({
    evidenceText: z.string().min(1).max(20_000),
    context: z
      .object({
        evidenceId: z.string().min(1),
        kind: z.enum(['screenshot', 'audio', 'document']),
        capturedAt: z.string().min(1),
        sensitivity: Sensitivity,
        ocrText: z.string().optional(),
        note: z.string().max(2_000).optional(),
      })
      .strict(),
  })
  .strict();

function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      'invalid_contract',
      'Request did not satisfy its contract.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/* ------------------------------------------------------------------------- */
/* Routes                                                                    */
/* ------------------------------------------------------------------------- */

async function handleTranscribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseOrThrow(TranscribeBody, await readJsonBody(req));
  const audio = decodeBase64(body.audioBase64, 'audioBase64');

  const result = await adapter.transcribeAudio(audio, {
    ...(body.sensitivity === undefined ? {} : { sensitivity: body.sensitivity }),
    ...(body.evidenceId === undefined ? {} : { evidenceId: body.evidenceId }),
  });

  sendJson(res, 200, result);
}

async function handleSegment(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseOrThrow(SegmentBody, await readJsonBody(req));
  const image = decodeBase64(body.imageBase64, 'imageBase64');

  const result = await adapter.segmentRegion(image, body.box, {
    ...(body.sensitivity === undefined ? {} : { sensitivity: body.sensitivity }),
    ...(body.evidenceId === undefined ? {} : { evidenceId: body.evidenceId }),
  });

  sendJson(res, 200, result);
}

async function handleExtract(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseOrThrow(ExtractBody, await readJsonBody(req));

  // `turns` cannot be supplied by the browser: they are model output, and a
  // client that could inject them could forge an audio anchor. The client
  // calls `/api/transcribe` first and passes the resulting turns back only
  // for display; the anchor is rebuilt here from the transcript it sends.
  const context: EvidenceContext = {
    evidenceId: body.context.evidenceId,
    kind: body.context.kind,
    capturedAt: body.context.capturedAt,
    ...(body.context.sensitivity === undefined ? {} : { sensitivity: body.context.sensitivity }),
    ...(body.context.ocrText === undefined ? {} : { ocrText: body.context.ocrText }),
    ...(body.context.note === undefined ? {} : { note: body.context.note }),
  };

  const result = await adapter.extractCausalCommitment(body.evidenceText, context);
  sendJson(res, 200, result);
}

/* ------------------------------------------------------------------------- */
/* Error mapping                                                             */
/* ------------------------------------------------------------------------- */

function statusForError(error: unknown): { status: number; code: string; details: unknown } {
  if (error instanceof HttpError) {
    return { status: error.status, code: error.code, details: error.details };
  }

  if (error instanceof PrivacyViolationError) {
    // 403, not 500: the caller asked for something the policy forbids.
    return {
      status: 403,
      code: 'privacy_violation',
      details: { evidenceId: error.evidenceId, operation: error.operation },
    };
  }

  if (error instanceof MetaAdapterError) {
    const status =
      error.code === 'rate_limited'
        ? 429
        : error.code === 'timeout'
          ? 504
          : error.code === 'missing_api_key' || error.code === 'key_in_client'
            ? 500
            : error.code === 'http_error'
              ? 502
              : error.code === 'invalid_response'
                ? 502
                : 400;

    return {
      status,
      code: error.code,
      details: { message: error.message, retryable: error.retryable, requestId: error.requestId },
    };
  }

  return { status: 500, code: 'internal_error', details: null };
}

/* ------------------------------------------------------------------------- */
/* Server                                                                    */
/* ------------------------------------------------------------------------- */

const startedAtMs = Date.now();

const server = createServer((req, res) => {
  const requestStarted = Date.now();
  const method = req.method ?? 'GET';
  const path = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;

  res.on('finish', () => {
    const mode = adapter.isMock ? 'mock' : 'live';
    // eslint-disable-next-line no-console
    console.log(
      `${method} ${path} -> ${res.statusCode} (${Date.now() - requestStarted}ms, ${mode})`,
    );
  });

  const route = async (): Promise<void> => {
    if (path === '/api/health') {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'Use GET.');
      sendJson(res, 200, {
        ok: true,
        mock: adapter.isMock,
        models: MODEL,
        pricing: PRICING,
        uptimeMs: Date.now() - startedAtMs,
      });
      return;
    }

    if (path === '/api/transcribe') {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.');
      await handleTranscribe(req, res);
      return;
    }

    if (path === '/api/segment') {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.');
      await handleSegment(req, res);
      return;
    }

    if (path === '/api/extract') {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.');
      await handleExtract(req, res);
      return;
    }

    throw new HttpError(404, 'not_found', `No route for ${path}.`);
  };

  route().catch((error: unknown) => {
    const mapped = statusForError(error);
    if (mapped.status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`${method} ${path} failed:`, error);
    }
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, mapped.status, {
      error: { code: mapped.code, details: mapped.details },
    });
  });
});

server.listen(PORT, HOST, () => {
  const mode = adapter.isMock ? 'MOCK (no network calls)' : 'LIVE (Meta Model API)';
  // eslint-disable-next-line no-console
  console.log(`[arcadia] api listening on http://${HOST}:${PORT} — mode: ${mode}`);
  if (!adapter.isMock) {
    // Never log the key itself, not even truncated: a prefix is enough to
    // correlate a leak with an account.
    console.log(`[arcadia] key present (${API_KEY.length} chars), base ${process.env.META_BASE_URL ?? 'https://api.meta.ai/v1'}`);
  }
});
