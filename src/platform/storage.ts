// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run identically without it, so every access is guarded.

import type { Best } from '../core/types.ts';
export type { Best };

const KEY = 'recall.best.v1';
const EMPTY: Best = { score: 0, wave: 0 };

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
