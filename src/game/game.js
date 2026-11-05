/**
 * ARCADIA · Game runtime
 * ---------------------------------------------------------------------------
 * Owns the narrative flow, HUD, onboarding, timed choices, rewind, saves,
 * cinematic FX and the 3D objective beacon. It talks to the 3D sanctuary only
 * through `bus.api` / bus events — the renderer stays a renderer.
 */
import './game.css';
import * as THREE from 'three';
import { bus } from './bus.js';
import { portraitSVG } from './portraits.js';
import { icon, polaroidScene, notebookSpiral } from './icons.js';
import { openMetaSuite, closeMetaSuite, isMetaSuiteOpen } from './metaSuite.js';
import { startAssistant, assistantSignal, stopAssistant, isAssistantActive } from './assistant.js';
import { startDemo, isDemoRunning } from './demo.js';
import {
  SAVE_VERSION, MAX_CHARGES, TOTAL_CLUES, STAT_META, CHAPTERS, HOTSPOTS, CLUES,
  SCENES, FLAVOR, TUTORIAL_STEPS, ONBOARDING_STEPS,
  createInitialState, cloneState, enterScene, availableChoices, choose,
  canRewind, rewind, computeEnding, requirementsMet,
} from './story.js';

const SAVE_KEY = 'arcadia.game.v3';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SPEAKERS = {
  javier: { name: 'Javier', role: 'You · Rebuilding your room', style: 'default' },
  narrador: { name: 'Narration', role: 'Surroundings', style: 'narration' },
  mariposa: { name: 'El Eco', role: 'Meta Muse Spark 1.3', style: 'thought' },
  ledger: { name: 'Cryptographic ledger', role: 'SHA-256 · immutable', style: 'ledger' },
  muse: { name: 'Meta AI', role: 'SAM 3.1 · Muse Voice 1.0', style: 'voice' },
};

// ---------------------------------------------------------------------------
// DOM SHELL
// ---------------------------------------------------------------------------
const root = document.createElement('div');
root.id = 'arcadia-game';
root.innerHTML = `
  <div id="ag-grain"></div>
  <div id="ag-scanlines"></div>
  <div id="ag-flash"></div>
  <div id="ag-letterbox"></div>

  <div id="ag-hud">
    <div class="ag-hud-top">
      <div class="ag-hud-left">
        <div class="ag-tab" id="ag-chapter-chip">
          <span class="ag-tab-index" id="ag-chap-kicker">00</span>
          <span class="ag-tab-title" id="ag-chap-title">The Flutter</span>
        </div>
        <div class="ag-objective ag-hidden" id="ag-objective">
          <span class="ag-obj-icon" id="ag-obj-icon"></span>
          <span class="ag-obj-text" id="ag-obj-text"></span>
          <span class="ag-obj-dist" id="ag-obj-dist"></span>
        </div>
      </div>
      <div class="ag-hud-right">
        <div class="ag-stat-strip" id="ag-stats"></div>
        <div class="ag-charges">
          <span class="ag-eco" id="ag-eco-label">${icon('butterfly', { size: 15 })}</span>
          <div class="ag-charge-pips" id="ag-pips"></div>
          <span class="ag-money" id="ag-money"></span>
          <span class="ag-clues" id="ag-clue-count"></span>
        </div>
        <div class="ag-hud-buttons">
          <button class="ag-icon-btn highlight" id="ag-btn-meta-ai" title="Meta AI suite (SAM 3.1 · Muse Voice · Muse Spark)">${icon('spark')}<span>Meta AI</span></button>
          <button class="ag-icon-btn" id="ag-btn-journal" title="Notebook (J)">${icon('book')}<span>Notebook</span></button>
          <button class="ag-icon-btn" id="ag-btn-ledger" title="Ledger (L)">${icon('chain')}<span>Ledger</span></button>
          <button class="ag-icon-btn" id="ag-btn-music" title="Turntable (M)">${icon('music')}<span>Music</span></button>
          <button class="ag-icon-btn" id="ag-btn-rewind" title="Rewind (R)">${icon('butterfly')}<span>Echo</span></button>
          <button class="ag-icon-btn" id="ag-btn-pause" title="Menu (ESC)">${icon('menu')}<span>Menu</span></button>
        </div>
      </div>
    </div>
    <div class="ag-bottom-hint"><b>WASD</b> walk <i>·</i> <b>DRAG</b> 360° <i>·</i> <b>E</b> interact <i>·</i> <b>I</b> Meta AI <i>·</i> <b>M</b> music <i>·</i> <b>R</b> Echo <i>·</i> <b>ESC</b> menu</div>
    <div id="ag-waypoint"><div class="ag-waypoint-inner"><div class="ag-waypoint-diamond"></div><div class="ag-waypoint-label"></div></div></div>
  </div>

  <!-- Outside the HUD on purpose: the demo has to be one click from the title
       screen, which fades the whole HUD out. -->
  <div class="ag-demo-chip" id="ag-demo-chip" title="90-second cinematic take, ready to record">
    <span class="ag-demo-dot"></span>
    <span class="ag-demo-label">Auto demo</span>
    <span class="ag-demo-sub">ready to record</span>
  </div>

  <div id="ag-toasts"></div>
  <div id="ag-consequence">
    <div class="ag-cons-butterfly">${icon('butterfly', { size: 34 })}</div>
    <div class="ag-cons-title">Consequences recorded</div>
    <div class="ag-cons-deltas" id="ag-cons-deltas"></div>
  </div>

  <div id="ag-dialogue">
    <div class="ag-portrait-wrap">
      <div class="ag-tape"></div>
      <div class="ag-portrait" id="ag-portrait"></div>
    </div>
    <div class="ag-dialogue-body">
      <div class="ag-speaker" id="ag-speaker"></div>
      <div class="ag-text" id="ag-text"></div>
      <div class="ag-continue" id="ag-continue">SPACE · continue ${icon('arrowDown', { size: 14 })}</div>
    </div>
  </div>

  <div id="ag-choices">
    <div class="ag-choice-head">${icon('butterfly', { size: 16 })}<span>What you choose stays written</span></div>
    <div id="ag-choice-list"></div>
    <div class="ag-timer-wrap" id="ag-timer-wrap">
      <div class="ag-timer-track"><div class="ag-timer-fill" id="ag-timer-fill"></div></div>
      <div class="ag-timer-text" id="ag-timer-text">TIME KEEPS RUNNING</div>
    </div>
  </div>

  <div id="ag-tutorial" class="ag-hidden"></div>

  <div class="ag-screen" id="ag-title">
    <div class="ag-title-inner">
      <div class="ag-title-note">
        <div class="ag-tape wide"></div>
        <div class="ag-title-kicker">Tuesday, 3 November · 16:42</div>
        <h1 class="ag-title-main">Arcadia</h1>
        <div class="ag-title-sub">Time forgives. The ledger does not.</div>
        <p class="ag-title-desc">Rebuild your room with the Meta AI suite. Every object proven. Every decision sealed.</p>
        <div class="ag-title-menu">
          <button class="ag-menu-btn primary" id="ag-new"><span class="ag-menu-icon">${icon('play')}</span><span class="ag-menu-label">New game</span><span class="ag-menu-key">ENTER</span></button>
          <button class="ag-menu-btn" id="ag-continue"><span class="ag-menu-icon">${icon('book')}</span><span class="ag-menu-label">Continue</span><span class="ag-menu-key" id="ag-save-info">—</span></button>
          <button class="ag-menu-btn" id="ag-howto"><span class="ag-menu-icon">${icon('compass')}</span><span class="ag-menu-label">How to play</span><span class="ag-menu-key">?</span></button>
        </div>
        <div class="ag-title-footer">ARCADIA · SHA-256 CHAIN · 8 CLUES · 6 ENDINGS</div>
      </div>
      <div class="ag-title-polaroid">
        <div class="ag-tape"></div>
        <div class="ag-photo">${polaroidScene(0)}</div>
        <div class="ag-cap">the lighthouse, October</div>
      </div>
    </div>
  </div>

  <div class="ag-screen ag-hidden" id="ag-chapter"><div class="ag-chapter-inner" id="ag-chapter-inner"></div></div>
  <div class="ag-screen ag-hidden" id="ag-journal"></div>
  <div class="ag-screen ag-hidden" id="ag-pause"></div>
  <div class="ag-screen ag-hidden" id="ag-ending"></div>
  <div class="ag-screen ag-hidden" id="ag-evidence"></div>

`;

document.body.appendChild(root);
document.body.classList.add('arcadia-game');

// ---------------------------------------------------------------------------
// RUNTIME STATE
// ---------------------------------------------------------------------------
let state = createInitialState();
let phase = 'title';          // title | tutorial | dialogue | choice | explore | ending
let openScreen = null;        // title | chapter | journal | pause | ending | evidence
let currentSceneId = 'p.wake';
let objective = null;
let tutorial = null;
let tutorialOnly = false;
let beacon = null;
let originalLabels = {};
let soundOn = true;
let uiAudio = null;

const dialogueState = { lines: [], index: 0, full: '', typed: '', typing: false, timer: null, onDone: null, tickCounter: 0 };
let choiceCtx = null;
// Overlay continuity: opening the journal / pause menu during a scene must not
// lose the current dialogue line, nor silently burn a timed choice. `phase` is
// intentionally left untouched while an overlay is open, so closing it is just
// a matter of restoring the UI for the phase that was already running.
let pausedChoice = null;       // frozen countdown (deadline converted to `remaining`)
let overlayReturn = null;      // 'pause' when the journal was opened from the pause menu
let tutorialReturn = null;     // { screen, phase } for reviewing the controls mid-game
let kbFocus = 0;
let travelled = 0;
let dragTotal = 0;
let lastAvatarPos = null;

// ---------------------------------------------------------------------------
// UI SOUND (tiny synth, independent from the 3D world's foley)
// ---------------------------------------------------------------------------
function uiSfx(kind) {
  if (!soundOn) return;
  try {
    if (!uiAudio) uiAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (uiAudio.state === 'suspended') uiAudio.resume().catch(() => {});
    const t = uiAudio.currentTime;
    const presets = {
      click: [520, 780, 0.075, 0.10, 'triangle'],
      hover: [880, 1180, 0.035, 0.025, 'sine'],
      choice: [180, 92, 0.34, 0.20, 'sawtooth'],
      clue: [660, 1320, 0.42, 0.13, 'sine'],
      chapter: [220, 440, 0.65, 0.12, 'triangle'],
      rewind: [900, 110, 0.85, 0.18, 'sawtooth'],
      error: [160, 120, 0.18, 0.10, 'square'],
      flash: [1200, 300, 0.22, 0.08, 'sine'],
    };
    const p = presets[kind] || presets.click;
    const osc = uiAudio.createOscillator();
    const gain = uiAudio.createGain();
    const filter = uiAudio.createBiquadFilter();
    osc.type = p[4];
    osc.frequency.setValueAtTime(p[0], t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p[1]), t + p[2]);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(p[3], t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
    osc.connect(filter); filter.connect(gain); gain.connect(uiAudio.destination);
    osc.start(t); osc.stop(t + p[2] + 0.02);
  } catch { /* audio is optional */ }
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------
function flash() {
  const el = $('ag-flash');
  el.classList.remove('fire');
  void el.offsetWidth;
  el.classList.add('fire');
  uiSfx('flash');
}
function shake() {
  document.body.classList.add('ag-shake');
  setTimeout(() => document.body.classList.remove('ag-shake'), 500);
}
function butterflyBurst(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 9) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'ag-burst';
    s.innerHTML = i % 3 === 0 ? icon('spark', { size: 16 }) : icon('butterfly', { size: 18 });
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--bx', `${(Math.random() - 0.5) * 340}px`);
    s.style.setProperty('--by', `${-40 - Math.random() * 220}px`);
    s.style.setProperty('--br', `${(Math.random() - 0.5) * 320}deg`);
    s.style.animationDelay = `${i * 45}ms`;
    root.appendChild(s);
    setTimeout(() => s.remove(), 1700);
  }
}
function toast(title, body, kind = '') {
  const el = document.createElement('div');
  el.className = `ag-toast ${kind}`;
  el.innerHTML = `<div class="ag-toast-title">${esc(title)}</div><div class="ag-toast-body">${esc(body)}</div>`;
  $('ag-toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
}

// ---------------------------------------------------------------------------
// SCREENS / LOCKING
// ---------------------------------------------------------------------------
const SCREENS = ['title', 'chapter', 'journal', 'pause', 'ending', 'evidence'];
function showScreen(name) {
  for (const s of SCREENS) $(`ag-${s}`).classList.add('ag-hidden');
  if (name) $(`ag-${name}`).classList.remove('ag-hidden');
  openScreen = name || null;
  lock(!!openScreen);
  if (name) cinematic(true);
}
function hideScreens() {
  for (const s of SCREENS) $(`ag-${s}`).classList.add('ag-hidden');
  openScreen = null;
}
function lock(v) {
  document.body.classList.toggle('ag-locked', !!v);
  bus.api.setInputLock?.(!!v);
}
function cinematic(v) {
  document.body.classList.toggle('ag-cinematic', !!v);
  $('ag-hud').classList.toggle('ag-fade', !!v);
}

/** Finish the typewriter instantly so no text is lost behind an overlay. */
function freezeDialogue() {
  if (!dialogueState.typing) return;
  clearInterval(dialogueState.timer);
  dialogueState.typed = dialogueState.full;
  dialogueState.typing = false;
  $('ag-text').textContent = dialogueState.full;
  $('ag-continue').classList.add('on');
}
/** Park the countdown clock; `tickWorld` only advances a live `choiceCtx`. */
function freezeChoice() {
  if (!choiceCtx) return;
  pausedChoice = { ...choiceCtx, remaining: Math.max(250, choiceCtx.deadline - performance.now()) };
  choiceCtx = null;
}
function thawChoice() {
  if (!pausedChoice) return;
  choiceCtx = { ...pausedChoice, deadline: performance.now() + pausedChoice.remaining };
  pausedChoice = null;
}
function canOpenOverlay(name) {
  if (openScreen === 'title' || phase === 'title') return false;
  // Chapter cards and evidence scans are scene beats, not menus: they own the
  // screen and must be dismissed through their own continuation path.
  if (openScreen === 'chapter' || openScreen === 'evidence') return false;
  if (phase === 'ending' && name === 'pause') return false;
  return true;
}
/** Single entry point for journal / pause overlays. Never changes `phase`. */
function openOverlay(name) {
  if (!canOpenOverlay(name)) return false;
  if (!openScreen) { freezeDialogue(); freezeChoice(); }
  showScreen(name);
  uiSfx('click');
  return true;
}
/** Restore whatever was on screen before an overlay took over. */
function restorePhase() {
  switch (phase) {
    case 'ending':
      showScreen('ending');
      break;
    case 'dialogue':
      resumeDialogue();
      break;
    case 'choice':
      resumeChoices();
      break;
    case 'tutorial':
      lock(false); cinematic(false);
      break;
    default:
      enterExplore();
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function renderHUD() {
  const ch = CHAPTERS[state.chapterId] || CHAPTERS.prologo;
  $('ag-chap-kicker').textContent = ch.index;
  $('ag-chap-title').textContent = ch.title;

  // Icon + number only: the label lives in the tooltip, not on screen.
  $('ag-stats').innerHTML = ['confianza', 'notas', 'integridad'].map((k) => {
    const m = STAT_META[k];
    const val = Math.round(state.stats[k] ?? 0);
    const tone = val >= 70 ? 'high' : val <= 35 ? 'low' : '';
    return `<div class="ag-stat ${tone}" data-key="${k}" title="${esc(m.label)}: ${val}">${icon(m.icon, { size: 16 })}<span>${val}</span></div>`;
  }).join('');
  $('ag-pips').innerHTML = Array.from({ length: MAX_CHARGES }, (_, i) => `<span class="ag-pip ${i < state.charges ? 'on' : ''}"></span>`).join('');
  $('ag-pips').title = `Eco: ${state.charges}/${MAX_CHARGES} recargas`;
  $('ag-money').innerHTML = `${icon('coin', { size: 14 })}<span>${STAT_META.dinero.prefix || ''}${state.stats.dinero}</span>`;
  $('ag-clue-count').innerHTML = `${icon('search', { size: 14 })}${state.clues.length}/${TOTAL_CLUES}`;
  $('ag-btn-rewind').disabled = !canRewind(state).ok;
}
function renderObjective() {
  const box = $('ag-objective');
  if (!objective) { box.classList.add('ag-hidden'); return; }
  box.classList.remove('ag-hidden');
  $('ag-obj-icon').innerHTML = icon(HOTSPOTS[objective.hotspot]?.icon || 'compass', { size: 18 });
  $('ag-obj-text').textContent = objective.text;
  const d = bus.api.distanceTo?.(objective.hotspot);
  $('ag-obj-dist').textContent = Number.isFinite(d) ? `${d.toFixed(1)} m` : '';
}

// ---------------------------------------------------------------------------
// 3D OBJECTIVE BEACON + SCREEN WAYPOINT
// ---------------------------------------------------------------------------
function ensureBeacon() {
  if (beacon || !bus.api.scene) return;
  const g = new THREE.Group();
  const mk = (geo, color, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  const ring = mk(new THREE.TorusGeometry(0.46, 0.028, 8, 48), 0xf5a524, 0.95);
  ring.rotation.x = Math.PI / 2;
  const ring2 = mk(new THREE.TorusGeometry(0.66, 0.014, 8, 48), 0xfbbf24, 0.5);
  ring2.rotation.x = Math.PI / 2;
  const beam = mk(new THREE.CylinderGeometry(0.10, 0.34, 3.4, 20, 1, true), 0xf5a524, 0.055);
  beam.position.y = 1.7;
  beam.material.blending = THREE.AdditiveBlending;
  const arrow = mk(new THREE.ConeGeometry(0.16, 0.34, 16), 0xfbbf24, 0.9);
  arrow.rotation.z = Math.PI;
  arrow.position.y = 1.25;
  g.add(ring, ring2, beam, arrow);
  g.visible = false;
  bus.api.scene.add(g);
  beacon = { group: g, ring, ring2, beam, arrow };
}
function tickWorld(time) {
  ensureBeacon();
  const wp = $('ag-waypoint');
  const active = objective || (tutorial && TUTORIAL_STEPS[tutorial.index]?.id === 'approach' ? { hotspot: 'desk', label: 'Escritorio' } : null);

  if (beacon) {
    beacon.group.visible = !!active;
    if (active) {
      const p = bus.api.hotspotPosition?.(active.hotspot);
      if (p) {
        beacon.group.position.set(p.x, 0.07, p.z);
        beacon.ring.rotation.z = time * 0.7;
        beacon.ring2.rotation.z = -time * 0.45;
        beacon.arrow.position.y = 1.2 + Math.sin(time * 2.6) * 0.13;
        const pulse = 0.75 + Math.sin(time * 3) * 0.25;
        beacon.ring.material.opacity = pulse;
        beacon.beam.material.opacity = 0.035 + pulse * 0.035;
      }
    }
  }

  if (!active) { wp.classList.remove('on'); }
  else {
    const p = bus.api.hotspotPosition?.(active.hotspot);
    const proj = p ? bus.api.project?.(p.clone().add(new THREE.Vector3(0, 1.0, 0))) : null;
    if (proj) {
      const pad = 60;
      const x = Math.max(pad, Math.min(window.innerWidth - pad, proj.x));
      const y = Math.max(pad, Math.min(window.innerHeight - pad, proj.y));
      wp.style.left = `${x}px`;
      wp.style.top = `${y}px`;
      wp.classList.add('on');
      wp.classList.toggle('offscreen', !proj.visible);
      const d = bus.api.distanceTo?.(active.hotspot);
      wp.querySelector('.ag-waypoint-label').textContent = Number.isFinite(d) ? `${d.toFixed(1)} m` : '';
      if (objective) $('ag-obj-dist').textContent = Number.isFinite(d) ? `${d.toFixed(1)} m` : '';
    } else wp.classList.remove('on');
  }

  // Onboarding assistant: step 1 completes on real movement or a real drag.
  if (isAssistantActive()) {
    const pos = bus.api.avatarPosition?.();
    if (pos) {
      if (lastAvatarPos) travelled += Math.hypot(pos.x - lastAvatarPos.x, pos.z - lastAvatarPos.z);
      lastAvatarPos = { x: pos.x, z: pos.z };
    }
    if (travelled > 1.8 || dragTotal > 70) assistantSignal('explore');
  }

  // Tutorial proximity checks.
  if (phase === 'tutorial' && tutorial && !tutorial.checking) {
    const step = TUTORIAL_STEPS[tutorial.index];
    const pos = bus.api.avatarPosition?.();
    if (pos && lastAvatarPos) {
      travelled += Math.hypot(pos.x - lastAvatarPos.x, pos.z - lastAvatarPos.z);
    }
    if (pos) lastAvatarPos = { x: pos.x, z: pos.z };
    if (step.id === 'move' && travelled > 2.0) completeTutorialStep();
    if (step.id === 'approach' && (bus.api.distanceTo?.('desk') ?? 99) < 2.9) completeTutorialStep();
  }

  // Choice countdown.
  if (choiceCtx) {
    const remaining = Math.max(0, choiceCtx.deadline - performance.now());
    const ratio = remaining / choiceCtx.duration;
    $('ag-timer-fill').style.transform = `scaleX(${ratio})`;
    $('ag-timer-text').textContent = remaining > 0 ? `DECIDE IN ${(remaining / 1000).toFixed(1)} s` : 'TIME DECIDED FOR YOU';
    choiceCtx.container.querySelectorAll('.ag-choice').forEach((b) => b.dataset.urgent = remaining < 4000 ? 'true' : 'false');
    if (remaining <= 0) {
      const fallback = choiceCtx.available[0];
      const ctx = choiceCtx;
      choiceCtx = null;
      toast('Time decided for you', 'Hesitating is an answer too.', 'red');
      if (fallback) pickChoice(fallback, ctx);
      else {
        // Defensive only: the story graph always keeps one open branch, but a
        // blank screen is worse than skipping a beat.
        $('ag-choices').classList.remove('on');
        const forced = SCENES[ctx.sceneId]?.choices?.[0];
        if (forced) playScene(forced.next);
        else enterExplore();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DIALOGUE
// ---------------------------------------------------------------------------
function startDialogue(lines, onDone) {
  phase = 'dialogue';
  dialogueState.lines = lines || [];
  dialogueState.index = 0;
  dialogueState.onDone = onDone;
  lock(true); cinematic(true);
  $('ag-choices').classList.remove('on');
  $('ag-dialogue').classList.add('on');
  showLine(0);
}
function showLine(i, instant = false) {
  clearInterval(dialogueState.timer);
  const line = dialogueState.lines[i];
  if (!line) { finishDialogue(); return; }
  dialogueState.index = i;
  const sp = SPEAKERS[line.who] || SPEAKERS.narrador;
  $('ag-portrait').innerHTML = portraitSVG(line.who);
  const roleHtml = sp.role ? `<span class="ag-speaker-role">${esc(sp.role)}</span>` : '';
  $('ag-speaker').innerHTML = `<span>${esc(sp.name)}</span>${roleHtml}<span class="ag-speaker-rule"></span>`;
  $('ag-dialogue').dataset.style = line.style || sp.style || 'default';
  dialogueState.full = line.text;
  dialogueState.typed = '';
  dialogueState.tickCounter = 0;
  // Restoring after an overlay shows the whole line at once: replaying the
  // typewriter would feel like the character started the sentence over.
  if (instant) {
    dialogueState.typed = dialogueState.full;
    dialogueState.typing = false;
    $('ag-text').textContent = dialogueState.full;
    $('ag-continue').classList.add('on');
    return;
  }
  dialogueState.typing = true;
  $('ag-continue').classList.remove('on');
  $('ag-text').innerHTML = '<span class="ag-caret"></span>';
  const speed = line.style === 'ledger' ? 12 : 19;
  dialogueState.timer = setInterval(() => {
    if (dialogueState.typed.length >= dialogueState.full.length) {
      clearInterval(dialogueState.timer);
      dialogueState.typing = false;
      $('ag-text').textContent = dialogueState.full;
      $('ag-continue').classList.add('on');
      return;
    }
    dialogueState.typed += dialogueState.full[dialogueState.typed.length];
    $('ag-text').innerHTML = `${esc(dialogueState.typed)}<span class="ag-caret"></span>`;
    dialogueState.tickCounter++;
    if (dialogueState.tickCounter % 7 === 0) uiSfx('hover');
  }, speed);
}
function advanceDialogue() {
  if (phase !== 'dialogue') return;
  if (dialogueState.typing) {
    clearInterval(dialogueState.timer);
    dialogueState.typed = dialogueState.full;
    dialogueState.typing = false;
    $('ag-text').textContent = dialogueState.full;
    $('ag-continue').classList.add('on');
    return;
  }
  uiSfx('click');
  if (dialogueState.index + 1 < dialogueState.lines.length) showLine(dialogueState.index + 1);
  else finishDialogue();
}
function finishDialogue() {
  clearInterval(dialogueState.timer);
  $('ag-dialogue').classList.remove('on');
  $('ag-continue').classList.remove('on');
  const cb = dialogueState.onDone;
  dialogueState.onDone = null;
  if (cb) cb();
}

// ---------------------------------------------------------------------------
// CHOICES
// ---------------------------------------------------------------------------
function showChoices(scene, sceneId) {
  phase = 'choice';
  lock(true); cinematic(true);
  $('ag-dialogue').classList.remove('on');
  const all = scene.choices || [];
  const available = availableChoices(state, sceneId);
  const list = $('ag-choice-list');
  list.innerHTML = '';
  all.forEach((c, idx) => {
    const unlocked = requirementsMet(state, c.requires);
    const btn = document.createElement('button');
    btn.className = `ag-choice ${unlocked ? '' : 'locked'}`;
    // Keyboard shortcuts must follow the number printed on screen, even when a
    // locked branch sits above an unlocked one.
    btn.dataset.num = String(idx + 1);
    btn.dataset.choiceId = c.id;
    btn.style.animationDelay = `${idx * 90}ms`;
    btn.innerHTML = `
      <span class="ag-choice-num">${idx + 1}</span>
      <span class="ag-choice-label">${esc(c.label)}</span>
      ${unlocked
        ? `<span class="ag-choice-tag">${esc(c.tag || '')}</span>`
        : `<span class="ag-choice-lock">${icon('lock', { size: 14 })}${c.requires?.allClues ? `${state.clues.length}/${TOTAL_CLUES}` : ''}</span>`}`;
    if (unlocked) btn.addEventListener('click', () => pickChoice(c));
    else btn.addEventListener('click', () => toast('Path closed', c.requires?.allClues ? `Find all ${TOTAL_CLUES} clues to open this path.` : 'You would have had to act differently.', 'red'));
    list.appendChild(btn);
  });
  kbFocus = 0;
  updateKbFocus(list);
  $('ag-choices').classList.add('on');
  // Every authored scene has at least one open branch, but never let a fully
  // locked scene hang the game on `Math.min(...[])` → Infinity.
  const duration = available.length
    ? Math.min(...available.map((c) => c.timeLimit || 15000))
    : 15000;
  choiceCtx = { sceneId, available, container: $('ag-choices'), deadline: performance.now() + duration, duration };
  $('ag-timer-wrap').classList.remove('ag-hidden');
  uiSfx('chapter');
}
function resumeChoices() {
  lock(true); cinematic(true);
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.add('on');
  $('ag-timer-wrap').classList.remove('ag-hidden');
  thawChoice();
  updateKbFocus($('ag-choice-list'));
}
function updateKbFocus(list) {
  list.querySelectorAll('.ag-choice:not(.locked)').forEach((b, i) => b.classList.toggle('kbfocus', i === kbFocus));
  list.querySelectorAll('.ag-choice.locked').forEach((b) => b.classList.remove('kbfocus'));
}
function pickChoice(choice, ctxOverride) {
  const ctx = ctxOverride || choiceCtx;
  if (!ctx) return;
  choiceCtx = null;
  $('ag-choices').classList.remove('on');
  $('ag-timer-wrap').classList.add('ag-hidden');

  const before = state;
  const result = choose(state, ctx.sceneId, choice.id);
  if (!result.ok) { toast('That path is closed', result.reason || '', 'red'); showChoices(SCENES[ctx.sceneId], ctx.sceneId); return; }
  state = result.state;

  bus.api.appendLedger?.(choice.ledger?.type || 'decision.made', {
    ...(choice.ledger || {}), scene: ctx.sceneId, choice: choice.id,
    label: choice.label, effects: choice.effects, at: new Date().toISOString(),
  });

  uiSfx('choice'); flash(); butterflyBurst(window.innerWidth / 2, window.innerHeight * 0.52, 12);
  if (choice.weather !== undefined) {
    bus.api.setWorldState?.(choice.weather);
    state.weather = choice.weather;
    if (choice.weather === 1) shake();
  }
  showConsequence(choice.effects);
  save();
  const next = choice.next;
  setTimeout(() => { hideConsequence(); playScene(next); }, 2050);
}
function showConsequence(effects = {}) {
  const deltas = [];
  for (const [k, v] of Object.entries(effects.stats || {})) {
    const meta = STAT_META[k];
    if (!meta) continue;
    const sign = v > 0 ? '+' : '';
    deltas.push(`<span class="ag-delta ${v > 0 ? 'up' : 'down'}" style="animation-delay:${deltas.length * 70}ms">${icon(meta.icon, { size: 14 })}${esc(meta.label)} ${sign}${v}${k === 'dinero' ? '$' : ''}</span>`);
  }
  if (effects.flags?.length) deltas.push(`<span class="ag-delta">${icon('pen', { size: 14 })}${effects.flags.length} mark${effects.flags.length > 1 ? 's' : ''} on your story</span>`);
  $('ag-cons-deltas').innerHTML = deltas.join('');
  $('ag-consequence').classList.add('on');
}
function hideConsequence() { $('ag-consequence').classList.remove('on'); }

// ---------------------------------------------------------------------------
// SCENE FLOW
// ---------------------------------------------------------------------------
function handleGrant(scene, before) {
  if (!scene.grant) return;
  const newClues = state.clues.filter((c) => !before.clues.includes(c));
  for (const c of newClues) {
    toast(`New clue · ${CLUES[c]?.title || c}`, '+1 Echo charge', 'green');
  }
  if (scene.grant.charges && !newClues.length) toast('Echo restored', 'A new clue gives a charge back.', 'cyan');
  if (newClues.length) { uiSfx('clue'); butterflyBurst(window.innerWidth * 0.72, window.innerHeight * 0.3, 6); }
  if (scene.grant.ledger) bus.api.appendLedger?.(scene.grant.ledger.type, { ...scene.grant.ledger, scene: currentSceneId, at: new Date().toISOString() });
  // The first sealed object is the third onboarding beat: the player has just
  // watched SAM anchor a real thing and the ledger accept it.
  if (newClues.length) assistantSignal('rebuild');
  renderHUD();
}
function playScene(sceneId) {
  if (!SCENES[sceneId]) { console.warn('[arcadia] unknown scene', sceneId); enterExplore(); return; }
  const before = state;
  const result = enterScene(state, sceneId);
  state = result.state;
  currentSceneId = sceneId;
  save();
  renderHUD();
  const scene = result.scene;
  const grantedNow = state.grantedScenes.length > before.grantedScenes.length;
  if (scene.weather !== undefined && scene.weather !== before.weather) bus.api.setWorldState?.(scene.weather);
  if (scene.grant && grantedNow) handleGrant(scene, before);

  if (scene.chapterCard) {
    showChapterCard(scene.chapter, () => runSceneBody(scene));
    return;
  }
  runSceneBody(scene);
}
function runSceneBody(scene) {
  if (scene.evidence) {
    showEvidence(scene.evidence, () => {
      if (scene.lines?.length) startDialogue(scene.lines, () => afterLines(scene));
      else afterLines(scene);
    });
    return;
  }
  if (scene.lines?.length) { startDialogue(scene.lines, () => afterLines(scene)); return; }
  afterLines(scene);
}
function afterLines(scene) {
  if (scene.choices) { showChoices(scene, currentSceneId); return; }
  if (scene.objective) { setObjective(scene.objective); return; }
  if (scene.ending) { showEnding(); return; }
  if (scene.next) { playScene(scene.next); return; }
  enterExplore();
}
function setObjective(obj) {
  objective = obj;
  state.objective = obj;
  phase = 'explore';
  for (const [id, label] of Object.entries(originalLabels)) bus.api.setHotspotLabel?.(id, label);
  bus.api.setHotspotLabel?.(obj.hotspot, obj.label || 'Interact');
  renderObjective();
  save();
  lock(false); cinematic(false);
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.remove('on');
}
function clearObjective() {
  objective = null;
  state.objective = null;
  $('ag-objective').classList.add('ag-hidden');
  for (const [id, label] of Object.entries(originalLabels)) bus.api.setHotspotLabel?.(id, label);
}
function enterExplore() {
  phase = 'explore';
  lock(false); cinematic(false);
  bus.api.clearFocus?.();
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.remove('on');
  renderObjective();
}
function resumeDialogue() {
  lock(true); cinematic(true);
  $('ag-choices').classList.remove('on');
  $('ag-dialogue').classList.add('on');
  showLine(dialogueState.index, true);
}

// ---------------------------------------------------------------------------
// FLAVOUR EXPLORATION (optional clues hidden around the room)
// ---------------------------------------------------------------------------
function playFlavor(hotspotId) {
  const sceneId = FLAVOR[hotspotId];
  const scene = SCENES[sceneId];
  if (!scene) return;
  const before = state;
  if (scene.grant && !state.grantedScenes.includes(sceneId)) {
    const tmp = cloneState(state);
    const res = enterScene(tmp, sceneId);
    const next = res.state;
    next.sceneId = state.sceneId;
    next.chapterId = state.chapterId;
    next.weather = state.weather;
    next.objective = state.objective;
    state = next;
    handleGrant(scene, before);
    save();
  }
  uiSfx('click');
  startDialogue(scene.lines || [], () => enterExplore());
}

// ---------------------------------------------------------------------------
// INTERACTION / REWIND BUS BRIDGE
// ---------------------------------------------------------------------------
function onInteract(detail) {
  if (!detail) return true;
  // Always swallow interactions while a full-screen screen is open.
  if (openScreen) return true;
  if (phase === 'tutorial') {
    if (detail.id === 'desk' && TUTORIAL_STEPS[tutorial?.index]?.id === 'interact') completeTutorialStep();
    uiSfx('click');
    return true;
  }
  if (phase === 'dialogue' || phase === 'choice' || phase === 'ending') return true;

  if (objective && detail.id === objective.hotspot) {
    const next = objective.next;
    clearObjective();
    uiSfx('click');
    flash();
    playScene(next);
    return true;
  }
  // Sitting down / lying back is the fourth and last onboarding beat.
  if (detail.id === 'armchair' || detail.id === 'bed') assistantSignal('reflect');

  // Posture hotspots also keep their legacy 3D animation.
  playFlavor(detail.id);
  return ['guitar', 'bed', 'armchair'].includes(detail.id) ? 'legacy' : true;
}

function requestRewind() {
  if (openScreen === 'title' || openScreen === 'ending' || phase === 'ending') return;
  if (phase === 'tutorial') {
    if (TUTORIAL_STEPS[tutorial?.index]?.id === 'rewind') completeTutorialStep();
    bus.emit('fx:rewind');
    fxRewind();
    return;
  }
  if (phase === 'dialogue' || phase === 'choice' || openScreen) {
    toast('The Echo does not answer', 'Finish the scene before bending time.', 'red');
    return;
  }
  const check = canRewind(state);
  if (!check.ok) {
    uiSfx('error');
    const messages = {
      NO_CHARGE: 'No charges left. Explore the room to recover them.',
      NO_DECISION: 'There is no decision to undo yet.',
      NO_SNAPSHOT: 'That instant is already too far back. Make a new decision.',
      FINISHED: 'This timeline is already closed.',
    };
    toast('The Echo does not answer', messages[check.reason] || 'You cannot rewind right now.', 'red');
    return;
  }
  const res = rewind(state);
  state = res.state;
  bus.api.appendLedger?.('timeline.rewound', {
    note: 'Time comes undone; the record remains',
    fromScene: res.entry.sceneId, undoneChoice: res.entry.choiceId,
    remembered: res.entry.label, chargesLeft: state.charges,
    at: new Date().toISOString(),
  });
  clearObjective();
  choiceCtx = null;
  $('ag-choices').classList.remove('on');
  save(); renderHUD();
  bus.emit('fx:rewind');
  fxRewind();
  toast('Timeline rewritten', `You remember: ${res.entry.label}. The ledger keeps the block.`, 'cyan');
}
function fxRewind() {
  document.body.classList.add('ag-rewinding');
  uiSfx('rewind');
  butterflyBurst(window.innerWidth / 2, window.innerHeight / 2, 10);
  setTimeout(() => {
    document.body.classList.remove('ag-rewinding');
    bus.api.setWorldState?.(state.weather);
    if (phase === 'tutorial') return;
    playScene(state.sceneId);
  }, 1450);
}

// ---------------------------------------------------------------------------
// CHAPTER CARD / EVIDENCE
// ---------------------------------------------------------------------------
function showChapterCard(chapterId, done) {
  const ch = CHAPTERS[chapterId] || CHAPTERS.prologo;
  openScreen = 'chapter';
  $('ag-chapter-inner').innerHTML = `
    <div class="ag-chapter-sheet">
      <div class="ag-tape wide"></div>
      <div class="ag-chapter-num">${esc(ch.index)}</div>
      <div class="ag-chapter-title">${esc(ch.title)}</div>
      <div class="ag-chapter-sub">${esc(ch.subtitle)}</div>
      <div class="ag-chapter-epigraph">${esc(ch.epigraph)}</div>
    </div>`;
  showScreen('chapter');
  flash(); uiSfx('chapter');
  setTimeout(() => { hideScreens(); openScreen = null; lock(true); cinematic(true); done(); }, 2900);
}

const EVIDENCE_VIEWS = {
  mask: {
    title: 'PIXEL ANCHOR · SAM 3.1', meta: 'Muse Spark 1.3 → SAM 3.1',
    visual: `<div class="ag-ev-bubble"><span class="ag-ev-time">post-it</span>DELIVERY · thursday 17:00 · $200</div><div class="ag-ev-scan"></div><div class="ag-ev-line"></div>`,
    stats: [['IoU', '99.96 %'], ['BOX', '[24,232,519,427]'], ['CONFIDENCE', '0.9996']],
  },
  voice: {
    title: 'AUDIO ANCHOR · MUSE VOICE 1.0', meta: '16 kHz · mono · PCM 16-bit',
    visual: `<div class="ag-ev-wave">${Array.from({ length: 54 }, (_, i) => `<i style="height:${18 + Math.abs(Math.sin(i * 0.7)) * 90}px;animation-delay:${(i % 9) * 90}ms"></i>`).join('')}</div>`,
    stats: [['TURN', '2 · Speaker A'], ['START', '00:04.400'], ['END', '00:08.600']],
  },
  schedule: {
    title: 'ANCHORED DOCUMENT · TICKET', meta: 'Thursday · seat 14C',
    visual: `<div class="ag-ev-bubble" style="font-family:var(--ag-mono);font-size:12px;background:#f8f1e5;color:#33261a">THURSDAY · 16:30<br><b>DEPARTURE · CENTRAL STATION</b><br>Platform 3 · seat 14C</div><div class="ag-ev-scan" style="border-color:#34d399"></div>`,
    stats: [['SEAL', 'BUS-1430'], ['DAY', 'THURSDAY'], ['DEPARTURE', '16:30']],
  },
  conflict: {
    title: 'CAUSAL CONFLICT DETECTED', meta: 'Bitemporal · asOf() · 1 match',
    visual: `<div class="ag-ev-conflict"><div class="ag-ev-slip"><b>DELIVERY · 17:00</b><span>16:15 → 17:00</span></div><div class="ag-ev-slip bad"><b>BUS · 16:30</b><span>16:15 → 16:30</span></div><div class="ag-ev-overlap">${icon('warning', { size: 16 })} OVERLAP · 45 MIN</div></div>`,
    stats: [['ANCHORS', '3'], ['CONFLICTS', '1'], ['LEDGER', 'VALID']],
  },
};
function showEvidence(type, done) {
  const view = EVIDENCE_VIEWS[type];
  if (!view) { done(); return; }
  $('ag-evidence').innerHTML = `
    <div class="ag-ev-card">
      <div class="ag-ev-head"><h2>${esc(view.title)}</h2><span>${esc(view.meta)}</span></div>
      <div class="ag-ev-visual">${view.visual}</div>
      <div class="ag-ev-meta">${view.stats.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>
      <div class="ag-ev-foot"><button class="ag-icon-btn primary" id="ag-ev-continue">Seal evidence →</button></div>
    </div>`;
  showScreen('evidence');
  uiSfx('clue');
  $('ag-ev-continue').addEventListener('click', () => {
    uiSfx('click'); hideScreens(); openScreen = null; lock(true); cinematic(true); done();
  });
}

// ---------------------------------------------------------------------------
// JOURNAL
// ---------------------------------------------------------------------------
function showJournal() {
  const found = state.clues.length;
  const clueSlips = Object.entries(CLUES).map(([id, c]) => {
    const has = state.clues.includes(id);
    return `<div class="ag-clue ${has ? '' : 'missing'}" title="${esc(has ? c.detail : 'You have not found it yet')}">
      <span class="ag-clue-ic">${icon(has ? c.icon : 'lock', { size: 17 })}</span>
      <span class="ag-clue-t">${esc(has ? c.title : 'not found')}</span>
      ${has ? `<span class="ag-clue-mark">${icon('check', { size: 13 })}</span>` : ''}
    </div>`;
  }).join('');

  const decisionStamps = state.decisions.length
    ? state.decisions.map((d) => `<div class="ag-stamp ${d.undone ? 'undone' : ''}">
        <span class="ag-stamp-mark">${d.undone ? 'UNDONE' : 'SEALED'}</span>
        <span class="ag-stamp-label">${esc(d.label)}</span>
      </div>`).join('')
    : '<p class="ag-hand-empty">Nothing written here yet.</p>';

  const statInk = Object.entries(STAT_META).map(([k, m]) => `<div class="ag-ink-row">
      ${icon(m.icon, { size: 16 })}
      <span class="ag-ink-name">${esc(m.label)}</span>
      <span class="ag-ink-val">${m.prefix || ''}${Math.round(state.stats[k] ?? 0)}</span>
    </div>`).join('');

  const blocks = bus.api.ledgerCount?.() ?? '—';
  const ch = CHAPTERS[state.chapterId] || CHAPTERS.prologo;

  const pendientes = [
    `<li>${esc(ch.title)} · ${esc(ch.subtitle)}</li>`,
    objective ? `<li>${esc(objective.text)}</li>` : null,
    found < TOTAL_CLUES
      ? `<li>I still have <b>${TOTAL_CLUES - found}</b> clues to find.</li>`
      : '<li>I have all eight clues. Now to seal them.</li>',
    `<li>Echo: <b>${state.charges}</b> charges available.</li>`,
  ].filter(Boolean).join('');

  $('ag-journal').innerHTML = `
    <div class="ag-book">
      <button class="ag-book-close ag-interactive" id="ag-journal-close" title="Close">${icon('close', { size: 20 })}</button>
      <div class="ag-book-spiral">${notebookSpiral(20)}</div>
      <div class="ag-book-spread">
        <article class="ag-book-page" data-page="0">
          <span class="ag-page-tab">the week</span>
          <div class="ag-page-paper">
            <div class="ag-polaroid journal">
              <div class="ag-tape"></div>
              <div class="ag-photo">${polaroidScene(1)}</div>
              <div class="ag-cap">the lighthouse, October</div>
            </div>
            <h2 class="ag-hand-title">What I know</h2>
            <ul class="ag-hand-list">
              <li><b>Tuesday.</b> The post-it says: delivery thursday at 17:00. $200.</li>
              <li><b>21:14.</b> My voice note: the bus leaves at 16:30.</li>
              <li><b>Thursday.</b> The two do not fit.</li>
            </ul>
            <p class="ag-hand-aside">${icon('arrowRight', { size: 16 })} if I deliver, I miss the bus. if I leave, I break my word.</p>
            <p class="ag-hand-sign">${esc(ch.title)} · ${esc(ch.subtitle)}</p>
          </div>
          <span class="ag-page-num">1</span>
        </article>

        <article class="ag-book-page" data-page="1">
          <span class="ag-page-tab">clues</span>
          <div class="ag-page-paper">
            <h2 class="ag-hand-title">Clues <em>${found}/${TOTAL_CLUES}</em></h2>
            <div class="ag-clue-grid">${clueSlips}</div>
            <p class="ag-hand-aside">${icon('butterfly', { size: 16 })} every clue gives an Echo charge back.</p>
            <div class="ag-page-doodle">${icon('lighthouse', { size: 64, stroke: 1.2 })}</div>
          </div>
          <span class="ag-page-num">2</span>
        </article>

        <article class="ag-book-page is-hidden" data-page="2">
          <span class="ag-page-tab">decisions</span>
          <div class="ag-page-paper">
            <h2 class="ag-hand-title">Outstanding</h2>
            <ul class="ag-hand-list">${pendientes}</ul>
            <h2 class="ag-hand-title small">Decisions</h2>
            <div class="ag-stamp-list">${decisionStamps}</div>
            <p class="ag-hand-aside">${icon('pen', { size: 16 })} the ledger does not erase: it marks.</p>
            <div class="ag-page-doodle">${icon('compass', { size: 68, stroke: 1.2 })}</div>
          </div>
          <span class="ag-page-num">3</span>
        </article>

        <article class="ag-book-page is-hidden" data-page="3">
          <span class="ag-page-tab">other lines</span>
          <div class="ag-page-paper">
            <h2 class="ag-hand-title">Your record</h2>
            <div class="ag-ink-list">${statInk}</div>
            <h2 class="ag-hand-title small">Other lines</h2>
            <p class="ag-hand-body">${state.memories.length ? state.memories.map((m) => `«${esc(m)}»`).join('<br>') : 'None. You have not rewound yet.'}</p>
            <p class="ag-hand-sign">${blocks} SHA-256 blocks · ${state.rewindCount} rewinds</p>
          </div>
          <span class="ag-page-num">4</span>
        </article>
      </div>

      <div class="ag-book-nav">
        <button class="ag-nav-text ag-interactive" id="ag-journal-prev">${icon('arrowLeft', { size: 15 })} Previous</button>
        <span class="ag-nav-page" id="ag-journal-pageno">1–2</span>
        <button class="ag-nav-text ag-interactive" id="ag-journal-next">Next ${icon('arrowRight', { size: 15 })}</button>
        <span class="ag-nav-sep"></span>
        <button class="ag-nav-text ag-interactive" id="ag-journal-ledger">Ledger</button>
        <button class="ag-nav-text ag-interactive" id="ag-journal-tutorial">Controls</button>
      </div>
    </div>`;

  if (!openOverlay('journal')) return false;

  let spread = 0;
  const pages = [...$('ag-journal').querySelectorAll('.ag-book-page')];
  const renderSpread = () => {
    pages.forEach((p, i) => p.classList.toggle('is-hidden', Math.floor(i / 2) !== spread));
    $('ag-journal-pageno').textContent = spread === 0 ? '1–2' : '3–4';
    $('ag-journal-prev').disabled = spread === 0;
    $('ag-journal-next').disabled = spread === 1;
  };
  renderSpread();
  $('ag-journal-prev').addEventListener('click', () => { spread = 0; renderSpread(); uiSfx('hover'); });
  $('ag-journal-next').addEventListener('click', () => { spread = 1; renderSpread(); uiSfx('hover'); });
  $('ag-journal-close').addEventListener('click', closeOverlay);
  $('ag-journal-ledger').addEventListener('click', () => { closeOverlay(); bus.api.toggleLedger?.(); });
  $('ag-journal-tutorial').addEventListener('click', () => {
    const screen = overlayReturn || (phase === 'ending' ? 'ending' : 'game');
    tutorialReturn = { screen, phase };
    overlayReturn = null;
    hideScreens();
    startTutorial(true);
  });
  return true;
}

// ---------------------------------------------------------------------------
// PAUSE
// ---------------------------------------------------------------------------
function showPause() {
  const ch = CHAPTERS[state.chapterId] || CHAPTERS.prologo;
  const notes = {
    resume: ['Back to the scene', 'Time stays where you left it. If a decision was open, the counter is frozen.'],
    journal: ['Notebook', 'The week, the clues you carry, the decisions sealed and what you remember from other lines.'],
    tutorial: ['Controls', 'Review how to move, orbit the camera and interact without leaving the game.'],
    music: ['Turntable', 'Three original pieces generated in the browser. No licensed audio.'],
    sound: ['Sound', 'Turn the interface clicks and cues on or off.'],
    restart: ['Restart', 'Erases this timeline and starts from scratch. The previous ledger stays on disk.'],
    title: ['Title', 'Back to the cover. The game stays saved where it is.'],
  };
  $('ag-pause').innerHTML = `
    <div class="ag-menu">
      <div class="ag-menu-tabs" role="tablist">
        <button class="ag-tab-btn is-active" data-tab="game">Game</button>
        <button class="ag-tab-btn" data-tab="audio">Audio</button>
        <button class="ag-tab-btn" data-tab="system">System</button>
      </div>
      <div class="ag-menu-body">
        <div class="ag-menu-rows" data-panel="game">
          <button class="ag-row" id="ag-p-resume" data-note="resume"><span class="ag-row-ic">${icon('play', { size: 18 })}</span><span class="ag-row-label">Continue</span><span class="ag-row-val">ESC</span></button>
          <button class="ag-row" id="ag-p-journal" data-note="journal"><span class="ag-row-ic">${icon('book', { size: 18 })}</span><span class="ag-row-label">Notebook</span><span class="ag-row-val">J</span></button>
          <button class="ag-row" id="ag-p-tutorial" data-note="tutorial"><span class="ag-row-ic">${icon('compass', { size: 18 })}</span><span class="ag-row-label">Controls</span><span class="ag-row-val">?</span></button>
          <div class="ag-row static"><span class="ag-row-ic">${icon('butterfly', { size: 18 })}</span><span class="ag-row-label">Echo</span><span class="ag-row-val">${state.charges}/${MAX_CHARGES}</span></div>
          <div class="ag-row static"><span class="ag-row-ic">${icon('search', { size: 18 })}</span><span class="ag-row-label">Clues</span><span class="ag-row-val">${state.clues.length}/${TOTAL_CLUES}</span></div>
          <div class="ag-row static"><span class="ag-row-ic">${icon('chain', { size: 18 })}</span><span class="ag-row-label">Chapter</span><span class="ag-row-val">${esc(ch.index)} · ${esc(ch.title)}</span></div>
        </div>
        <div class="ag-menu-rows is-hidden" data-panel="audio">
          <button class="ag-row" id="ag-p-music" data-note="music"><span class="ag-row-ic">${icon('music', { size: 18 })}</span><span class="ag-row-label">Turntable</span><span class="ag-row-val">M</span></button>
          <button class="ag-row" id="ag-p-sound" data-note="sound"><span class="ag-row-ic">${icon(soundOn ? 'volume' : 'mute', { size: 18 })}</span><span class="ag-row-label">Interface sound</span><span class="ag-row-val">${soundOn ? 'ON' : 'MUTED'}</span></button>
        </div>
        <div class="ag-menu-rows is-hidden" data-panel="system">
          <button class="ag-row" id="ag-p-restart" data-note="restart"><span class="ag-row-ic">${icon('restart', { size: 18 })}</span><span class="ag-row-label">Restart game</span><span class="ag-row-val">↺</span></button>
          <button class="ag-row" id="ag-p-title" data-note="title"><span class="ag-row-ic">${icon('home', { size: 18 })}</span><span class="ag-row-label">Back to title</span><span class="ag-row-val">⌂</span></button>
        </div>
        <aside class="ag-menu-note">
          <div class="ag-polaroid tiny"><div class="ag-tape"></div><div class="ag-photo">${polaroidScene(2)}</div></div>
          <h3 id="ag-note-title">${notes.resume[0]}</h3>
          <p id="ag-note-text">${notes.resume[1]}</p>
        </aside>
      </div>
      <div class="ag-menu-foot">
        <span class="ag-key"><b>ESC</b> back</span>
        <span class="ag-key"><b>J</b> notebook</span>
        <span class="ag-key"><b>R</b> rewind</span>
      </div>
    </div>`;
  if (!openOverlay('pause')) return false;

  const showTab = (name) => {
    $('ag-pause').querySelectorAll('.ag-tab-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    $('ag-pause').querySelectorAll('.ag-menu-rows').forEach((p) => p.classList.toggle('is-hidden', p.dataset.panel !== name));
  };
  $('ag-pause').querySelectorAll('.ag-tab-btn').forEach((b) => b.addEventListener('click', () => { showTab(b.dataset.tab); uiSfx('hover'); }));
  $('ag-pause').querySelectorAll('.ag-row[data-note]').forEach((row) => {
    const paint = () => {
      const n = notes[row.dataset.note];
      if (!n) return;
      $('ag-note-title').textContent = n[0];
      $('ag-note-text').textContent = n[1];
    };
    row.addEventListener('mouseenter', paint);
    row.addEventListener('focus', paint);
  });

  $('ag-p-resume').addEventListener('click', closeOverlay);
  $('ag-p-journal').addEventListener('click', () => { overlayReturn = 'pause'; showJournal(); });
  $('ag-p-tutorial').addEventListener('click', () => {
    tutorialReturn = { screen: 'pause', phase };
    overlayReturn = null;
    hideScreens();
    startTutorial(true);
  });
  $('ag-p-music').addEventListener('click', () => bus.api.openMusic?.());
  $('ag-p-sound').addEventListener('click', () => { soundOn = !soundOn; showPause(); });
  $('ag-p-restart').addEventListener('click', () => {
    if (!confirm('Restart the game? The decisions and clues of this timeline will be lost.')) return;
    localStorage.removeItem(SAVE_KEY);
    state = createInitialState();
    hideScreens(); startNewGame(false);
  });
  $('ag-p-title').addEventListener('click', () => { hideScreens(); showTitle(); });
  return true;
}
/**
 * Close a journal / pause overlay and put the player back exactly where they
 * were: same dialogue line, same choice with the same time left on the clock.
 */
function closeOverlay() {
  const back = overlayReturn;
  overlayReturn = null;
  hideScreens();
  if (back === 'pause' && showPause()) return;
  restorePhase();
}

// ---------------------------------------------------------------------------
// ENDING
// ---------------------------------------------------------------------------
function showEnding() {
  phase = 'ending';
  const ending = computeEnding(state);
  state.finished = ending.id;
  save();
  bus.api.setWorldState?.(ending.weather);
  if (ending.weather === 1) shake();
  clearObjective();
  const blocks = bus.api.ledgerCount?.() ?? '—';
  $('ag-ending').innerHTML = `
    <div class="ag-ending-inner">
      <div class="ag-ending-sheet">
        <div class="ag-tape wide"></div>
        <div class="ag-ending-badge">${esc(ending.badge)}</div>
        <h1 class="ag-ending-title">${esc(ending.title)}</h1>
        <div class="ag-ending-verdict">${esc(ending.verdict)}</div>
        <div class="ag-ending-paras">${ending.paragraphs.slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="ag-ending-stats">
          <span>${icon('search', { size: 15 })}<b>${state.clues.length}/${TOTAL_CLUES}</b> clues</span>
          <span>${icon('rewind', { size: 15 })}<b>${state.rewindCount}</b> rewinds</span>
          <span>${icon('chain', { size: 15 })}<b>${blocks}</b> blocks</span>
          <span>${icon('heart', { size: 15 })}<b>${Math.round(state.stats.confianza)}</b> trust</span>
        </div>
      </div>
      <div class="ag-ending-actions">
        <button class="ag-menu-btn primary" id="ag-e-again"><span class="ag-menu-icon">${icon('restart')}</span><span class="ag-menu-label">Another line</span></button>
        <button class="ag-menu-btn" id="ag-e-journal"><span class="ag-menu-icon">${icon('book')}</span><span class="ag-menu-label">Notebook</span></button>
        <button class="ag-menu-btn" id="ag-e-title"><span class="ag-menu-icon">${icon('home')}</span><span class="ag-menu-label">Title</span></button>
      </div>
    </div>`;
  showScreen('ending');
  flash(); uiSfx('chapter');
  butterflyBurst(window.innerWidth / 2, window.innerHeight * 0.6, 14);
  $('ag-e-again').addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); state = createInitialState(); hideScreens(); openScreen = null; startNewGame(false); });
  $('ag-e-journal').addEventListener('click', showJournal);
  $('ag-e-title').addEventListener('click', () => { hideScreens(); openScreen = null; showTitle(); });
}

// ---------------------------------------------------------------------------
// TUTORIAL
// ---------------------------------------------------------------------------
/**
 * `standalone` = a review of the controls from the title / pause / journal.
 * `tutorialReturn` (set by the caller) says which context to restore on exit,
 * so reviewing controls mid-scene never drops a dialogue or a timed choice.
 */
function startTutorial(standalone = false) {
  tutorialOnly = standalone;
  if (!standalone) { state.tutorialDone = false; tutorialReturn = null; }
  phase = 'tutorial';
  tutorial = { index: 0, checking: false };
  travelled = 0; dragTotal = 0; lastAvatarPos = null;
  hideScreens(); openScreen = null;
  lock(false); cinematic(false);
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.remove('on');
  $('ag-tutorial').classList.remove('ag-hidden');
  renderTutorial();
  toast('Tutorial', 'Five steps. You can skip it whenever you like.', 'cyan');
}
function renderTutorial() {
  if (!tutorial) return;
  const step = TUTORIAL_STEPS[tutorial.index];
  const box = $('ag-tutorial');
  box.innerHTML = `
    <div class="ag-tut-card">
      <div class="ag-tape"></div>
      <div class="ag-tut-top">
        <span class="ag-tut-kicker">STEP ${tutorial.index + 1} / ${TUTORIAL_STEPS.length}</span>
        <div class="ag-tut-steps">${TUTORIAL_STEPS.map((_, i) => `<span class="ag-tut-step ${i < tutorial.index ? 'done' : i === tutorial.index ? 'current' : ''}"></span>`).join('')}</div>
      </div>
      <div class="ag-tut-main">
        <span class="ag-tut-icon">${icon(step.icon, { size: 34, stroke: 1.5 })}</span>
        <div>
          <div class="ag-tut-title">${esc(step.title)}</div>
          <div class="ag-tut-text">${esc(step.text)}</div>
        </div>
      </div>
      <div class="ag-tut-keys">${step.keys.map((k) => `<span class="ag-key">${esc(k)}</span>`).join('')}</div>
      <div class="ag-tut-foot">
        <span class="ag-tut-status" id="ag-tut-status">waiting for you…</span>
        <button class="ag-link ag-interactive" id="ag-tut-skip">Skip ${icon('arrowRight', { size: 13 })}</button>
      </div>
    </div>`;
  $('ag-tut-skip').addEventListener('click', () => finishTutorial(true));
  for (const [id, label] of Object.entries(originalLabels)) bus.api.setHotspotLabel?.(id, label);
  if (step.id === 'approach' || step.id === 'interact') bus.api.setHotspotLabel?.('desk', 'Examine the desk');
}
function completeTutorialStep() {
  if (!tutorial || tutorial.checking) return;
  tutorial.checking = true;
  uiSfx('clue');
  const st = $('ag-tut-status');
  if (st) { st.innerHTML = `<span class="ag-tut-check">${icon('check', { size: 14 })} done</span>`; st.className = 'ag-tut-status'; }
  butterflyBurst(window.innerWidth * 0.25, window.innerHeight * 0.75, 5);
  setTimeout(() => {
    tutorial.index++;
    tutorial.checking = false;
    if (tutorial.index >= TUTORIAL_STEPS.length) { finishTutorial(false); return; }
    renderTutorial();
  }, 950);
}
function finishTutorial(skipped) {
  const wasStandalone = tutorialOnly;
  const ret = tutorialReturn;
  tutorialReturn = null;
  tutorial = null;
  $('ag-tutorial').classList.add('ag-hidden');
  for (const [id, label] of Object.entries(originalLabels)) bus.api.setHotspotLabel?.(id, label);
  if (wasStandalone) {
    if (ret?.phase) phase = ret.phase;
    if (ret?.screen === 'pause') showPause();
    else if (ret?.screen === 'game' || ret?.screen === 'ending') restorePhase();
    else showTitle();          // "How to play" from the title screen
    return;
  }
  state.tutorialDone = true;
  save();
  toast(skipped ? 'Tutorial skipped' : 'Tutorial complete', 'You know your way around Arcadia now.', 'green');
  beginStory();
}

// ---------------------------------------------------------------------------
// TITLE / SAVE / GAME START
// ---------------------------------------------------------------------------
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SAVE_VERSION || !data.state || !data.state.stats || !Array.isArray(data.state.clues)) return null;
    return data.state;
  } catch { return null; }
}
/**
 * Timeline snapshots are full state clones, so an untrimmed save grows
 * exponentially with the number of decisions. Keep only the last three real
 * snapshots and strip deeper recursion: after loading, at least one rewind is
 * still possible without blowing past the localStorage quota.
 */
function compactForSave(s, depth = 0) {
  const c = cloneState(s);
  if (depth >= 1) {
    c.timeline = c.timeline.map((e) => ({ ...e, snapshot: null }));
    return c;
  }
  const keepFrom = Math.max(0, c.timeline.length - 3);
  c.timeline = c.timeline.map((e, i) => ({
    ...e,
    snapshot: i >= keepFrom && e.snapshot ? compactForSave(e.snapshot, depth + 1) : null,
  }));
  return c;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, state: compactForSave(state), at: Date.now() })); } catch { /* storage disabled */ }
}
/** Drop every transient UI continuation when a new run / the title begins. */
function resetOverlayState() {
  choiceCtx = null;
  pausedChoice = null;
  overlayReturn = null;
  tutorialReturn = null;
  tutorial = null;
  kbFocus = 0;
  clearInterval(dialogueState.timer);
  dialogueState.typing = false;
  dialogueState.onDone = null;
}
function showTitle() {
  phase = 'title';
  resetOverlayState();
  objective = null;
  hideConsequence();
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.remove('on');
  $('ag-tutorial').classList.add('ag-hidden');
  $('ag-objective').classList.add('ag-hidden');
  $('ag-waypoint').classList.remove('on');
  const saved = readSave();
  $('ag-continue').disabled = !saved;
  $('ag-save-info').textContent = saved
    ? `${saved.clues.length}/${TOTAL_CLUES} clues${saved.finished ? ' · ended' : ''}`
    : 'no save';
  $('ag-continue').title = saved
    ? `${CHAPTERS[saved.chapterId]?.title || 'Game'} · ${saved.clues.length}/${TOTAL_CLUES} clues`
    : 'No saved game';
  showScreen('title');
  renderHUD();
}
function startNewGame(withTutorial = true) {
  resetOverlayState();
  state = createInitialState();
  currentSceneId = 'p.wake';
  clearObjective();
  hideConsequence();
  hideScreens();
  cinematic(false);
  save();
  if (withTutorial) {
    // The room opens with no text on it at all. The first onboarding beat is
    // pure exploration, so the story cannot start locked behind a dialogue the
    // player is still being taught how to walk around.
    enterExplore();
    startOnboarding();
  } else {
    beginStory();
  }
}

/**
 * Four visual beats in the corner of the screen. The assistant watches the
 * engine for real signals (distance walked, suite opened, first clue, posture)
 * and never advances on a timer.
 */
let pendingStory = false;
let demoObjective = null;

function openPendingStory() {
  if (!pendingStory) return;
  pendingStory = false;
  beginStory();
}

function startOnboarding() {
  travelled = 0;
  dragTotal = 0;
  lastAvatarPos = null;
  pendingStory = true;

  startAssistant({
    // Beat 1 is the only one that gates the story: once the player has moved
    // through the room, the narration earns its place.
    onStep: (id) => { if (id === 'explore') openPendingStory(); },
    onDone: (skipped) => {
      state.onboardingDone = true;
      state.tutorialDone = true;
      save();
      // Skipping still has to leave a playable game — but never mid-demo.
      if (pendingStory) { if (!isDemoRunning()) openPendingStory(); return; }
      if (!skipped) toast('Listo', 'Ya sabes reconstruir, verificar y sentarte a mirar.', 'green');
    },
  });
}
function resumeGame() {
  const saved = readSave();
  if (!saved) return;
  resetOverlayState();
  state = saved;
  state.tutorialDone = true;
  // Saves are trusted but may come from an older build: normalise every array
  // the runtime iterates so a single missing field cannot brick a run.
  const base = createInitialState();
  for (const key of ['clues', 'timeline', 'decisions', 'memories', 'grantedScenes']) {
    if (!Array.isArray(state[key])) state[key] = base[key];
  }
  if (!state.flags || typeof state.flags !== 'object') state.flags = {};
  if (!state.stats || typeof state.stats !== 'object') state.stats = base.stats;
  for (const [key, value] of Object.entries(base.stats)) {
    if (typeof state.stats[key] !== 'number' || !Number.isFinite(state.stats[key])) state.stats[key] = value;
  }
  if (typeof state.charges !== 'number') state.charges = base.charges;
  if (typeof state.rewindCount !== 'number') state.rewindCount = 0;
  objective = state.objective || null;
  hideScreens();
  cinematic(false);
  renderHUD();
  bus.api.setWorldState?.(state.weather ?? 0);
  if (state.finished) { showEnding(); return; }
  playScene(state.sceneId || 'p.wake');
}
function beginStory() {
  hideScreens(); openScreen = null;
  clearObjective();
  currentSceneId = 'p.wake';
  playScene('p.wake');
}

// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

  // The demo owns every key while it runs; its own listener handles Escape.
  if (isDemoRunning()) return;

  // The Meta AI suite is a modal in its own right and closes first.
  if (isMetaSuiteOpen()) {
    if (e.key === 'Escape' || k === 'i') { e.preventDefault(); closeMetaSuite(); }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (openScreen === 'evidence') { $('ag-ev-continue')?.click(); return; }
    if (openScreen === 'journal' || openScreen === 'pause') { closeOverlay(); return; }
    if (openScreen === 'title' || openScreen === 'ending' || openScreen === 'chapter') return;
    showPause();
    return;
  }
  if (openScreen === 'title') {
    if (e.key === 'Enter' || k === ' ') { e.preventDefault(); startNewGame(true); }
    return;
  }
  if (openScreen === 'chapter' || openScreen === 'ending') return;
  if (openScreen === 'evidence') { if (e.key === 'Enter' || k === ' ') $('ag-ev-continue')?.click(); return; }
  if (openScreen === 'journal' && (k === 'j' || e.key === 'Enter')) { e.preventDefault(); closeOverlay(); return; }
  if (openScreen === 'pause') {
    if (k === 'j') { e.preventDefault(); overlayReturn = 'pause'; showJournal(); }
    return;
  }

  if (phase === 'dialogue' && (k === ' ' || e.key === 'Enter')) { e.preventDefault(); advanceDialogue(); return; }
  if (phase === 'choice') {
    if (/^[1-9]$/.test(k)) {
      const btn = $('ag-choice-list').querySelector(`.ag-choice[data-num="${k}"]:not(.locked)`);
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }
    const list = $('ag-choice-list');
    if (k === 'arrowdown' || k === 'arrowup') {
      e.preventDefault();
      const count = list.querySelectorAll('.ag-choice:not(.locked)').length;
      kbFocus = (kbFocus + (k === 'arrowdown' ? 1 : -1) + count) % Math.max(1, count);
      updateKbFocus(list);
      uiSfx('hover');
      return;
    }
    if (e.key === 'Enter' || k === ' ') {
      e.preventDefault();
      list.querySelectorAll('.ag-choice:not(.locked)')[kbFocus]?.click();
      return;
    }
  }
  if (phase === 'explore' || phase === 'tutorial' || phase === 'dialogue') {
    if (k === 'j') { e.preventDefault(); showJournal(); }
    if (k === 'i') { e.preventDefault(); openSuite(); return; }
    if (k === 'l') { e.preventDefault(); bus.api.toggleLedger?.(); }
    if (k === 'm') { e.preventDefault(); bus.api.openMusic?.(); }
  }
});

$('ag-dialogue').addEventListener('click', () => advanceDialogue());
$('ag-new').addEventListener('click', () => { uiSfx('click'); startNewGame(true); });
$('ag-continue').addEventListener('click', () => { if ($('ag-continue').disabled) return; uiSfx('click'); resumeGame(); });
$('ag-howto').addEventListener('click', () => { uiSfx('click'); startTutorial(true); });

// ---------------------------------------------------------------------------
// META AI SUITE
// ---------------------------------------------------------------------------
function openSuite(tab) {
  if (openScreen === 'title' || openScreen === 'chapter' || openScreen === 'evidence') return;
  uiSfx('clue');
  freezeDialogue();
  freezeChoice();
  lock(true);
  openMetaSuite({ tab, onClose: () => { lock(!!openScreen); restorePhase(); } });
  assistantSignal('meta');
}
function toggleSuite() {
  if (isMetaSuiteOpen()) { closeMetaSuite(); return; }
  openSuite();
}
$('ag-btn-meta-ai')?.addEventListener('click', () => { if (openScreen) return; toggleSuite(); });

// ---------------------------------------------------------------------------
// DEMO
// ---------------------------------------------------------------------------
$('ag-demo-chip')?.addEventListener('click', () => {
  if (isDemoRunning()) return;
  uiSfx('chapter');
  startDemo();
});
bus.on('demo:start', () => {
  stopAssistant(true);
  hideScreens();
  closeMetaSuite();
  openScreen = null;
  // The take owns the screen: no dialogue card, no choice list, no objective
  // strip, no hotspot prompt bleeding into a cinematic shot.
  freezeDialogue();
  choiceCtx = null;
  pausedChoice = null;
  demoObjective = objective;
  clearObjective();
  $('ag-dialogue').classList.remove('on');
  $('ag-choices').classList.remove('on');
  bus.api.clearFocus?.();
  lock(true);
  cinematic(true);
  document.body.classList.add('ag-demo');
});
bus.on('demo:end', () => {
  document.body.classList.remove('ag-demo');
  cinematic(false);
  lock(false);
  if (phase === 'title') { showTitle(); return; }
  // A demo started before the first beat was finished still owes the player
  // the opening narration.
  if (pendingStory) { openPendingStory(); return; }
  restorePhase();
  // The demo clears the objective strip so no HUD text lands in a shot; put the
  // player's current errand back once the camera is theirs again.
  if (demoObjective && phase === 'explore') setObjective(demoObjective);
  demoObjective = null;
});

$('ag-btn-journal').addEventListener('click', showJournal);
$('ag-btn-ledger').addEventListener('click', () => { if (openScreen) return; uiSfx('click'); bus.api.toggleLedger?.(); });
$('ag-btn-music').addEventListener('click', () => { if (openScreen) return; uiSfx('click'); bus.api.openMusic?.(); });
$('ag-btn-rewind').addEventListener('click', () => requestRewind());
$('ag-btn-pause').addEventListener('click', showPause);
root.querySelectorAll('.ag-icon-btn, .ag-menu-btn, .ag-choice').forEach((el) => {
  el.addEventListener('mouseenter', () => uiSfx('hover'));
});

// ---------------------------------------------------------------------------
// BUS WIRING
// ---------------------------------------------------------------------------
bus.on('interact', (detail) => onInteract(detail));
bus.on('input:rewind', () => requestRewind());
// The 3D engine's legacy "open the journal" command (desk / butterfly) is
// routed into the narrative Decision Journal instead of the hidden modal.
bus.on('cmd:openJournal', () => showJournal());
bus.on('cmd:pause', () => showPause());
bus.on('camera:drag', (d) => {
  dragTotal += Math.hypot(d?.dx || 0, d?.dy || 0);
  if (phase === 'tutorial' && TUTORIAL_STEPS[tutorial?.index]?.id === 'look' && dragTotal > 85) completeTutorialStep();
});
bus.on('world:state', (d) => { if (typeof d?.mode === 'number') state.weather = d.mode; });

// ---------------------------------------------------------------------------
// BOOT (wait for the 3D engine to publish its capabilities)
// ---------------------------------------------------------------------------
function boot() {
  originalLabels = {};
  for (const h of bus.api.hotspots || []) originalLabels[h.id] = h.label;
  ensureBeacon();
  // The engine can publish its capabilities a few seconds in. If the player
  // already started the demo (or a run) in that window, boot must not yank the
  // title card back over the top of it.
  if (phase === 'title' && !isDemoRunning()) showTitle();
  const loop = () => {
    tickWorld(performance.now() / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
let bootTries = 0;
const bootTimer = setInterval(() => {
  bootTries++;
  if (bus.api.scene || bootTries > 60) {
    clearInterval(bootTimer);
    boot();
  }
}, 50);
