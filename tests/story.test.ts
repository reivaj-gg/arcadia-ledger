/**
 * Narrative engine tests — pure functions, no DOM, no WebGL, no wall clock.
 *
 * The game layer (`src/game/game.js`) owns the browser; everything that can be
 * reasoned about as a *fact* lives in `src/game/story.js` and is asserted here:
 * graph integrity, one-shot grants, locked branches, rewind semantics, save
 * compaction and ending selection.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SAVE_VERSION, MAX_CHARGES, TOTAL_CLUES, STAT_META, CHAPTERS, HOTSPOTS, CLUES,
  ENDINGS, SCENES, FLAVOR, TUTORIAL_STEPS, STORY,
  createInitialState, cloneState, applyEffects, enterScene, requirementsMet,
  availableChoices, choose, canRewind, rewind, computeEnding, validateStory,
  type GameState,
} from '../src/game/story.js';
import { EventLedger } from '../src/domain/ledger.ts';
import { LEDGER_PAYLOADS } from '../src/domain/schema.ts';

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

/** Mirrors `compactForSave` in the browser runtime, without importing the DOM. */
function compact(s: GameState, depth = 0): GameState {
  const c = cloneState(s);
  if (depth >= 1) {
    c.timeline = c.timeline.map((e) => ({ ...e, snapshot: null }));
    return c;
  }
  const keepFrom = Math.max(0, c.timeline.length - 3);
  c.timeline = c.timeline.map((e, i) => ({
    ...e,
    snapshot: i >= keepFrom && e.snapshot ? compact(e.snapshot, depth + 1) : null,
  }));
  return c;
}

/* ------------------------------------------------------------------------- */
/* Story graph                                                               */
/* ------------------------------------------------------------------------- */

test('validateStory reports a structurally sound graph', () => {
  assert.deepEqual(validateStory(), []);
});

test('every timed choice scene keeps at least one unconditional branch', () => {
  // A fully locked choice screen would strand the player when the timer runs out.
  for (const [id, scene] of Object.entries(SCENES)) {
    if (!scene.choices?.length) continue;
    const open = scene.choices.filter((c) => !c.requires);
    assert.ok(open.length > 0, `${id} has no branch that is always available`);
    for (const c of scene.choices) {
      assert.ok(c.timeLimit && c.timeLimit > 0, `${id}/${c.id} has no time limit`);
      assert.ok(c.label && c.next, `${id}/${c.id} is incomplete`);
    }
  }
});

test('every authored scene is reachable from the prologue or via exploration', () => {
  const seen = new Set<string>(['p.wake']);
  const queue: string[] = ['p.wake'];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const scene = SCENES[id];
    if (!scene) continue;
    const targets: string[] = [];
    if (scene.next) targets.push(scene.next);
    if (scene.objective?.next) targets.push(scene.objective.next);
    for (const c of scene.choices ?? []) targets.push(c.next);
    for (const target of targets) {
      if (!seen.has(target)) { seen.add(target); queue.push(target); }
    }
  }
  const flavorTargets = new Set<string>(Object.values(FLAVOR));
  for (const id of Object.keys(SCENES)) {
    assert.ok(seen.has(id) || flavorTargets.has(id), `${id} is unreachable`);
  }
  assert.ok(seen.has('c3.final'), 'the final decision is reachable');
  assert.ok(Object.keys(SCENES).some((id) => SCENES[id]!.ending), 'at least one ending beat exists');
});

test('tutorial, chapters, clues, hotspots and endings are consistent', () => {
  assert.deepEqual(TUTORIAL_STEPS.map((s) => s.id), ['move', 'look', 'approach', 'interact', 'rewind']);
  assert.ok(TUTORIAL_STEPS.every((s) => s.title && s.text && s.keys.length > 0));
  assert.equal(Object.keys(CLUES).length, TOTAL_CLUES);
  assert.equal(Object.keys(ENDINGS).length, 6);
  assert.equal(Object.keys(CHAPTERS).length, 5);
  assert.ok(Object.keys(FLAVOR).every((h) => HOTSPOTS[h] !== undefined));
  assert.ok(Object.values(ENDINGS).every((e) => e.paragraphs.length > 0 && e.title && e.verdict));
  assert.strictEqual(STORY.scenes, SCENES);
  assert.strictEqual(STORY.clues, CLUES);
});

/* ------------------------------------------------------------------------- */
/* Pure state helpers                                                        */
/* ------------------------------------------------------------------------- */

test('createInitialState exposes the documented defaults', () => {
  const s = createInitialState();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.sceneId, 'p.wake');
  assert.equal(s.chapterId, 'prologo');
  assert.equal(s.charges, 3);
  assert.equal(s.weather, 0);
  assert.equal(s.finished, null);
  assert.deepEqual(s.clues, []);
  assert.deepEqual(s.timeline, []);
  assert.deepEqual(s.decisions, []);
  for (const key of Object.keys(STAT_META)) {
    assert.equal(typeof s.stats[key], 'number', `missing stat ${key}`);
  }
});

test('cloneState deep-copies nested state', () => {
  const a = createInitialState();
  a.flags.honestEarly = true;
  const b = cloneState(a);
  b.flags.sharedTruth = true;
  b.stats.notas = 1;
  assert.equal(a.flags.sharedTruth, undefined);
  assert.equal(a.stats.notas, 72);
});

test('applyEffects clamps stats and charges, dedupes clues, sets flags', () => {
  const s = createInitialState();
  const next = applyEffects(s, {
    stats: { eco: 10_000, notas: -10_000, dinero: 500 },
    charges: 99,
    clues: ['mask_whatsapp', 'mask_whatsapp'],
    flags: ['honestEarly'],
  });
  assert.equal(next.stats.eco, STAT_META.eco!.max);
  assert.equal(next.stats.notas, STAT_META.notas!.min);
  assert.equal(next.charges, MAX_CHARGES);
  assert.deepEqual(next.clues, ['mask_whatsapp']);
  assert.equal(next.flags.honestEarly, true);
  // The input state is never mutated.
  assert.equal(s.stats.eco, 18);
  assert.equal(s.charges, 3);
  assert.deepEqual(s.clues, []);
});

test('enterScene applies a one-shot grant exactly once', () => {
  const initial = createInitialState();
  const first = enterScene(initial, 'c1.evidence');
  assert.equal(first.ok, true);
  assert.equal(first.state.chapterId, 'c1');
  assert.equal(first.state.sceneId, 'c1.evidence');
  assert.ok(first.state.clues.includes('mask_whatsapp'));
  assert.equal(first.state.charges, 4); // 3 + 1 clue charge
  assert.deepEqual(first.state.grantedScenes, ['c1.evidence']);

  const second = enterScene(first.state, 'c1.evidence');
  assert.equal(second.state.charges, 4, 're-entering must not mint another charge');
  assert.equal(second.state.clues.length, 1);
  assert.equal(second.state.grantedScenes.length, 1);

  const unknown = enterScene(initial, 'does.not.exist');
  assert.equal(unknown.ok, false);
  assert.strictEqual(unknown.state, initial);
});

test('requirementsMet covers clues, allClues, flags, stats, rewinds and any', () => {
  const s = createInitialState();
  assert.equal(requirementsMet(s), true);
  assert.equal(requirementsMet(s, { clues: ['mask_whatsapp'] }), false);
  s.clues.push('mask_whatsapp');
  assert.equal(requirementsMet(s, { clues: ['mask_whatsapp'] }), true);
  assert.equal(requirementsMet(s, { allClues: true }), false);
  s.clues = Object.keys(CLUES);
  assert.equal(requirementsMet(s, { allClues: true }), true);
  assert.equal(requirementsMet(s, { flags: ['honestEarly'] }), false);
  s.flags.honestEarly = true;
  assert.equal(requirementsMet(s, { flags: ['honestEarly'] }), true);
  assert.equal(requirementsMet(s, { minStats: { integridad: 999 } }), false);
  assert.equal(requirementsMet(s, { minStats: { integridad: 58 } }), true);
  assert.equal(requirementsMet(s, { maxRewinds: 0 }), true);
  s.rewindCount = 5;
  assert.equal(requirementsMet(s, { maxRewinds: 0 }), false);
  assert.equal(requirementsMet(s, { any: [{ flags: ['never'] }, { flags: ['honestEarly'] }] }), true);
  assert.equal(requirementsMet(s, { any: [{ flags: ['never'] }] }), false);
});

test('availableChoices hides locked secret branches until earned', () => {
  const s = createInitialState();
  assert.deepEqual(availableChoices(s, 'c3.final')?.map((c) => c.id), ['deliver', 'study']);
  s.flags.honestEarly = true;
  assert.equal(availableChoices(s, 'c3.final')?.length, 3);
  s.clues = Object.keys(CLUES);
  assert.equal(availableChoices(s, 'c3.final')?.length, 4);
  assert.equal(availableChoices(s, 'p.wake')?.length, 0);
});

/* ------------------------------------------------------------------------- */
/* Decisions and rewind                                                      */
/* ------------------------------------------------------------------------- */

test('choose snapshots the pre-choice state and seals a decision', () => {
  const s = createInitialState();
  const r = choose(s, 'c1.reply', 'accept');
  assert.equal(r.ok, true);
  assert.equal(r.state.stats.dinero, 200);
  assert.equal(r.state.flags.acceptedFast, true);
  assert.equal(r.state.timeline.length, 1);
  assert.equal(r.state.decisions.length, 1);
  assert.equal(r.state.timeline[0]?.sceneId, 'c1.reply');
  // Assert against the authored copy, not a hardcoded string: the contract is
  // "the timeline records the chosen label", not the wording of the label.
  const acceptLabel = SCENES['c1.reply']!.choices!.find((c) => c.id === 'accept')!.label;
  assert.equal(r.state.timeline[0]?.label, acceptLabel);
  assert.ok(r.state.timeline[0]?.snapshot, 'a live decision must carry a snapshot');
  assert.equal(r.state.timeline[0]!.snapshot!.stats.dinero, 0);
  assert.equal(s.timeline.length, 0, 'the caller state is immutable');

  assert.equal(choose(s, 'c1.reply', 'not-a-choice').reason, 'UNKNOWN_CHOICE');
  assert.equal(choose(s, 'c3.final', 'seal').reason, 'LOCKED');
});

test('canRewind reports every refusal reason explicitly', () => {
  assert.equal(canRewind(createInitialState()).reason, 'NO_DECISION');
  const after = choose(createInitialState(), 'c1.reply', 'accept').state;
  assert.equal(canRewind(after).ok, true);

  const broke = cloneState(after); broke.charges = 0;
  assert.equal(canRewind(broke).reason, 'NO_CHARGE');
  const trimmed = cloneState(after); trimmed.timeline[0]!.snapshot = null;
  assert.equal(canRewind(trimmed).reason, 'NO_SNAPSHOT');
  const closed = cloneState(after); closed.finished = 'eco';
  assert.equal(canRewind(closed).reason, 'FINISHED');
});

test('rewind restores the past but keeps memories and the append-only decision log', () => {
  const after = choose(createInitialState(), 'c1.reply', 'accept').state;
  const acceptLabel = SCENES['c1.reply']!.choices!.find((c) => c.id === 'accept')!.label;
  const r = rewind(after);
  assert.equal(r.ok, true);
  assert.equal(r.entry?.sceneId, 'c1.reply');
  assert.equal(r.state.stats.dinero, 0, 'effects are undone');
  assert.equal(r.state.charges, 2, 'rewinding costs one Eco charge');
  assert.equal(r.state.rewindCount, 1);
  assert.deepEqual(r.state.memories, [acceptLabel]);
  assert.equal(r.state.timeline.length, 0);
  assert.equal(r.state.decisions.length, 1, 'the undone decision is kept, not deleted');
  assert.equal(r.state.decisions[0]?.undone, true);

  assert.equal(rewind(r.state).reason, 'NO_DECISION');
  const fresh = choose(r.state, 'c1.reply', 'check').state;
  assert.equal(canRewind(fresh).ok, true, 'a new decision makes another rewind possible');
});

test('save compaction keeps one valid rewind and survives JSON round-tripping', () => {
  let s = createInitialState();
  for (let i = 0; i < 4; i++) s = choose(s, 'c1.reply', 'accept').state;
  assert.equal(s.timeline.length, 4);

  const saved = compact(s);
  const raw = JSON.stringify({ v: SAVE_VERSION, state: saved });
  assert.ok(raw.length < 30_000, 'compacted saves must not grow exponentially');
  const reloaded = JSON.parse(raw) as { v: number; state: GameState };
  assert.equal(reloaded.v, SAVE_VERSION);
  assert.equal(canRewind(reloaded.state).ok, true);

  const r = rewind(reloaded.state);
  assert.equal(r.ok, true);
  // The restored snapshot's own history was trimmed: no chained rewinds.
  assert.equal(canRewind(r.state).reason, 'NO_SNAPSHOT');
  assert.equal(canRewind(choose(r.state, 'c1.reply', 'check').state).ok, true);
});

test('exploration clues are capped, unique and restore Eco charges', () => {
  let s = createInitialState();
  s.charges = 1;
  const grantScenes: string[] = [];
  for (const sceneId of Object.values(FLAVOR)) {
    const scene = SCENES[sceneId];
    if (!scene?.grant) continue;
    grantScenes.push(sceneId);
    s = enterScene(s, sceneId).state;
  }
  assert.equal(grantScenes.length, 5);
  assert.equal(s.clues.length, 5);
  assert.equal(new Set(s.clues).size, 5);
  assert.equal(s.charges, MAX_CHARGES, 'charges are capped, not accumulated forever');
  for (const id of grantScenes) s = enterScene(s, id).state;
  assert.equal(s.clues.length, 5, 'revisiting a hotspot is not a clue farm');
});

/* ------------------------------------------------------------------------- */
/* Endings and a full deterministic playthrough                              */
/* ------------------------------------------------------------------------- */

test('computeEnding selects each of the six endings', () => {
  const base = createInitialState();
  assert.equal(computeEnding(base).id, 'eco');

  const truth = cloneState(base); truth.flags.truthSealed = true;
  assert.equal(computeEnding(truth).id, 'verdad');

  const loop = cloneState(base); loop.rewindCount = 4;
  assert.equal(computeEnding(loop).id, 'bucle');
  const loopByEco = cloneState(base); loopByEco.stats.eco = 80;
  assert.equal(computeEnding(loopByEco).id, 'bucle');

  const faro = cloneState(base);
  faro.stats.notas = 80; faro.stats.confianza = 70; faro.stats.integridad = 70;
  assert.equal(computeEnding(faro).id, 'faro');

  const storm = cloneState(base);
  storm.stats.dinero = 260; storm.stats.notas = 50;
  assert.equal(computeEnding(storm).id, 'tormenta');

  const silence = cloneState(base); silence.stats.confianza = 20;
  assert.equal(computeEnding(silence).id, 'silencio');

  // Priority: a sealed truth beats every stat-based ending.
  silence.flags.truthSealed = true;
  assert.equal(computeEnding(silence).id, 'verdad');
});

test('narrative decisions, clues and rewinds are first-class verifiable ledger events', () => {
  const narrativeTypes = ['narrative.decision', 'narrative.clue', 'narrative.rewound'] as const;
  for (const type of narrativeTypes) {
    assert.ok(LEDGER_PAYLOADS[type], `${type} must be a registered ledger payload`);
  }
  const at = '2026-11-04T16:42:00.000Z';
  const ledger = new EventLedger({ clock: () => at });
  ledger.append('narrative.decision', {
    kind: 'decision.final', sceneId: 'c3.final', choiceId: 'seal',
    label: '✦ Sellar las ocho pistas en el ledger', recordedAt: at,
  });
  ledger.append('narrative.clue', {
    kind: 'evidence.pixel_anchored', sceneId: 'c1.evidence', label: 'SAM 3.1 · IoU 96,1 %', recordedAt: at,
  });
  ledger.append('narrative.rewound', {
    kind: 'timeline.rewound', fromScene: 'c3.final', choiceId: 'seal',
    remembered: '✦ Sellar las ocho pistas en el ledger', chargesLeft: 2, recordedAt: at,
  });

  assert.equal(ledger.size, 3);
  const verified = ledger.verify();
  assert.equal(verified.valid, true);
  const events = ledger.listEvents();
  assert.equal(events[1]?.prevHash, events[0]?.hash, 'the chain is linked');
  assert.equal(events[2]?.prevHash, events[1]?.hash);
  assert.equal(events[2]?.type, 'narrative.rewound', 'a rewind is recorded, not erased');

  // A malformed write must be rejected before it can poison the chain.
  assert.throws(() => ledger.append('narrative.decision', { kind: 'incomplete' }));
  assert.equal(ledger.size, 3);
  assert.equal(ledger.verify().valid, true);
});

test('a deterministic playthrough always terminates in an ending beat', () => {
  let s = createInitialState();
  let id = 'p.wake';
  const visited = new Set<string>();
  for (let step = 0; step < 60; step++) {
    assert.ok(!visited.has(id), `narrative loop detected at ${id}`);
    visited.add(id);
    s = enterScene(s, id).state;
    const scene = SCENES[id];
    assert.ok(scene, `unknown scene ${id}`);
    if (scene.ending) {
      assert.ok(ENDINGS[computeEnding(s).id], 'the computed ending must be authored');
      return;
    }
    if (scene.choices?.length) {
      const open = availableChoices(s, id);
      assert.ok(open && open.length > 0, `no open branch at ${id}`);
      const picked = open[0]!;
      const result = choose(s, id, picked.id);
      assert.equal(result.ok, true);
      s = result.state;
      id = picked.next;
      continue;
    }
    const next = scene.next ?? scene.objective?.next;
    assert.ok(next, `dead end at ${id}`);
    id = next;
  }
  assert.fail('playthrough did not terminate within 60 beats');
});
