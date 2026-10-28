// The whole game loop, with no DOM. A run is a state object advanced by `tick(dt)`. Effects and
// audio are injected; the browser shell and the Node tests both run this exact code.

import { ARENA, W, H, INTRO_TIME, DEATH_TIME, HITSTOP_HIT, HITSTOP_KILL, HITSTOP_HURT, MULT_CAP, CATCHES_PER_MULT } from './config.ts';
import { Rng, norm, segCircleHit, circleHit } from './util.ts';
import { waveRoster, spawnGroups, waveBudget, isHeavyWave } from './waves.ts';
import { Player } from './player.ts';
import { Blade } from './blade.ts';
import type {
  BladeLike, BladeWorld, EnemyCatalog, EnemyKind, EnemyLike, EnemyWorld, PlayerWorld, RunStats,
  Shot, SimFx, SimInput, SimMode, SpawnGroup, WaveState, Vec,
} from './types.ts';

export interface SimOptions {
  catalog: EnemyCatalog;
  spawn: (kind: EnemyKind, x: number, y: number, world: EnemyWorld, instant?: boolean) => EnemyLike;
  input: SimInput;
  fx: SimFx;
  introTime?: number;
}

export class Sim implements EnemyWorld, BladeWorld, PlayerWorld {
  readonly catalog: EnemyCatalog;
  readonly input: SimInput;
  readonly fx: SimFx;
  readonly ink: SimFx['ink'];
  readonly sfx: SimFx['sfx'];
  readonly introTime: number;
  private readonly spawnEnemy: SimOptions['spawn'];

  rng = new Rng(1);
  player!: Player;
  blade!: Blade;
  enemies: EnemyLike[] = [];
  newEnemies: EnemyLike[] = [];
  shots: Shot[] = [];
  score = 0;
  combo = 0;
  stats: RunStats = { kills: 0, bestMult: 1, time: 0 };
  hitstop = 0;
  timeScale = 1;
  mode: SimMode = 'playing';
  wave = 0;
  waveState: WaveState = 'intro';
  waveT = 0;
  groups: SpawnGroup[] = [];
  groupClock = 0;
  waveLock = false;
  deathT = 0;
  overT = 0;
  hintAlpha = 1;
  taught = false;
  flash = 0;

  constructor(opts: SimOptions) {
    this.catalog = opts.catalog;
    this.spawnEnemy = opts.spawn;
    this.input = opts.input;
    this.fx = opts.fx;
    this.ink = opts.fx.ink;
    this.sfx = opts.fx.sfx;
    this.introTime = opts.introTime ?? INTRO_TIME;
  }

  get mult(): number {
    return Math.min(1 + Math.floor(this.combo / CATCHES_PER_MULT), MULT_CAP);
  }

  // ---------------------------------------------------------------- lifecycle

  newRun(seed: number): void {
    this.rng = new Rng(seed);
    this.player = new Player(ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2);
    this.blade = new Blade(this.player);
    this.enemies = [];
    this.newEnemies = [];
    this.shots = [];
    this.score = 0;
    this.combo = 0;
    this.stats = { kills: 0, bestMult: 1, time: 0 };
    this.hitstop = 0;
    this.timeScale = 1;
    this.mode = 'playing';
    this.overT = 0;
    this.deathT = 0;
    this.hintAlpha = 1;
    this.taught = false;
    this.flash = 0;
    this.waveLock = false;
    this.ink.clear();
    this.startWave(1);
  }

  startWave(n: number): void {
    this.wave = n;
    this.waveState = 'intro';
    this.waveT = this.introTime;
    this.groups = spawnGroups(waveRoster(n, this.rng, this.catalog), n, this.rng);
    this.groupClock = 0;
    const debut = (Object.keys(this.catalog) as EnemyKind[]).find((k) => this.catalog[k].unlock === n);
    this.debutNote = debut ? this.catalog[debut].note : null;
    this.sfx.wave();
  }

  debutNote: string | null = null;

  private waveCleared(): void {
    this.waveState = 'clear';
    this.waveT = 1.1;
    const bonus = 100 * this.wave;
    this.score += bonus;
    this.fx.floaters.add(W / 2, H / 2, `wave clear  +${bonus}`, { size: 18, life: 1.2, rise: 20 });
    this.sfx.clear();
    if (this.wave % 3 === 0 && this.player.hp < this.player.maxHp) {
      this.player.hp += 1;
      this.fx.floaters.add(this.player.x, this.player.y - 20, '+1', { size: 16, color: '#d9402b', life: 1.2 });
      this.fx.particles.ring(this.player.x, this.player.y, '#d9402b', 26);
      this.sfx.heal();
    }
  }

  die(): void {
    const p = this.player;
    this.mode = 'dying';
    this.timeScale = 0.3;
    this.deathT = DEATH_TIME;
    this.ink.blot(p.x, p.y, 26, '#d9402b', 0, 0, 0.9);
    this.fx.particles.burst(p.x, p.y, { count: 40, color: '#d9402b', speed: [80, 420], life: [0.4, 1.1], size: [2, 6] });
    this.fx.shake.add(1);
    this.sfx.gameOver();
    this.fx.onDeath();
  }

  finishRun(): void {
    this.mode = 'over';
    this.overT = 0;
    this.fx.onFinish(this.score, this.wave);
  }

  // ---------------------------------------------------------------- hooks used by entities

  hasTargets(): boolean {
    return this.enemies.some((e) => e.active);
  }

  addEnemy(e: EnemyLike): void {
    this.newEnemies.push(e);
  }

  spawnShot(x: number, y: number, vx: number, vy: number): void {
    this.shots.push({ x, y, vx, vy, r: 6, dead: false });
    this.sfx.shoot();
  }

  onThrow(_b: BladeLike): void {
    this.sfx.throw();
    this.player.squash = 0.5;
  }

  onRecall(b: BladeLike): void {
    this.sfx.recall();
    this.fx.particles.ring(b.x, b.y, '#d9402b', 12);
  }

  onDash(p: Player): void {
    this.sfx.dash();
    this.fx.particles.burst(p.x, p.y, { count: 8, color: '#958c7c', dirX: -p.dashX, dirY: -p.dashY, spread: 1.2, speed: [60, 180] });
  }

  onBladeBounce(b: BladeLike): void {
    this.fx.onBladeBounce(b);
  }

  // Swept collision for the blade this frame. Pierces everything; heavy enemies slow it.
  bladeSweep(b: BladeLike, x1: number, y1: number, x2: number, y2: number): void {
    const [dx, dy] = norm(b.vx, b.vy);
    for (const e of this.enemies) {
      if (!e.active || b.hitSet.has(e)) continue;
      if (!segCircleHit(x1, y1, x2, y2, e.x, e.y, e.r + b.r)) continue;
      b.hitSet.add(e);
      b.flightHits += 1;
      e.hit(dx, dy, this);
      if (e.heavy) b.drag();
      this.sfx.hit(b.flightHits + this.combo);
      this.hitstop = Math.max(this.hitstop, e.dead ? HITSTOP_KILL : HITSTOP_HIT);
      this.fx.shake.add(e.dead ? 0.26 : 0.13);
      this.fx.particles.burst(e.x, e.y, { count: e.dead ? 16 : 6, dirX: dx, dirY: dy, spread: 1.7 });
      if (e.dead) this.kill(e, dx, dy);
    }
    for (const s of this.shots) {
      if (s.dead || !segCircleHit(x1, y1, x2, y2, s.x, s.y, s.r + b.r)) continue;
      s.dead = true;
      const pts = 5 * this.mult;
      this.score += pts;
      this.fx.floaters.add(s.x, s.y, `${pts}`, { size: 11 });
      this.sfx.clink();
      this.fx.particles.burst(s.x, s.y, { count: 6, color: '#1d1b1a', speed: [40, 160] });
    }
  }

  kill(e: EnemyLike, dx: number, dy: number): void {
    this.stats.kills += 1;
    const pts = e.points * this.mult;
    this.score += pts;
    this.fx.floaters.add(e.x, e.y - e.r, `${pts}`, { size: 13 + Math.min(this.mult, 8) });
    this.ink.blot(e.x, e.y, e.r * 1.25, '#1d1b1a', dx, dy);
    this.sfx.kill();
  }

  // Catching a blade that struck something banks a combo step. Catching an empty blade
  // (when there was something to hit) breaks the chain.
  onCatch(hits: number, hadTargets: boolean): void {
    const p = this.player;
    if (hits > 0) {
      const before = this.mult;
      this.combo += 1;
      const m = this.mult;
      this.stats.bestMult = Math.max(this.stats.bestMult, m);
      this.sfx.catch(m);
      this.fx.particles.ring(p.x, p.y, '#d9402b', 18);
      if (m > before) this.fx.floaters.add(p.x, p.y - 22, `×${m}`, { size: 18, color: '#d9402b' });
      if (hits >= 3) {
        const bonus = 15 * hits * hits * m;
        this.score += bonus;
        this.fx.floaters.add(p.x, p.y - 42, `pierce ×${hits}  +${bonus}`, { size: 14, color: '#1d1b1a', life: 1 });
      }
      this.taught = true;
    } else if (hadTargets && this.combo > 0) {
      this.combo = 0;
      this.fx.floaters.add(p.x, p.y - 22, 'dropped', { size: 13, color: '#958c7c' });
      this.sfx.whiff();
    } else {
      this.sfx.catchSoft();
    }
  }

  hurtPlayer(fromX: number, fromY: number): void {
    const p = this.player;
    if (!p.hurt(this, fromX, fromY)) return;
    this.combo = 0;
    this.hitstop = HITSTOP_HURT;
    this.fx.shake.add(0.7);
    this.flash = 1;
    this.fx.flash(1);
    this.sfx.hurt();
    this.ink.blot(p.x, p.y, 9, '#d9402b', p.vx, p.vy, 0.8);
    this.fx.particles.burst(p.x, p.y, { count: 18, color: '#d9402b', speed: [80, 300] });
    if (!p.alive) this.die();
  }

  findSpawn(r: number): Vec {
    const p = this.player;
    for (let i = 0; i < 40; i++) {
      const x = this.rng.float(ARENA.x + r + 12, ARENA.x + ARENA.w - r - 12);
      const y = this.rng.float(ARENA.y + r + 12, ARENA.y + ARENA.h - r - 12);
      if (Math.hypot(x - p.x, y - p.y) > 200) return [x, y];
    }
    // Fallback: the corner farthest from the player.
    return [p.x < W / 2 ? ARENA.x + ARENA.w - r - 20 : ARENA.x + r + 20, p.y < H / 2 ? ARENA.y + ARENA.h - r - 20 : ARENA.y + r + 20];
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    if (this.mode !== 'playing' && this.mode !== 'dying') return;
    if (this.mode === 'playing') this.stats.time += dt;
    this.hintAlpha = Math.max(0, this.hintAlpha - (this.taught && this.wave >= 2 ? dt * 0.8 : 0));

    if (this.waveState === 'intro') {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveState = 'fight';
        this.groupClock = 0;
      }
    } else if (this.waveState === 'fight') {
      this.groupClock += dt;
      while (this.groups.length && this.groups[0].at <= this.groupClock) {
        const group = this.groups.shift();
        if (!group) break;
        for (const kind of group.kinds) {
          const [x, y] = this.findSpawn(this.catalog[kind].r);
          this.enemies.push(this.spawnEnemy(kind, x, y, this));
        }
        this.sfx.spawn();
      }
      if (!this.groups.length && !this.enemies.length && !this.newEnemies.length && this.mode === 'playing' && !this.waveLock) this.waveCleared();
    } else if (this.waveState === 'clear') {
      this.waveT -= dt;
      if (this.waveT <= 0 && this.mode === 'playing') this.startWave(this.wave + 1);
    }

    const p = this.player;
    p.update(dt, this);
    this.blade.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    this.separate();

    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < ARENA.x || s.x > ARENA.x + ARENA.w || s.y < ARENA.y || s.y > ARENA.y + ARENA.h) {
        s.dead = true;
        this.ink.dot(s.x, s.y, 3, '#1d1b1a', 0.5);
      }
    }

    if (p.alive) {
      for (const e of this.enemies) {
        if (e.active && circleHit(p.x, p.y, p.r - 2, e.x, e.y, e.r - 2)) {
          this.hurtPlayer(e.x, e.y);
          break;
        }
      }
      for (const s of this.shots) {
        if (!s.dead && p.alive && circleHit(p.x, p.y, p.r - 2, s.x, s.y, s.r)) {
          s.dead = true;
          this.hurtPlayer(s.x, s.y);
        }
      }
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.newEnemies.length) {
      this.enemies.push(...this.newEnemies);
      this.newEnemies.length = 0;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  // Cheap pairwise push-apart so packs spread out instead of stacking into one blob.
  separate(): void {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (!a.active) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-4) continue;
        const d = Math.sqrt(d2);
        const push = min - d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const ka = mb / (ma + mb);
        const kb = ma / (ma + mb);
        a.x -= (dx / d) * push * ka;
        a.y -= (dy / d) * push * ka;
        b.x += (dx / d) * push * kb;
        b.y += (dy / d) * push * kb;
      }
    }
  }

  // One frame of game time. Input polling and menus live in the shell.
  tick(realDt: number): void {
    if (this.mode === 'playing' || this.mode === 'dying') {
      if (this.hitstop > 0) this.hitstop -= realDt; // freeze-frame: the sim pauses, the camera doesn't
      else this.update(realDt * this.timeScale);
      if (this.mode === 'dying') {
        this.deathT -= realDt;
        if (this.deathT <= 0) this.finishRun();
      }
    } else {
      this.overT += realDt;
    }
  }

  // Used by tests and the debug overlay; kept here so the shell does not duplicate it.
  get waveBudget(): number {
    return waveBudget(this.wave);
  }

  get heavyWave(): boolean {
    return isHeavyWave(this.wave);
  }
}
