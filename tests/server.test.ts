/**
 * Server policy tests.
 *
 * These cover the three decisions that are cheap to get wrong and expensive to
 * get wrong in public: which variable holds the key, whether the process is
 * allowed to call the network, and whether a `local-only` evidence may leave
 * the machine.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HttpError,
  localOnlyVerdict,
  resolveApiKey,
  resolveMockMode,
  statusForError,
} from '../server/policy.ts';
import { MetaAdapterError, PrivacyViolationError } from '../src/services/metaAdapter.ts';

/* ------------------------------------------------------------------------- */
/* Key resolution                                                            */
/* ------------------------------------------------------------------------- */

test('key: MODEL_API_KEY is the documented name and wins when both exist', () => {
  const resolved = resolveApiKey({ MODEL_API_KEY: 'canonical', META_API_KEY: 'legacy' });

  assert.equal(resolved.key, 'canonical');
  assert.equal(resolved.source, 'MODEL_API_KEY');
  assert.equal(resolved.warning, null);
});

test('key: META_API_KEY still works, but is reported as a legacy alias', () => {
  const resolved = resolveApiKey({ META_API_KEY: 'legacy' });

  assert.equal(resolved.key, 'legacy');
  assert.equal(resolved.source, 'META_API_KEY');
  assert.ok(resolved.warning !== null);
  assert.match(resolved.warning, /MODEL_API_KEY/);
});

test('key: surrounding whitespace is trimmed, blank values count as absent', () => {
  assert.equal(resolveApiKey({ MODEL_API_KEY: '  spaced  ' }).key, 'spaced');
  assert.equal(resolveApiKey({ MODEL_API_KEY: '   ' }).source, 'none');
  assert.equal(resolveApiKey({}).source, 'none');
  assert.equal(resolveApiKey({}).key, '');
});

test('key: the resolved object never leaks the key through a warning', () => {
  const resolved = resolveApiKey({ META_API_KEY: 'sk-super-secret' });
  assert.equal(JSON.stringify(resolved.warning).includes('sk-super-secret'), false);
});

/* ------------------------------------------------------------------------- */
/* Mock mode                                                                 */
/* ------------------------------------------------------------------------- */

test('mode: unset follows the key — no key means mock, key means live', () => {
  assert.equal(resolveMockMode({}, false).mode, 'mock');
  assert.equal(resolveMockMode({}, true).mode, 'live');
});

test('mode: MOCK_MODE=true forces mock even with a key present', () => {
  const decision = resolveMockMode({ MOCK_MODE: 'true' }, true);
  assert.equal(decision.mode, 'mock');
  assert.equal(decision.forceLive, false);
});

test('mode: MOCK_MODE=false without a key is a boot error, not a downgrade', () => {
  const decision = resolveMockMode({ MOCK_MODE: 'false' }, false);
  assert.equal(decision.forceLive, true);
});

test('mode: MOCK_MODE=false with a key is live', () => {
  const decision = resolveMockMode({ MOCK_MODE: 'false' }, true);
  assert.equal(decision.mode, 'live');
  assert.equal(decision.forceLive, false);
});

test('mode: the flag is case-insensitive and tolerates padding', () => {
  assert.equal(resolveMockMode({ MOCK_MODE: ' TRUE ' }, true).mode, 'mock');
  assert.equal(resolveMockMode({ MOCK_MODE: 'False' }, true).mode, 'live');
});

/* ------------------------------------------------------------------------- */
/* Local-only gate                                                           */
/* ------------------------------------------------------------------------- */

test('local-only: normal evidence is always allowed', () => {
  const verdict = localOnlyVerdict('normal', { live: true, operation: 'Muse Spark' });
  assert.equal(verdict.allowed, true);
});

test('local-only: an unclassified evidence is not silently treated as private', () => {
  const verdict = localOnlyVerdict(undefined, { live: true, operation: 'Muse Spark' });
  assert.equal(verdict.allowed, true);
});

test('local-only: live calls are refused before any bytes are decoded', () => {
  const verdict = localOnlyVerdict('local-only', {
    live: true,
    operation: 'Muse Voice Transcribe',
    evidenceId: 'ev-voice-dilemma',
  });

  assert.equal(verdict.allowed, false);
  if (verdict.allowed) return;

  assert.equal(verdict.status, 403);
  assert.equal(verdict.code, 'local_only_blocked');
  assert.match(verdict.reason, /ev-voice-dilemma/);
  assert.match(verdict.reason, /Muse Voice Transcribe/);
  assert.match(verdict.reason, /never|on-device/);
});

test('local-only: mock mode may read it, because nothing crosses the wire', () => {
  const verdict = localOnlyVerdict('local-only', { live: false, operation: 'Muse Spark' });
  assert.equal(verdict.allowed, true);
});

test('local-only: the refusal names the evidence even when the id is absent', () => {
  const verdict = localOnlyVerdict('local-only', { live: true, operation: 'SAM 3.1' });
  assert.equal(verdict.allowed, false);
  if (verdict.allowed) return;
  assert.match(verdict.reason, /this evidence/);
});

/* ------------------------------------------------------------------------- */
/* Error mapping                                                             */
/* ------------------------------------------------------------------------- */

test('errors: an HttpError keeps its own status and code', () => {
  const mapped = statusForError(new HttpError(404, 'not_found', 'nope'));
  assert.equal(mapped.status, 404);
  assert.equal(mapped.code, 'not_found');
  assert.equal(mapped.message, 'nope');
  assert.equal(mapped.details, null);
});

test('errors: a privacy violation is a 403, not a server fault', () => {
  const mapped = statusForError(new PrivacyViolationError('ev-1', 'Muse Spark'));
  assert.equal(mapped.status, 403);
  assert.equal(mapped.code, 'privacy_violation');
});

test('errors: rate limiting stays 429 so clients back off instead of hammering', () => {
  const mapped = statusForError(new MetaAdapterError('rate_limited', 'slow down'));
  assert.equal(mapped.status, 429);
  assert.equal(mapped.code, 'rate_limited');
});

test('errors: upstream failures map to 502 and timeouts to 504', () => {
  assert.equal(statusForError(new MetaAdapterError('http_error', 'boom')).status, 502);
  assert.equal(statusForError(new MetaAdapterError('invalid_response', 'bad json')).status, 502);
  assert.equal(statusForError(new MetaAdapterError('timeout', 'slow')).status, 504);
});

test('errors: malformed media is a client error, not a server error', () => {
  for (const code of ['unsupported_media', 'payload_too_large', 'audio_too_long', 'invalid_audio'] as const) {
    assert.equal(statusForError(new MetaAdapterError(code, 'bad input')).status, 400, code);
  }
});

test('errors: an unknown throwable becomes a 500 without leaking its message', () => {
  const mapped = statusForError(new Error('database password is hunter2'));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.code, 'internal_error');
  assert.equal(mapped.details, null);
  assert.equal(mapped.message, null);
  assert.equal(JSON.stringify(mapped).includes('hunter2'), false);
});

test('errors: a non-Error throwable is still contained', () => {
  assert.equal(statusForError('a string').status, 500);
  assert.equal(statusForError(undefined).status, 500);
});
