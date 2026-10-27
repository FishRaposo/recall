import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segCircleHit, circleHit, norm, expDecay, Rng } from '../src/util.js';

test('swept hit catches a fast pass straight through a small circle', () => {
  // Endpoints are both far outside the circle; only the segment crosses it.
  assert.ok(segCircleHit(0, 0, 100, 0, 50, 3, 5));
  assert.ok(!circleHit(0, 0, 0, 50, 3, 5) && !circleHit(100, 0, 0, 50, 3, 5));
});

test('swept hit misses a segment that ends before the circle', () => {
  assert.ok(!segCircleHit(0, 0, 30, 0, 50, 0, 5));
});

test('norm of zero is zero, not NaN', () => {
  assert.deepEqual(norm(0, 0), [0, 0]);
});

test('expDecay is frame-rate independent', () => {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 60; i++) a = expDecay(a, 100, 5, 1 / 60);
  for (let i = 0; i < 240; i++) b = expDecay(b, 100, 5, 1 / 240);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('rng is deterministic and in range', () => {
  const a = new Rng(7);
  const b = new Rng(7);
  for (let i = 0; i < 1000; i++) {
    const x = a.float();
    assert.equal(x, b.float());
    assert.ok(x >= 0 && x < 1);
    const n = a.int(2, 4);
    b.int(2, 4);
    assert.ok(n >= 2 && n <= 4 && Number.isInteger(n));
  }
});
