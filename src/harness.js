import { INPUT_BUFFER } from './config.js';
import { createEnemy } from './enemies.js';

// Deterministic test harness, active only with ?harness in the URL.
//
// Under the harness the game never advances on its own: a test sets up a scenario, scripts the
// input, and steps frames at a fixed dt. That turns acceptance criteria ("throw right, recall
// after 12 frames, the brute should have lost two hit points") into checks that run the real game
// code in a real browser and give the same answer every time.
//
//   const T = window.__recall.test;
//   T.start({ seed: 1 });
//   T.place(300, 290);
//   T.spawn('brute', 520, 290);
//   T.aim(1, 0); T.press('throw');
//   T.stepUntil(() => T.state().blade.state === 'held', 300);
//
export function attachHarness(g) {
  const T = {
    FRAME: 1 / 60,

    // A fresh run with no automatic spawns and no wave clearing, unless waves: true.
    start({ seed = 1, waves = false } = {}) {
      g.newRun(seed);
      g.waveState = 'fight';
      g.groups = [];
      g.waveLock = !waves;
      g.input.script = { move: [0, 0], aim: [1, 0], held: {} };
      return T.state();
    },

    place(x, y) {
      Object.assign(g.player, { x, y, vx: 0, vy: 0 });
      if (g.blade.state === 'held') Object.assign(g.blade, { x, y });
    },

    // Spawns an enemy that is already solid (no fade-in telegraph). Returns the live object.
    spawn(kind, x, y, overrides = {}) {
      const e = createEnemy(kind, x, y, g, true);
      Object.assign(e, overrides);
      g.enemies.push(e);
      return e;
    },

    move(x, y) { g.input.script.move = [x, y]; },
    aim(x, y) { g.input.script.aim = [x, y]; },
    aimAt(x, y) { g.input.script.aim = [x - g.player.x, y - g.player.y]; },
    press(action) { g.input.buffers[action] = INPUT_BUFFER; },
    hold(action, down = true) { g.input.script.held[action] = down; },

    step(frames = 1) {
      for (let i = 0; i < frames; i++) g.tick(T.FRAME);
      return T.state();
    },

    // Steps until pred() is true. Returns the number of frames taken, or -1 if it never happened.
    stepUntil(pred, maxFrames = 600) {
      for (let i = 0; i < maxFrames; i++) {
        if (pred()) return i;
        g.tick(T.FRAME);
      }
      return pred() ? maxFrames : -1;
    },

    state() {
      const p = g.player;
      const b = g.blade;
      return {
        game: g.state,
        wave: g.wave,
        waveState: g.waveState,
        score: g.score,
        combo: g.combo,
        mult: g.mult,
        hitstop: g.hitstop,
        player: { x: p.x, y: p.y, hp: p.hp, invuln: p.invuln, dashing: p.dashing, alive: p.alive, vx: p.vx, vy: p.vy },
        blade: { state: b.state, x: b.x, y: b.y, speed: b.speed, flightHits: b.flightHits },
        enemies: g.enemies.map((e) => ({ kind: e.constructor.name.toLowerCase(), x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, state: e.state ?? null })),
        pendingEnemies: g.newEnemies.length,
        floaters: g.floaters.list.map((f) => f.text),
      };
    },

    game: g,
  };
  return T;
}
