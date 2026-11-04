/**
 * Arcadia — Verifiable Spatial Ledger
 * ===================================
 * Phase 1 / Deterministic fixtures for `MOCK_MODE`.
 *
 * These are not lorem ipsum. They reproduce the exact scenario the demo
 * depends on, so the 3D frontend can render a full custody chain — box,
 * audio turn, two causal branches and a schedule collision — before the
 * Model API key is even provisioned.
 *
 * The screenshot is a synthetic WhatsApp-style frame drawn as SVG. It is
 * generated here, so we own it: no licensed asset, no scraped image, nothing
 * that could put the submission at risk.
 */

import { sha256Hex } from '../domain/ledger.ts';
import type {
  AudioTurn,
  CausalBranch,
  DraftCommitment,
  Evidence,
  PixelBoundingBox,
} from '../domain/schema.ts';

/* ------------------------------------------------------------------------- */
/* Screenshot fixture                                                        */
/* ------------------------------------------------------------------------- */

const SHOT_WIDTH = 720;
const SHOT_HEIGHT = 1280;

/** Geometry of the incoming message bubble, in screenshot pixels. */
const BUBBLE = { x: 24, y: 232, width: 496, height: 196 } as const;

/** Convert a pixel rectangle to the domain's normalized 0..1000 space. */
export function normalizeBox(
  x: number,
  y: number,
  width: number,
  height: number,
  mediaWidth: number,
  mediaHeight: number,
): PixelBoundingBox {
  const toX = (value: number): number =>
    Math.min(1000, Math.max(0, Math.round((value / mediaWidth) * 1000)));
  const toY = (value: number): number =>
    Math.min(1000, Math.max(0, Math.round((value / mediaHeight) * 1000)));

  return [toY(y), toX(x), toY(y + height), toX(x + width)];
}

export const MOCK_SCREENSHOT_BOX: PixelBoundingBox = normalizeBox(
  BUBBLE.x,
  BUBBLE.y,
  BUBBLE.width,
  BUBBLE.height,
  SHOT_WIDTH,
  SHOT_HEIGHT,
);

export const MOCK_SCREENSHOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}" viewBox="0 0 ${SHOT_WIDTH} ${SHOT_HEIGHT}">
  <rect width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}" fill="#0b141a"/>
  <rect width="${SHOT_WIDTH}" height="120" fill="#1f2c34"/>
  <circle cx="46" cy="62" r="26" fill="#00a884"/>
  <text x="88" y="56" font-family="Segoe UI, Roboto, sans-serif" font-size="26" font-weight="600" fill="#e9edef">Mariana · Cliente</text>
  <text x="88" y="86" font-family="Segoe UI, Roboto, sans-serif" font-size="19" fill="#8696a0">en línea</text>
  <rect x="${BUBBLE.x}" y="${BUBBLE.y}" width="${BUBBLE.width}" height="${BUBBLE.height}" rx="14" fill="#202c33"/>
  <text font-family="Segoe UI, Roboto, sans-serif" font-size="24" fill="#e9edef">
    <tspan x="44" y="278">Oye Javier, ¿me ayudas con el</tspan>
    <tspan x="44" y="312">diseño para el jueves?</tspan>
    <tspan x="44" y="346">Te pago $200.</tspan>
    <tspan x="44" y="380">Entrega a las 4 PM.</tspan>
  </text>
  <text x="470" y="412" font-family="Segoe UI, Roboto, sans-serif" font-size="17" fill="#8696a0">09:41</text>
  <rect x="300" y="456" width="396" height="64" rx="14" fill="#005c4b"/>
  <text x="324" y="496" font-family="Segoe UI, Roboto, sans-serif" font-size="24" fill="#e9edef">Déjame ver mi agenda</text>
  <text x="640" y="512" font-family="Segoe UI, Roboto, sans-serif" font-size="17" fill="#8696a0">09:42</text>
</svg>`;

/**
 * SVG data URI, URL-encoded rather than base64 so it stays readable in dev
 * tools and needs no `Buffer`/`btoa` polyfill in either runtime.
 *
 * This fixture exists to be *rendered* by the UI. Real uploads are PNG/JPEG;
 * see `readImageSize()` in `metaAdapter.ts`.
 */
export const MOCK_SCREENSHOT_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  MOCK_SCREENSHOT_SVG,
)}`;

/* ------------------------------------------------------------------------- */
/* Evidence                                                                  */
/* ------------------------------------------------------------------------- */

export const MOCK_EVIDENCE_SCREENSHOT: Evidence = {
  id: 'ev-whatsapp-mariana',
  type: 'screenshot',
  rawUri: MOCK_SCREENSHOT_URI,
  // The digest is computed from the actual bytes we ship, not hard-coded.
  sha256: sha256Hex(MOCK_SCREENSHOT_SVG),
  capturedAt: '2026-11-03T09:41:00-03:00',
  sensitivity: 'normal',
};

export const MOCK_EVIDENCE_AUDIO: Evidence = {
  id: 'ev-voice-dilemma',
  type: 'audio',
  rawUri: 'file:fixtures/voice-dilemma.wav',
  sha256: sha256Hex('arcadia:fixture:voice-dilemma:v1'),
  capturedAt: '2026-11-03T21:14:00-03:00',
  // A private voice note is the canonical `local-only` case.
  sensitivity: 'local-only',
};

/* ------------------------------------------------------------------------- */
/* Audio turns                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Turn-level timestamps, as Muse Voice Transcribe actually returns them.
 * There is no word-level timing to promise, so the fixture does not invent
 * any: each anchor points at an utterance.
 */
export const MOCK_TRANSCRIPTION_TURNS: AudioTurn[] = [
  {
    speaker: 'A',
    startMs: 0,
    endMs: 4200,
    text: 'Si acepto el diseño de Mariana, tengo que entregar el jueves a las 4 de la tarde.',
  },
  {
    speaker: 'A',
    startMs: 4400,
    endMs: 8600,
    text: 'Pero a las 3 tengo clase de cálculo y no puedo faltar.',
  },
  {
    speaker: 'A',
    startMs: 8800,
    endMs: 11200,
    text: 'Si le digo que sí, entrego tarde. Si le digo que no, pierdo los doscientos.',
  },
];

/* ------------------------------------------------------------------------- */
/* Segmentation                                                              */
/* ------------------------------------------------------------------------- */

export const MOCK_SEGMENTATION_CONFIDENCE = 0.9609375;

/** What SAM 3.1 reports back after the box prompt is refined to a mask. */
export const MOCK_REFINED_BOX: PixelBoundingBox = normalizeBox(
  BUBBLE.x - 2,
  BUBBLE.y - 3,
  BUBBLE.width + 5,
  BUBBLE.height + 6,
  SHOT_WIDTH,
  SHOT_HEIGHT,
);

/* ------------------------------------------------------------------------- */
/* Causal branches                                                           */
/* ------------------------------------------------------------------------- */

export const MOCK_BRANCHES: [CausalBranch, CausalBranch] = [
  {
    pathName: 'A',
    actionTitle: 'Aceptar y negociar la entrega para el viernes',
    tradeOffs: [
      'Cobrás los $200 sin romper la clase del jueves.',
      'Quedás comprometido hasta el viernes a las 11 AM.',
      'Mariana puede leerlo como falta de disponibilidad.',
    ],
    deltaHours: 6,
    deltaEnergy: -2,
    riskLevel: 'medium',
  },
  {
    pathName: 'B',
    actionTitle: 'Aceptar el jueves y faltar a clase',
    tradeOffs: [
      'Entregás a tiempo y protegés la relación comercial.',
      'Perdés la clase de cálculo, que tiene asistencia obligatoria.',
      'Acumulás 3 horas de deuda de sueño el mismo día.',
    ],
    deltaHours: 11,
    deltaEnergy: -7,
    riskLevel: 'high',
  },
];

/* ------------------------------------------------------------------------- */
/* Commitments                                                               */
/* ------------------------------------------------------------------------- */

/** The commitment extracted from the WhatsApp screenshot. */
export const MOCK_DILEMMA_DRAFT: DraftCommitment = {
  title: 'Diseño para Mariana',
  claimText:
    'Mariana pide un diseño para el jueves a las 4 PM y ofrece $200 por el trabajo.',
  branches: MOCK_BRANCHES,
  validFrom: '2026-11-03T09:41:00-03:00',
  timeWindow: {
    start: '2026-11-05T16:00:00-03:00',
    end: '2026-11-05T17:00:00-03:00',
  },
};

/**
 * The second commitment that makes the demo land: it collides with the
 * delivery window above. Same Thursday, 15:00–17:00.
 */
export const MOCK_CLASS_DRAFT: DraftCommitment = {
  title: 'Clase de cálculo',
  claimText:
    'La clase de cálculo del jueves va de 15:00 a 17:00 y tiene asistencia obligatoria.',
  branches: [
    {
      pathName: 'A',
      actionTitle: 'Asistir y entregar el diseño el viernes',
      tradeOffs: ['Protegés la asistencia.', 'La entrega se corre 19 horas.'],
      deltaHours: 2,
      deltaEnergy: -1,
      riskLevel: 'low',
    },
    {
      pathName: 'B',
      actionTitle: 'Faltar a clase para entregar a tiempo',
      tradeOffs: ['Entregás a tiempo.', 'Perdés la asistencia obligatoria.'],
      deltaHours: 0,
      deltaEnergy: -4,
      riskLevel: 'high',
    },
  ],
  validFrom: '2026-11-03T21:14:00-03:00',
  timeWindow: {
    start: '2026-11-05T15:00:00-03:00',
    end: '2026-11-05T17:00:00-03:00',
  },
};

/** The exact utterance that supports `MOCK_CLASS_DRAFT`. */
export const MOCK_CLASS_ANCHOR_TURN: AudioTurn = MOCK_TRANSCRIPTION_TURNS[1] as AudioTurn;
