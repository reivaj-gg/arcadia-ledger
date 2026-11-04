/**
 * Arcadia — server policy
 * =======================
 * Pure decision functions extracted from the HTTP layer.
 *
 * Everything here is side-effect free and therefore testable without opening a
 * socket. `server/index.ts` owns transport; this module owns the rules:
 * which key we read, whether a request may leave the machine, and how a domain
 * error maps onto an HTTP status.
 */

import {
  MetaAdapterError,
  PrivacyViolationError,
} from '../src/services/metaAdapter.ts';
import type { EvidenceSensitivity } from '../src/domain/schema.ts';

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

export class HttpError extends Error {
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

/* ------------------------------------------------------------------------- */
/* Credentials                                                               */
/* ------------------------------------------------------------------------- */

export type EnvLike = Readonly<Record<string, string | undefined>>;

export type ApiKeySource = 'MODEL_API_KEY' | 'META_API_KEY' | 'none';

export interface ResolvedApiKey {
  /** Empty string when no key is configured. Never log this value. */
  readonly key: string;
  readonly source: ApiKeySource;
  /**
   * Non-fatal note for the operator. Today the only case is the legacy
   * `META_API_KEY` alias: accepted so an existing shell keeps working, but the
   * name published by the API reference is `MODEL_API_KEY`.
   */
  readonly warning: string | null;
}

/**
 * Read the Model API key.
 *
 * `MODEL_API_KEY` is the name used by every official Meta Model API snippet
 * (verified in the authentication docs and in the SAM client-library example),
 * so it wins when both are present. `META_API_KEY` is accepted as a legacy
 * alias because it is easy to have exported already, but it is never
 * documented here as the correct spelling.
 */
export function resolveApiKey(env: EnvLike): ResolvedApiKey {
  const canonical = env['MODEL_API_KEY']?.trim() ?? '';
  if (canonical.length > 0) {
    return { key: canonical, source: 'MODEL_API_KEY', warning: null };
  }

  const legacy = env['META_API_KEY']?.trim() ?? '';
  if (legacy.length > 0) {
    return {
      key: legacy,
      source: 'META_API_KEY',
      warning:
        'META_API_KEY is a legacy alias. The documented variable is MODEL_API_KEY; rename it before shipping.',
    };
  }

  return { key: '', source: 'none', warning: null };
}

export type MockMode = 'mock' | 'live';

export interface MockModeDecision {
  readonly mode: MockMode;
  readonly forceLive: boolean;
}

/**
 * Decide whether this process may call the real API.
 *
 *  - `MOCK_MODE=true`   -> mock, unconditionally.
 *  - `MOCK_MODE=false`  -> live, and a missing key is a boot error (thrown by
 *                          the caller) rather than a silent downgrade.
 *  - unset              -> live when a key exists, mock otherwise.
 *
 * The one behaviour that is never acceptable is answering "live" and then
 * serving fixtures, because the demo would then be lying about what the model
 * actually produced.
 */
export function resolveMockMode(env: EnvLike, hasKey: boolean): MockModeDecision {
  const raw = env['MOCK_MODE']?.trim().toLowerCase();

  if (raw === 'true') return { mode: 'mock', forceLive: false };
  if (raw === 'false') return { mode: hasKey ? 'live' : 'mock', forceLive: !hasKey };

  return { mode: hasKey ? 'live' : 'mock', forceLive: false };
}

/* ------------------------------------------------------------------------- */
/* Local-only evidence                                                       */
/* ------------------------------------------------------------------------- */

export type LocalOnlyVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly status: 403;
      readonly code: 'local_only_blocked';
      readonly reason: string;
    };

/**
 * The privacy gate, evaluated before any bytes are decoded or sent.
 *
 * `local-only` is a hard policy flag: the raw evidence must never leave the
 * device. In mock mode nothing crosses the wire, so the flag is satisfiable —
 * that is what lets the demo show a private voice note honestly instead of
 * pretending it was uploaded.
 *
 * This is deliberately redundant with `MetaAdapter.assertRemoteAllowed`. The
 * adapter gate protects the network boundary; this one protects the request
 * boundary and gives the client a stable `403` with an audit-friendly code.
 * Two independent gates, one invariant.
 */
export function localOnlyVerdict(
  sensitivity: EvidenceSensitivity | undefined,
  options: { readonly live: boolean; readonly operation: string; readonly evidenceId?: string },
): LocalOnlyVerdict {
  if (sensitivity !== 'local-only') return { allowed: true };
  if (!options.live) return { allowed: true };

  const subject = options.evidenceId === undefined ? 'this evidence' : `"${options.evidenceId}"`;

  return {
    allowed: false,
    status: 403,
    code: 'local_only_blocked',
    reason:
      `${subject} is marked local-only and cannot be sent to ${options.operation}. ` +
      'Process it on-device, or re-classify it explicitly before uploading.',
  };
}

/* ------------------------------------------------------------------------- */
/* Error mapping                                                             */
/* ------------------------------------------------------------------------- */

export interface ErrorMapping {
  readonly status: number;
  readonly code: string;
  /**
   * Operator-facing explanation. Present for 4xx (the caller can act on it) and
   * null for 5xx, where the message would describe our internals rather than
   * anything the caller can fix.
   */
  readonly message: string | null;
  readonly details: unknown;
}

/**
 * Map a domain failure onto an HTTP status.
 *
 * The distinction that matters to a client: `4xx` means "fix your request",
 * `5xx` means "retry or wait". A `rate_limited` that arrived as `502` would
 * make a client retry into a wall; a `privacy_violation` that arrived as `500`
 * would look like our bug instead of a deliberate refusal.
 */
export function statusForError(error: unknown): ErrorMapping {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.status < 500 ? error.message : null,
      details: error.details,
    };
  }

  if (error instanceof PrivacyViolationError) {
    return {
      status: 403,
      code: 'privacy_violation',
      message: error.message,
      details: { evidenceId: error.evidenceId, operation: error.operation },
    };
  }

  if (error instanceof MetaAdapterError) {
    const status = httpStatusForAdapterCode(error.code);
    return {
      status,
      code: error.code,
      // Adapter messages are written for humans and contain the remediation
      // ("convert with ffmpeg ..."), so they survive on 4xx. On 5xx they may
      // quote an upstream body, which does not belong in our response.
      message: status < 500 ? error.message : null,
      details: { message: error.message, retryable: error.retryable, requestId: error.requestId },
    };
  }

  return { status: 500, code: 'internal_error', message: null, details: null };
}

function httpStatusForAdapterCode(code: MetaAdapterError['code']): number {
  switch (code) {
    case 'rate_limited':
      return 429;
    case 'timeout':
      return 504;
    case 'http_error':
    case 'invalid_response':
      return 502;
    case 'missing_api_key':
    case 'key_in_client':
      return 500;
    case 'unsupported_media':
    case 'payload_too_large':
    case 'audio_too_long':
    case 'invalid_audio':
      return 400;
    default:
      return 500;
  }
}
