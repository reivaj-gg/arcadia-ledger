/** Type surface for the plain-JS narrative engine (used by the TS test suite). */
export interface GameState {
  version: number;
  sceneId: string;
  chapterId: string;
  weather: number;
  stats: Record<string, number> & {
    confianza: number; notas: number; integridad: number; eco: number; dinero: number;
  };
  charges: number;
  clues: string[];
  flags: Record<string, boolean>;
  // `snapshot` is nulled for older entries when a save is compacted, so a
  // rewind of that particular instant is intentionally unavailable.
  timeline: Array<{ sceneId: string; choiceId: string; label: string; at: number; snapshot: GameState | null }>;
  decisions: Array<{ sceneId: string; choiceId: string; label: string; at: number; undone: boolean }>;
  memories: string[];
  grantedScenes: string[];
  rewindCount: number;
  objective: unknown;
  tutorialDone: boolean;
  finished: string | null;
  startedAt: number;
}

export interface Scene {
  chapter?: string;
  chapterCard?: boolean;
  ending?: boolean;
  evidence?: string;
  weather?: number;
  sfx?: string;
  lines?: Array<{ who: string; text: string; style?: string }>;
  choices?: Array<{
    id: string; label: string; hint?: string; tag?: string; timeLimit?: number;
    effects?: Record<string, unknown>; ledger?: Record<string, unknown>;
    requires?: Record<string, unknown>; weather?: number; next: string;
  }>;
  objective?: { hotspot: string; text: string; label: string; next: string };
  grant?: Record<string, unknown>;
  next?: string;
}

export const SAVE_VERSION: number;
export const MAX_CHARGES: number;
export const TOTAL_CLUES: number;
export const STAT_META: Record<string, { label: string; icon: string; min: number; max: number; prefix?: string }>;
export const CHAPTERS: Record<string, { index: string; title: string; subtitle: string; epigraph: string }>;
export const HOTSPOTS: Record<string, { name: string; icon: string }>;
export const CLUES: Record<string, { title: string; detail: string; icon: string; seals?: boolean }>;
export const ENDINGS: Record<string, { id: string; title: string; badge: string; weather: number; tone: string; verdict: string; paragraphs: string[] }>;
export const SCENES: Record<string, Scene>;
export const FLAVOR: Record<string, string>;
export const TUTORIAL_STEPS: Array<{ id: string; title: string; text: string; keys: string[]; icon: string }>;
export const STORY: { chapters: typeof CHAPTERS; scenes: typeof SCENES; flavor: typeof FLAVOR; clues: typeof CLUES; hotspots: typeof HOTSPOTS; endings: typeof ENDINGS };

export function createInitialState(): GameState;
export function cloneState(state: GameState): GameState;
export function applyEffects(state: GameState, effects?: Record<string, unknown>): GameState;
export function enterScene(state: GameState, sceneId: string): { ok: boolean; reason?: string; state: GameState; scene?: Scene };
export function requirementsMet(state: GameState, req?: Record<string, unknown>): boolean;
export function availableChoices(state: GameState, sceneId: string): Scene['choices'];
export function choose(state: GameState, sceneId: string, choiceId: string): { ok: boolean; reason?: string; state: GameState; choice?: NonNullable<Scene['choices']>[number] };
export function canRewind(state: GameState): { ok: boolean; reason?: string };
export function rewind(state: GameState): { ok: boolean; reason?: string; state: GameState; entry?: GameState['timeline'][number] };
export function computeEnding(state: GameState): typeof ENDINGS[string];
export function validateStory(): string[];
