/**
 * Arcadia — live smoke test
 * =========================
 * One real call per Meta model, so "the integration works" is a fact we can
 * point at instead of a hope.
 *
 * What it proves
 * --------------
 *  1. `MODEL_API_KEY` reaches the wire and the endpoint accepts it.
 *  2. Muse Spark answers with a schema-valid CausalCommitment.
 *  3. SAM 3.1 answers the documented box-prompt grammar.
 *  4. Muse Voice Transcribe accepts our WAV container and answers with turns.
 *  5. Every receipt says `mock: false`. A live run that silently served a
 *     fixture would be worse than a failed run.
 *
 * What it does not prove
 * ----------------------
 *  - Recognition quality. The image is synthetic and the audio is a tone, not
 *    speech. This is a wire/contract check, not an accuracy benchmark.
 *  - Cost at scale. It reports the cost of these three calls only.
 *
 * Usage
 * -----
 *   npm run smoke           # spends credits, writes SMOKE_RESULTS.md
 *   npm run smoke -- --check  # local only: validate the generated media, no network
 *
 * The script refuses to run without a key. It never falls back to mock mode,
 * because a smoke test that passes in mock mode answers the wrong question.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

import {
  inspectWav,
  MetaAdapter,
  MetaAdapterError,
  MODEL,
  readImageSize,
} from '../src/services/metaAdapter.ts';
import type { ModelCallReceipt } from '../src/services/metaAdapter.ts';
import { resolveApiKey } from '../server/policy.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const reportPath = join(root, 'SMOKE_RESULTS.md');

/* ------------------------------------------------------------------------- */
/* Environment                                                               */
/* ------------------------------------------------------------------------- */

// Same rule as `server/index.ts`: a missing `.env` is normal, so the failure is
// swallowed. The key check below is what decides whether we can run.
try {
  process.loadEnvFile?.(join(root, '.env'));
} catch {
  // No .env: the key may still come from the shell.
}

/* ------------------------------------------------------------------------- */
/* Synthetic media                                                           */
/* ------------------------------------------------------------------------- */

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (CRC_TABLE[(value ^ byte) & 0xff] as number) ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeFourCC(bytes: Uint8Array, offset: number, tag: string): void {
  for (let index = 0; index < 4; index += 1) {
    bytes[offset + index] = tag.charCodeAt(index);
  }
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  writeFourCC(out, 4, type);
  out.set(data, 8);
  // The CRC covers the type and the payload, never the length.
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)), false);
  return out;
}

/**
 * A real, decodable RGB PNG: dark field with one light rectangle.
 *
 * SAM needs an actual image, not a header. The rectangle gives the box prompt
 * something unambiguous to segment, so a `matched: false` is a signal worth
 * reading rather than an artefact of a flat image.
 */
export function buildPng(width = 640, height = 480): Uint8Array {
  const left = Math.round(width * 0.3);
  const right = Math.round(width * 0.7);
  const top = Math.round(height * 0.3);
  const bottom = Math.round(height * 0.7);

  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0; // Filter type 0 (None) for this scanline.
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 3;
      const inside = x >= left && x < right && y >= top && y < bottom;
      raw[pixel] = inside ? 240 : 24;
      raw[pixel + 1] = inside ? 240 : 28;
      raw[pixel + 2] = inside ? 236 : 40;
    }
  }

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width, false);
  header.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none

  return concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * A contract-compliant WAV: RIFF/WAVE, PCM, mono, 16-bit, 16 kHz.
 *
 * The samples are a faded 440 Hz tone, not speech. ASR is expected to return
 * no turns, and that is a valid answer — the smoke test checks the container
 * and the receipt, not the transcription.
 */
export function buildWav(durationMs = 1_200): Uint8Array {
  const sampleRate = 16_000;
  const samples = Math.round((sampleRate * durationMs) / 1_000);
  const dataBytes = samples * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);

  writeFourCC(bytes, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeFourCC(bytes, 8, 'WAVE');

  writeFourCC(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  writeFourCC(bytes, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < samples; index += 1) {
    const seconds = index / sampleRate;
    // Short fade in/out so the tone does not start or end with a click.
    const envelope = Math.min(1, index / 160, (samples - index) / 160);
    const sample = Math.sin(2 * Math.PI * 440 * seconds) * 0.2 * envelope;
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return bytes;
}

/** The rectangle from `buildPng`, in SAM's normalized 0..1000 coordinates. */
const IMAGE_BOX: [number, number, number, number] = [300, 300, 700, 700];

const EVIDENCE_TEXT = [
  'Client message: "We need the API integration finished by Friday.',
  'If it ships on time we will sign the annual contract; if it slips,',
  'we go with the other vendor."',
].join(' ');

/* ------------------------------------------------------------------------- */
/* Local check                                                               */
/* ------------------------------------------------------------------------- */

interface MediaCheck {
  readonly label: string;
  readonly detail: string;
}

function checkMedia(): MediaCheck[] {
  const png = buildPng();
  const image = readImageSize(png);

  const wav = buildWav();
  const audio = inspectWav(wav);

  return [
    {
      label: 'PNG',
      detail: `${image.mime} ${image.width}x${image.height}, ${png.length} bytes`,
    },
    {
      label: 'WAV',
      detail:
        `${audio.sampleRate} Hz, ${audio.channels} ch, ` +
        `${audio.bitsPerSample}-bit, ${audio.durationMs} ms, ${wav.length} bytes`,
    },
  ];
}

/* ------------------------------------------------------------------------- */
/* Live calls                                                                */
/* ------------------------------------------------------------------------- */

type CallStatus = 'pass' | 'fail';

interface CallReport {
  readonly label: string;
  readonly model: string;
  readonly operation: ModelCallReceipt['operation'];
  readonly status: CallStatus;
  readonly receipt: ModelCallReceipt | null;
  readonly detail: string;
  readonly error: string | null;
}

function describeError(error: unknown): string {
  if (error instanceof MetaAdapterError) {
    return `${error.name} [${error.code}]: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * A receipt is the proof of what happened. If it says `mock`, the run did not
 * touch the API, so the smoke test has not passed no matter what else returned.
 */
function assertLiveReceipt(receipt: ModelCallReceipt): void {
  if (receipt.mock !== false) {
    throw new Error(
      'The adapter returned a mock receipt during a live smoke test. Refusing to report a pass.',
    );
  }
}

async function runExtraction(adapter: MetaAdapter): Promise<CallReport> {
  try {
    const result = await adapter.extractCausalCommitment(EVIDENCE_TEXT, {
      evidenceId: 'smoke-evidence-001',
      kind: 'document',
      capturedAt: new Date().toISOString(),
      note: 'Synthetic evidence generated by scripts/smoke.ts.',
    });

    assertLiveReceipt(result.receipt);

    const paths = result.draft.branches.map((branch) => branch.pathName).join(' -> ');

    return {
      label: 'Spark extraction',
      model: result.receipt.model,
      operation: 'extract',
      status: 'pass',
      receipt: result.receipt,
      detail:
        `"${result.draft.title}" | branches ${paths} | ` +
        `proposedBox ${result.proposedBox === null ? 'null' : JSON.stringify(result.proposedBox)}`,
      error: null,
    };
  } catch (error) {
    return {
      label: 'Spark extraction',
      model: MODEL.spark,
      operation: 'extract',
      status: 'fail',
      receipt: null,
      detail: 'no result',
      error: describeError(error),
    };
  }
}

async function runSegmentation(adapter: MetaAdapter): Promise<CallReport> {
  try {
    const result = await adapter.segmentRegion(buildPng(), IMAGE_BOX);

    assertLiveReceipt(result.receipt);

    const detail = result.matched
      ? `matched | box ${JSON.stringify(result.box)} | ` +
        `confidence ${result.confidence === null ? 'null' : result.confidence.toFixed(3)} | ` +
        `encoding ${result.maskEncoding} | ` +
        `geometry ${result.geometry === null ? 'null' : `${result.geometry.raster.width}x${result.geometry.raster.height}, coverage ${result.geometry.raster.coverage.toFixed(3)}`}`
      : 'no match (the call succeeded; the prompt found no object)';

    return {
      label: 'SAM segmentation',
      model: result.receipt.model,
      operation: 'segment',
      status: 'pass',
      receipt: result.receipt,
      detail,
      error: null,
    };
  } catch (error) {
    return {
      label: 'SAM segmentation',
      model: MODEL.sam,
      operation: 'segment',
      status: 'fail',
      receipt: null,
      detail: 'no result',
      error: describeError(error),
    };
  }
}

async function runTranscription(adapter: MetaAdapter): Promise<CallReport> {
  try {
    const result = await adapter.transcribeAudio(buildWav());

    assertLiveReceipt(result.receipt);

    return {
      label: 'Voice transcription',
      model: result.receipt.model,
      operation: 'transcribe',
      status: 'pass',
      receipt: result.receipt,
      detail:
        `${result.turns.length} turn(s) | ${result.audioDurationMs} ms | ` +
        `text ${result.fullText.trim().length === 0 ? '(none, valid for a non-speech tone)' : JSON.stringify(result.fullText)}`,
      error: null,
    };
  } catch (error) {
    return {
      label: 'Voice transcription',
      model: MODEL.asr,
      operation: 'transcribe',
      status: 'fail',
      receipt: null,
      detail: 'no result',
      error: describeError(error),
    };
  }
}

/* ------------------------------------------------------------------------- */
/* Report                                                                    */
/* ------------------------------------------------------------------------- */

function formatCost(value: number | null): string {
  if (value === null) return 'n/a';
  if (value === 0) return '$0';
  return `$${value.toFixed(6)}`;
}

function formatTokens(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}

function formatRequestId(receipt: ModelCallReceipt | null): string {
  if (receipt === null || receipt.requestId === null) return 'n/a';
  return `\`${receipt.requestId}\``;
}

function renderReport(reports: readonly CallReport[], startedAt: string): string {
  const completedAt = new Date().toISOString();
  const passed = reports.filter((report) => report.status === 'pass').length;
  const totalCost = reports.reduce(
    (sum, report) => sum + (report.receipt?.estimatedCostUsd ?? 0),
    0,
  );

  const lines: string[] = [
    '# Arcadia — live smoke test',
    '',
    `- Started: ${startedAt}`,
    `- Completed: ${completedAt}`,
    `- Node: ${process.version}`,
    `- Result: **${passed}/${reports.length} passed**`,
    `- Estimated cost of this run: **${formatCost(totalCost)}**`,
    '',
    '## Calls',
    '',
    '| Model | Operation | Status | Latency | Input tok | Output tok | Cost | Request ID |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const report of reports) {
    const receipt = report.receipt;
    lines.push(
      `| \`${report.model}\` | ${report.operation} | ${report.status} | ` +
        `${receipt === null ? 'n/a' : `${receipt.latencyMs} ms`} | ` +
        `${formatTokens(receipt?.inputTokens ?? null)} | ` +
        `${formatTokens(receipt?.outputTokens ?? null)} | ` +
        `${formatCost(receipt?.estimatedCostUsd ?? null)} | ` +
        `${formatRequestId(receipt)} |`,
    );
  }

  lines.push('', '## Details', '');

  for (const report of reports) {
    lines.push(`### ${report.label} — ${report.status}`, '');
    lines.push(`- Model: \`${report.model}\``);
    lines.push(`- ${report.detail}`);
    if (report.error !== null) {
      lines.push(`- Error: \`${report.error.replaceAll('`', "'")}\``);
    }
    lines.push('');
  }

  lines.push(
    '## What this run does and does not prove',
    '',
    '- It proves the key is accepted and each model answers on the documented wire contract.',
    '- It proves every receipt says `mock: false`, so no fixture was substituted.',
    '- It does not measure recognition quality: the image is synthetic and the audio is a 440 Hz tone, not speech.',
    '- The ASR call is expected to return zero turns. That is a valid answer for non-speech audio.',
    '',
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------------- */
/* Entry point                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Guarded so the module can be imported by tests without spending credits.
 * Running `node scripts/smoke.ts` still executes `main`.
 */
async function main(): Promise<void> {
  const startedAt = new Date().toISOString();

  if (process.argv.includes('--check')) {
    const checks = checkMedia();
    console.log('Local media check (no network, no credits):');
    for (const check of checks) {
      console.log(`  ${check.label}: ${check.detail}`);
    }
    console.log('OK — the generated media satisfies the contract.');
    return;
  }

  const credentials = resolveApiKey(process.env);

  if (credentials.key.length === 0) {
    console.error(
      [
        'No Model API key found. Refusing to run a live smoke test in mock mode.',
        '',
        'Set MODEL_API_KEY in .env (the canonical name), then retry:',
        '  MODEL_API_KEY=...',
        '',
        'MOCK_MODE is irrelevant here: this script always exercises the live path.',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  if (credentials.warning !== null) {
    console.warn(`warning: ${credentials.warning}`);
  }

  if (process.env['MOCK_MODE']?.trim().toLowerCase() === 'true') {
    console.warn(
      'warning: MOCK_MODE=true is set, but this smoke test ignores it on purpose. ' +
        'It will spend credits to prove the live path.',
    );
  }

  const adapter = new MetaAdapter({
    apiKey: credentials.key,
    mock: false,
    // One attempt per model: a retry storm on a bad key is just a bigger bill.
    retries: 0,
    timeoutMs: 120_000,
  });

  console.log(`Running one live call per model (key source: ${credentials.source})...`);

  const reports = [
    await runExtraction(adapter),
    await runSegmentation(adapter),
    await runTranscription(adapter),
  ];

  const report = renderReport(reports, startedAt);
  await writeFile(reportPath, report, 'utf8');

  console.log('');
  for (const entry of reports) {
    console.log(`  ${entry.status === 'pass' ? 'PASS' : 'FAIL'}  ${entry.label} — ${entry.detail}`);
    if (entry.error !== null) {
      console.log(`        ${entry.error}`);
    }
  }

  const passed = reports.filter((entry) => entry.status === 'pass').length;
  console.log('');
  console.log(`${passed}/${reports.length} passed. Report: ${reportPath}`);

  if (passed !== reports.length) {
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
const isEntryPoint =
  entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href;

if (isEntryPoint) {
  await main();
}
