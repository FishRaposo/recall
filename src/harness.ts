// Deterministic test harness, active only with ?harness in the URL.
//
// Under the harness the game never advances on its own: a test sets up a scenario, scripts the
// input, and steps frames at a fixed dt. The same surface works against the headless Sim in Node.
//
//   const T = window.__recall.test;
//   T.start({ seed: 1 });
//   T.place(300, 290);
//   T.spawn('brute', 520, 290);
//   T.aim(1, 0); T.press('throw');
//   T.stepUntil(() => T.state().blade.state === 'held', 300);

import { createEnemy } from './content/enemies.ts';
import { INPUT_BUFFER } from './core/config.ts';
import type { EnemyKind, EnemyLike } from './core/types.ts';
import type { Game } from './main.ts';

export function attachHarness(g: Game) {
  const T = {
    FRAME: 1 / 60,

    // A fresh run with no automatic spawns and no wave clearing, unless waves: true.
    start({ seed = 1, waves = false }: { seed?: number; waves?: boolean } = {}) {
      g.newRun(seed);
      g.waveState = 'fight';
      g.groups = [];
      g.waveLock = !waves;
      g.input.script = { move: [0, 0], aim: [1, 0], held: { throw: false, dash: false } };
      return T.state();
    },

    place(x: number, y: number) {
      Object.assign(g.player, { x, y, vx: 0, vy: 0 });
      if (g.blade.state === 'held') Object.assign(g.blade, { x, y });
    },

    // Spawns an enemy that is already solid (no fade-in telegraph). Returns the live object.
    spawn(kind: EnemyKind, x: number, y: number, overrides: Record<string, unknown> = {}): EnemyLike {
      const e = createEnemy(kind, x, y, g.sim, true);
      Object.assign(e, overrides);
      g.enemies.push(e);
      return e;
    },

    move(x: number, y: number) { if (g.input.script) g.input.script.move = [x, y]; },
    aim(x: number, y: number) { if (g.input.script) g.input.script.aim = [x, y]; },
    aimAt(x: number, y: number) { if (g.input.script) g.input.script.aim = [x - g.player.x, y - g.player.y]; },
    press(action: 'throw' | 'dash') { g.input.buffers[action] = INPUT_BUFFER; },
    hold(action: 'throw' | 'dash', down = true) { if (g.input.script) g.input.script.held[action] = down; },

    step(frames = 1) {
      for (let i = 0; i < frames; i++) g.tick(T.FRAME);
      return T.state();
    },

    // Steps until pred() is true. Returns the number of frames taken, or -1 if it never happened.
    stepUntil(pred: () => boolean, maxFrames = 600): number {
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
        enemies: g.enemies.map((e) => ({
          kind: e.constructor.name.toLowerCase(),
          x: e.x,
          y: e.y,
          hp: e.hp,
          maxHp: e.maxHp,
          state: (e as unknown as { state?: string }).state ?? null,
        })),
        pendingEnemies: g.newEnemies.length,
        floaters: g.floaters.list.map((f) => f.text),
      };
    },

    game: g,
  };
  return T;
}
