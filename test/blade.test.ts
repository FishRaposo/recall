import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blade } from '../src/core/blade.ts';
import { ARENA } from '../src/core/config.ts';
import type { BladeWorld, PlayerLike, SimInput } from '../src/core/types.ts';

// A minimal stand-in for the game: the blade only needs these hooks.
function harness(): BladeWorld & { caught: number; throwQueued: boolean } {
  const g: BladeWorld & { caught: number; throwQueued: boolean } = {
    caught: 0,
    throwQueued: false,
    input: {
      moveVector: () => [0, 0] as [number, number],
      aimDir: () => [1, 0] as [number, number],
      consume: (a: 'throw' | 'dash') => (a === 'throw' && g.throwQueued ? ((g.throwQueued = false), true) : false),
    } satisfies SimInput,
    hasTargets: () => false,
    onThrow() {},
    onRecall() {},
    onBladeBounce() {},
    bladeSweep() {},
    onCatch() { g.caught += 1; },
  };
  return g;
}

function makePlayer(x: number, y: number, angle: number): PlayerLike {
  return { x, y, r: 11, alive: true, faceX: Math.cos(angle), faceY: Math.sin(angle) } as PlayerLike;
}

// Regression: the returning blade used to blend its heading with the direction home.
// Thrown and recalled in a straight line, the two vectors were exact opposites and cancelled,
// so the blade flew away forever. Every throw must come home.
for (const fps of [30, 60, 144]) {
  test(`blade returns to a stationary player from every direction at ${fps} fps`, () => {
    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;
    for (let i = 0; i < 24; i++) {
      const p = makePlayer(cx, cy, (i / 24) * Math.PI * 2);
      const g = harness();
      const b = new Blade(p);
      b.throw(g);
      let t = 0;
      while (!g.caught && t < 4) {
        b.update(1 / fps, g);
        t += 1 / fps;
      }
      assert.equal(g.caught, 1, `throw ${i} never came back`);
      assert.ok(t < 2.5, `throw ${i} took ${t.toFixed(2)}s`);
    }
  });
}

test('early recall turns the blade home immediately and it still arrives', () => {
  const p = makePlayer(ARENA.x + 200, ARENA.y + 200, 0);
  const g = harness();
  const b = new Blade(p);
  b.throw(g);
  for (let i = 0; i < 5; i++) b.update(1 / 60, g);
  g.throwQueued = true;
  b.update(1 / 60, g);
  assert.equal(b.state, 'return');
  let t = 0;
  while (!g.caught && t < 3) {
    b.update(1 / 60, g);
    t += 1 / 60;
  }
  assert.equal(g.caught, 1);
});

test('blade returns to a player who keeps moving', () => {
  const p = makePlayer(ARENA.x + 300, ARENA.y + 230, 0.3);
  const g = harness();
  const b = new Blade(p);
  b.throw(g);
  let t = 0;
  while (!g.caught && t < 5) {
    p.x = ARENA.x + 300 + Math.cos(t * 2) * 120; // running in a circle at ~240 px/s
    p.y = ARENA.y + 230 + Math.sin(t * 2) * 120;
    b.update(1 / 60, g);
    t += 1 / 60;
  }
  assert.equal(g.caught, 1);
});

test('blade never leaves the arena', () => {
  const p = makePlayer(ARENA.x + 20, ARENA.y + 20, Math.PI * 0.25);
  const g = harness();
  const b = new Blade(p);
  b.throw(g);
  for (let i = 0; i < 300 && !g.caught; i++) {
    b.update(1 / 60, g);
    assert.ok(b.x >= ARENA.x && b.x <= ARENA.x + ARENA.w && b.y >= ARENA.y && b.y <= ARENA.y + ARENA.h);
  }
});
