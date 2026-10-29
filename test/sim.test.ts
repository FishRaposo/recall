import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.ts';
import { ENEMIES, createEnemy, Darter, Shell } from '../src/content/enemies.ts';
import { ARENA } from '../src/core/config.ts';
import type { EnemyLike, SimCheckpoint, SimFx, SimInput, Vec } from '../src/core/types.ts';

function fakeInput(): SimInput & { queue: Array<'throw' | 'dash'>; aim: Vec } {
  const input = {
    queue: [] as Array<'throw' | 'dash'>,
    aim: [1, 0] as Vec,
    moveVector: (): Vec => [0, 0],
    aimDir: (): Vec => input.aim,
    consume(action: 'throw' | 'dash'): boolean {
      const at = input.queue.indexOf(action);
      if (at < 0) return false;
      input.queue.splice(at, 1);
      return true;
    },
    held: () => false,
  };
  return input;
}

function fakeFx(): SimFx & { finished: boolean; checkpoint: SimCheckpoint | null } {
  const fx = {
    finished: false,
    checkpoint: null as SimCheckpoint | null,
    sfx: {
      throw() {}, recall() {}, bounce() {}, hit() {}, kill() {}, catch() {}, catchSoft() {}, whiff() {},
      dash() {}, hurt() {}, spawn() {}, shoot() {}, clink() {}, wave() {}, clear() {}, heal() {}, gameOver() {},
      pickup() {}, buffEnd() {}, pigment() {}, doubleTap() {}, draft() {}, pick() {},
    },
    ink: {
      clear() {}, blot() {}, dot() {}, kill() {}, hurt() {}, death() {}, doubleTap() {}, pickup() {}, motion() {},
    },
    particles: { burst() {}, ring() {} },
    floaters: { list: [] as Array<{ text: string }>, add() {} },
    shake: { add() {} },
    flash() {},
    onBladeBounce() {},
    onFinish() { fx.finished = true; },
    onDeath() {},
    onCheckpoint(save: SimCheckpoint) { fx.checkpoint = save; },
  };
  return fx;
}

function setup(): { sim: Sim; input: ReturnType<typeof fakeInput>; fx: ReturnType<typeof fakeFx> } {
  const input = fakeInput();
  const fx = fakeFx();
  const sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input, fx });
  sim.newRun(1);
  sim.waveState = 'fight';
  sim.groups = [];
  sim.waveLock = true;
  sim.player.x = 300;
  sim.player.y = 290;
  return { sim, input, fx };
}

test('the core loop runs in Node without a browser', () => {
  const sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input: fakeInput(), fx: fakeFx() });
  sim.newRun(7);
  for (let i = 0; i < 600; i++) sim.tick(1 / 60);
  assert.ok(sim.stats.time > 0);
  assert.ok(sim.wave >= 1);
  assert.ok(Number.isFinite(sim.score));
});

test('a thrown blade hits a brute and catching it raises the multiplier', () => {
  const { sim, input } = setup();
  const brute = createEnemy('brute', 520, 290, sim, true);
  sim.enemies.push(brute);
  input.queue.push('throw');
  for (let i = 0; i < 400; i++) {
    sim.tick(1 / 60);
    if (sim.blade.state === 'held' && sim.blade.flightHits > 0) break;
  }
  assert.ok(brute.maxHp - brute.hp >= 1, 'the blade hit the brute');
  assert.ok(sim.combo > 0, 'the catch banked a combo step');
  assert.ok(sim.mult >= 1);
});

test('a splitter death keeps the wave open until its mites are gone', () => {
  const { sim } = setup();
  sim.waveLock = false;
  const splitter = createEnemy('splitter', 470, 290, sim, true);
  sim.enemies.push(splitter);
  splitter.hit(1, 0, sim);
  splitter.hit(1, 0, sim);
  assert.equal(sim.newEnemies.length, 2);
  sim.update(1 / 60);
  assert.equal(sim.waveState, 'fight');
  assert.equal(sim.enemies.length, 2);
  assert.equal(sim.wave, 1);
});

test('a darter locks its aim when the wind-up starts', () => {
  const { sim } = setup();
  const darter = createEnemy('darter', 560, 290, sim, true) as Darter;
  sim.enemies.push(darter);
  while (darter.state !== 'wind') sim.tick(1 / 60);
  const lock = Math.atan2(darter.ay, darter.ax);
  (sim.player as { y: number }).y += 40;
  for (let i = 0; i < 60 && darter.state === 'wind'; i++) sim.tick(1 / 60);
  assert.ok(Math.abs(Math.atan2(darter.ay, darter.ax) - lock) < 0.01);
});

test('the same simulation seed produces the same run', () => {
  const run = (seed: number): number[] => {
    const sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input: fakeInput(), fx: fakeFx() });
    sim.newRun(seed);
    const out: number[] = [];
    for (let i = 0; i < 120; i++) {
      sim.tick(1 / 60);
      out.push(sim.wave, sim.enemies.length, sim.score);
    }
    return out;
  };
  assert.deepEqual(run(12), run(12));
});

test('a shell deflects the outbound blade from the front', () => {
  const { sim, input } = setup();
  sim.player.x = 700;
  const shell = createEnemy('shell', 500, 290, sim, true) as Shell;
  shell.faceLock = true;
  shell.faceX = 1;
  shell.faceY = 0;
  sim.enemies.push(shell);
  input.aim = [-1, 0];
  input.queue.push('throw');
  let deflected = false;
  for (let i = 0; i < 40; i++) {
    sim.tick(1 / 60);
    if (sim.blade.state === 'out' && sim.blade.speed < 800) {
      deflected = true;
      break;
    }
    if (sim.blade.state === 'held') break;
  }
  assert.ok(deflected, 'the plate slowed the outbound blade');
  assert.equal(shell.hp, shell.maxHp, 'front plate took no damage');
});

test('a shell takes damage from the return leg after a front deflect', () => {
  const { sim, input } = setup();
  const shell = createEnemy('shell', 500, 290, sim, true) as Shell;
  shell.faceLock = true;
  shell.faceX = -1;
  shell.faceY = 0;
  sim.enemies.push(shell);
  input.aim = [1, 0];
  input.queue.push('throw');
  for (let i = 0; i < 30; i++) sim.tick(1 / 60);
  input.queue.push('throw');
  for (let i = 0; i < 300; i++) {
    sim.tick(1 / 60);
    if (sim.blade.state === 'held') break;
  }
  assert.ok(shell.hp < shell.maxHp, 'return leg got through the plate');
});

test('a shell takes damage from behind', () => {
  const { sim, input } = setup();
  const shell = createEnemy('shell', 500, 290, sim, true) as Shell;
  shell.faceLock = true;
  shell.faceX = 1;
  shell.faceY = 0;
  sim.enemies.push(shell);
  input.aim = [1, 0];
  input.queue.push('throw');
  for (let i = 0; i < 300; i++) {
    sim.tick(1 / 60);
    if (shell.hp < shell.maxHp || sim.blade.state === 'held') break;
  }
  assert.ok(shell.hp < shell.maxHp, 'back hit damaged the shell');
});

test('a wave checkpoint resumes the same wave and RNG state', () => {
  const fx = fakeFx();
  const sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input: fakeInput(), fx });
  sim.newRun(42);
  assert.ok(fx.checkpoint);
  const cp = fx.checkpoint;
  const resumedFx = fakeFx();
  const resumed = new Sim({ catalog: ENEMIES, spawn: createEnemy, input: fakeInput(), fx: resumedFx });
  resumed.resume(cp);
  assert.equal(resumed.seed, cp.seed);
  assert.equal(resumed.wave, cp.wave);
  assert.equal(resumed.score, cp.score);
  assert.equal(resumed.player.hp, cp.hp);
  assert.equal(resumed.rng.state, sim.rng.state);
  assert.deepEqual(resumed.groups, sim.groups);
});
