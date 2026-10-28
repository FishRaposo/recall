import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveRoster, spawnGroups, waveBudget } from '../src/core/waves.ts';
import { ENEMIES } from '../src/content/enemies.ts';
import { Rng } from '../src/core/util.ts';
import type { EnemyKind } from '../src/core/types.ts';

const cost = (roster: EnemyKind[]): number => roster.reduce((s, k) => s + ENEMIES[k].cost, 0);

test('rosters never exceed the wave budget', () => {
  for (let n = 1; n <= 40; n++) {
    for (let seed = 1; seed <= 20; seed++) {
      assert.ok(cost(waveRoster(n, new Rng(seed), ENEMIES)) <= waveBudget(n), `wave ${n} seed ${seed}`);
    }
  }
});

test('rosters spend the budget down to less than the cheapest enemy', () => {
  for (let n = 1; n <= 20; n++) {
    const left = waveBudget(n) - cost(waveRoster(n, new Rng(n), ENEMIES));
    assert.ok(left < ENEMIES.mite.cost, `wave ${n} left ${left} unspent`);
  }
});

test('enemies only appear from their unlock wave on', () => {
  for (let n = 1; n <= 12; n++) {
    for (const k of waveRoster(n, new Rng(3), ENEMIES)) assert.ok(n >= ENEMIES[k].unlock, `${k} in wave ${n}`);
  }
});

test('every enemy appears in its debut wave', () => {
  for (const [kind, def] of Object.entries(ENEMIES) as Array<[EnemyKind, (typeof ENEMIES)[EnemyKind]]>) {
    const n = def.unlock;
    for (let seed = 1; seed <= 10; seed++) assert.ok(waveRoster(n, new Rng(seed), ENEMIES).includes(kind), `${kind} missing from wave ${n}`);
  }
});

test('same seed, same wave', () => {
  assert.deepEqual(waveRoster(9, new Rng(42), ENEMIES), waveRoster(9, new Rng(42), ENEMIES));
});

test('heavy waves bring more brutes', () => {
  const brutes = (n: number): number => {
    let c = 0;
    for (let s = 1; s <= 200; s++) c += waveRoster(n, new Rng(s), ENEMIES).filter((k) => k === 'brute').length;
    return c;
  };
  assert.ok(brutes(10) > brutes(11) * 1.5);
});

test('spawn groups cover the roster in order, with non-decreasing times', () => {
  const roster = waveRoster(12, new Rng(5), ENEMIES);
  const groups = spawnGroups(roster, 12, new Rng(6));
  assert.deepEqual(groups.flatMap((g) => g.kinds), roster);
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i].at >= groups[i - 1].at);
  for (const g of groups) assert.ok(g.kinds.length >= 1 && g.kinds.length <= 4);
});
