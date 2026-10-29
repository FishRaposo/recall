// Pickups are drawn in the world layer: a blue diamond with a faint floor ring.
// They never stamp the ink canvas; only collecting one does.

import { COLORS } from '../core/config.ts';
import { TAU } from '../core/util.ts';
import type { PickupState } from '../core/types.ts';

export function drawPickups(ctx: CanvasRenderingContext2D, pickups: PickupState[]): void {
  for (const p of pickups) {
    const pulse = 1 + Math.sin((p.maxLife - p.life) * 6) * 0.12;
    const fade = p.life < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(p.life * 8)) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = p.def.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12 * pulse, 0, TAU);
    ctx.stroke();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = p.def.color;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.rect(-5 * pulse, -5 * pulse, 10 * pulse, 10 * pulse);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    if (p.def.kind === 'heal') {
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, TAU);
      ctx.fill();
    } else if (p.def.kind === 'pigment') {
      ctx.fillStyle = COLORS.paper;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
