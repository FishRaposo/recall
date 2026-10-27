import { W, H, INPUT_BUFFER } from './config.js';
import { norm } from './util.js';

const THROW_KEYS = new Set(['Space', 'KeyJ', 'KeyZ']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX']);
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const BLOCK_DEFAULT = new Set([...THROW_KEYS, ...ARROWS, 'Tab']);

const deadzone = (v) => (Math.abs(v) < 0.22 ? 0 : v);

// Keyboard, mouse and gamepad folded into one interface.
// Actions (throw, dash) are buffered for a short window so a press made during hitstop
// or between frames is never dropped.
export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    this.down = new Set();
    this.pressed = new Set(); // edge-triggered, cleared every frame (menus use these)
    this.buffers = { throw: 0, dash: 0 };
    this.mouse = { x: W / 2, y: H / 2, inside: false };
    // Where aim comes from: 'mouse', 'keys' (arrows + Z/X play, aim follows movement) or 'pad'.
    this.aimSource = 'mouse';
    this.pad = null;
    this.padPrev = [];
    this.mouseDown = [false, false, false];
    // Test harness override: { move: [x, y], aim: [x, y], held: { throw, dash } }. Null in normal play.
    this.script = null;

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
  }

  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return [(clientX - r.left - this.view.ox) / this.view.scale, (clientY - r.top - this.view.oy) / this.view.scale];
  }

  poll(dt) {
    this.buffers.throw = Math.max(0, this.buffers.throw - dt);
    this.buffers.dash = Math.max(0, this.buffers.dash - dt);

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) {
      this.pad = null;
      return;
    }
    const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    const edge = (i) => b[i] && !this.padPrev[i];
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

  moveVector() {
    if (this.script) return this.script.move;
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
  aimDir(px, py, fx, fy) {
    if (this.script) {
      const v = norm(this.script.aim[0], this.script.aim[1]);
      return v[0] || v[1] ? v : [fx, fy];
    }
    if (this.aimSource === 'pad' && this.pad && (this.pad.rx || this.pad.ry)) return norm(this.pad.rx, this.pad.ry);
    if (this.aimSource === 'mouse') {
      const v = norm(this.mouse.x - px, this.mouse.y - py);
      if (v[0] || v[1]) return v;
    }
    return [fx, fy];
  }

  // Is the action's button physically down right now (as opposed to pressed this frame)?
  held(action) {
    if (this.script) return !!this.script.held?.[action];
    const keys = action === 'throw' ? THROW_KEYS : DASH_KEYS;
    for (const k of keys) if (this.down.has(k)) return true;
    if (this.mouseDown[action === 'throw' ? 0 : 2]) return true;
    const b = this.padPrev;
    return action === 'throw' ? !!(b[0] || b[5] || b[7]) : !!(b[1] || b[4] || b[6]);
  }

  consume(action) {
    if (this.buffers[action] > 0) {
      this.buffers[action] = 0;
      return true;
    }
    return false;
  }

  clearBuffers() {
    this.buffers.throw = 0;
    this.buffers.dash = 0;
  }

  was(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  startPressed() {
    return this.was('Space', 'Enter', 'Mouse0', 'PadA', 'PadStart', 'KeyJ', 'KeyZ');
  }

  endFrame() {
    this.pressed.clear();
  }
}
