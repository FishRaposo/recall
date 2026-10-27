import { W, H, ARENA, COLORS, FONT, MULT_CAP, CATCHES_PER_MULT } from './config.js';
import { Rng, norm, circleHit, segCircleHit, TAU } from './util.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Shake, Particles, InkLayer, Floaters, makeBackground } from './fx.js';
import { Player } from './player.js';
import { Blade } from './blade.js';
import { createEnemy, enemyRadius } from './enemies.js';
import { waveRoster, spawnGroups, UNLOCK_WAVE, DEBUT_NOTE } from './waves.js';
import { loadBest, saveBest } from './storage.js';
import * as ui from './ui.js';
import { attachHarness } from './harness.js';

const params = new URLSearchParams(location.search);
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const DEBUG = params.has('debug');
const HARNESS = params.has('harness'); // tests drive the clock and the input; see src/harness.js

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.input = new Input(canvas, this.view);
    this.sfx = new Sfx();
    this.bg = makeBackground();
    this.ink = new InkLayer();
    this.particles = new Particles();
    this.floaters = new Floaters();
    this.shake = new Shake();
    this.best = loadBest();
    this.multCap = MULT_CAP;
    this.catchesPerMult = CATCHES_PER_MULT;
    this.introTime = 1.7;
    this.state = 'title';
    this.clock = 0;
    this.flash = 0;
    this.fps = 60;
    this.waveLock = false;
    this.harness = HARNESS;
    this.paintTitle();

    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => document.hidden && this.pause());

    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  // ---------------------------------------------------------------- run lifecycle

  newRun(seedOverride) {
    const seed = seedOverride ?? FIXED_SEED ?? ((Date.now() ^ 0x9e3779b9) >>> 0);
    this.rng = new Rng(seed);
    this.player = new Player(ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2);
    this.blade = new Blade(this.player);
    this.enemies = [];
    this.newEnemies = [];
    this.shots = [];
    this.score = 0;
    this.displayScore = 0;
    this.combo = 0;
    this.stats = { kills: 0, bestMult: 1, time: 0 };
    this.hitstop = 0;
    this.timeScale = 1;
    this.hintAlpha = 1;
    this.taught = false;
    this.newBest = false;
    this.ink.clear();
    this.particles.list.length = 0;
    this.floaters.list.length = 0;
    this.input.clearBuffers();
    this.state = 'playing';
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    this.waveState = 'intro';
    this.waveT = this.introTime;
    this.groups = spawnGroups(waveRoster(n, this.rng), n, this.rng);
    this.groupClock = 0;
    const debut = Object.keys(UNLOCK_WAVE).find((k) => UNLOCK_WAVE[k] === n);
    this.debutNote = debut ? DEBUT_NOTE[debut] : null;
    this.sfx.wave();
  }

  waveCleared() {
    this.waveState = 'clear';
    this.waveT = 1.1;
    const bonus = 100 * this.wave;
    this.score += bonus;
    this.floaters.add(W / 2, H / 2, `wave clear  +${bonus}`, { size: 18, life: 1.2, rise: 20 });
    this.sfx.clear();
    if (this.wave % 3 === 0 && this.player.hp < this.player.maxHp) {
      this.player.hp += 1;
      this.floaters.add(this.player.x, this.player.y - 20, '+1', { size: 16, color: COLORS.red, life: 1.2 });
      this.particles.ring(this.player.x, this.player.y, COLORS.red, 26);
      this.sfx.heal();
    }
  }

  die() {
    const p = this.player;
    this.state = 'dying';
    this.timeScale = 0.3;
    this.deathT = 1.1;
    this.ink.blot(p.x, p.y, 26, COLORS.red, 0, 0, 0.9);
    this.particles.burst(p.x, p.y, { count: 40, color: COLORS.red, speed: [80, 420], life: [0.4, 1.1], size: [2, 6] });
    this.shake.add(1);
    this.sfx.gameOver();
  }

  finishRun() {
    this.state = 'over';
    this.overT = 0;
    if (this.score > this.best.score) {
      this.best = { score: this.score, wave: this.wave };
      this.newBest = true;
      saveBest(this.best);
    }
  }

  pause() {
    if (this.state === 'playing' && !this.harness) this.state = 'paused';
  }

  // ---------------------------------------------------------------- events (called by entities)

  hasTargets() {
    return this.enemies.some((e) => e.active);
  }

  addEnemy(e) {
    this.newEnemies.push(e);
  }

  spawnShot(x, y, vx, vy) {
    this.shots.push({ x, y, vx, vy, r: 6 });
    this.sfx.shoot();
  }

  onThrow() {
    this.sfx.throw();
    this.player.squash = 0.5;
  }

  onRecall(b) {
    this.sfx.recall();
    this.particles.ring(b.x, b.y, COLORS.red, 12);
  }

  onDash(p) {
    this.sfx.dash();
    this.particles.burst(p.x, p.y, { count: 8, color: COLORS.grey, dirX: -p.dashX, dirY: -p.dashY, spread: 1.2, speed: [60, 180] });
  }

  onBladeBounce(b) {
    this.sfx.bounce();
    this.shake.add(0.06);
    this.ink.dot(b.x, b.y, 2.2, COLORS.red, 0.5);
    this.particles.burst(b.x, b.y, { count: 4, color: COLORS.red, speed: [40, 120], size: [1, 2.5] });
  }

  // Swept collision for the blade this frame. Pierces everything; heavy enemies slow it.
  bladeSweep(b, x1, y1, x2, y2) {
    const [dx, dy] = norm(b.vx, b.vy);
    for (const e of this.enemies) {
      if (!e.active || b.hitSet.has(e)) continue;
      if (!segCircleHit(x1, y1, x2, y2, e.x, e.y, e.r + b.r)) continue;
      b.hitSet.add(e);
      b.flightHits += 1;
      e.hit(dx, dy, this);
      if (e.heavy) b.drag();
      this.sfx.hit(b.flightHits + this.combo);
      this.hitstop = Math.max(this.hitstop, e.dead ? 0.065 : 0.04);
      this.shake.add(e.dead ? 0.26 : 0.13);
      this.particles.burst(e.x, e.y, { count: e.dead ? 16 : 6, dirX: dx, dirY: dy, spread: 1.7 });
      if (e.dead) this.kill(e, dx, dy);
    }
    for (const s of this.shots) {
      if (s.dead || !segCircleHit(x1, y1, x2, y2, s.x, s.y, s.r + b.r)) continue;
      s.dead = true;
      const pts = 5 * this.mult;
      this.score += pts;
      this.floaters.add(s.x, s.y, `${pts}`, { size: 11 });
      this.sfx.clink();
      this.particles.burst(s.x, s.y, { count: 6, color: COLORS.ink, speed: [40, 160] });
    }
  }

  kill(e, dx, dy) {
    this.stats.kills += 1;
    const pts = e.points * this.mult;
    this.score += pts;
    this.floaters.add(e.x, e.y - e.r, `${pts}`, { size: 13 + Math.min(this.mult, 8) });
    this.ink.blot(e.x, e.y, e.r * 1.25, COLORS.ink, dx, dy);
    this.sfx.kill();
  }

  get mult() {
    return Math.min(1 + Math.floor(this.combo / CATCHES_PER_MULT), MULT_CAP);
  }

  // Catching a blade that struck something banks a combo step. Catching an empty blade
  // (when there was something to hit) breaks the chain.
  onCatch(hits, hadTargets) {
    const p = this.player;
    if (hits > 0) {
      const before = this.mult;
      this.combo += 1;
      const m = this.mult;
      this.stats.bestMult = Math.max(this.stats.bestMult, m);
      this.sfx.catch(m);
      this.particles.ring(p.x, p.y, COLORS.red, 18);
      if (m > before) this.floaters.add(p.x, p.y - 22, `×${m}`, { size: 18, color: COLORS.red });
      if (hits >= 3) {
        const bonus = 15 * hits * hits * m;
        this.score += bonus;
        this.floaters.add(p.x, p.y - 42, `pierce ×${hits}  +${bonus}`, { size: 14, color: COLORS.ink, life: 1 });
      }
      this.taught = true;
    } else if (hadTargets && this.combo > 0) {
      this.combo = 0;
      this.floaters.add(p.x, p.y - 22, 'dropped', { size: 13, color: COLORS.grey });
      this.sfx.whiff();
    } else {
      this.sfx.catchSoft();
    }
  }

  hurtPlayer(fromX, fromY) {
    const p = this.player;
    if (!p.hurt(this, fromX, fromY)) return;
    this.combo = 0;
    this.hitstop = 0.12;
    this.shake.add(0.7);
    this.flash = 1;
    this.sfx.hurt();
    this.ink.blot(p.x, p.y, 9, COLORS.red, p.vx, p.vy, 0.8);
    this.particles.burst(p.x, p.y, { count: 18, color: COLORS.red, speed: [80, 300] });
    if (!p.alive) this.die();
  }

  findSpawn(r) {
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

  update(dt) {
    this.clock += dt;
    this.particles.update(dt);
    this.floaters.update(dt);
    this.displayScore += (this.score - this.displayScore) * (1 - Math.exp(-12 * dt));
    if (this.state !== 'playing' && this.state !== 'dying') return;

    if (this.state === 'playing') this.stats.time += dt;
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
        for (const kind of this.groups.shift().kinds) {
          const [x, y] = this.findSpawn(enemyRadius(kind));
          this.enemies.push(createEnemy(kind, x, y, this));
        }
        this.sfx.spawn();
      }
      if (!this.groups.length && !this.enemies.length && this.state === 'playing' && !this.waveLock) this.waveCleared();
    } else if (this.waveState === 'clear') {
      this.waveT -= dt;
      if (this.waveT <= 0 && this.state === 'playing') this.startWave(this.wave + 1);
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
        this.ink.dot(s.x, s.y, 3, COLORS.ink, 0.5);
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
  separate() {
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

  // ---------------------------------------------------------------- frame loop

  frame(now) {
    const realDt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.fps += (1 / Math.max(realDt, 1e-3) - this.fps) * 0.05;
    if (!this.harness) this.tick(realDt); // under the harness, time only moves when a test steps it
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  // One frame of game time: input, menus, simulation (or hitstop), camera.
  tick(realDt) {
    this.input.poll(realDt);
    this.handleMeta();

    if (this.state === 'playing' || this.state === 'dying') {
      if (this.hitstop > 0) this.hitstop -= realDt; // freeze-frame: the sim pauses, the camera doesn't
      else this.update(realDt * this.timeScale);
      if (this.state === 'dying') {
        this.deathT -= realDt;
        if (this.deathT <= 0) this.finishRun();
      }
    } else {
      this.update(realDt);
      if (this.state === 'over') this.overT += realDt;
    }
    this.shake.update(realDt);
    this.flash = Math.max(0, this.flash - realDt * 4);
    this.input.endFrame();
  }

  handleMeta() {
    const inp = this.input;
    if (inp.was('KeyM')) this.sfx.toggleMute();
    if (inp.was('KeyF')) this.toggleFullscreen();

    switch (this.state) {
      case 'title':
        if (inp.startPressed()) {
          this.sfx.unlock();
          this.newRun();
        }
        break;
      case 'playing':
        if (inp.was('Escape', 'KeyP', 'PadStart')) this.state = 'paused';
        break;
      case 'paused':
        if (inp.was('Escape', 'KeyP', 'PadStart', 'Mouse0', 'PadA')) {
          this.sfx.unlock();
          this.input.clearBuffers();
          this.state = 'playing';
        }
        break;
      case 'over':
        if (inp.was('KeyS')) this.savePainting();
        if (this.overT > 0.8 && (inp.startPressed() || inp.was('KeyR'))) this.newRun();
        break;
    }
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else this.canvas.requestFullscreen?.();
    } catch {
      /* not allowed in this frame */
    }
  }

  // Export the floor as a PNG: the run's painting.
  savePainting() {
    const c = document.createElement('canvas');
    c.width = W * 2;
    c.height = H * 2;
    const x = c.getContext('2d');
    x.drawImage(this.bg, 0, 0, c.width, c.height);
    x.drawImage(this.ink.canvas, 0, 0, c.width, c.height);
    x.scale(2, 2);
    ui.text(x, 'RECALL', 40, 27, { size: 15, font: FONT.mono, weight: 'bold', align: 'left', spacing: 4 });
    ui.text(x, `wave ${this.wave}  ·  ${Math.round(this.score).toLocaleString('en-US')}`, W - 40, 27, { size: 14, style: 'italic', align: 'right' });
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recall-wave${this.wave}-${Math.round(this.score)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
    this.floaters.add(W / 2, H - 60, 'painting saved', { size: 13, life: 1.2, rise: 10 });
  }

  // ---------------------------------------------------------------- rendering

  render() {
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

    if (this.state === 'title') this.drawTitleBlade(ctx);
    else this.drawWorld(ctx);
    this.particles.draw(ctx);
    this.floaters.draw(ctx);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = COLORS.red;
      ctx.globalAlpha = this.flash * 0.18;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (this.state === 'title') ui.drawTitle(ctx, this);
    else {
      ui.drawHud(ctx, this);
      ui.drawWaveBanner(ctx, this);
      ui.drawHint(ctx, this);
      if (this.state === 'playing') ui.drawReticle(ctx, this);
      if (this.state === 'paused') ui.drawPause(ctx);
      if (this.state === 'over') ui.drawGameOver(ctx, this);
    }
    this.canvas.style.cursor = this.state === 'playing' ? 'none' : 'default';

    if (DEBUG) {
      ui.text(ctx, `${this.fps.toFixed(0)} fps · ${this.enemies?.length ?? 0} enemies · ${this.particles.list.length} particles · seed ${this.rng?.seed ?? '-'}`, 8, H - 8, {
        size: 11, font: FONT.mono, align: 'left', baseline: 'bottom', color: COLORS.grey,
      });
    }
    ctx.restore();
  }

  drawWorld(ctx) {
    const p = this.player;
    const b = this.blade;
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
    for (const s of this.shots) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const e of this.enemies) e.draw(ctx);
    p.draw(ctx);
    b.draw(ctx);
  }

  // Title screen: the blade circles the text, out and back, forever.
  drawTitleBlade(ctx) {
    const t = this.clock * 0.55;
    const path = (k) => [W / 2 + Math.cos(k) * 410, 282 + Math.sin(k) * 196];
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
    this.titleBlade ??= new Blade({ x: bx, y: by, r: 0, faceX: 1, faceY: 0 });
    Object.assign(this.titleBlade, { x: bx, y: by, angle: this.clock * 14, trail: [] });
    this.titleBlade.draw(ctx);
  }

  paintTitle() {
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
const game = new Game(canvas);
window.__recall = game; // exposed for the smoke test and for poking at in the console
if (HARNESS) game.test = attachHarness(game);
