/**
 * Smoke-test media.
 *
 * The live smoke test is only meaningful if the bytes it uploads are valid.
 * A malformed PNG or WAV would fail at the endpoint and look like a broken
 * integration, so the generators are checked against the same contract the
 * adapter enforces before a request is sent.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectWav, readImageSize } from '../src/services/metaAdapter.ts';
import { buildPng, buildWav } from '../scripts/smoke.ts';

test('smoke media: the synthetic PNG is a decodable RGB image', () => {
  const bytes = buildPng();
  const size = readImageSize(bytes);

  assert.equal(size.mime, 'image/png');
  assert.equal(size.width, 640);
  assert.equal(size.height, 480);
  // The IDAT payload is deflated scanlines, not a header-only stub.
  assert.ok(bytes.length > 1_000);
});

test('smoke media: the synthetic WAV satisfies the ASR contract', () => {
  const bytes = buildWav();
  const info = inspectWav(bytes);

  assert.equal(info.sampleRate, 16_000);
  assert.equal(info.channels, 1);
  assert.equal(info.bitsPerSample, 16);
  assert.equal(info.durationMs, 1_200);
});
