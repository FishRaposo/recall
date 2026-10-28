import { W, H, ARENA, COLORS, FONT, INPUT_BUFFER, MULT_CAP, CATCHES_PER_MULT, INTRO_TIME } from './core/config.ts';
import { Rng, TAU } from './core/util.ts';
import { Sim } from './core/sim.ts';
import { Blade } from './core/blade.ts';
import { ENEMIES, createEnemy } from './content/enemies.ts';
import { Input } from './platform/input.ts';
import { Sfx } from './platform/audio.ts';
import { loadBest, saveBest } from './platform/storage.ts';
import type { Best } from './platform/storage.ts';
import { loadSettings, saveSettings } from './platform/settings.ts';
import type { Settings } from './platform/settings.ts';
import { Shake, Particles, InkLayer, Floaters, makeBackground } from './presentation/fx.ts';
import * as ui from './presentation/ui.ts';
import { Menus } from './presentation/menus.ts';
import { attachHarness } from './harness.ts';
import type { BladeLike, EnemyLike, PlayerLike, SimFx, WaveState, SpawnGroup, Vec } from './core/types.ts';

const params = new URLSearchParams(location.search);
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const DEBUG = params.has('debug');
const HARNESS = params.has('harness'); // tests drive the clock and the input; see src/harness.ts

type Screen = 'title' | 'playing' | 'paused' | 'over';

export class Game implements SimFx, ui.UiGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  input: Input;
  sim: Sim;
  sfx: Sfx;
  bg: HTMLCanvasElement;
  ink: InkLayer;
  particles: Particles;
  floaters: Floaters;
  shake: Shake;
  best: Best;
  settings: Settings;
  menus: Menus;
  screen: Screen = 'title';
  clock = 0;
  displayScore = 0;
  flashT = 0;
  fps = 60;
  newBest = false;
  harness: boolean;
  seed = 1;
  multCap = MULT_CAP;
  catchesPerMult = CATCHES_PER_MULT;
  titleBlade: Blade | null = null;
  test?: ReturnType<typeof attachHarness>;
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    const menuRoot = document.getElementById('ui');
    const announcer = document.getElementById('announcer');
    if (!ctx || !menuRoot || !announcer) throw new Error('Recall needs a canvas, #ui and #announcer');
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = new Input(canvas, this.view);
    this.sfx = new Sfx();
    this.settings = loadSettings();
    this.sfx.configure(this.settings);
    this.menus = new Menus(menuRoot, announcer);
    this.bg = makeBackground();
    this.ink = new InkLayer();
    this.particles = new Particles();
    this.floaters = new Floaters();
    this.shake = new Shake();
    this.applySettings(this.settings, false);
    this.best = loadBest();
    this.harness = HARNESS;
    this.sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input: this.input, fx: this, introTime: INTRO_TIME });
    this.seed = FIXED_SEED ?? ((Date.now() ^ 0x9e3779b9) >>> 0);
    this.paintTitle();

    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.wireButtons();

    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  // ---------------------------------------------------------------- exposed game state (harness + checks)

  get state(): string {
    if (this.screen !== 'playing') return this.screen;
    return this.sim.mode;
  }
  get player(): PlayerLike { return this.sim.player; }
  get blade(): BladeLike { return this.sim.blade; }
  get enemies(): EnemyLike[] { return this.sim.enemies; }
  get newEnemies(): EnemyLike[] { return this.sim.newEnemies; }
  get shots() { return this.sim.shots; }
  get score(): number { return this.sim.score; }
  get combo(): number { return this.sim.combo; }
  get mult(): number { return this.sim.mult; }
  get stats() { return this.sim.stats; }
  get wave(): number { return this.sim.wave; }
  get waveState(): WaveState { return this.sim.waveState; }
  set waveState(v: WaveState) { this.sim.waveState = v; }
  get groups(): SpawnGroup[] { return this.sim.groups; }
  set groups(v: SpawnGroup[]) { this.sim.groups = v; }
  get groupClock(): number { return this.sim.groupClock; }
  get waveT(): number { return this.sim.waveT; }
  get waveLock(): boolean { return this.sim.waveLock; }
  set waveLock(v: boolean) { this.sim.waveLock = v; }
  get hitstop(): number { return this.sim.hitstop; }
  get timeScale(): number { return this.sim.timeScale; }
  get introTime(): number { return this.sim.introTime; }
  get rng(): Rng { return this.sim.rng; }
  get overT(): number { return this.sim.overT; }
  get taught(): boolean { return this.sim.taught; }
  get hintAlpha(): number { return this.sim.hintAlpha; }
  get debutNote(): string | null { return this.sim.debutNote; }

  // ---------------------------------------------------------------- SimFx

  flash(amount: number): void {
    const scale = this.settings.reducedMotion ? 0 : this.settings.flashes;
    this.flashT = Math.max(this.flashT, amount * scale);
  }

  onBladeBounce(b: BladeLike): void {
    this.sfx.bounce();
    this.shake.add(0.06);
    this.ink.dot(b.x, b.y, 2.2, COLORS.red, 0.5);
    this.particles.burst(b.x, b.y, { count: 4, color: COLORS.red, speed: [40, 120], size: [1, 2.5] });
  }

  onDeath(): void {
    this.menus.announce(`Run over on wave ${this.sim.wave}`);
  }

  onFinish(score: number, wave: number): void {
    this.screen = 'over';
    if (score > this.best.score) {
      this.best = { score, wave };
      this.newBest = true;
      saveBest(this.best);
    }
  }

  hurtPlayer(fromX: number, fromY: number): void {
    this.sim.hurtPlayer(fromX, fromY);
  }

  // ---------------------------------------------------------------- lifecycle / settings

  newRun(seedOverride?: number): void {
    this.sfx.unlock();
    const seed = seedOverride ?? FIXED_SEED ?? ((Date.now() ^ 0x9e3779b9) >>> 0);
    this.seed = seed;
    this.sim.newRun(seed);
    this.screen = 'playing';
    this.displayScore = 0;
    this.flashT = 0;
    this.newBest = false;
    this.input.clearBuffers();
    this.menus.close();
    this.menus.announce(`Wave 1 · seed ${seed}`);
  }

  applySettings(settings: Settings, persist = true): void {
    this.settings = settings;
    this.sfx.configure(settings);
    this.shake.scale = settings.reducedMotion ? 0 : settings.shake;
    if (persist) saveSettings(settings);
  }

  toggleFullscreen(): void {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.canvas.requestFullscreen?.();
    } catch {
      /* not allowed in this frame */
    }
  }

  openSettings(): void {
    this.sfx.unlock();
    this.menus.openSettings(
      this.settings,
      { onChange: (s) => this.applySettings(s), onFullscreen: () => this.toggleFullscreen() },
      () => {
        if (this.screen === 'paused') this.screen = 'playing';
      },
    );
  }

  pause(): void {
    if (this.screen !== 'playing' || this.harness || this.menus.isOpen) return;
    this.screen = 'paused';
    this.menus.announce('Paused');
    setTimeout(() => {
      if (this.screen !== 'paused' || this.menus.isOpen) return;
      this.menus.openPause(this.settings, {
        onChange: (s) => this.applySettings(s),
        onFullscreen: () => this.toggleFullscreen(),
        onResume: () => {
          this.screen = 'playing';
          this.menus.announce('Resumed');
        },
        onNewRun: () => this.newRun(),
      });
    }, 0);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  private wireButtons(): void {
    const settings = document.getElementById('settings-btn');
    const pause = document.getElementById('pause-btn');
    const throwBtn = document.getElementById('throw-btn');
    const dashBtn = document.getElementById('dash-btn');
    settings?.addEventListener('click', () => {
      if (this.screen === 'playing') this.pause();
      else this.openSettings();
    });
    pause?.addEventListener('click', () => this.pause());
    const bind = (button: HTMLElement | null, action: 'throw' | 'dash'): void => {
      if (!button) return;
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sfx.unlock();
        this.input.press(action);
        this.input.setHeld(action, true);
        if (this.screen === 'title') this.newRun();
      });
      const up = (): void => this.input.setHeld(action, false);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', up);
    };
    bind(throwBtn, 'throw');
    bind(dashBtn, 'dash');
  }

  // ---------------------------------------------------------------- frame loop

  frame(now: number): void {
    const realDt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.fps += (1 / Math.max(realDt, 1e-3) - this.fps) * 0.05;
    if (!this.harness) this.tick(realDt); // under the harness, time only moves when a test steps it
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  tick(realDt: number): void {
    this.input.poll(realDt);
    if (!this.menus.isOpen) this.handleMeta();

    if (!this.menus.isOpen && (this.screen === 'playing' || this.screen === 'over')) this.sim.tick(realDt);

    this.clock += realDt;
    this.displayScore += (this.sim.score - this.displayScore) * (1 - Math.exp(-12 * realDt));
    this.particles.update(realDt);
    this.floaters.update(realDt);
    this.shake.update(realDt);
    if (this.sim.mode !== 'over') this.flashT = Math.max(0, this.flashT - realDt * 4);
    this.input.endFrame();
  }

  handleMeta(): void {
    const inp = this.input;
    if (inp.was('KeyM')) {
      this.applySettings({ ...this.settings, muted: !this.settings.muted });
      return;
    }
    if (inp.was('KeyF')) {
      this.toggleFullscreen();
      return;
    }
    if (inp.was('KeyO')) {
      if (this.screen === 'playing') this.pause();
      else this.openSettings();
      return;
    }

    switch (this.screen) {
      case 'title':
        if (inp.startPressed()) {
          this.sfx.unlock();
          this.newRun();
        }
        break;
      case 'playing':
        if (inp.was('Escape', 'KeyP', 'PadStart')) this.pause();
        break;
      case 'paused':
        if (!this.menus.isOpen && inp.was('Escape', 'KeyP', 'PadStart', 'Mouse0', 'PadA')) {
          this.screen = 'playing';
          this.input.clearBuffers();
        }
        break;
      case 'over':
        if (inp.was('KeyS')) this.savePainting();
        if (this.sim.overT > 0.8 && (inp.startPressed() || inp.was('KeyR'))) this.newRun();
        break;
    }
  }

  // ---------------------------------------------------------------- painting

  savePainting(): void {
    const c = document.createElement('canvas');
    c.width = W * 2;
    c.height = H * 2;
    const x = c.getContext('2d');
    if (!x) return;
    x.drawImage(this.bg, 0, 0, c.width, c.height);
    x.drawImage(this.ink.canvas, 0, 0, c.width, c.height);
    x.scale(2, 2);
    ui.text(x, 'RECALL', 40, 27, { size: 15, font: FONT.mono, weight: 'bold', align: 'left', spacing: 4 });
    ui.text(x, `wave ${this.sim.wave}  ·  ${Math.round(this.sim.score).toLocaleString('en-US')}`, W - 40, 27, { size: 14, style: 'italic', align: 'right' });
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recall-wave${this.sim.wave}-${Math.round(this.sim.score)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
    this.floaters.add(W / 2, H - 60, 'painting saved', { size: 13, life: 1.2, rise: 10 });
  }

  // ---------------------------------------------------------------- rendering

  render(): void {
    const ctx = this.ctx;
    const v = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.letterbox;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = COLORS.paperDark;
    ctx.fillRect(0, 0, W, H);

    const [sx, sy, rot] = this.shake.offset();
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.rotate(rot);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(this.bg, 0, 0, W, H);
    ctx.drawImage(this.ink.canvas, 0, 0, W, H);

    if (this.screen === 'title') this.drawTitleBlade(ctx);
    else this.drawWorld(ctx);
    this.particles.draw(ctx);
    this.floaters.draw(ctx);
    ctx.restore();

    if (this.flashT > 0) {
      ctx.fillStyle = COLORS.red;
      ctx.globalAlpha = this.flashT * 0.18;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (this.screen === 'title') ui.drawTitle(ctx, this);
    else {
      ui.drawHud(ctx, this);
      ui.drawWaveBanner(ctx, this);
      if (this.screen === 'playing' || this.screen === 'paused') {
        ui.drawHint(ctx, this);
        if (this.screen === 'playing') ui.drawReticle(ctx, this);
      }
      if (this.screen === 'paused') ui.drawPause(ctx);
      if (this.screen === 'over') ui.drawGameOver(ctx, this);
    }
    this.canvas.style.cursor = this.screen === 'playing' ? 'none' : 'default';

    if (DEBUG) {
      ui.text(ctx, `${this.fps.toFixed(0)} fps · ${this.sim.enemies.length} enemies · ${this.particles.list.length} particles · seed ${this.sim.rng.seed}`, 8, H - 8, {
        size: 11, font: FONT.mono, align: 'left', baseline: 'bottom', color: COLORS.grey,
      });
    }
    ctx.restore();
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    const p = this.sim.player;
    const b = this.sim.blade;
    // The tether: a faint line from you to the blade while it's away.
    if (b.flying && p.alive) {
      ctx.save();
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = b.state === 'return' ? 0.28 : 0.14;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    for (const s of this.sim.shots) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const e of this.sim.enemies) e.draw(ctx);
    p.draw(ctx);
    b.draw(ctx);
  }

  // Title screen: the blade circles the text, out and back, forever.
  drawTitleBlade(ctx: CanvasRenderingContext2D): void {
    const t = this.clock * 0.55;
    const path = (k: number): Vec => [W / 2 + Math.cos(k) * 410, 282 + Math.sin(k) * 196];
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 16; i > 0; i--) {
      const [x0, y0] = path(t - i * 0.02);
      const [x1, y1] = path(t - (i - 1) * 0.02);
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = (1 - i / 16) * 0.4;
      ctx.lineWidth = (1 - i / 16) * 6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
    const [bx, by] = path(t);
    if (!this.titleBlade) this.titleBlade = new Blade({ x: bx, y: by, r: 0, faceX: 1, faceY: 0 } as PlayerLike);
    Object.assign(this.titleBlade, { x: bx, y: by, angle: this.clock * 14, trail: [] });
    this.titleBlade.draw(ctx);
  }

  paintTitle(): void {
    // A few blots in the margins so the title already looks like a floor someone fought on.
    const r = new Rng(11);
    for (let i = 0; i < 8; i++) {
      const left = i % 2 === 0;
      const x = left ? r.float(70, 190) : r.float(770, 890);
      this.ink.blot(x, r.float(100, H - 70), r.float(6, 15), i === 3 ? COLORS.red : COLORS.ink, r.float(-1, 1), r.float(-1, 1), 0.2);
    }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas as HTMLCanvasElement);
window.__recall = game; // exposed for the smoke test and for poking at in the console
if (HARNESS) game.test = attachHarness(game);

// Keep the input buffer constant reachable for the harness without exporting the module twice.
export const BUFFER = INPUT_BUFFER;
