/**
 * ARCADIA · Progressive onboarding assistant
 * ---------------------------------------------------------------------------
 * Four beats in the bottom-left corner. It does not explain the game: it waits
 * for the player to *do* the thing and then gets out of the way. Each step is
 * completed by a real signal from the engine, never by a timer, so the
 * assistant can never claim progress the player did not make.
 */
import { icon } from './icons.js';
import { ONBOARDING_STEPS } from './story.js';
import './assistant.css';

let el = null;
let index = 0;
let active = false;
let hiding = false;
let advancing = false;
let onDoneCb = null;
let onStepCb = null;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ag-assistant';
  el.className = 'ag-assistant';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

function render() {
  if (!el) return;
  const step = ONBOARDING_STEPS[index];
  if (!step) return;
  const dots = ONBOARDING_STEPS.map((_, i) =>
    `<span class="ag-as-dot ${i < index ? 'done' : i === index ? 'now' : ''}"></span>`).join('');

  el.innerHTML = `
    <div class="ag-as-card">
      <div class="ag-as-rail">
        <span class="ag-as-ic">${icon(step.icon, { size: 20, stroke: 1.6 })}</span>
        <span class="ag-as-count">${index + 1}/${ONBOARDING_STEPS.length}</span>
      </div>
      <div class="ag-as-main">
        <div class="ag-as-title">${step.title}</div>
        <p class="ag-as-text">${step.text}</p>
        <div class="ag-as-foot">
          <span class="ag-as-keys">${step.keys.map((k) => `<kbd>${k}</kbd>`).join('')}</span>
          <span class="ag-as-dots">${dots}</span>
        </div>
      </div>
      <button class="ag-as-skip" title="Omitir la guía">${icon('close', { size: 14 })}</button>
    </div>`;

  el.querySelector('.ag-as-skip')?.addEventListener('click', () => stopAssistant(true));
}

function pulse() {
  if (!el) return;
  el.classList.remove('is-pulse');
  void el.offsetWidth;
  el.classList.add('is-pulse');
}

export function startAssistant(opts = {}) {
  ensure();
  index = 0;
  active = true;
  hiding = false;
  advancing = false;
  onDoneCb = opts.onDone || null;
  onStepCb = opts.onStep || null;
  el.classList.remove('is-hidden');
  el.classList.add('is-visible');
  render();
  // The first beat fades in a beat late so the title card can breathe.
  setTimeout(() => { if (active) el?.classList.add('is-in'); }, 650);
}

export function assistantSignal(id) {
  if (!active || advancing) return;
  const step = ONBOARDING_STEPS[index];
  if (!step || step.id !== id) return;

  // The engine polls every frame (distance walked, posture), so the same signal
  // arrives dozens of times. One acknowledgement per step, or the player would
  // skip three beats at once.
  advancing = true;

  // Acknowledge, then advance.
  const card = el?.querySelector('.ag-as-card');
  if (card) card.classList.add('is-done');
  pulse();

  setTimeout(() => {
    advancing = false;
    if (!active) return;
    index += 1;
    if (onStepCb) onStepCb(id);
    if (index >= ONBOARDING_STEPS.length) { stopAssistant(false); return; }
    render();
    el?.classList.add('is-in');
  }, 620);
}

export function stopAssistant(skipped = false) {
  if (!active) return;
  active = false;
  advancing = false;
  if (!el) return;
  el.classList.remove('is-in');
  el.classList.add('is-hidden');
  if (skipped) hiding = true;
  setTimeout(() => { if (!active && el) el.classList.add('is-gone'); }, 420);
  const cb = onDoneCb;
  onDoneCb = null;
  onStepCb = null;
  if (cb) cb(skipped);
}

export function isAssistantActive() {
  return active;
}

export function assistantStep() {
  return ONBOARDING_STEPS[index]?.id ?? null;
}

export function assistantCompleted() {
  return hiding || (!active && index >= ONBOARDING_STEPS.length);
}
