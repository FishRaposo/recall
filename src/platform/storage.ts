// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run identically without it, so every access is guarded.

import type { Best, RunStats, SimCheckpoint } from '../core/types.ts';
export type { Best };

const KEY = 'recall.best.v1';
const SAVE_KEY = 'recall.save.v1';
const EMPTY: Best = { score: 0, wave: 0 };

export interface RecallSave extends SimCheckpoint {}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function loadBest(): Best {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') {
      const best = v as Partial<Best>;
      if (typeof best.score === 'number' && typeof best.wave === 'number') {
        return { score: Math.max(0, best.score), wave: Math.max(0, best.wave) };
      }
    }
    return { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveBest(best: Best): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* not persisted this session */
  }
}

function isStats(v: unknown): v is RunStats {
  return isObject(v) && typeof v.kills === 'number' && typeof v.bestMult === 'number' && typeof v.time === 'number';
}

export function loadSave(): RecallSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(v) || v.version !== 1) return null;
    if (typeof v.seed !== 'number' || typeof v.rngState !== 'number') return null;
    if (typeof v.wave !== 'number' || v.wave < 1) return null;
    if (typeof v.score !== 'number' || typeof v.combo !== 'number') return null;
    if (typeof v.hp !== 'number' || v.hp < 0) return null;
    if (!isStats(v.stats)) return null;
    return {
      version: 1,
      seed: v.seed,
      rngState: v.rngState,
      wave: v.wave,
      score: v.score,
      combo: v.combo,
      hp: v.hp,
      stats: { kills: v.stats.kills, bestMult: v.stats.bestMult, time: v.stats.time },
    };
  } catch {
    return null;
  }
}

export function saveRun(save: RecallSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* not persisted this session */
  }
}

export function clearRunSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
