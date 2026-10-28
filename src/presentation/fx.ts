import { W, H, ARENA, COLORS, FONT } from '../core/config.ts';
import { TAU, mulberry32 } from '../core/util.ts';
import type { BurstOptions, FloaterOptions, FloatersLike, InkLike, ParticlesLike, ShakeLike } from '../core/types.ts';

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo); // cosmetic only; gameplay uses the seeded Rng

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  ring?: boolean;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  life: number;
  max: number;
  rise: number;
  font: string;
}

// Trauma-based screen shake: events add trauma, offset grows with trauma², trauma decays linearly.
export class Shake implements ShakeLike {
  trauma = 0;
  t = 0;
  scale = 1;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.scale);
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }

  offset(): [number, number, number] {
    const s = this.trauma * this.trauma;
    const t = this.t;
    return [
      s * 14 * Math.sin(t * 71.3) * Math.cos(t * 13.1),
      s * 14 * Math.sin(t * 57.7 + 1.3) * Math.cos(t * 17.9),
      s * 0.035 * Math.sin(t * 31.1),
    ];
  }
}

export class Particles implements ParticlesLike {
  list: Particle[] = [];

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const { count = 10, speed = [60, 260], life = [0.25, 0.6], size = [1.5, 4.5], color = COLORS.ink, dirX = 0, dirY = 0, spread = TAU, drag = 5 } = o;
    const base = dirX || dirY ? Math.atan2(dirY, dirX) : 0;
    for (let i = 0; i < count; i++) {
      const a = base + (dirX || dirY ? rand(-spread / 2, spread / 2) : rand(0, TAU));
      const v = rand(speed[0], speed[1]);
      const l = rand(life[0], life[1]);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: rand(size[0], size[1]), color, drag });
    }
  }

  ring(x: number, y: number, color: string, radius = 22): void {
    this.list.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: radius, color, drag: 0, ring: true });
  }

  update(dt: number): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l[i] = l[l.length - 1];
        l.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.9), 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.35 + 0.65 * a), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// The floor. Ink lands here and stays for the whole run: by the end, each run is a painting.
export class InkLayer implements InkLike {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * 2;
    this.canvas.height = H * 2;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Recall needs a 2D canvas');
    this.ctx = ctx;
    this.ctx.scale(2, 2);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, W, H);
  }

  private clip(c: CanvasRenderingContext2D): void {
    c.save();
    c.beginPath();
    c.rect(ARENA.x + 2, ARENA.y + 2, ARENA.w - 4, ARENA.h - 4);
    c.clip();
  }

  // A blot: a lumpy core plus droplets flung along (dirX, dirY).
  blot(x: number, y: number, r: number, color: string, dirX = 0, dirY = 0, alpha = 0.88): void {
    const c = this.ctx;
    this.clip(c);
    c.fillStyle = color;
    c.globalAlpha = alpha;
    c.beginPath();
    c.arc(x, y, r * rand(0.75, 0.95), 0, TAU);
    c.fill();
    const lumps = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < lumps; i++) {
      const a = rand(0, TAU);
      const d = r * rand(0.3, 0.7);
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * rand(0.3, 0.6), 0, TAU);
      c.fill();
    }
    const base = dirX || dirY ? Math.atan2(dirY, dirX) : rand(0, TAU);
    const spread = dirX || dirY ? 1.1 : TAU;
    const drops = 4 + Math.floor(Math.random() * 7);
    for (let i = 0; i < drops; i++) {
      const a = base + rand(-spread / 2, spread / 2);
      const d = r * rand(1.2, 3.8);
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * rand(0.06, 0.26), 0, TAU);
      c.fill();
    }
    c.restore();
  }

  dot(x: number, y: number, r: number, color: string, alpha: number): void {
    const c = this.ctx;
    this.clip(c);
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.restore();
  }
}

export class Floaters implements FloatersLike {
  list: Floater[] = [];

  add(x: number, y: number, text: string, { size = 15, color = COLORS.ink, life = 0.8, rise = 36, font = FONT.mono }: FloaterOptions = {}): void {
    this.list.push({ x, y, text, size, color, life, max: life, rise, font });
  }

  update(dt: number): void {
    this.list = this.list.filter((f) => (f.life -= dt) > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.list) {
      const age = f.max - f.life;
      const pop = 1 + 0.45 * Math.max(0, 1 - age / 0.12);
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.round(f.size * pop)}px ${f.font}`;
      ctx.fillText(f.text, f.x, f.y - f.rise * (1 - (f.life / f.max) ** 2));
    }
    ctx.globalAlpha = 1;
  }
}

// Pre-rendered paper and arena border, drawn once at 2× for crisp scaling.
export function makeBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const x = c.getContext('2d');
  if (!x) throw new Error('Recall needs a 2D canvas');
  x.scale(2, 2);
  const r = mulberry32(7); // fixed seed: same paper every time

  x.fillStyle = COLORS.paperDark;
  x.fillRect(0, 0, W, H);
  x.fillStyle = COLORS.paper;
  x.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

  for (let i = 0; i < 2800; i++) {
    x.globalAlpha = r() * 0.07;
    x.fillStyle = r() < 0.5 ? COLORS.ink : '#8a7a5c';
    x.fillRect(r() * W, r() * H, r() * 1.6 + 0.4, r() * 1.6 + 0.4);
  }
  x.lineWidth = 0.6;
  for (let i = 0; i < 160; i++) {
    x.globalAlpha = 0.03 + r() * 0.03;
    x.strokeStyle = '#6b5d44';
    const sx = r() * W;
    const sy = r() * H;
    x.beginPath();
    x.moveTo(sx, sy);
    x.quadraticCurveTo(sx + r() * 16 - 8, sy + r() * 16 - 8, sx + r() * 30 - 15, sy + r() * 30 - 15);
    x.stroke();
  }
  x.globalAlpha = 1;

  const g = x.createRadialGradient(W / 2, H / 2 + 20, 120, W / 2, H / 2 + 20, 560);
  g.addColorStop(0, 'rgba(120,90,40,0)');
  g.addColorStop(1, 'rgba(120,90,40,0.12)');
  x.fillStyle = g;
  x.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

  const rough = (inset: number, alpha: number, width: number): void => {
    x.globalAlpha = alpha;
    x.strokeStyle = COLORS.ink;
    x.lineWidth = width;
    x.lineJoin = 'round';
    const pts: Array<[number, number]> = [];
    const L = ARENA.x - inset;
    const T = ARENA.y - inset;
    const R = ARENA.x + ARENA.w + inset;
    const B = ARENA.y + ARENA.h + inset;
    const edge = (x0: number, y0: number, x1: number, y1: number): void => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 22);
      for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 1.4, y0 + ((y1 - y0) * i) / n + (r() - 0.5) * 1.4]);
    };
    edge(L, T, R, T);
    edge(R, T, R, B);
    edge(R, B, L, B);
    edge(L, B, L, T);
    x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
    x.stroke();
  };
  rough(0, 0.85, 2);
  rough(5, 0.25, 1);
  x.globalAlpha = 1;
  return c;
}
