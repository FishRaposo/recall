// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run identically without it, so every access is guarded.

const KEY = 'recall.best.v1';
const EMPTY = { score: 0, wave: 0 };

export function loadBest() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v.score === 'number' ? v : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveBest(best) {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* not persisted this session */
  }
}
