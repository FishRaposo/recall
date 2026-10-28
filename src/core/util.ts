export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}

// Frame-rate independent smoothing: moves `a` toward `b` at `rate` per second.
export const expDecay = (a: number, b: number, rate: number, dt: number): number => b + (a - b) * Math.exp(-rate * dt);

export function circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

// Swept test: does the segment (x1,y1)→(x2,y2) pass within r of (cx,cy)?
// The blade moves up to ~17px per frame, so a point test would tunnel through small enemies.
export function segCircleHit(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1) : 0;
  const px = x1 + dx * t - cx;
  const py = y1 + dy * t - cy;
  return px * px + py * py <= r * r;
}

// Small, fast, seedable PRNG. Gameplay randomness goes through this so runs can be replayed with ?seed=.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  seed: number;
  next: () => number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }

  float(lo = 0, hi = 1): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.float(lo, hi + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
