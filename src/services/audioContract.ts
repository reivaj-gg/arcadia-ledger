/**
 * Arcadia — audio contract
 * ========================
 * What Muse Voice Transcribe will accept, enforced before a byte is uploaded.
 *
 * The endpoint answers a bare `400` for every violation, which is expensive in
 * two ways: it costs a round-trip, and it tells the operator nothing. This module
 * turns "it didn't work" into "it is stereo, here is the ffmpeg line".
 *
 * The published contract
 * ----------------------
 *  - RIFF/WAVE container, PCM
 *  - mono
 *  - 16-bit
 *  - 16 kHz or 24 kHz
 *  - at most 10 minutes
 *  - at most 32 MB
 *
 * Why this is stricter than a byte sniff
 * --------------------------------------
 * A WAV is a chunked container, so the interesting facts live in `fmt `, not in
 * the first four bytes. Four failures that a naive check misses, all handled
 * here:
 *
 *  1. **Format tag.** A 16-bit IEEE-float WAV (tag 3) has the same bit depth as
 *     PCM and would pass a bits-only check, then fail upstream. Only tag 1 (PCM)
 *     and tag 0xFFFE (EXTENSIBLE with a PCM sub-format) are accepted.
 *  2. **Truncated data chunk.** The header can declare 700 seconds while the file
 *     carries 12. Computing the duration from the declared size would reject a
 *     file that is actually fine, or accept one that is not. The duration is
 *     computed from the bytes that exist, and truncation is reported as its own
 *     fact.
 *  3. **Chunk walking past the audio.** Once `data` is found, the remaining bytes
 *     are samples, not chunks. Continuing to walk would read PCM as chunk ids and
 *     could "discover" a bogus `fmt `.
 *  4. **Streaming placeholders.** Recorders that cannot seek write `0xFFFFFFFF`
 *     as the data size. That is read as "until end of file", not as 4 GB.
 */

/** The Model API's ASR limits. Verified against the speech-to-text docs. */
export const ASR_CONTRACT = {
  maxBytes: 32 * 1024 * 1024,
  maxDurationMs: 10 * 60 * 1000,
  sampleRates: [16_000, 24_000] as const,
  channels: 1,
  bitsPerSample: 16,
} as const;

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

export type AudioContractErrorCode = 'invalid_audio' | 'audio_too_long' | 'payload_too_large';

/**
 * Codes mirror `MetaAdapterError`'s so the adapter can rethrow without a mapping
 * table. This module deliberately does not import the adapter: audio validation
 * must stay usable from a CLI or a test with no network stack around it.
 */
export class AudioContractError extends Error {
  readonly code: AudioContractErrorCode;

  constructor(code: AudioContractErrorCode, message: string) {
    super(message);
    this.name = 'AudioContractError';
    this.code = code;
  }
}

/** The one message that actually fixes most of these problems. */
const FFMPEG_RECIPE =
  'ffmpeg -i in.m4a -ac 1 -ar 24000 -c:a pcm_s16le out.wav';

/* ------------------------------------------------------------------------- */
/* Types                                                                     */
/* ------------------------------------------------------------------------- */

export interface WavFormat {
  /** Tag as declared in the file. `1` is PCM, `0xFFFE` is EXTENSIBLE. */
  readonly formatTag: number;
  /** The tag that actually describes the samples: the sub-format for EXTENSIBLE. */
  readonly effectiveTag: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly byteRate: number;
  readonly blockAlign: number;
}

export interface WavInspection {
  readonly format: WavFormat;
  /** Bytes of audio actually present. Never larger than the file. */
  readonly dataBytes: number;
  /** Bytes the header claims. Differs from `dataBytes` only when truncated. */
  readonly declaredDataBytes: number;
  /** The header promised more samples than the file carries. */
  readonly truncated: boolean;
  readonly durationMs: number;
  readonly sizeBytes: number;
}

/* ------------------------------------------------------------------------- */
/* Parsing                                                                   */
/* ------------------------------------------------------------------------- */

const WAVE_FORMAT_PCM = 0x0001;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;
/** Streaming placeholder written by recorders that cannot seek back. */
const SIZE_UNKNOWN = 0xffffffff;

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

/**
 * Parse a WAV without judging it.
 *
 * Separated from the limit check so callers can inspect a file they intend to
 * reject, which is exactly what a "why was this refused" screen needs.
 */
export function readWav(bytes: Uint8Array): WavInspection {
  if (bytes.length < 12 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WAVE') {
    throw new AudioContractError(
      'invalid_audio',
      `Audio must be a RIFF/WAVE container. Convert it with: ${FFMPEG_RECIPE}`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let format: WavFormat | null = null;
  let dataBytes = 0;
  let declaredDataBytes = 0;
  let truncated = false;
  let sawData = false;

  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = fourCC(bytes, offset);
    const declaredSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    const available = bytes.length - body;

    if (chunkId === 'fmt ') {
      if (available < 16) {
        throw new AudioContractError('invalid_audio', 'The fmt chunk is truncated.');
      }

      const formatTag = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      const byteRate = view.getUint32(body + 8, true);
      const blockAlign = view.getUint16(body + 12, true);
      const bitsPerSample = view.getUint16(body + 14, true);

      // EXTENSIBLE keeps the real format tag in the first two bytes of the
      // SubFormat GUID, which starts 24 bytes into the chunk body:
      // 16 (base) + 2 (cbSize) + 2 (valid bits) + 4 (channel mask).
      let effectiveTag = formatTag;
      if (formatTag === WAVE_FORMAT_EXTENSIBLE) {
        if (available < 40) {
          throw new AudioContractError(
            'invalid_audio',
            'The WAVE_FORMAT_EXTENSIBLE fmt chunk is truncated.',
          );
        }
        effectiveTag = view.getUint16(body + 24, true);
      }

      format = {
        formatTag,
        effectiveTag,
        sampleRate,
        channels,
        bitsPerSample,
        byteRate,
        blockAlign,
      };
    } else if (chunkId === 'data') {
      sawData = true;
      declaredDataBytes = declaredSize;

      if (declaredSize === SIZE_UNKNOWN) {
        // Until end of file. Trust the file, not the placeholder.
        dataBytes = available;
      } else {
        dataBytes = Math.min(declaredSize, available);
        if (declaredSize > available) truncated = true;
      }

      // Everything after `data` is samples. Walking further would parse PCM as
      // chunk headers, so the walk stops here by design.
      break;
    }

    // Chunks are word-aligned: an odd size is followed by one pad byte.
    const advance = declaredSize === SIZE_UNKNOWN ? available : declaredSize;
    const next = body + advance + (advance % 2);
    if (next <= offset) break; // A zero-sized chunk would loop forever.
    offset = next;
  }

  if (format === null) {
    throw new AudioContractError(
      'invalid_audio',
      'The WAV has no fmt chunk, so its format cannot be established.',
    );
  }

  if (!sawData) {
    throw new AudioContractError('invalid_audio', 'The WAV has no data chunk.');
  }

  // Prefer blockAlign over byteRate: byteRate is derived and can disagree with
  // the declared format, while blockAlign is what actually steps the samples.
  const bytesPerSecond =
    format.blockAlign > 0 ? format.blockAlign * format.sampleRate : format.byteRate;

  const durationMs =
    bytesPerSecond > 0 ? Math.round((dataBytes / bytesPerSecond) * 1000) : 0;

  return {
    format,
    dataBytes,
    declaredDataBytes,
    truncated,
    durationMs,
    sizeBytes: bytes.length,
  };
}

/* ------------------------------------------------------------------------- */
/* Enforcement                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Enforce the published contract on an already-parsed file.
 *
 * Order matters for the message: size first (cheap), then container facts, then
 * duration. A file that is both stereo and too long should complain about being
 * stereo, because that is the fix the operator has to make first.
 */
export function assertAsrContract(inspection: WavInspection): void {
  if (inspection.sizeBytes > ASR_CONTRACT.maxBytes) {
    throw new AudioContractError(
      'payload_too_large',
      `Audio is ${megabytes(inspection.sizeBytes)} MB; the endpoint caps at 32 MB. Split the recording.`,
    );
  }

  const { format } = inspection;

  if (format.effectiveTag !== WAVE_FORMAT_PCM) {
    throw new AudioContractError(
      'invalid_audio',
      `Audio must be PCM, got WAV format tag 0x${format.effectiveTag.toString(16)}. ` +
        `Convert it with: ${FFMPEG_RECIPE}`,
    );
  }

  if (format.channels !== ASR_CONTRACT.channels) {
    throw new AudioContractError(
      'invalid_audio',
      `Audio must be mono, got ${format.channels} channels. Convert it with: ${FFMPEG_RECIPE}`,
    );
  }

  if (!(ASR_CONTRACT.sampleRates as readonly number[]).includes(format.sampleRate)) {
    throw new AudioContractError(
      'invalid_audio',
      `Audio must be 16 kHz or 24 kHz, got ${format.sampleRate} Hz. Convert it with: ${FFMPEG_RECIPE}`,
    );
  }

  if (format.bitsPerSample !== ASR_CONTRACT.bitsPerSample) {
    throw new AudioContractError(
      'invalid_audio',
      `Audio must be 16-bit PCM, got ${format.bitsPerSample}-bit. Convert it with: ${FFMPEG_RECIPE}`,
    );
  }

  if (inspection.truncated) {
    throw new AudioContractError(
      'invalid_audio',
      `The data chunk is truncated: the header declares ${inspection.declaredDataBytes} bytes ` +
        `but only ${inspection.dataBytes} are present. Re-export the file.`,
    );
  }

  if (inspection.dataBytes === 0) {
    throw new AudioContractError('invalid_audio', 'The WAV contains no audio samples.');
  }

  if (inspection.durationMs > ASR_CONTRACT.maxDurationMs) {
    throw new AudioContractError(
      'audio_too_long',
      `Audio is ${Math.round(inspection.durationMs / 1000)}s; the endpoint caps at 600s. Split it.`,
    );
  }
}

/** Parse and enforce in one call. This is what the adapter uses. */
export function inspectAsrWav(bytes: Uint8Array): WavInspection {
  const inspection = readWav(bytes);
  assertAsrContract(inspection);
  return inspection;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
