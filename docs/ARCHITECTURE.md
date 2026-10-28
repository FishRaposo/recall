# Recall — architecture

## What the game is

A one-blade arcade game. The blade's catch is the combo meter, enemies arrive in themed waves, and every kill inks a persistent floor. The whole run is deterministic from a seed.

## Modules

| Module | Responsibility | DOM? |
|---|---|---|
| `src/core/types.ts` | Run, entity, input, effects and event contracts | no |
| `src/core/config.ts` | Every tunable number | no |
| `src/core/util.ts` | Vector/smoothing/collision math and the seeded RNG | no |
| `src/core/player.ts` | Movement, dash, invulnerability, hurt | no |
| `src/core/blade.ts` | held / out / return state machine and swept sweep hookup | no |
| `src/core/waves.ts` | Budgeted roster and timed spawn groups | no |
| `src/core/sim.ts` | The run loop: waves, spawn, collision, scoring, combo, hitstop, death | no |
| `src/content/enemies.ts` | The enemy catalog: stats, behaviour, drawing, factory | no* |
| `src/platform/input.ts` | Keyboard, mouse, touch and gamepad behind `SimInput` | yes |
| `src/platform/audio.ts` | Synthesized WebAudio and volume/mute | yes |
| `src/platform/storage.ts` | Guarded best score | yes |
| `src/platform/settings.ts` | Guarded settings and reduced-motion default | yes |
| `src/presentation/fx.ts` | Shake, particles, ink layer, floaters, paper | yes |
| `src/presentation/ui.ts` | HUD, banners, title, pause and game-over drawing | yes |
| `src/presentation/menus.ts` | Accessible pause/settings dialogs and announcements | yes |
| `src/main.ts` | Composition root, input polling, screens, effects, painting export | yes |
| `src/harness.ts` | Deterministic `?harness` surface for the tasks | no |

\* `content/enemies.ts` has `draw` methods that use `CanvasRenderingContext2D`; it never touches the document.

Dependency rule, enforced by `scripts/check-boundaries.mjs`:

- `core` imports only core.
- `content` imports core types and pure helpers.
- `platform` imports core; never presentation.
- `presentation` imports core/content types and receives platform services from `main.ts`.
- `main.ts` is the only wiring point.

## The headless simulation

`Sim` owns the run: player, blade, enemies, shots, wave state, score, combo, hitstop and stats. It takes:

- a **catalog** (`ENEMIES`) for wave composition and spawn radii;
- a **spawn factory** (`createEnemy`) so core never imports content;
- an **input** object (`SimInput`) with `moveVector`, `aimDir`, `consume`, `held`;
- a **`SimFx`** object with `sfx`, `ink`, `particles`, `floaters`, `shake`, `flash`, `onBladeBounce`, `onFinish`, `onDeath`.

`tick(realDt)` applies hitstop or advances the simulation, and the shell consumes the effects as they happen. Tests instantiate `Sim` with a scripted input and no-op effects; the browser supplies the real input and effects. This is why the core loop is testable without a browser harness.

The browser `Game` exposes the same surface the checks use: `player`, `blade`, `enemies`, `newEnemies`, `wave`, `waveState`, `groups`, `waveLock`, `hitstop`, `score`, `combo`, `mult`, `floaters`, `tick`, `newRun`, and `onBladeBounce`.

## Rendering and feel

- Camera shake is trauma-based; `SimFx.shake` is scaled by settings (reduced motion sets the scale to zero).
- Hitstop freezes the simulation while the shell keeps updating effects and the camera.
- The blade is swept against enemy circles using the segment `(x1,y1)→(x2,y2)`, so it never tunnels.
- The ink layer is a 2× offscreen canvas that is never cleared during a run; the game-over screen copies it with the paper background into a PNG.

## Determinism

- Gameplay randomness goes through `Rng` seeded from `?seed=` or the clock.
- Wave rosters, spawn groups, spawn positions, splitter children and spitter orbits all use that RNG.
- Same seed + same inputs = same run; the headless suite asserts it.

## Build and deploy

- `tsc` emits browser-native ES modules to `dist/`; no bundler.
- `index.html` loads `dist/styles.css` and `dist/main.js` with relative paths.
- GitHub Pages uploads `index.html` + `dist/`; the itch zip has the same layout at its root.
- `scripts/check-dist.mjs` rejects bad imports; `scripts/check-module-graph.mjs` proves the artifact under `/recall/`.
- `npm run smoke` runs a real journey in Chromium, Firefox and WebKit; `npm run a11y` scans the DOM overlays.
