import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.ts';
import { ENEMIES, createEnemy } from '../src/content/enemies.ts';
import { TECHNIQUES } from '../src/content/techniques.ts';
import { PICKUPS } from '../src/content/pickups.ts';
import { computeMods, drawDraft, rerollCost } from '../src/core/run.ts';
import { paintingTitle } from '../src/core/painting.ts';
import { Rng } from '../src/core/util.ts';
import type { SimFx, SimInput, Vec } from '../src/core/types.ts';

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

function fakeFx(): SimFx & { inkEvents: string[] } {
  const inkEvents: string[] = [];
  const fx = {
    inkEvents,
    sfx: {
      throw() {}, recall() {}, bounce() {}, hit() {}, kill() {}, catch() {}, catchSoft() {}, whiff() {},
      dash() {}, hurt() {}, spawn() {}, shoot() {}, clink() {}, wave() {}, clear() {}, heal() {}, gameOver() {},
      pickup() {}, buffEnd() {}, pigment() {}, doubleTap() {}, draft() {}, pick() {},
    },
    ink: {
      clear() {}, blot() {}, dot() {},
      kill() { inkEvents.push('kill'); },
      hurt() { inkEvents.push('hurt'); },
      death() { inkEvents.push('death'); },
      doubleTap() { inkEvents.push('doubleTap'); },
      pickup() { inkEvents.push('pickup'); },
      motion() { inkEvents.push('motion'); },
    },
    particles: { burst() {}, ring() {} },
    floaters: { list: [] as Array<{ text: string }>, add() {} },
    shake: { add() {} },
    flash() {},
    onBladeBounce() {},
    onFinish() {},
    onDeath() {},
    onCheckpoint() {},
  };
  return fx;
}

function setup(mode: 'arcade' | 'roguelike' = 'roguelike') {
  const input = fakeInput();
  const fx = fakeFx();
  const sim = new Sim({ catalog: ENEMIES, spawn: createEnemy, input, fx, techniques: TECHNIQUES, pickups: PICKUPS });
  sim.newRun(1, mode);
  sim.waveState = 'fight';
  sim.groups = [];
  sim.waveLock = true;
  sim.player.x = 300;
  sim.player.y = 290;
  return { sim, input, fx };
}

test('a double tap is the same enemy on both legs inside the window', () => {
  const { sim, input, fx } = setup();
  const brute = createEnemy('brute', 520, 290, sim, true);
  sim.enemies.push(brute);
  input.queue.push('throw');
  for (let i = 0; i < 240 && brute.hp === brute.maxHp; i++) sim.tick(1 / 60);
  assert.ok(brute.hp < brute.maxHp, 'outbound hit landed');
  input.queue.push('throw');
  for (let i = 0; i < 240 && sim.stats.doubleTaps === 0; i++) sim.tick(1 / 60);
  assert.equal(sim.stats.doubleTaps, 1);
  assert.ok(fx.inkEvents.includes('doubleTap'));
});

test('a return hit outside the double-tap window does not count', () => {
  const { sim, input } = setup();
  sim.doubleTapWindow = 0.005;
  const brute = createEnemy('brute', 520, 290, sim, true);
  sim.enemies.push(brute);
  input.queue.push('throw');
  for (let i = 0; i < 240 && brute.hp === brute.maxHp; i++) sim.tick(1 / 60);
  input.queue.push('throw');
  for (let i = 0; i < 240 && sim.blade.state !== 'held'; i++) sim.tick(1 / 60);
  assert.equal(sim.stats.doubleTaps ?? 0, 0);
});

test('pickups are roguelike-only, collect blue ink and grant pigment', () => {
  const arcade = setup('arcade');
  arcade.sim.spawnPickup('pigment', 310, 290);
  assert.equal(arcade.sim.pickups.length, 0, 'arcade never spawns pickups');

  const { sim, fx } = setup('roguelike');
  assert.ok(sim.spawnPickup('pigment', sim.player.x + 4, sim.player.y));
  sim.tick(1 / 60);
  assert.equal(sim.pigment, 3);
  assert.equal(sim.pickups.length, 0);
  assert.ok(fx.inkEvents.includes('pickup'));
});

test('a buff applies its modifiers and expires', () => {
  const { sim } = setup('roguelike');
  sim.spawnPickup('quickening', sim.player.x + 4, sim.player.y);
  sim.tick(1 / 60);
  assert.ok((sim.mods.throwSpeedPct ?? 0) >= 0.19);
  assert.equal(sim.buffList.length, 1);
  for (let i = 0; i < 660; i++) sim.tick(1 / 60);
  assert.equal(sim.buffList.length, 0);
  assert.equal(sim.mods.throwSpeedPct ?? 0, 0);
});

test('clearing a roguelike wave opens a draft and a pick starts the next wave', () => {
  const { sim } = setup();
  sim.waveLock = false;
  sim.tick(1 / 60);
  assert.equal(sim.mode, 'draft');
  assert.equal(sim.draft?.cards.length, 3);
  const id = sim.draft?.cards[0]?.id;
  assert.ok(id);
  assert.ok(sim.chooseTechnique(id));
  assert.equal(sim.mode, 'playing');
  assert.equal(sim.wave, 2);
  assert.equal(sim.techniques.get(id), 1);
});

test('draft rerolls spend pigment and skip refunds a little', () => {
  const { sim } = setup();
  sim.waveLock = false;
  sim.tick(1 / 60);
  sim.pigment = 10;
  assert.ok(sim.rerollDraft());
  assert.equal(sim.pigment, 7);
  assert.equal(sim.draft?.rerolls, 1);
  assert.ok(sim.skipDraft());
  assert.equal(sim.pigment, 9);
  assert.equal(sim.draft, null);
  assert.equal(sim.wave, 2);
});

test('a new run resets every roguelike choice', () => {
  const { sim } = setup();
  sim.techniques.set('quick-draw', 2);
  sim.recomputeMods();
  sim.pigment = 12;
  sim.spawnPickup('quickening', sim.player.x, sim.player.y);
  sim.tick(1 / 60);
  assert.ok(sim.buffList.length > 0);

  sim.newRun(2, 'roguelike');
  assert.equal(sim.runMode, 'roguelike');
  assert.equal(sim.pigment, 0);
  assert.equal(sim.techniques.size, 0);
  assert.equal(sim.buffList.length, 0);
  assert.equal(sim.pickups.length, 0);
  assert.equal(sim.stats.doubleTaps, 0);
  assert.equal(sim.paintingTitle, '');

  sim.newRun(3, 'arcade');
  assert.equal(sim.runMode, 'arcade');
  assert.equal(sim.techniques.size, 0);
});

test('arcade runs never spawn pickups', () => {
  const { sim } = setup('arcade');
  for (let i = 0; i < 1200; i++) sim.tick(1 / 60);
  assert.equal(sim.pickups.length, 0);
  assert.equal(sim.draft, null);
});

test('modifiers stack per technique copy and cap', () => {
  const mods = computeMods(new Map([['quick-draw', 2]]), TECHNIQUES, []);
  assert.ok(Math.abs((mods.throwSpeedPct ?? 0) - 0.2) < 1e-9);
  const buffed = computeMods(new Map([['quick-draw', 2]]), TECHNIQUES, [
    { id: 'q', name: 'Q', duration: 10, mods: { throwSpeedPct: 0.2 } },
  ]);
  assert.ok(Math.abs((buffed.throwSpeedPct ?? 0) - 0.4) < 1e-9);
  const capped = computeMods(new Map([['quick-draw', 3]]), TECHNIQUES, [
    { id: 'q', name: 'Q', duration: 10, mods: { throwSpeedPct: 0.6 } },
  ]);
  assert.equal(capped.throwSpeedPct, 0.6);
});

test('the draft is unique, wave-gated and deterministic', () => {
  const a = drawDraft(TECHNIQUES, 1, new Map(), new Rng(7), 3);
  const b = drawDraft(TECHNIQUES, 1, new Map(), new Rng(7), 3);
  assert.deepEqual(a.cards.map((c) => c.id), b.cards.map((c) => c.id));
  assert.equal(new Set(a.cards.map((c) => c.id)).size, 3);
  assert.ok(a.cards.every((c) => c.minWave <= 1));
  assert.equal(rerollCost({ cards: [], rerolls: 0 }), 3);
  assert.equal(rerollCost({ cards: [], rerolls: 2 }), 5);
});

test('painting titles are deterministic and avoid an immediate repeat', () => {
  const first = paintingTitle(42, 5, 20);
  assert.equal(first, paintingTitle(42, 5, 20));
  assert.ok(first.length > 0 && first.length <= 40);
  assert.notEqual(paintingTitle(42, 5, 20, first), first);
});
