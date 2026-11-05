/**
 * ARCADIA · 90-second demo sequence
 * ---------------------------------------------------------------------------
 * One click, one perfect take. The sequence owns the camera, the avatar, the
 * Meta AI suite and its own subtitles, so a screen recording has no dead air
 * and no human error:
 *
 *   0:00  establishing dolly through the golden-hour room
 *   0:12  Javier walks to the desk
 *   0:21  SAM 3.1 scans the photograph (laser + bounding box)
 *   0:35  Muse Voice 1.0 reads the voice note (waveform + transcript)
 *   0:47  Muse Spark 1.3 draws the causal graph and the conflict
 *   0:56  the block is sealed into the SHA-256 chain
 *   1:06  Javier walks to the armchair and sits down
 *   1:14  first person, sunset, slow drift, end card
 *
 * The beats add up to ~89 s, which is what the progress bar divides by: if you
 * retime a shot, keep `TOTAL` in step or the bar will finish early.
 *
 * Every step is `await`ed on a timer that can be aborted, so Escape always
 * hands control back to the player instead of stranding them mid-take.
 */
import { bus } from './bus.js';
import { icon } from './icons.js';
import {
  openMetaSuite, closeMetaSuite, setTab, metaSuiteSeal, metaSuitePlayVoice,
} from './metaSuite.js';
import './demo.css';

let root = null;
let running = false;
let aborted = false;
let timers = [];

function wait(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(() => { timers = timers.filter((t) => t !== id); resolve(); }, ms);
    timers.push(id);
  });
}

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function build() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'dm-root';
  root.className = 'dm-root';
  root.innerHTML = `
    <div class="dm-bars"><i class="dm-bar top"></i><i class="dm-bar bottom"></i></div>
    <div class="dm-rec"><span class="dm-rec-dot"></span>REC</div>
    <div class="dm-caption" id="dm-caption">
      <span class="dm-cap-k" id="dm-cap-k"></span>
      <span class="dm-cap-t" id="dm-cap-t"></span>
    </div>
    <div class="dm-progress"><i id="dm-progress-fill"></i></div>
    <button class="dm-skip" id="dm-skip">${icon('close', { size: 14 })}<span>Skip demo</span></button>
    <div class="dm-card" id="dm-card">
      <div class="dm-card-inner">
        <div class="dm-card-kicker" id="dm-card-kicker"></div>
        <h1 class="dm-card-title" id="dm-card-title"></h1>
        <p class="dm-card-sub" id="dm-card-sub"></p>
      </div>
    </div>`;
  document.body.appendChild(root);
  root.querySelector('#dm-skip').addEventListener('click', () => abort());
  return root;
}

function caption(kicker, text) {
  const box = root?.querySelector('#dm-caption');
  if (!box) return;
  box.classList.remove('on');
  void box.offsetWidth;
  root.querySelector('#dm-cap-k').textContent = kicker || '';
  root.querySelector('#dm-cap-t').textContent = text || '';
  box.classList.add('on');
}

function clearCaption() {
  root?.querySelector('#dm-caption')?.classList.remove('on');
}

function card(kicker, title, sub, ms = 2600) {
  const el = root?.querySelector('#dm-card');
  if (!el) return wait(ms);
  root.querySelector('#dm-card-kicker').textContent = kicker || '';
  root.querySelector('#dm-card-title').textContent = title || '';
  root.querySelector('#dm-card-sub').textContent = sub || '';
  el.classList.add('on');
  return wait(ms).then(() => { el.classList.remove('on'); });
}

function progress(p) {
  const fill = root?.querySelector('#dm-progress-fill');
  if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
}

/* ------------------------------------------------------------------------- */
/* Sequence                                                                   */
/* ------------------------------------------------------------------------- */
const TOTAL = 90_000;

async function sequence() {
  const api = bus.api;
  const started = performance.now();
  const tick = setInterval(() => progress((performance.now() - started) / TOTAL), 120);
  timers.push(tick);

  const shot = (pos, look, ms) => api.demoShot?.(pos, look, ms);
  const walk = (x, z, ms) => api.walkTo?.(x, z, ms) ?? wait(ms);

  // ── 0:00 establishing dolly ────────────────────────────────────────────
  api.setDemoMode?.(true);
  api.setPosture?.('stand');
  root.classList.add('is-on');
  await wait(420);

  shot([5.4, 3.6, 6.6], [0.4, 1.5, -1.6], 200);
  await card('Verifiable spatial reconstruction', 'Arcadia', 'One room, proven object by object', 2600);

  caption('00 · The room', 'Every object is rebuilt from real evidence.');
  shot([2.4, 2.7, 5.2], [0.2, 1.35, -1.8], 9000);
  await wait(9000);

  // ── 0:12 walk to the desk ──────────────────────────────────────────────
  caption('01 · Javier', 'The reconstruction is his: his desk, his notes, his voice.');
  shot([3.5, 2.4, 3.4], [0.8, 1.2, -0.4], 2000);
  await walk(1.5, -0.6, 5200);
  shot([2.1, 2.0, 1.2], [2.4, 1.3, -1.9], 2400);
  await wait(3000);

  // ── 0:21 SAM 3.1 ───────────────────────────────────────────────────────
  clearCaption();
  shot([1.7, 1.85, -0.3], [2.55, 1.35, -2.0], 1600);
  await wait(1900);

  caption('02 · Meta SAM 3.1', 'Segments the sticky note on the desk to pixel precision.');
  openMetaSuite({ tab: 'sam' });
  await wait(12000);

  // ── 0:35 Muse Voice 1.0 ────────────────────────────────────────────────
  caption('03 · Meta Muse Voice 1.0', 'His own voice note, transcribed with timecodes.');
  setTab('voice');
  metaSuitePlayVoice();
  await wait(12000);

  // ── 0:47 Muse Spark 1.3 ────────────────────────────────────────────────
  caption('04 · Meta Muse Spark 1.3', 'Crosses image and audio: the 17:00 delivery collides with the 16:30 bus.');
  setTab('spark');
  await wait(9500);

  // ── 0:56 SHA-256 ───────────────────────────────────────────────────────
  caption('05 · SHA-256 Spatial Ledger', 'The finding is sealed into a block nobody can rewrite.');
  setTab('ledger');
  await wait(3000);
  metaSuiteSeal();
  await wait(6500);

  // ── 1:06 walk to the armchair ──────────────────────────────────────────
  clearCaption();
  closeMetaSuite();
  await wait(1200);

  caption('06 · The armchair', 'And then he sits down to look at what he has rebuilt.');
  shot([-0.8, 2.3, 4.6], [-3.0, 1.1, 2.4], 2600);
  await walk(-2.5, 2.35, 6200);

  // ── 1:14 first person at sunset ────────────────────────────────────────
  api.setPosture?.('sitting_armchair');
  await wait(900);

  // Hand the lens to the engine's own POV rig: eye height, chair yaw and head
  // room all come from the scene, so the shot cannot end up inside a cushion.
  api.releaseDemoCamera?.();
  await wait(3000);

  // A slow drift of the head, as if he were following the last of the light.
  for (let i = 1; i <= 10; i++) {
    api.setHeadTurn?.(-0.26 * (i / 10), 0.05 * (i / 10));
    await wait(500);
  }
  await wait(2000);

  // ── end card ───────────────────────────────────────────────────────────
  clearCaption();
  await card('Arcadia', 'Time forgives. The ledger does not.', '8 clues · 6 endings · one verified chain', 7000);

  finish();
}

function finish() {
  running = false;
  clearTimers();
  progress(1);
  root?.classList.remove('is-on');
  closeMetaSuite();
  bus.api.setDemoMode?.(false);
  bus.api.setPosture?.('stand');
  bus.emit('demo:end');
  setTimeout(() => {
    if (!running) {
      root?.classList.remove('is-on');
      document.body.classList.remove('dm-active');
    }
  }, 400);
}

function abort() {
  if (!running) return;
  aborted = true;
  running = false;
  clearTimers();
  closeMetaSuite();
  root?.classList.remove('is-on');
  document.body.classList.remove('dm-active');
  bus.api.setDemoMode?.(false);
  bus.api.setPosture?.('stand');
  bus.emit('demo:end');
}

// Escape aborts the take without leaving the player in a locked state.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && running) { e.preventDefault(); abort(); }
});

export function startDemo() {
  if (running) return false;
  running = true;
  aborted = false;
  build();
  document.body.classList.add('dm-active');
  bus.emit('demo:start');
  sequence().catch((error) => {
    console.warn('[arcadia] demo stopped:', error);
    abort();
  });
  return true;
}

export function stopDemo() {
  abort();
}

export function isDemoRunning() {
  return running;
}
