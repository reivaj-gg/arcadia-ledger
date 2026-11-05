/**
 * ARCADIA · Icon set
 * ---------------------------------------------------------------------------
 * Hand-drawn, single-weight line icons rendered inline as SVG. No emoji, no
 * icon font, no network request: every glyph is a path on a 24×24 grid that
 * inherits `currentColor`, so it reads like ink on paper at any size.
 */

const P = {
  /* ── stats ─────────────────────────────────────────────────────────── */
  heart: '<path d="M12 20.2S4.4 15.6 4.4 10.4A3.9 3.9 0 0 1 12 8.6a3.9 3.9 0 0 1 7.6 1.8c0 5.2-7.6 9.8-7.6 9.8Z"/>',
  pen: '<path d="M4.5 19.6l4.2-1 9.1-9.1-3.2-3.2-9.1 9.1-1 4.2Z"/><path d="M14.4 6.5l3.2 3.2"/><path d="M13.2 19.6h6.3"/>',
  shield: '<path d="M12 3.2l7 2.9v5.6c0 4.1-3 7.2-7 9.1-4-1.9-7-5-7-9.1V6.1l7-2.9Z"/><path d="M9.2 12.1l2 2 3.6-3.9"/>',
  butterfly: '<path d="M12 11.6c0-3.1-1.8-6.2-4.7-6.2-2.4 0-3.6 2.4-3.6 4.4 0 2.4 1.8 4.2 4.1 4.2 2 0 3.4-1.1 4.2-2.4Z"/><path d="M12 11.6c0-3.1 1.8-6.2 4.7-6.2 2.4 0 3.6 2.4 3.6 4.4 0 2.4-1.8 4.2-4.1 4.2-2 0-3.4-1.1-4.2-2.4Z"/><path d="M12 5.2v13.4"/><path d="M10.6 4.4 12 5.6l1.4-1.2"/>',
  coin: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 7.4v9.2"/><path d="M14.4 9.6c0-1-1-1.5-2.4-1.5s-2.4.6-2.4 1.6c0 2.3 4.9 1.3 4.9 3.7 0 1-1 1.6-2.5 1.6s-2.5-.6-2.5-1.6"/>',

  /* ── room / hotspots ───────────────────────────────────────────────── */
  desk: '<path d="M3.2 9.2h17.6"/><path d="M4.6 9.2v10.4"/><path d="M19.4 9.2v10.4"/><path d="M7.4 9.2V5.8h9.2v3.4"/><path d="M9.4 13.2h5.2"/><path d="M15.2 13.2v3.6"/>',
  pin: '<path d="M12 3.2a4 4 0 0 1 4 4c0 2.1-1.1 3.1-1.1 5l2.1 3.1H7l2.1-3.1c0-1.9-1.1-2.9-1.1-5a4 4 0 0 1 4-4Z"/><path d="M12 15.3v5.5"/>',
  vinyl: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/><path d="M12 11.4v1.2"/>',
  books: '<path d="M4.2 5.4h4.6v15H4.2z"/><path d="M8.8 5.4h4.6v15H8.8z"/><path d="M14.8 6.4l4.4-1.2 2 14.2-4.4 1.2z"/>',
  window: '<path d="M4.2 4.4h15.6v15.2H4.2z"/><path d="M12 4.4v15.2"/><path d="M4.2 12h15.6"/>',
  guitar: '<path d="M10.2 13.8a4.4 4.4 0 1 1 5.6-5.6l5.6-5.6"/><path d="M14.2 10.2l3.2 3.2"/><path d="M8.4 15.6l1.2 1.2"/><path d="M3.6 20.4l2-2"/>',
  armchair: '<path d="M6.4 11.2V8.4a2.2 2.2 0 0 1 2.2-2.2h6.8a2.2 2.2 0 0 1 2.2 2.2v2.8"/><path d="M4.4 11.2h15.2v6H4.4z"/><path d="M6.4 17.2v3"/><path d="M17.6 17.2v3"/>',
  bed: '<path d="M3.4 17.4V8.6"/><path d="M3.4 17.4h17.2"/><path d="M20.6 17.4v-5.2a3.2 3.2 0 0 0-3.2-3.2H9v8.4"/><path d="M6.2 12.4h2.2"/>',

  /* ── clues ─────────────────────────────────────────────────────────── */
  image: '<path d="M4.2 5.2h15.6v13.6H4.2z"/><path d="M8.4 10.4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z"/><path d="M5.2 16.6l4.9-4.9 3.9 3.9 2.1-2.1 2.7 2.7"/>',
  mic: '<path d="M12 3.4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3Z"/><path d="M5.4 11.2a6.6 6.6 0 0 0 13.2 0"/><path d="M12 17.8v3"/><path d="M9 20.8h6"/>',
  calendar: '<path d="M4.2 6.2h15.6v14H4.2z"/><path d="M4.2 10.4h15.6"/><path d="M8.2 3.4v4"/><path d="M15.8 3.4v4"/><path d="M8 14h2M12 14h2M16 14h2M8 17.4h2M12 17.4h2"/>',
  camera: '<path d="M3.4 8.4h3.8l1.8-2.2h6l1.8 2.2h3.8v11.2H3.4z"/><path d="M12 16.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"/>',
  note: '<path d="M9.2 17.8V6.2l9.6-2v11.6"/><path d="M9.2 17.8a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0Z"/><path d="M18.8 15.8a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0Z"/>',
  letter: '<path d="M3.4 6.4h17.2v11.2H3.4z"/><path d="M3.4 7.2l8.6 5.6 8.6-5.6"/>',
  rain: '<path d="M7.2 14.6a3.8 3.8 0 0 1 .5-7.6 5 5 0 0 1 9.4 1.1 3.4 3.4 0 0 1 .5 6.5"/><path d="M8.4 17.4l-.9 3.2"/><path d="M12.4 17.4l-.9 3.2"/><path d="M16.4 17.4l-.9 3.2"/>',

  /* ── tutorial / input ──────────────────────────────────────────────── */
  walk: '<path d="M13.4 5.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z"/><path d="M11.2 8.6l-2.6 4.8 2.4 2.6-.8 5.4"/><path d="M11.2 8.6l3.9 2.1 1 4.1-2.2 2.6"/><path d="M8.6 13.4l-3.2 1.8"/><path d="M14.2 20.6l2.4 1.2"/>',
  orbit: '<path d="M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8Z"/><path d="M3.6 12h16.8"/><path d="M12 3.6c3.1 3.2 3.1 13.6 0 16.8"/><path d="M12 3.6c-3.1 3.2-3.1 13.6 0 16.8"/>',
  compass: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/>',
  aiRobot: '<rect x="4" y="6" width="16" height="12" rx="3"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M12 2v4M2 12h2M20 12h2M9 15h6"/>',
  brain: '<path d="M9.5 4a3.5 3.5 0 0 0-3.5 3.5c0 .7.2 1.4.6 2A3.5 3.5 0 0 0 5 13a3.5 3.5 0 0 0 3 3.5 3.5 3.5 0 0 0 3.5 3.5c.7 0 1.4-.2 2-.6.6.4 1.3.6 2 .6a3.5 3.5 0 0 0 3.5-3.5 3.5 3.5 0 0 0 3-3.5 3.5 3.5 0 0 0-1.6-3.5c.4-.6.6-1.3.6-2A3.5 3.5 0 0 0 16.5 4c-.7 0-1.4.2-2 .6-.6-.4-1.3-.6-2-.6s-1.4.2-2 .6A3.4 3.4 0 0 0 9.5 4Z"/><path d="M12 4v16"/>',
  spark: '<path d="M12 3.2v4.2"/><path d="M12 16.6v4.2"/><path d="M3.2 12h4.2"/><path d="M16.6 12h4.2"/><path d="M6.2 6.2l2.8 2.8"/><path d="M15 15l2.8 2.8"/><path d="M17.8 6.2L15 9"/><path d="M9 15l-2.8 2.8"/>',
  rewind: '<path d="M11.4 6.2 4.8 12l6.6 5.8V6.2Z"/><path d="M19.6 6.2 13 12l6.6 5.8V6.2Z"/>',

  /* ── interface ─────────────────────────────────────────────────────── */
  book: '<path d="M4.2 5.2a2 2 0 0 1 2-2h5.4v17.6H6.2a2 2 0 0 1-2-2V5.2Z"/><path d="M11.6 3.2h6.2a2 2 0 0 1 2 2v13.6a2 2 0 0 1-2 2h-6.2"/><path d="M7 7.2h2M7 10.4h2"/>',
  chain: '<path d="M9.4 12a3 3 0 0 1 3-3h1.8a3 3 0 0 1 0 6h-.9"/><path d="M14.6 12a3 3 0 0 1-3 3H9.8a3 3 0 0 1 0-6h.9"/>',
  music: '<path d="M9 18V6l10-2v12"/><path d="M9 18a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0Z"/><path d="M19 16a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0Z"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h11"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  lock: '<path d="M7.2 10.8V8a4.8 4.8 0 0 1 9.6 0v2.8"/><path d="M5.2 10.8h13.6v9.8H5.2z"/><path d="M12 14.4v2.6"/>',
  check: '<path d="M4.8 12.8l4.4 4.4 10-10"/>',
  arrowLeft: '<path d="M14.4 5.6 8 12l6.4 6.4"/>',
  arrowRight: '<path d="M9.6 5.6 16 12l-6.4 6.4"/>',
  arrowDown: '<path d="M5.6 9.6 12 16l6.4-6.4"/>',
  pause: '<path d="M9 5v14"/><path d="M15 5v14"/>',
  play: '<path d="M8 4.8l11 7.2-11 7.2V4.8Z"/>',
  volume: '<path d="M4 10v4h3l4 3V7l-4 3H4Z"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6"/><path d="M18.4 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  mute: '<path d="M4 10v4h3l4 3V7l-4 3H4Z"/><path d="M15.8 10.2l4.4 4.4"/><path d="M20.2 10.2l-4.4 4.4"/>',
  restart: '<path d="M4.4 12a7.8 7.8 0 1 0 2.9-6"/><path d="M4 4.4v5h5"/>',
  home: '<path d="M4 11.2 12 4l8 7.2"/><path d="M6.2 10.2v9.6h11.6v-9.6"/>',
  clock: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 7.4v5l3.2 2"/>',
  warning: '<path d="M12 4.2 21 19.8H3L12 4.2Z"/><path d="M12 10v4.2"/><path d="M12 17.2h.01"/>',
  search: '<path d="M10.6 4.2a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8Z"/><path d="M15.4 15.4 20.6 20.6"/>',
  star: '<path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.6l5.9-.8L12 3.4Z"/>',
  trophy: '<path d="M8 4.2h8v4a4 4 0 0 1-8 0v-4Z"/><path d="M8 5.2H5.2v1.9a3 3 0 0 0 2.8 3"/><path d="M16 5.2h2.8v1.9a3 3 0 0 1-2.8 3"/><path d="M12 12.2v3.8"/><path d="M9 20.2h6"/><path d="M9.6 16h4.8v4.2H9.6z"/>',
  tape: '<path d="M3 8.4h18v7.2H3z"/><path d="M7 8.4v7.2"/><path d="M17 8.4v7.2"/>',
  paperclip: '<path d="M9 4.6h6v11.2a3 3 0 0 1-6 0V7.2a2 2 0 0 1 4 0v8.6"/>',
  trash: '<path d="M4.2 7h15.6"/><path d="M9.2 7V4.8h5.6V7"/><path d="M6.2 7l1 13h9.6l1-13"/><path d="M10.2 11v5.6"/><path d="M13.8 11v5.6"/>',
  eye: '<path d="M2.4 12S6.4 5.2 12 5.2 21.6 12 21.6 12 17.6 18.8 12 18.8 2.4 12 2.4 12Z"/><path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/>',
  seal: '<path d="M12 3.2l2.2 1.6 2.7-.3 1 2.5 2.4 1.3-.6 2.7 1.3 2.4-1.9 1.9-.3 2.7-2.7.3-1.6 2.2-2.5-1-2.5 1-1.6-2.2-2.7-.3-.3-2.7L3.3 15l1.3-2.4-.6-2.7 2.4-1.3 1-2.5 2.7.3L12 3.2Z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>',
  polaroid: '<path d="M4.4 3.6h15.2v16.8H4.4z"/><path d="M6.6 5.8h10.8v9.2H6.6z"/><path d="M8 18.4h6"/>',
  lighthouse: '<path d="M9.6 20.4h4.8l1.2-11.4h-7.2z"/><path d="M7.8 9h8.4"/><path d="M12 3.2l2.4 5.8h-4.8L12 3.2Z"/><path d="M3.4 20.4h17.2"/>',
  dot: '<path d="M12 11.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',

  /* ── Meta AI suite / demo ──────────────────────────────────────────── */
  waveform: '<path d="M3.4 12v.01"/><path d="M6.4 8.6v6.8"/><path d="M9.4 5.4v13.2"/><path d="M12.4 9.4v5.2"/><path d="M15.4 6.6v10.8"/><path d="M18.4 9.8v4.4"/><path d="M21 11.4v1.2"/>',
  scan: '<path d="M3.4 8.2V4.6h3.8"/><path d="M16.8 4.6h3.8v3.6"/><path d="M20.6 15.8v3.6h-3.8"/><path d="M7.2 19.4H3.4v-3.6"/><path d="M3.4 12h17.2"/>',
  cube: '<path d="M12 3.4 20.4 8v8L12 20.6 3.6 16V8L12 3.4Z"/><path d="M3.6 8 12 12.6 20.4 8"/><path d="M12 12.6v8"/>',
  graph: '<path d="M6.2 6.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"/><path d="M17.8 11.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"/><path d="M6.2 22a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"/><path d="M8.2 6 15.8 9"/><path d="M7.6 9.6l-1 8"/>',
  hash: '<path d="M9.4 3.6 7.6 20.4"/><path d="M16.4 3.6l-1.8 16.8"/><path d="M3.8 8.6h16.4"/><path d="M3 15.4h16.4"/>',
  clapper: '<path d="M3.6 9.2h16.8v11.2H3.6z"/><path d="M3.6 9.2 5.2 4.4l16.4 1.4-1.2 3.4"/><path d="M8.4 5l1.8 3.6"/><path d="M13.4 5.4l1.8 3.4"/><path d="M18.2 5.8l1.6 3"/>',
  bus: '<path d="M4.4 4.6h15.2v11.2H4.4z"/><path d="M4.4 9.4h15.2"/><path d="M7 15.8v2.6"/><path d="M17 15.8v2.6"/><path d="M7.4 12.4h2"/><path d="M14.6 12.4h2"/><path d="M6.6 7.4h4"/><path d="M13.4 7.4h4"/>',
  arrowUp: '<path d="M5.6 14.4 12 8l6.4 6.4"/>',
  stop: '<path d="M5.6 5.6h12.8v12.8H5.6z"/>',
  refresh: '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.8 4v5h-5"/>',
};

/**
 * @param {keyof typeof P | string} name
 * @param {{ size?: number, cls?: string, stroke?: number }} [opts]
 */
export function icon(name, opts = {}) {
  const { size = 24, cls = '', stroke = 1.7 } = opts;
  const body = P[name] || P.dot;
  return (
    `<svg class="ag-ic${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}

/** Inline icon for use inside a text string, sized to the current font. */
export function glyph(name, opts = {}) {
  return icon(name, { size: 18, ...opts });
}

export const ICON_NAMES = Object.keys(P);

/* ------------------------------------------------------------------------- */
/* Illustrations (procedural "photo" assets, no external files)              */
/* ------------------------------------------------------------------------- */

let sceneSeq = 0;

/**
 * The wire spiral of a ring-bound notebook. Drawn once per journal open; the
 * page block sits behind it so the rings read as passing through the paper.
 */
export function notebookSpiral(rings = 22) {
  const step = 40;
  const h = rings * step;
  const parts = [];
  for (let i = 0; i < rings; i++) {
    const y = i * step + step / 2;
    parts.push(`<ellipse cx="30" cy="${y}" rx="26" ry="11" fill="none" stroke="#8a7f6b" stroke-width="4.2" opacity="0.95"/>`);
    parts.push(`<ellipse cx="30" cy="${y - 1.6}" rx="24" ry="9" fill="none" stroke="#efe6d3" stroke-width="1.5" opacity="0.5"/>`);
    parts.push(`<ellipse cx="30" cy="${y}" rx="6" ry="3.4" fill="#2b2b30" opacity="0.55"/>`);
  }
  return `<svg class="ag-spiral-svg" viewBox="0 0 60 ${h}" preserveAspectRatio="none" aria-hidden="true">${parts.join('')}</svg>`;
}

export function polaroidScene(seed = 0) {
  const n = ++sceneSeq;
  const sky = `sky${n}`;
  const sea = `sea${n}`;
  const warm = `warm${n}`;
  const sunX = 196 + (seed % 3) * 12;
  const sunY = 116 + (seed % 2) * 8;
  return `<svg viewBox="0 0 300 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2c9a0"/><stop offset="0.45" stop-color="#e2a98a"/>
      <stop offset="0.72" stop-color="#9d7f86"/><stop offset="1" stop-color="#4b4a5e"/>
    </linearGradient>
    <linearGradient id="${sea}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7d7f92"/><stop offset="1" stop-color="#2f3547"/>
    </linearGradient>
    <radialGradient id="${warm}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff2cf" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#ffd79a" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffd79a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="340" fill="url(#${sky})"/>
  <circle cx="${sunX}" cy="${sunY}" r="64" fill="url(#${warm})"/>
  <circle cx="${sunX}" cy="${sunY}" r="16" fill="#ffe7b8" opacity="0.92"/>
  <path d="M0 196h300v144H0z" fill="url(#${sea})"/>
  <path d="M0 214c34-6 62 5 96 1s66-8 100-2 68 6 104 1" stroke="#c9b7ad" stroke-opacity="0.28" stroke-width="1.6" fill="none"/>
  <path d="M0 238c40-5 70 4 104 0s70-7 104-2 62 5 92 1" stroke="#c9b7ad" stroke-opacity="0.18" stroke-width="1.4" fill="none"/>
  <path d="M96 196h26l-5-84h-16z" fill="#2b2b33"/>
  <path d="M92 112h34l-3-12H95z" fill="#22222a"/>
  <path d="M101 100h16l-2-14h-12z" fill="#1d1d24"/>
  <path d="M109 86l2-16 2 16z" fill="#1d1d24"/>
  <path d="M109 74l-58-16 6 22 52-2z" fill="#ffe9bd" opacity="0.30"/>
  <path d="M109 74l58-16-6 22-52-2z" fill="#ffe9bd" opacity="0.30"/>
  <path d="M0 340V286c30-8 52 6 82 2s54-12 84-6 62 10 92 4 30-2 42 0v54z" fill="#1c1f27"/>
  <path d="M0 306c26-5 48 4 74 2s50-8 78-4 56 8 86 4 40-2 62 0" stroke="#3a3f4d" stroke-width="1.2" fill="none"/>
  <rect width="300" height="340" fill="#7a5c3a" opacity="0.06"/>
</svg>`;
}

