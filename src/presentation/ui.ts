import { W, H, ARENA, COLORS, FONT } from '../core/config.ts';
import { TAU } from '../core/util.ts';
import type { Best, PlayerLike, RunMode, RunStats, WaveState } from '../core/types.ts';

export interface UiGame {
  player: PlayerLike;
  seed: number;
  wave: number;
  displayScore: number;
  mult: number;
  combo: number;
  multCap: number;
  catchesPerMult: number;
  sfx: { muted: boolean };
  waveState: WaveState;
  waveT: number;
  introTime: number;
  debutNote: string | null;
  hintAlpha: number;
  input: { aimSource: 'mouse' | 'keys' | 'pad' | 'touch'; mouse: { x: number; y: number; inside: boolean } };
  clock: number;
  best: Best;
  overT: number;
  newBest: boolean;
  stats: RunStats;
  score: number;
  runMode: RunMode;
  pigment: number;
  buffs: Array<{ name: string; remaining: number; duration: number }>;
  techniques: Array<{ name: string; stacks: number }>;
  paintingTitle: string;
}

export interface TextOptions {
  size?: number;
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: string;
  style?: string;
  alpha?: number;
  spacing?: number;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOptions = {}): void {
  const { size = 16, font = FONT.serif, color = COLORS.ink, align = 'center', baseline = 'middle', weight = '', style = '', alpha = 1, spacing = 0 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${style} ${weight} ${size}px ${font}`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

export function drawHud(ctx: CanvasRenderingContext2D, g: UiGame): void {
  const p = g.player;
  for (let i = 0; i < p.maxHp; i++) {
    const x = 44 + i * 24;
    ctx.beginPath();
    ctx.arc(x, 26, 7.5, 0, TAU);
    if (i < p.hp) {
      ctx.fillStyle = COLORS.ink;
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.grey;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  text(ctx, `WAVE ${g.wave}`, W / 2, 26, { size: 14, font: FONT.mono, spacing: 3, weight: 'bold' });

  text(ctx, fmt(g.displayScore), W - 34, 22, { size: 22, font: FONT.mono, align: 'right', weight: 'bold' });
  const m = g.mult;
  text(ctx, `×${m}`, W - 34, 42, { size: 13, font: FONT.mono, align: 'right', weight: 'bold', color: m > 1 ? COLORS.red : COLORS.grey });
  // Pips: catches banked toward the next multiplier step.
  if (m < g.multCap) {
    const into = g.combo % g.catchesPerMult;
    for (let i = 0; i < g.catchesPerMult; i++) {
      ctx.beginPath();
      ctx.arc(W - 72 - i * 9, 42, 2.6, 0, TAU);
      ctx.fillStyle = i < into ? COLORS.red : 'rgba(29,27,26,0.18)';
      ctx.fill();
    }
  }

  if (g.runMode === 'roguelike') {
    text(ctx, `pigment ${g.pigment}`, 34 + 3 * 24 + 18, 26, { size: 11, font: FONT.mono, align: 'left', color: '#2f5fa8' });
    g.buffs.slice(0, 4).forEach((b, i) => {
      text(ctx, `${b.name} ${Math.ceil(b.remaining)}s`, 36, ARENA.y + ARENA.h - 14 - i * 12, {
        size: 9, font: FONT.mono, align: 'left', color: '#2f5fa8', alpha: 0.8,
      });
    });
  }

  if (g.sfx.muted) {
    text(ctx, 'muted', 34 + 3 * 24 + 18 + (g.runMode === 'roguelike' ? 86 : 0), 26, {
      size: 11, font: FONT.mono, align: 'left', color: COLORS.grey,
    });
  }
}

export function drawWaveBanner(ctx: CanvasRenderingContext2D, g: UiGame): void {
  if (g.waveState !== 'intro') return;
  const t = 1 - g.waveT / g.introTime;
  const a = Math.min(1, t * 4, (1 - t) * 3);
  // A wash of paper behind the text so it stays readable over a heavily inked floor.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, 0.3); // squash the radial gradient into a wide ellipse
  const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, 320);
  grad.addColorStop(0, 'rgba(239,232,218,0.92)');
  grad.addColorStop(1, 'rgba(239,232,218,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = grad;
  ctx.fillRect(-320, -320, 640, 640);
  ctx.restore();
  text(ctx, `wave ${g.wave}`, W / 2, H / 2 - 18, { size: 44, style: 'italic', alpha: a });
  if (g.debutNote) text(ctx, g.debutNote, W / 2, H / 2 + 22, { size: 16, style: 'italic', alpha: a * 0.75 });
}

export function drawHint(ctx: CanvasRenderingContext2D, g: UiGame): void {
  if (g.hintAlpha <= 0.01) return;
  text(ctx, 'click to throw  ·  click again to call it back  ·  catch it to raise your multiplier', W / 2, ARENA.y + ARENA.h - 18, {
    size: 13,
    font: FONT.mono,
    alpha: g.hintAlpha * 0.7,
  });
}

export function drawReticle(ctx: CanvasRenderingContext2D, g: UiGame): void {
  if (g.input.aimSource !== 'mouse' || !g.input.mouse.inside) return;
  const { x, y } = g.input.mouse;
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, TAU);
  ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
  ctx.stroke();
  ctx.restore();
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = COLORS.paper;
  ctx.globalAlpha = 0.93;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 0.3;
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
  ctx.restore();
}

export function drawTitle(ctx: CanvasRenderingContext2D, g: UiGame): void {
  const t = g.clock;
  text(ctx, 'RECALL', W / 2, 168, { size: 104, weight: 'bold', spacing: 14 });
  // A red stroke under the title, like a cut.
  ctx.save();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 230, 228);
  ctx.quadraticCurveTo(W / 2, 214, W / 2 + 236, 222);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'throw the blade.  call it home.  paint the floor.', W / 2, 262, { size: 19, style: 'italic' });

  const rows: Array<[string, string]> = [
    ['move', 'WASD  ·  arrows  ·  left stick  ·  touch drag'],
    ['aim', 'mouse  ·  right stick  ·  tap'],
    ['throw / recall', 'click  ·  Z  ·  space  ·  pad A  ·  button'],
    ['dash', 'right-click  ·  shift  ·  X  ·  pad B  ·  button'],
    ['pause  ·  mute  ·  fullscreen', 'esc  ·  M  ·  F'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 318 + i * 24;
    text(ctx, k, W / 2 - 14, y, { size: 13, font: FONT.mono, align: 'right', color: COLORS.grey });
    text(ctx, v, W / 2 + 14, y, { size: 13, font: FONT.mono, align: 'left' });
  });

  text(ctx, 'click or tap for arcade', W / 2, 466, { size: 18, style: 'italic', alpha: 0.55 + 0.45 * Math.sin(t * 3) });
  text(ctx, `seed ${g.seed}  ·  Y copy`, W / 2, 516, { size: 11, font: FONT.mono, color: COLORS.grey });
  if (g.best.score > 0) text(ctx, `arcade best  ${fmt(g.best.score)}  ·  wave ${g.best.wave}`, W / 2, 496, { size: 11, font: FONT.mono, color: COLORS.grey });
}

export function drawPause(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = COLORS.paper;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  text(ctx, 'paused', W / 2, H / 2 - 10, { size: 44, style: 'italic' });
  text(ctx, 'esc or click to resume', W / 2, H / 2 + 30, { size: 13, font: FONT.mono, color: COLORS.grey });
}

export function drawGameOver(ctx: CanvasRenderingContext2D, g: UiGame): void {
  if (g.overT < 1.4) {
    text(ctx, g.paintingTitle || 'untitled', W / 2, H - 16, {
      size: 13, font: FONT.mono, color: COLORS.grey, alpha: Math.min(1, g.overT * 2),
    });
    return;
  }
  const w = 440;
  const h = 340;
  const x = (W - w) / 2;
  const y = (H - h) / 2 + 6;
  const a = Math.min(1, (g.overT - 1.4) * 3);
  ctx.save();
  ctx.globalAlpha = a;
  panel(ctx, x, y, w, h);
  text(ctx, g.paintingTitle || 'untitled', W / 2, y + 18, { size: 12, font: FONT.mono, color: COLORS.grey });
  text(ctx, 'the ink dries.', W / 2, y + 48, { size: 30, style: 'italic' });
  text(ctx, fmt(g.score), W / 2, y + 96, { size: 46, font: FONT.mono, weight: 'bold' });
  if (g.newBest) text(ctx, 'new best', W / 2, y + 126, { size: 13, font: FONT.mono, color: COLORS.red, weight: 'bold', spacing: 2 });
  const s = g.stats;
  const mins = Math.floor(s.time / 60);
  const secs = Math.floor(s.time % 60).toString().padStart(2, '0');
  const rows: Array<[string, string]> = [
    ['wave', `${g.wave} · ${g.runMode}`],
    ['kills', `${s.kills}`],
    ['top multiplier', `×${s.bestMult}`],
    ['double taps', `${s.doubleTaps ?? 0}`],
    ['time', `${mins}:${secs}`],
  ];
  rows.forEach(([k, v], i) => {
    const ry = y + 150 + i * 20;
    text(ctx, k, W / 2 - 10, ry, { size: 13, font: FONT.mono, align: 'right', color: COLORS.grey });
    text(ctx, v, W / 2 + 10, ry, { size: 13, font: FONT.mono, align: 'left' });
  });
  if (g.techniques.length) {
    const shown = g.techniques.slice(0, 4).map((t) => `${t.name} ×${t.stacks}`).join(' · ');
    const more = g.techniques.length > 4 ? `  +${g.techniques.length - 4}` : '';
    text(ctx, shown + more, W / 2, y + 254, { size: 10, font: FONT.mono, color: COLORS.grey, alpha: a });
  }
  const ready = g.overT > 0.8;
  text(ctx, 'click/R again · T title · S save · V share', W / 2, y + h - 26, { size: 13, font: FONT.mono, alpha: ready ? 1 : 0.3 });
  text(ctx, `seed ${g.seed}  ·  Y copy`, W / 2, y + h + 18, { size: 11, font: FONT.mono, color: COLORS.grey, alpha: a });
  ctx.restore();
}
