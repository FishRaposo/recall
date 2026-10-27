import { BLADE, ARENA, COLORS } from './config.js';
import { norm, expDecay } from './util.js';

// The blade has three states:
//   held   → rides beside the player, pointing at the aim
//   out    → flies along the throw, decelerating and bouncing off walls
//   return → accelerates back, curving toward wherever the player is now
// Pressing throw while it's out recalls it early. Catching it is what builds the multiplier.
export class Blade {
  constructor(player) {
    this.p = player;
    this.state = 'held';
    this.x = player.x;
    this.y = player.y;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.angle = 0;
    this.r = BLADE.r;
    this.flightHits = 0;
    this.hitSet = new Set(); // each enemy can be struck once per leg (out, then again on return)
    this.hadTargets = false;
    this.trail = [];
  }

  get flying() {
    return this.state !== 'held';
  }

  update(dt, g) {
    const p = this.p;

    if (this.state === 'held') {
      const tx = p.x + p.faceX * (p.r + 9);
      const ty = p.y + p.faceY * (p.r + 9);
      this.x = expDecay(this.x, tx, 30, dt);
      this.y = expDecay(this.y, ty, 30, dt);
      this.angle = Math.atan2(p.faceY, p.faceX);
      if (this.trail.length) this.trail.shift();
      if (p.alive && g.input.consume('throw')) this.throw(g);
      return;
    }

    if (this.state === 'out' && g.input.consume('throw')) this.turnHome(g, true);

    const px = this.x;
    const py = this.y;

    if (this.state === 'out') {
      this.speed -= BLADE.decel * dt;
      if (this.speed <= BLADE.minSpeed) {
        this.speed = BLADE.minSpeed;
        this.turnHome(g, false);
      }
      const [dx, dy] = norm(this.vx, this.vy);
      this.vx = dx * this.speed;
      this.vy = dy * this.speed;
    } else {
      this.speed = Math.min(this.speed + BLADE.returnAccel * dt, BLADE.returnMax);
      // Steer by rotating the heading, not by blending vectors: blending a heading with its
      // exact opposite cancels out, so a blade turning home from straight ahead would never turn.
      // The turn rate also tightens as the blade closes in, or a fast blade can orbit the player.
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      const target = Math.atan2(dy, dx);
      const heading = this.vx || this.vy ? Math.atan2(this.vy, this.vx) : target;
      const diff = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
      const k = 1 - Math.exp(-BLADE.steer * (1 + 160 / Math.max(d, 1)) * dt);
      const a = heading + diff * k;
      this.vx = Math.cos(a) * this.speed;
      this.vy = Math.sin(a) * this.speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.state === 'out') this.bounce(g);
    else this.keepInside();
    this.angle += dt * (16 + this.speed * 0.022);

    g.bladeSweep(this, px, py, this.x, this.y);

    this.trail.push(this.x, this.y);
    if (this.trail.length > 24) this.trail.splice(0, 2);

    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (this.state === 'return' && p.alive && d < p.r + this.r + BLADE.catchPad) this.catch(g);
  }

  throw(g) {
    const p = this.p;
    this.state = 'out';
    this.speed = BLADE.throwSpeed;
    this.vx = p.faceX * this.speed;
    this.vy = p.faceY * this.speed;
    this.x = p.x + p.faceX * (p.r + 4);
    this.y = p.y + p.faceY * (p.r + 4);
    this.flightHits = 0;
    this.hitSet.clear();
    this.trail.length = 0;
    this.hadTargets = g.hasTargets();
    g.onThrow(this);
  }

  turnHome(g, early) {
    this.state = 'return';
    this.hitSet.clear();
    if (early) g.onRecall(this);
  }

  // Called when the blade strikes something heavy on the way out.
  drag() {
    if (this.state === 'out') this.speed = Math.max(BLADE.minSpeed + 1, this.speed * BLADE.heavyDrag);
  }

  bounce(g) {
    const a = ARENA;
    let hit = false;
    if (this.x < a.x + this.r) { this.x = a.x + this.r; this.vx = Math.abs(this.vx); hit = true; }
    if (this.x > a.x + a.w - this.r) { this.x = a.x + a.w - this.r; this.vx = -Math.abs(this.vx); hit = true; }
    if (this.y < a.y + this.r) { this.y = a.y + this.r; this.vy = Math.abs(this.vy); hit = true; }
    if (this.y > a.y + a.h - this.r) { this.y = a.y + a.h - this.r; this.vy = -Math.abs(this.vy); hit = true; }
    if (hit) {
      this.speed *= BLADE.bounce;
      g.onBladeBounce(this);
    }
  }

  keepInside() {
    const a = ARENA;
    this.x = Math.min(Math.max(this.x, a.x + this.r), a.x + a.w - this.r);
    this.y = Math.min(Math.max(this.y, a.y + this.r), a.y + a.h - this.r);
  }

  catch(g) {
    const hits = this.flightHits;
    const hadTargets = this.hadTargets;
    this.state = 'held';
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    g.onCatch(hits, hadTargets);
  }

  draw(ctx) {
    const t = this.trail;
    const n = t.length / 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = i / n;
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = a * 6;
      ctx.beginPath();
      ctx.moveTo(t[(i - 1) * 2], t[(i - 1) * 2 + 1]);
      ctx.lineTo(t[i * 2], t[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = COLORS.red;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-10, 0);
    ctx.lineTo(0, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
