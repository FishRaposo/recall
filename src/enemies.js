import { ARENA, COLORS } from './config.js';
import { norm, expDecay, TAU } from './util.js';

export const SPAWN_TIME = 0.75; // telegraph before an enemy becomes solid: nothing spawns on top of you unannounced

class Enemy {
  constructor(x, y, o) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = o.r;
    this.hp = this.maxHp = o.hp;
    this.points = o.points;
    this.knock = o.knock;
    this.heavy = !!o.heavy;
    this.spawnT = o.instant ? 0 : SPAWN_TIME;
    this.flash = 0;
    this.dead = false;
    this.t = Math.random() * 10;
  }

  get active() {
    return this.spawnT <= 0 && !this.dead;
  }

  update(dt, g) {
    this.t += dt;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      return;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.think(dt, g);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.confine();
  }

  think() {}

  steer(tx, ty, speed, rate, dt) {
    const [dx, dy] = norm(tx - this.x, ty - this.y);
    this.vx = expDecay(this.vx, dx * speed, rate, dt);
    this.vy = expDecay(this.vy, dy * speed, rate, dt);
  }

  confine() {
    const a = ARENA;
    const r = this.r;
    if (this.x < a.x + r) { this.x = a.x + r; this.vx = Math.abs(this.vx) * 0.4; }
    if (this.x > a.x + a.w - r) { this.x = a.x + a.w - r; this.vx = -Math.abs(this.vx) * 0.4; }
    if (this.y < a.y + r) { this.y = a.y + r; this.vy = Math.abs(this.vy) * 0.4; }
    if (this.y > a.y + a.h - r) { this.y = a.y + a.h - r; this.vy = -Math.abs(this.vy) * 0.4; }
  }

  hit(dx, dy, g) {
    this.hp -= 1;
    this.flash = 0.09;
    this.vx += dx * this.knock;
    this.vy += dy * this.knock;
    if (this.hp <= 0) {
      this.dead = true;
      this.onDeath(g, dx, dy);
    }
  }

  onDeath() {}

  get bodyColor() {
    return this.flash > 0 ? COLORS.paper : COLORS.ink;
  }

  drawSpawn(ctx) {
    const p = 1 - this.spawnT / SPAWN_TIME;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.globalAlpha = 0.2 + 0.45 * p;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, this.r * (2.6 - 1.6 * p), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = p;
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * p * 0.55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    if (this.spawnT > 0) return this.drawSpawn(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    this.drawBody(ctx);
    ctx.restore();
  }

  outline(ctx) {
    if (this.flash > 0) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// Swarmers. Cheap, fast, weave slightly so they don't line up perfectly.
export class Mite extends Enemy {
  constructor(x, y, g, instant) {
    super(x, y, { r: 9, hp: 1, points: 10, knock: 320, instant });
    this.speed = Math.min(118 + g.wave * 4, 182);
  }
  think(dt, g) {
    const p = g.player;
    const wob = Math.sin(this.t * 5) * 0.6;
    const [dx, dy] = norm(p.x - this.x, p.y - this.y);
    this.steer(this.x + (dx - dy * wob) * 100, this.y + (dy + dx * wob) * 100, this.speed, 5, dt);
  }
  drawBody(ctx) {
    ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const w = Math.sin(this.t * 22 + i * 2) * 2.5;
      ctx.beginPath();
      ctx.moveTo(i * 4, -3);
      ctx.lineTo(i * 5 + w, -this.r - 4);
      ctx.moveTo(i * 4, 3);
      ctx.lineTo(i * 5 - w, this.r + 4);
      ctx.stroke();
    }
    ctx.fillStyle = this.bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fill();
    this.outline(ctx);
  }
}

// Slow and heavy. Takes three hits and saps the blade's speed.
export class Brute extends Enemy {
  constructor(x, y, g, instant) {
    super(x, y, { r: 20, hp: g.wave >= 10 ? 4 : 3, points: 40, knock: 140, heavy: true, instant });
    this.speed = Math.min(64 + g.wave * 1.5, 92);
  }
  think(dt, g) {
    this.steer(g.player.x, g.player.y, this.speed, 2.5, dt);
  }
  drawBody(ctx) {
    const squish = 1 + Math.sin(this.t * 6) * 0.04;
    ctx.scale(squish, 2 - squish);
    ctx.fillStyle = this.bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fill();
    this.outline(ctx);
    ctx.fillStyle = this.flash > 0 ? COLORS.ink : COLORS.paper;
    for (let i = 0; i < this.maxHp; i++) {
      const a = -Math.PI / 2 + (i - (this.maxHp - 1) / 2) * 0.55;
      ctx.globalAlpha = i < this.hp ? 1 : 0.25;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * this.r * 0.55, Math.sin(a) * this.r * 0.55 + 4, 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// Telegraphed lunger: seek → wind up (aim locked, line drawn) → dash → rest.
export class Darter extends Enemy {
  constructor(x, y, g, instant) {
    super(x, y, { r: 11, hp: 1, points: 20, knock: 260, instant });
    this.state = 'seek';
    this.stateT = 0.5;
    this.ax = 1;
    this.ay = 0;
  }
  think(dt, g) {
    const p = g.player;
    this.stateT -= dt;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    switch (this.state) {
      case 'seek':
        this.steer(p.x, p.y, 95, 4, dt);
        [this.ax, this.ay] = norm(p.x - this.x, p.y - this.y);
        if (d < 290 && this.stateT <= 0) {
          this.state = 'wind';
          this.stateT = 0.62;
          [this.ax, this.ay] = norm(p.x - this.x, p.y - this.y);
        }
        break;
      case 'wind':
        this.vx = expDecay(this.vx, 0, 10, dt);
        this.vy = expDecay(this.vy, 0, 10, dt);
        if (this.stateT <= 0) {
          this.state = 'dash';
          this.stateT = 0.42;
          this.vx = this.ax * 560;
          this.vy = this.ay * 560;
          g.sfx.dash();
        }
        break;
      case 'dash':
        g.ink.dot(this.x, this.y, 2.5, COLORS.ink, 0.12);
        if (this.stateT <= 0) {
          this.state = 'rest';
          this.stateT = 0.75;
        }
        break;
      case 'rest':
        this.vx = expDecay(this.vx, 0, 6, dt);
        this.vy = expDecay(this.vy, 0, 6, dt);
        if (this.stateT <= 0) {
          this.state = 'seek';
          this.stateT = 0.4;
        }
        break;
    }
  }
  drawBody(ctx) {
    if (this.state === 'wind') {
      const p = 1 - this.stateT / 0.62;
      ctx.save();
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = 0.25 + 0.5 * p;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(this.ax * 16, this.ay * 16);
      ctx.lineTo(this.ax * 235, this.ay * 235);
      ctx.stroke();
      ctx.restore();
      ctx.translate((Math.random() - 0.5) * 3 * p, (Math.random() - 0.5) * 3 * p);
    }
    ctx.rotate(Math.atan2(this.ay, this.ax));
    ctx.fillStyle = this.bodyColor;
    ctx.beginPath();
    ctx.moveTo(this.r + 5, 0);
    ctx.lineTo(-this.r, this.r * 0.85);
    ctx.lineTo(-this.r * 0.45, 0);
    ctx.lineTo(-this.r, -this.r * 0.85);
    ctx.closePath();
    ctx.fill();
    this.outline(ctx);
  }
}

// Two hits; dies into two mites.
export class Splitter extends Enemy {
  constructor(x, y, g, instant) {
    super(x, y, { r: 15, hp: 2, points: 25, knock: 220, instant });
    this.speed = Math.min(86 + g.wave * 2, 130);
  }
  think(dt, g) {
    this.steer(g.player.x, g.player.y, this.speed, 3.5, dt);
  }
  onDeath(g, dx, dy) {
    for (const s of [-1, 1]) {
      const m = new Mite(this.x - dy * s * 10, this.y + dx * s * 10, g, true);
      m.vx = -dy * s * 240 + dx * 80;
      m.vy = dx * s * 240 + dy * 80;
      g.addEnemy(m);
    }
  }
  drawBody(ctx) {
    const gap = this.hp < this.maxHp ? 3 : 1;
    ctx.rotate(this.t * 0.8);
    ctx.fillStyle = this.bodyColor;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * gap, 0, this.r, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
      ctx.closePath();
      ctx.fill();
    }
    this.outline(ctx);
  }
}

// Keeps its distance and lobs slow ink. Telegraphs each shot by glowing.
export class Spitter extends Enemy {
  constructor(x, y, g, instant) {
    super(x, y, { r: 13, hp: 2, points: 30, knock: 200, instant });
    this.cool = 1.4;
    this.wind = 0;
    this.orbit = Math.random() < 0.5 ? -1 : 1;
  }
  think(dt, g) {
    const p = g.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const [nx, ny] = norm(dx, dy);
    let tx = -ny * this.orbit;
    let ty = nx * this.orbit;
    if (d < 220) { tx -= nx * 1.5; ty -= ny * 1.5; }
    else if (d > 310) { tx += nx * 1.5; ty += ny * 1.5; }
    this.steer(this.x + tx * 100, this.y + ty * 100, 85, 3, dt);

    if (this.wind > 0) {
      this.wind -= dt;
      if (this.wind <= 0) {
        g.spawnShot(this.x + nx * (this.r + 6), this.y + ny * (this.r + 6), nx * 175, ny * 175);
        this.cool = 2.4 - Math.min(g.wave * 0.04, 0.8);
      }
    } else {
      this.cool -= dt;
      if (this.cool <= 0) this.wind = 0.45;
    }
  }
  drawBody(ctx) {
    ctx.fillStyle = this.bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fill();
    this.outline(ctx);
    const glow = this.wind > 0 ? 1 - this.wind / 0.45 : 0;
    ctx.fillStyle = glow > 0 ? COLORS.red : COLORS.paper;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * (0.42 + glow * 0.25), 0, TAU);
    ctx.fill();
  }
}

const KINDS = { mite: Mite, brute: Brute, darter: Darter, splitter: Splitter, spitter: Spitter };

export function createEnemy(kind, x, y, g, instant = false) {
  return new KINDS[kind](x, y, g, instant);
}

export function enemyRadius(kind) {
  return { mite: 9, brute: 20, darter: 11, splitter: 15, spitter: 13 }[kind];
}
