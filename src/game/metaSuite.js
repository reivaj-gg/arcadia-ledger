/**
 * ARCADIA · Meta AI Multimodal Suite
 * ---------------------------------------------------------------------------
 * The visible half of the promise. Four live instruments, not four
 * paragraphs:
 *
 *   1. SAM 3.1        — a real photograph scanned by a neon laser, with the
 *                       bounding box, the normalised coordinates and the IoU
 *                       round-trip verdict drawn on top.
 *   2. Muse Voice 1.0 — a speech envelope rendered as 64 equaliser bars, a
 *                       waveform with a moving playhead, and the transcript
 *                       lighting up in sync with the timestamps.
 *   3. Muse Spark 1.3 — the causal graph that joins the photograph and the
 *                       voice note to a 3D position, and the temporal conflict
 *                       that falls out of it.
 *   4. SHA-256 Ledger — real hashes, computed with @noble/hashes, revealed
 *                       character by character and chained to genesis.
 *
 * Everything is deterministic (a seeded envelope, a fixed payload) so a demo
 * recording looks identical on every run.
 */
import { icon } from './icons.js';
import { sha256Hex } from '../domain/ledger.ts';
import './metaSuite.css';

const BOX = { x1: 24, y1: 232, x2: 519, y2: 427 };

/* ------------------------------------------------------------------------- */
/* Deterministic pseudo-speech envelope                                       */
/* ------------------------------------------------------------------------- */
/** Smooth, repeatable "someone is talking" curve for bar `i` at time `t`. */
function envelope(i, t) {
  const a = Math.sin(i * 0.41 + t * 3.1) * 0.5 + 0.5;
  const b = Math.sin(i * 1.13 - t * 1.7) * 0.5 + 0.5;
  const c = Math.sin(i * 0.17 + t * 0.9) * 0.5 + 0.5;
  // Syllable-like gating so it never looks like a plain sine wave.
  const gate = Math.pow(Math.max(0, Math.sin(i * 0.23 + t * 2.3)), 2.2);
  return 0.16 + (a * 0.42 + b * 0.3 + c * 0.28) * (0.45 + gate * 0.85);
}

/* ------------------------------------------------------------------------- */
/* The photograph: a close-up of Javier's desk, with the sticky note exactly   */
/* inside the bounding box the model reports.                                 */
/* ------------------------------------------------------------------------- */
function deskPhoto() {
  // The overlay positions the box as a percentage of the stage, so the drawing
  // has to map linearly onto the stage too: a landscape viewBox stretched with
  // preserveAspectRatio="none". The mild horizontal stretch is invisible on
  // wood and paper, and it guarantees the box lands on the note at any size.
  const bx = (BOX.x1 / 1000) * 960;
  const by = (BOX.y1 / 1000) * 720;
  const bw = ((BOX.x2 - BOX.x1) / 1000) * 960;
  const bh = ((BOX.y2 - BOX.y1) / 1000) * 720;

  return `<svg viewBox="0 0 960 720" class="ms-photo" preserveAspectRatio="none" aria-label="Photo of the desk">
    <defs>
      <linearGradient id="msWood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8a5a34"/><stop offset="0.5" stop-color="#744526"/><stop offset="1" stop-color="#5c3419"/>
      </linearGradient>
      <linearGradient id="msNote" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#f7e7a8"/><stop offset="1" stop-color="#e9d07a"/>
      </linearGradient>
      <radialGradient id="msLamp" cx="0.72" cy="0.05" r="0.9">
        <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <filter id="msSoft"><feGaussianBlur stdDeviation="7"/></filter>
      <radialGradient id="msVin" cx="0.45" cy="0.4" r="0.78">
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.5"/>
      </radialGradient>
    </defs>

    <rect width="960" height="720" fill="url(#msWood)"/>
    <g opacity="0.26" stroke="#2a1608" stroke-width="2">
      <path d="M0 78h960M0 168h960M0 262h960M0 352h960M0 448h960M0 540h960M0 634h960"/>
    </g>
    <g opacity="0.12" stroke="#3d2412" stroke-width="1">
      <path d="M0 122h960M0 214h960M0 308h960M0 398h960M0 494h960M0 586h960"/>
    </g>
    <rect width="960" height="720" fill="url(#msLamp)"/>
    <rect width="960" height="720" fill="url(#msVin)"/>

    <!-- libreta abierta -->
    <g transform="rotate(-3 660 570)">
      <rect x="470" y="456" width="400" height="240" rx="6" fill="#000" opacity="0.28" filter="url(#msSoft)"/>
      <rect x="470" y="450" width="400" height="240" rx="6" fill="#f3ece0"/>
      <rect x="470" y="450" width="200" height="240" rx="6" fill="#eae2d4"/>
      <path d="M670 456v228" stroke="#c9bda9" stroke-width="2"/>
      <g stroke="#b9ac96" stroke-width="1.6" opacity="0.75">
        <path d="M494 486h150M494 512h150M494 538h130M494 564h150M494 590h110"/>
        <path d="M696 486h150M696 512h150M696 538h120"/>
      </g>
      <path d="M512 618q28-24 54 0t54 0" stroke="#8a7a63" stroke-width="2" fill="none" opacity="0.6"/>
    </g>

    <!-- coffee mug, three-quarter view -->
    <g transform="translate(772 342)">
      <ellipse cx="8" cy="14" rx="62" ry="54" fill="#000" opacity="0.3" filter="url(#msSoft)"/>
      <path d="M-56 0v34a56 52 0 0 0 112 0V0z" fill="#33404a"/>
      <path d="M56 10q32 6 27 30t-30 22" stroke="#33404a" stroke-width="13" fill="none"/>
      <ellipse cx="0" cy="0" rx="56" ry="21" fill="#4b5a66"/>
      <ellipse cx="0" cy="1" rx="45" ry="15" fill="#2a1a10"/>
      <ellipse cx="-12" cy="-2" rx="16" ry="5" fill="#6b4a2e" opacity="0.55"/>
    </g>

    <!-- pencil lying down -->
    <g transform="rotate(-9 240 660)">
      <rect x="128" y="650" width="200" height="15" rx="3" fill="#e0a83c"/>
      <rect x="128" y="650" width="26" height="15" fill="#c96a5a"/>
      <path d="M328 650v15l26-7.5z" fill="#d9c7a8"/>
      <path d="M346 654v7l8-3.5z" fill="#2b2b2b"/>
      <rect x="128" y="654" width="200" height="3" fill="#c98f2e" opacity="0.6"/>
    </g>

    <!-- plant, cropped by the frame edge -->
    <g transform="translate(58 700)">
      <path d="M-40 30h80l-10 60h-60z" fill="#b5643f"/>
      <path d="M-30 -6q-32-32-14-60 26 8 30 50z" fill="#4b7a4a"/>
      <path d="M4 -12q5-46 38-52 9 36-25 60z" fill="#5c8f57"/>
      <path d="M-6 -8q-5-40 11-56 18 20 5 58z" fill="#3f6b40"/>
    </g>

    <!-- the sticky note: sits exactly inside the reported box -->
    <g transform="rotate(-1.4 ${bx + bw / 2} ${by + bh / 2})">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#msNote)"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#000" opacity="0.07" filter="url(#msSoft)" transform="translate(4 7)"/>
      <rect x="${bx + 5}" y="${by + 5}" width="${bw - 10}" height="${bh - 10}" fill="none" stroke="#d8bf6d" stroke-width="1.5" opacity="0.7"/>
      <g fill="#3b3226" font-family="Caveat, cursive">
        <text x="${bx + 22}" y="${by + 40}" font-size="31" font-weight="700">DELIVERY</text>
        <text x="${bx + 22}" y="${by + 79}" font-size="27">thursday · 17:00</text>
        <text x="${bx + 22}" y="${by + 124}" font-size="38" font-weight="700" fill="#8c2f2b">$200</text>
      </g>
      <path d="M${bx + 22} ${by + 133} h${bw - 56}" stroke="#8c2f2b" stroke-width="2" opacity="0.45"/>
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------------- */
/* Panels                                                                     */
/* ------------------------------------------------------------------------- */
function samPanel() {
  const pct = (v, total) => `${(v / total) * 100}%`;
  return `
  <section class="ms-panel" data-panel="sam">
    <div class="ms-sam">
      <div class="ms-stage" id="ms-sam-stage">
        ${deskPhoto()}
        <div class="ms-laser" id="ms-laser"></div>
        <div class="ms-scan-grid"></div>
        <div class="ms-box" id="ms-box" style="left:${pct(BOX.x1, 1000)};top:${pct(BOX.y1, 1000)};width:${pct(BOX.x2 - BOX.x1, 1000)};height:${pct(BOX.y2 - BOX.y1, 1000)}">
          <span class="ms-corner tl"></span><span class="ms-corner tr"></span>
          <span class="ms-corner bl"></span><span class="ms-corner br"></span>
          <span class="ms-box-tag">mask · 1</span>
          <span class="ms-box-conf" id="ms-box-conf">0.9996</span>
        </div>
        <div class="ms-reticle" id="ms-reticle"></div>
      </div>

      <aside class="ms-side">
        <div class="ms-verdict" id="ms-verdict">
          <span class="ms-verdict-dot"></span>
          <span class="ms-verdict-main">IoU 99.96 %</span>
          <span class="ms-verdict-sub">ROUND-TRIP PASS</span>
        </div>

        <div class="ms-metrics">
          <div class="ms-metric"><b>BBOX</b><span>[24, 232, 519, 427]</span></div>
          <div class="ms-metric"><b>SPACE</b><span>normalised 0–1000</span></div>
          <div class="ms-metric"><b>IMAGE</b><span>960 × 720 px</span></div>
          <div class="ms-metric"><b>CLASS</b><span>post-it · handwritten text</span></div>
        </div>

        <div class="ms-tokens" id="ms-tokens" aria-label="Model output">
          <span class="ms-tokens-label">model output</span>
          <code id="ms-token-code"></code>
        </div>

        <div class="ms-ocr">
          <span class="ms-ocr-k">recovered text</span>
          <p>DELIVERY · thursday 17:00 · $200</p>
        </div>
      </aside>
    </div>
  </section>`;
}

const VOICE_LINES = [
  { from: 0, to: 4.4, text: 'Javier, it is ten past two in the morning.' },
  { from: 4.4, to: 8.6, text: 'The bus leaves thursday at 16:30 and I am not missing it again.' },
  { from: 8.6, to: 12.4, text: 'I will be there. I promise.' },
];

function voicePanel() {
  return `
  <section class="ms-panel" data-panel="voice">
    <div class="ms-voice">
      <header class="ms-voice-head">
        <div class="ms-voice-meta">
          <span class="ms-chip">16 kHz</span>
          <span class="ms-chip">MONO</span>
          <span class="ms-chip">PCM 16-bit</span>
        </div>
        <div class="ms-voice-time"><span id="ms-playhead-label">00:00.0</span> <i>/</i> 00:12.4</div>
      </header>

      <div class="ms-wave-wrap">
        <div class="ms-eq" id="ms-eq">${Array.from({ length: 64 }, () => '<i></i>').join('')}</div>
        <div class="ms-playhead" id="ms-playhead"></div>
      </div>

      <div class="ms-transcript" id="ms-transcript">
        ${VOICE_LINES.map((l, i) => `
          <div class="ms-line" data-line="${i}" data-from="${l.from}" data-to="${l.to}">
            <span class="ms-line-t">${fmt(l.from)} – ${fmt(l.to)}</span>
            <span class="ms-line-text">${l.text}</span>
          </div>`).join('')}
      </div>

      <footer class="ms-voice-foot">
        <button class="ms-play" id="ms-voice-play">${icon('play', { size: 15 })}<span>Listen</span></button>
        <span class="ms-voice-note">turn 2 · speaker A · confidence 0.985</span>
      </footer>
    </div>
  </section>`;
}

function sparkPanel() {
  return `
  <section class="ms-panel" data-panel="spark">
    <div class="ms-spark">
      <div class="ms-graph">
        <svg viewBox="0 0 640 380" class="ms-graph-svg" aria-label="Causal graph">
          <defs>
            <marker id="msArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#4b6a86"/>
            </marker>
          </defs>

          <path class="ms-edge" d="M116 78 C 176 78, 186 78, 236 78"/>
          <path class="ms-edge" d="M116 300 C 176 300, 186 300, 236 300"/>
          <path class="ms-edge" d="M340 78 C 392 78, 400 150, 436 168"/>
          <path class="ms-edge" d="M340 300 C 392 300, 400 226, 436 196"/>
          <path class="ms-edge hot" d="M498 182 C 540 182, 548 182, 574 182"/>

          <g class="ms-node"><rect x="20" y="52" width="96" height="52" rx="6"/>
            <text x="68" y="76" text-anchor="middle" class="ms-n-k">PHOTO</text>
            <text x="68" y="92" text-anchor="middle" class="ms-n-v">desk</text></g>

          <g class="ms-node"><rect x="20" y="274" width="96" height="52" rx="6"/>
            <text x="68" y="298" text-anchor="middle" class="ms-n-k">VOICE</text>
            <text x="68" y="314" text-anchor="middle" class="ms-n-v">00:12.4</text></g>

          <g class="ms-node accent"><rect x="236" y="52" width="104" height="52" rx="6"/>
            <text x="288" y="76" text-anchor="middle" class="ms-n-k">SAM 3.1</text>
            <text x="288" y="92" text-anchor="middle" class="ms-n-v">post-it</text></g>

          <g class="ms-node accent"><rect x="236" y="274" width="104" height="52" rx="6"/>
            <text x="288" y="298" text-anchor="middle" class="ms-n-k">MUSE VOICE</text>
            <text x="288" y="314" text-anchor="middle" class="ms-n-v">turn 2</text></g>

          <g class="ms-node core"><rect x="436" y="156" width="86" height="52" rx="6"/>
            <text x="479" y="180" text-anchor="middle" class="ms-n-k">SPARK</text>
            <text x="479" y="196" text-anchor="middle" class="ms-n-v">1.3</text></g>

          <g class="ms-node danger"><rect x="574" y="156" width="56" height="52" rx="6"/>
            <text x="602" y="180" text-anchor="middle" class="ms-n-k">17:00</text>
            <text x="602" y="196" text-anchor="middle" class="ms-n-v">16:30</text></g>

          <circle class="ms-pulse" id="ms-graph-pulse" r="3.4" fill="#7fd4ff"/>
        </svg>
      </div>

      <aside class="ms-spark-side">
        <div class="ms-positions">
          <div class="ms-pos"><b>3D position</b><span id="ms-pos">x 2.50 · y 1.60 · z −1.80</span></div>
          <div class="ms-pos"><b>anchor</b><span>hotspot "desk" · 0.42 m</span></div>
        </div>

        <div class="ms-map">
          <svg viewBox="0 0 200 140" aria-label="Room plan">
            <rect x="6" y="6" width="188" height="128" rx="4" class="ms-map-room"/>
            <rect x="118" y="24" width="66" height="30" rx="3" class="ms-map-furn"/>
            <rect x="18" y="88" width="54" height="34" rx="3" class="ms-map-furn"/>
            <rect x="24" y="26" width="30" height="30" rx="3" class="ms-map-furn"/>
            <circle cx="152" cy="39" r="4.5" class="ms-map-dot"/>
            <circle cx="152" cy="39" r="11" class="ms-map-ring"/>
            <path d="M0 70h200" class="ms-map-scan"/>
          </svg>
          <span class="ms-map-cap">projected object</span>
        </div>

        <div class="ms-conflict">
          <div class="ms-conflict-head">${icon('warning', { size: 14 })}<span>45 min overlap</span></div>
          <div class="ms-bars">
            <div class="ms-bar"><span class="ms-bar-k">delivery</span><div class="ms-bar-track"><i class="ms-bar-fill late" style="--a:72%;--b:88%"></i></div><span class="ms-bar-v">17:00</span></div>
            <div class="ms-bar"><span class="ms-bar-k">bus</span><div class="ms-bar-track"><i class="ms-bar-fill bus" style="--a:56%;--b:72%"></i></div><span class="ms-bar-v">16:30</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>`;
}

function ledgerPanel() {
  return `
  <section class="ms-panel" data-panel="ledger">
    <div class="ms-ledger">
      <div class="ms-chain-head">
        <div class="ms-chain-status" id="ms-chain-status">
          <span class="ms-verdict-dot"></span>
          <b>CHAIN VERIFIED</b>
          <span id="ms-chain-count">0 blocks</span>
        </div>
        <button class="ms-play" id="ms-seal">${icon('seal', { size: 15 })}<span>Seal block</span></button>
      </div>

      <div class="ms-blocks" id="ms-blocks"></div>

      <div class="ms-hashbox">
        <div class="ms-hash-label">live hash</div>
        <code class="ms-hash" id="ms-hash"></code>
        <div class="ms-hash-formula">SHA-256( seq · prevHash · payloadHash · timestamp )</div>
      </div>
    </div>
  </section>`;
}

function fmt(sec) {
  // Integer tenths first: 8.6 - 8 is 0.5999… in binary floating point.
  const tenths = Math.round(sec * 10);
  const m = Math.floor(tenths / 600);
  const rem = tenths - m * 600;
  const whole = String(Math.floor(rem / 10)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${whole}.${rem % 10}`;
}

/* ------------------------------------------------------------------------- */
/* Shell                                                                      */
/* ------------------------------------------------------------------------- */
const TABS = [
  { id: 'sam', label: 'SAM 3.1', sub: 'Vision', icon: 'scan' },
  { id: 'voice', label: 'Muse Voice', sub: 'Audio', icon: 'waveform' },
  { id: 'spark', label: 'Muse Spark', sub: 'Causality', icon: 'graph' },
  { id: 'ledger', label: 'SHA-256', sub: 'Ledger', icon: 'hash' },
];

function shell() {
  return `
    <div class="ms-scrim" data-close></div>
    <div class="ms-sheet" role="dialog" aria-modal="true" aria-label="Meta AI Suite">
      <header class="ms-head">
        <div class="ms-head-l">
          <span class="ms-head-mark">${icon('spark', { size: 18 })}</span>
          <div>
            <h2 class="ms-title">Meta AI Suite</h2>
            <div class="ms-sub">Your evidence, verified live</div>
          </div>
        </div>
        <div class="ms-tabs" role="tablist">
          ${TABS.map((t) => `
            <button class="ms-tab" data-tab="${t.id}" role="tab">
              ${icon(t.icon, { size: 16 })}
              <span class="ms-tab-t">${t.label}</span>
              <span class="ms-tab-s">${t.sub}</span>
            </button>`).join('')}
        </div>
        <button class="ms-close" data-close title="Close (ESC)">${icon('close', { size: 18 })}</button>
      </header>

      <div class="ms-body">
        ${samPanel()}
        ${voicePanel()}
        ${sparkPanel()}
        ${ledgerPanel()}
      </div>

      <footer class="ms-foot">
        <span class="ms-foot-k">${icon('scan', { size: 13 })} SAM 3.1</span>
        <span class="ms-foot-k">${icon('waveform', { size: 13 })} Muse Voice 1.0</span>
        <span class="ms-foot-k">${icon('graph', { size: 13 })} Muse Spark 1.3</span>
        <span class="ms-foot-k">${icon('hash', { size: 13 })} SHA-256</span>
        <span class="ms-foot-hint"><b>I</b> or <b>ESC</b> back to the room</span>
      </footer>
    </div>`;
}

/* ------------------------------------------------------------------------- */
/* Runtime                                                                    */
/* ------------------------------------------------------------------------- */
let el = null;
let isOpen = false;
let activeTab = 'sam';
let raf = 0;
let t0 = 0;
let voicePlaying = false;
let voiceStart = 0;
let voiceAudio = null;
let ledgerBlocks = [];
let hashReveal = 0;
let hashTarget = '';
let onCloseCb = null;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ms-root';
  el.className = 'ms-root';
  el.innerHTML = shell();
  document.body.appendChild(el);
  wire();
  seedLedger();
  return el;
}

function wire() {
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeMetaSuite()));
  el.querySelectorAll('.ms-tab').forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });
  el.querySelector('#ms-voice-play')?.addEventListener('click', toggleVoice);
  el.querySelector('#ms-seal')?.addEventListener('click', () => sealBlock({ user: true }));
}

export function setTab(name) {
  if (!el) ensure();
  activeTab = name;
  el.querySelectorAll('.ms-tab').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === name));
  el.querySelectorAll('.ms-panel').forEach((p) => p.classList.toggle('is-on', p.dataset.panel === name));
  if (name === 'voice') startVoice();
  else stopVoice();
  if (name === 'ledger') revealHash();
}

export function openMetaSuite(opts = {}) {
  ensure();
  if (!isOpen) {
    isOpen = true;
    el.classList.add('is-open');
    document.body.classList.add('ms-locked');
    t0 = performance.now();
    setTab(opts.tab || activeTab);
    loop();
  } else if (opts.tab) {
    setTab(opts.tab);
  }
  if (opts.onClose) onCloseCb = opts.onClose;
}

export function closeMetaSuite() {
  if (!isOpen) return;
  isOpen = false;
  stopVoice();
  cancelAnimationFrame(raf);
  raf = 0;
  el.classList.remove('is-open');
  document.body.classList.remove('ms-locked');
  const cb = onCloseCb;
  onCloseCb = null;
  if (cb) cb();
}

export function isMetaSuiteOpen() {
  return isOpen;
}

/* ── SAM ─────────────────────────────────────────────────────────────── */
function tickSam(time) {
  const laser = el.querySelector('#ms-laser');
  const conf = el.querySelector('#ms-box-conf');
  const code = el.querySelector('#ms-token-code');
  if (!laser) return;

  // 4.2 s sweep, then hold the mask lit for a beat and start again.
  const cycle = (time % 6200) / 4200;
  const p = Math.min(1, cycle);
  laser.style.setProperty('--p', p.toFixed(4));
  laser.style.opacity = cycle > 1 ? '0.25' : '1';

  const settled = p > 0.92;
  if (conf) {
    conf.textContent = settled ? '0.9996' : (0.86 + p * 0.13).toFixed(4);
    conf.classList.toggle('is-locked', settled);
  }
  el.querySelector('#ms-verdict')?.classList.toggle('is-live', settled);

  if (code) {
    const full = '<0f>1<|box;x1=24;y1=232;x2=519;y2=427;w=720;h=1280|>';
    const n = Math.floor(p * full.length);
    code.textContent = full.slice(0, n) + (n < full.length ? '▌' : '');
  }
}

/* ── VOICE ───────────────────────────────────────────────────────────── */
function tickVoice(time) {
  const bars = el.querySelectorAll('#ms-eq i');
  const head = el.querySelector('#ms-playhead');
  const label = el.querySelector('#ms-playhead-label');
  if (!bars.length) return;

  const t = voicePlaying ? Math.min(12.4, (performance.now() - voiceStart) / 1000) : (time * 0.4) % 12.4;

  for (let i = 0; i < bars.length; i++) {
    const v = envelope(i, t * 1.35);
    bars[i].style.transform = `scaleY(${(v * (voicePlaying ? 1 : 0.55)).toFixed(3)})`;
    bars[i].style.opacity = voicePlaying ? '1' : '0.45';
  }
  if (head) head.style.setProperty('--p', (t / 12.4).toFixed(4));
  if (label) {
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    const tenth = Math.min(9, Math.floor((t % 1) * 10));
    label.textContent = `${mm}:${ss}.${tenth}`;
  }

  el.querySelectorAll('#ms-transcript .ms-line').forEach((line) => {
    const from = Number(line.dataset.from);
    const to = Number(line.dataset.to);
    line.classList.toggle('is-live', t >= from && t < to);
    line.classList.toggle('is-done', t >= to);
  });

  if (voicePlaying && t >= 12.4) stopVoice();
}

function startVoice() {
  if (voicePlaying) return;
  voicePlaying = true;
  voiceStart = performance.now();
  const btn = el.querySelector('#ms-voice-play');
  if (btn) btn.innerHTML = `${icon('pause', { size: 15 })}<span>Pausar</span>`;
  playVoiceTone();
}

function stopVoice() {
  // Kill the context even when playback already ended on its own, so a close
  // mid-transcript never leaves a live context behind.
  if (voiceAudio) {
    killCtx(voiceAudio.ctx);
    voiceAudio = null;
  }
  if (!voicePlaying) return;
  voicePlaying = false;
  const btn = el?.querySelector('#ms-voice-play');
  if (btn) btn.innerHTML = `${icon('play', { size: 15 })}<span>Escuchar</span>`;
}

/**
 * `close()` and `resume()` both return promises, and both reject — rather than
 * throw — when the context is already gone. Closing the suite mid-playback used
 * to leave two unhandled rejections in the console; this swallows them.
 */
function killCtx(ctx) {
  if (!ctx || ctx.state === 'closed') return;
  try {
    const p = ctx.close();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* already closed */ }
}

function toggleVoice() {
  if (voicePlaying) stopVoice();
  else startVoice();
}

/**
 * A formant-ish hum shaped by the same envelope as the bars, so the audio and
 * the visual agree. Deliberately quiet: this is a UI instrument, not music.
 */
function playVoiceTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.075;
    master.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 132;

    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 264;

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 620;
    formant.Q.value = 6;

    const env = ctx.createGain();
    env.gain.value = 0;

    o1.connect(formant);
    o2.connect(formant);
    formant.connect(env);
    env.connect(master);

    // Syllable gate at ~4.4 Hz with a slow phrase envelope.
    const dur = 12.4;
    for (let i = 0; i < dur * 4.4; i++) {
      const at = now + i / 4.4;
      const amp = 0.25 + Math.random() * 0.55;
      env.gain.setValueAtTime(0.02, at);
      env.gain.linearRampToValueAtTime(amp, at + 0.05);
      env.gain.linearRampToValueAtTime(0.03, at + 0.16);
      formant.frequency.setValueAtTime(430 + Math.random() * 620, at);
    }

    o1.start(now);
    o2.start(now);
    o1.stop(now + dur);
    o2.stop(now + dur);
    voiceAudio = { ctx, o1, o2 };
    setTimeout(() => killCtx(ctx), (dur + 0.4) * 1000);
  } catch { /* audio is optional */ }
}

/* ── SPARK ───────────────────────────────────────────────────────────── */
function tickSpark(time) {
  const pulse = el.querySelector('#ms-graph-pulse');
  if (!pulse) return;
  // Travel the two input edges, then the hot edge, on a 3.6 s loop.
  const p = (time % 3600) / 3600;
  const pts = [
    [68, 78], [288, 78], [479, 182], [602, 182],
  ];
  const seg = p * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = pts[i];
  const b = pts[i + 1];
  pulse.setAttribute('cx', (a[0] + (b[0] - a[0]) * f).toFixed(1));
  pulse.setAttribute('cy', (a[1] + (b[1] - a[1]) * f).toFixed(1));
}

/* ── LEDGER ──────────────────────────────────────────────────────────── */
function seedLedger() {
  const genesis = '0'.repeat(64);
  ledgerBlocks = [
    { seq: 0, type: 'genesis', label: 'GENESIS BLOCK', hash: genesis, prevHash: genesis, at: '—' },
  ];
  renderBlocks();
}

function sealBlock({ user = false } = {}) {
  const prev = ledgerBlocks[ledgerBlocks.length - 1];
  const seq = ledgerBlocks.length;
  const at = new Date().toISOString();
  const payload = JSON.stringify({
    seq,
    type: 'narrative.clue',
    scene: 'c1.evidence',
    label: 'SAM 3.1 · IoU 99.96 % · bbox [24,232,519,427]',
    at,
  });
  const payloadHash = sha256Hex(payload);
  const hash = sha256Hex(`${seq}${prev.hash}${payloadHash}${at}`);
  ledgerBlocks.push({ seq, type: user ? 'manual.seal' : 'narrative.clue', label: user ? 'MANUAL SEAL' : 'PIXEL ANCHOR', hash, prevHash: prev.hash, at });
  renderBlocks();
  revealHash(hash);
}

function renderBlocks() {
  const box = el?.querySelector('#ms-blocks');
  if (!box) return;
  const shown = ledgerBlocks.slice(-4);
  box.innerHTML = shown.map((b, i) => `
    <div class="ms-block ${i === shown.length - 1 ? 'is-new' : ''}" style="animation-delay:${i * 40}ms">
      <div class="ms-block-head">
        <span class="ms-block-seq">#${String(b.seq).padStart(3, '0')}</span>
        <span class="ms-block-type">${b.label}</span>
      </div>
      <code class="ms-block-hash">${b.hash.slice(0, 34)}…</code>
      <div class="ms-block-link">${icon('chain', { size: 12 })} prev ${b.prevHash.slice(0, 10)}…</div>
    </div>`).join('');

  const count = el.querySelector('#ms-chain-count');
  if (count) count.textContent = `${ledgerBlocks.length} block${ledgerBlocks.length === 1 ? '' : 's'}`;
}

function revealHash(target) {
  hashReveal = 0;
  hashTarget = target || hashTarget || sha256Hex(String(Date.now()));
}

function tickLedger(time) {
  const code = el?.querySelector('#ms-hash');
  if (!code) return;
  if (!hashTarget) revealHash();

  // ~1.4 s to settle, then a short shimmer so the panel never looks frozen.
  const p = Math.min(1, (time % 9000) / 1400);
  const n = Math.floor(p * 64);
  const random = '0123456789abcdef';
  let out = hashTarget.slice(0, n);
  for (let i = n; i < 64; i++) {
    out += p < 1 ? random[(i * 7 + Math.floor(time / 40)) % 16] : hashTarget[i];
  }
  code.textContent = out;
  code.classList.toggle('is-settled', p >= 1);
}

/* ── loop ────────────────────────────────────────────────────────────── */
function loop() {
  if (!isOpen) return;
  const time = performance.now() - t0;
  if (activeTab === 'sam') tickSam(time);
  else if (activeTab === 'voice') tickVoice(time);
  else if (activeTab === 'spark') tickSpark(time);
  else if (activeTab === 'ledger') tickLedger(time);
  raf = requestAnimationFrame(loop);
}

/* Public helpers used by the demo sequence and the onboarding assistant. */
export function metaSuiteSeal() { sealBlock({ user: false }); }
export function metaSuitePlayVoice() { if (activeTab !== 'voice') setTab('voice'); startVoice(); }
export function metaSuiteScan() { if (activeTab !== 'sam') setTab('sam'); t0 = performance.now(); }
export function metaSuiteBlockCount() { return ledgerBlocks.length; }
