import { W, H, INPUT_BUFFER } from '../core/config.ts';
import { norm, clamp } from '../core/util.ts';
import type { SimInput, Vec } from '../core/types.ts';

const THROW_KEYS = new Set(['Space', 'KeyJ', 'KeyZ']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX']);
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const BLOCK_DEFAULT = new Set([...THROW_KEYS, ...ARROWS, 'Tab']);

const deadzone = (v: number): number => (Math.abs(v) < 0.22 ? 0 : v);

export interface InputScript {
  move: Vec;
  aim: Vec;
  held: Record<'throw' | 'dash', boolean>;
}

// Keyboard, mouse, touch and gamepad folded into one interface.
// Actions (throw, dash) are buffered for a short window so a press made during hitstop
// or between frames is never dropped.
export class Input implements SimInput {
  canvas: HTMLCanvasElement;
  view: { scale: number; ox: number; oy: number };
  down = new Set<string>();
  pressed = new Set<string>();
  buffers = { throw: 0, dash: 0 };
  mouse = { x: W / 2, y: H / 2, inside: false };
  aimSource: 'mouse' | 'keys' | 'pad' | 'touch' = 'mouse';
  pad: { lx: number; ly: number; rx: number; ry: number } | null = null;
  padPrev: boolean[] = [];
  mouseDown = [false, false, false];
  script: InputScript | null = null;
  virtualHeld = { throw: false, dash: false };

  private pointerId: number | null = null;
  private touchStart: Vec = [0, 0];
  private touchMove: Vec = [0, 0];
  private touchMoved = false;
  private touchPoint: Vec | null = null;
  private tapped = false;

  constructor(canvas: HTMLCanvasElement, view: { scale: number; ox: number; oy: number }) {
    this.canvas = canvas;
    this.view = view;

    addEventListener('keydown', (e) => {
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      this.down.add(e.code);
      if (e.repeat) return;
      this.pressed.add(e.code);
      if (THROW_KEYS.has(e.code)) this.buffers.throw = INPUT_BUFFER;
      if (DASH_KEYS.has(e.code)) this.buffers.dash = INPUT_BUFFER;
      if (ARROWS.has(e.code)) this.aimSource = 'keys';
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousemove', (e) => {
      [this.mouse.x, this.mouse.y] = this.toWorld(e.clientX, e.clientY);
      this.mouse.inside = true;
      this.aimSource = 'mouse';
    });
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => {
      canvas.focus();
      [this.mouse.x, this.mouse.y] = this.toWorld(e.clientX, e.clientY);
      this.mouseDown[e.button] = true;
      if (e.button === 0) {
        this.pressed.add('Mouse0');
        this.buffers.throw = INPUT_BUFFER;
      } else if (e.button === 2) {
        this.pressed.add('Mouse2');
        this.buffers.dash = INPUT_BUFFER;
      }
    });
    addEventListener('mouseup', (e) => (this.mouseDown[e.button] = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  toWorld(clientX: number, clientY: number): Vec {
    const r = this.canvas.getBoundingClientRect();
    return [(clientX - r.left - this.view.ox) / this.view.scale, (clientY - r.top - this.view.oy) / this.view.scale];
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic pointer in tests */
    }
    this.pointerId = e.pointerId;
    this.touchStart = this.toWorld(e.clientX, e.clientY);
    this.touchMove = [0, 0];
    this.touchMoved = false;
    this.aimSource = 'touch';
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== 'touch' || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const [x, y] = this.toWorld(e.clientX, e.clientY);
    const dx = x - this.touchStart[0];
    const dy = y - this.touchStart[1];
    const d = Math.hypot(dx, dy);
    if (d > 9) this.touchMoved = true;
    this.touchMove = d > 1 ? [dx / Math.max(d, 1), dy / Math.max(d, 1)] : [0, 0];
    this.mouse = { x, y, inside: true };
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerType !== 'touch' || e.pointerId !== this.pointerId) return;
    const [x, y] = this.toWorld(e.clientX, e.clientY);
    if (!this.touchMoved) {
      // A tap is a throw/recall aimed at the tap; a tap on the title also starts the run.
      this.touchPoint = [x, y];
      this.tapped = true;
      this.buffers.throw = INPUT_BUFFER;
    }
    this.pointerId = null;
    this.touchMove = [0, 0];
    try {
      if (this.canvas.hasPointerCapture?.(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer in tests */
    }
  }

  // On-screen buttons call these.
  press(action: 'throw' | 'dash'): void {
    this.buffers[action] = INPUT_BUFFER;
  }

  setHeld(action: 'throw' | 'dash', held: boolean): void {
    this.virtualHeld[action] = held;
  }

  poll(dt: number): void {
    this.buffers.throw = Math.max(0, this.buffers.throw - dt);
    this.buffers.dash = Math.max(0, this.buffers.dash - dt);

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) {
      this.pad = null;
      return;
    }
    const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    const edge = (i: number): boolean => !!b[i] && !this.padPrev[i];
    // Standard mapping: 0 A, 1 B, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start.
    if (edge(0) || edge(5) || edge(7)) this.buffers.throw = INPUT_BUFFER;
    if (edge(1) || edge(4) || edge(6)) this.buffers.dash = INPUT_BUFFER;
    if (edge(0)) this.pressed.add('PadA');
    if (edge(9)) this.pressed.add('PadStart');
    this.padPrev = b;

    const ax = gp.axes;
    this.pad = { lx: deadzone(ax[0] || 0), ly: deadzone(ax[1] || 0), rx: deadzone(ax[2] || 0), ry: deadzone(ax[3] || 0) };
    if (this.pad.lx || this.pad.ly || this.pad.rx || this.pad.ry || b.some(Boolean)) this.aimSource = 'pad';
  }

  moveVector(): Vec {
    if (this.script) return this.script.move;
    if (this.pointerId !== null && (this.touchMove[0] || this.touchMove[1])) return this.touchMove;
    const d = this.down;
    let x = 0;
    let y = 0;
    if (d.has('KeyA') || d.has('ArrowLeft')) x -= 1;
    if (d.has('KeyD') || d.has('ArrowRight')) x += 1;
    if (d.has('KeyW') || d.has('ArrowUp')) y -= 1;
    if (d.has('KeyS') || d.has('ArrowDown')) y += 1;
    if (this.pad) {
      x += this.pad.lx;
      y += this.pad.ly;
    }
    const l = Math.hypot(x, y);
    return l > 1 ? [x / l, y / l] : [x, y];
  }

  // Unit aim vector from (px,py). Falls back to the given direction (last movement).
  aimDir(px: number, py: number, fx: number, fy: number): Vec {
    if (this.script) {
      const v = norm(this.script.aim[0], this.script.aim[1]);
      return v[0] || v[1] ? v : [fx, fy];
    }
    if (this.aimSource === 'pad' && this.pad && (this.pad.rx || this.pad.ry)) return norm(this.pad.rx, this.pad.ry);
    if (this.aimSource === 'touch' && this.touchPoint) {
      const v = norm(this.touchPoint[0] - px, this.touchPoint[1] - py);
      if (v[0] || v[1]) return v;
    }
    if (this.aimSource === 'mouse') {
      const v = norm(this.mouse.x - px, this.mouse.y - py);
      if (v[0] || v[1]) return v;
    }
    return [fx, fy];
  }

  // Is the action's button physically down right now (as opposed to pressed this frame)?
  held(action: 'throw' | 'dash'): boolean {
    if (this.script) return !!this.script.held[action];
    if (this.virtualHeld[action]) return true;
    const keys = action === 'throw' ? THROW_KEYS : DASH_KEYS;
    for (const k of keys) if (this.down.has(k)) return true;
    if (this.mouseDown[action === 'throw' ? 0 : 2]) return true;
    const b = this.padPrev;
    return action === 'throw' ? !!(b[0] || b[5] || b[7]) : !!(b[1] || b[4] || b[6]);
  }

  consume(action: 'throw' | 'dash'): boolean {
    if (this.buffers[action] > 0) {
      this.buffers[action] = 0;
      return true;
    }
    return false;
  }

  clearBuffers(): void {
    this.buffers.throw = 0;
    this.buffers.dash = 0;
    this.virtualHeld.throw = false;
    this.virtualHeld.dash = false;
  }

  was(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  startPressed(): boolean {
    return this.was('Space', 'Enter', 'Mouse0', 'PadA', 'PadStart', 'KeyJ', 'KeyZ') || this.tapped;
  }

  endFrame(): void {
    this.pressed.clear();
    this.tapped = false;
  }
}

export { clamp };
