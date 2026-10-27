import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveRoster, spawnGroups, waveBudget, ENEMY_COST, UNLOCK_WAVE, isHeavyWave } from '../src/waves.js';
import { Rng } from '../src/util.js';

const cost = (roster) => roster.reduce((s, k) => s + ENEMY_COST[k], 0);

test('rosters never exceed the wave budget', () => {
  for (let n = 1; n <= 40; n++) {
    for (let seed = 1; seed <= 20; seed++) {
      assert.ok(cost(waveRoster(n, new Rng(seed))) <= waveBudget(n), `wave ${n} seed ${seed}`);
    }
  }
});

test('rosters spend the budget down to less than the cheapest enemy', () => {
  for (let n = 1; n <= 20; n++) {
    const left = waveBudget(n) - cost(waveRoster(n, new Rng(n)));
    assert.ok(left < ENEMY_COST.mite, `wave ${n} left ${left} unspent`);
  }
});

test('enemies only appear from their unlock wave on', () => {
  for (let n = 1; n <= 12; n++) {
    for (const k of waveRoster(n, new Rng(3))) assert.ok(n >= UNLOCK_WAVE[k], `${k} in wave ${n}`);
  }
});

test('every enemy appears in its debut wave', () => {
  for (const [kind, n] of Object.entries(UNLOCK_WAVE)) {
    for (let seed = 1; seed <= 10; seed++) assert.ok(waveRoster(n, new Rng(seed)).includes(kind), `${kind} missing from wave ${n}`);
  }
});

test('same seed, same wave', () => {
  assert.deepEqual(waveRoster(9, new Rng(42)), waveRoster(9, new Rng(42)));
});

test('heavy waves bring more brutes', () => {
  const brutes = (n) => {
    let c = 0;
    for (let s = 1; s <= 200; s++) c += waveRoster(n, new Rng(s)).filter((k) => k === 'brute').length;
    return c;
  };
  assert.ok(isHeavyWave(10) && !isHeavyWave(11));
  assert.ok(brutes(10) > brutes(11) * 1.5);
});

test('spawn groups cover the roster in order, with non-decreasing times', () => {
  const roster = waveRoster(12, new Rng(5));
  const groups = spawnGroups(roster, 12, new Rng(6));
  assert.deepEqual(groups.flatMap((g) => g.kinds), roster);
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i].at >= groups[i - 1].at);
  for (const g of groups) assert.ok(g.kinds.length >= 1 && g.kinds.length <= 4);
});
