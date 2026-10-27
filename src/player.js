import { PLAYER, ARENA, COLORS } from './config.js';
import { norm, expDecay, clamp, TAU } from './util.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = PLAYER.r;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.invuln = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashX = 1;
    this.dashY = 0;
    this.faceX = 1;
    this.faceY = 0;
    this.moveX = 1;
    this.moveY = 0;
    this.squash = 0;
    this.alive = true;
  }

  get dashing() {
    return this.dashT > 0;
  }

  get vulnerable() {
    return this.alive && this.invuln <= 0 && this.dashT <= 0;
  }

  update(dt, g) {
    const inp = g.input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.squash = expDecay(this.squash, 0, 10, dt);

    if (!this.alive) {
      this.vx = expDecay(this.vx, 0, 5, dt);
      this.vy = expDecay(this.vy, 0, 5, dt);
      this.integrate(dt);
      return;
    }

    const [mx, my] = inp.moveVector();
    if (mx || my) [this.moveX, this.moveY] = norm(mx, my);
    [this.faceX, this.faceY] = inp.aimDir(this.x, this.y, this.moveX, this.moveY);

    if (this.dashCd <= 0 && inp.consume('dash')) {
      // Dash goes where you're moving; standing still, it goes where you're aiming.
      [this.dashX, this.dashY] = mx || my ? norm(mx, my) : [this.faceX, this.faceY];
      this.dashT = PLAYER.dashTime;
      this.dashCd = PLAYER.dashCooldown;
      this.squash = 1;
      g.onDash(this);
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashX * PLAYER.dashSpeed;
      this.vy = this.dashY * PLAYER.dashSpeed;
      g.ink.dot(this.x, this.y, this.r * 0.55, COLORS.ink, 0.07); // dashes leave brushstrokes
      if (this.dashT <= 0) {
        this.vx *= 0.35;
        this.vy *= 0.35;
      }
    } else {
      this.vx = expDecay(this.vx, mx * PLAYER.speed, PLAYER.accel, dt);
      this.vy = expDecay(this.vy, my * PLAYER.speed, PLAYER.accel, dt);
    }
    this.integrate(dt);
  }

  integrate(dt) {
    this.x = clamp(this.x + this.vx * dt, ARENA.x + this.r, ARENA.x + ARENA.w - this.r);
    this.y = clamp(this.y + this.vy * dt, ARENA.y + this.r, ARENA.y + ARENA.h - this.r);
  }

  // Returns true if the hit landed.
  hurt(g, fromX, fromY) {
    if (!this.vulnerable) return false;
    this.hp -= 1;
    this.invuln = PLAYER.invuln;
    const [kx, ky] = norm(this.x - fromX, this.y - fromY);
    this.vx = kx * 420;
    this.vy = ky * 420;
    this.squash = 1;
    if (this.hp <= 0) this.alive = false;
    return true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.alive && this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.3;

    if (this.alive && this.dashCd > 0) {
      ctx.strokeStyle = COLORS.grey;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - this.dashCd / PLAYER.dashCooldown));
      ctx.stroke();
    }

    const moveAng = Math.atan2(this.vy, this.vx);
    ctx.rotate(moveAng);
    ctx.scale(1 + this.squash * 0.35, 1 - this.squash * 0.25);
    ctx.rotate(-moveAng);

    ctx.fillStyle = this.alive ? COLORS.ink : COLORS.grey;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fill();

    if (this.alive) {
      ctx.fillStyle = COLORS.paper;
      ctx.beginPath();
      ctx.arc(this.faceX * this.r * 0.42, this.faceY * this.r * 0.42, 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
