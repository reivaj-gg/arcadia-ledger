/**
 * Tiny synchronous event bus shared by the 3D engine (src/main.js) and the
 * narrative game layer (src/game/game.js).
 *
 * `bus.api` is a late-bound capability table: the 3D engine fills it once the
 * scene is built, and the game layer only ever talks through it. That keeps
 * the 3 300-line renderer free of game rules and the game layer free of
 * Three.js scene construction details.
 */
const channels = new Map();

export const bus = {
  /** Capabilities provided by the 3D engine. Filled at runtime. */
  api: {},

  on(event, fn) {
    if (!channels.has(event)) channels.set(event, new Set());
    channels.get(event).add(fn);
    return () => bus.off(event, fn);
  },

  off(event, fn) {
    const set = channels.get(event);
    if (set) set.delete(fn);
  },

  /** Returns the array of listener results, so callers can implement vetoes. */
  emit(event, payload) {
    const results = [];
    const set = channels.get(event);
    if (!set) return results;
    for (const fn of Array.from(set)) {
      try {
        results.push(fn(payload));
      } catch (err) {
        console.error(`[arcadia/bus] listener for "${event}" threw`, err);
      }
    }
    return results;
  },
};
