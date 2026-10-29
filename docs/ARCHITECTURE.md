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
| `src/core/run.ts` | Modifier totals, rarity-weighted draft draws and pickup weighting | no |
| `src/core/painting.ts` | Seeded painting-title grammar | no |
| `src/core/sim.ts` | The run loop: waves, spawn, collision, scoring, combo, hitstop, techniques, pigment, pickups, draft, double taps, death | no |
| `src/content/enemies.ts` | The enemy catalog: stats, behaviour, the Shell's plate hook, drawing, factory | no* |
| `src/content/techniques.ts` | Draftable technique registry | no |
| `src/content/pickups.ts` | Pickup and buff registry | no |
| `src/platform/input.ts` | Keyboard, mouse, touch and gamepad behind `SimInput` | yes |
| `src/platform/audio.ts` | Synthesized WebAudio and volume/mute | yes |
| `src/platform/storage.ts` | Guarded Arcade best score and wave checkpoint | yes |
| `src/platform/settings.ts` | Guarded settings and reduced-motion default | yes |
| `src/presentation/fx.ts` | Shake, particles, semantic ink layer, floaters, paper | yes |
| `src/presentation/pickups.ts` | Blue pickup diamonds and floor rings | yes |
| `src/presentation/ui.ts` | HUD, banners, title, pause and game-over drawing | yes |
| `src/presentation/menus.ts` | Accessible pause/settings/draft dialogs and announcements | yes |
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
- **technique and pickup catalogs** so the sim can draw drafts and pickups without importing content;
- a **spawn factory** (`createEnemy`) so core never imports content;
- an **input** object (`SimInput`) with `moveVector`, `aimDir`, `consume`, `held`;
- a **`SimFx`** object with `sfx`, `ink`, `particles`, `floaters`, `shake`, `flash`, `onBladeBounce`, `onFinish`, `onDeath`, `onCheckpoint`.

`tick(realDt)` applies hitstop or advances the simulation, and the shell consumes the effects as they happen. Tests instantiate `Sim` with a scripted input and no-op effects; the browser supplies the real input and effects. This is why the core loop is testable without a browser harness.

In Arcade, each wave start emits a `SimCheckpoint` through `SimFx.onCheckpoint`: seed, RNG state, wave, score, combo, HP and stats. The shell persists it as `recall.save.v1`; `Sim.resume` restores the RNG state before rebuilding the wave, so the same wave composition comes back. A new Arcade run or death clears the save.

Roguelike never emits a checkpoint and never reads or writes `recall.save.v1`. `newRun(seed, mode)` resets techniques, pigment, buffs, pickups, draft, modifiers and the painting title. `chooseTechnique`, `rerollDraft` and `skipDraft` own the between-wave draft; `updatePickups`/`applyPickup`/`tickBuffs` own the blue pickups and temporary modifiers. `Blade.registerHit` detects the double tap, and `Sim.onDoubleTap` applies its ink, cue, score and stat. `finishRun` generates the seeded painting title.

The Shell's front plate is a catalog hook (`EnemyDef.onBladeHit`) rather than a branch in `bladeSweep`: the hook sees the blade state and travel direction, returns `deflect`, and the sim slows the blade without damaging the enemy. The same hook leaves return-leg and back hits as normal damage.

The browser `Game` exposes the same surface the checks use: `player`, `blade`, `enemies`, `newEnemies`, `wave`, `waveState`, `groups`, `waveLock`, `hitstop`, `score`, `combo`, `mult`, `floaters`, `tick`, `newRun`, and `onBladeBounce`.

## Rendering and feel

- Camera shake is trauma-based; `SimFx.shake` is scaled by settings (reduced motion sets the scale to zero).
- Hitstop freezes the simulation while the shell keeps updating effects and the camera.
- The blade is swept against enemy circles using the segment `(x1,y1)→(x2,y2)`, so it never tunnels.
- The ink layer is a 2× offscreen canvas that is never cleared during a run. `InkLike` methods map events to black kills, red damage, yellow double-tap streaks, blue pickup marks and neutral motion; the game-over screen copies the floor with the paper background and the seeded title into a PNG.
- Pickups are drawn in the world layer (`presentation/pickups.ts`) and never stamp the ink canvas; collecting one does.

## Determinism

- Gameplay randomness goes through `Rng` seeded from `?seed=` or the clock.
- Wave rosters, spawn groups, spawn positions, splitter children, spitter orbits, draft draws and pickup selection all use that RNG. Painting titles are seeded from the run seed, wave and kills.
- Same seed + same inputs = same run; the headless suite asserts it. Roguelike state is in memory only, so a reload is a new run.

## Build and deploy

- `tsc` emits browser-native ES modules to `dist/`; no bundler.
- `index.html` loads `dist/styles.css` and `dist/main.js` with relative paths.
- GitHub Pages uploads `index.html` + `dist/`; the itch zip has the same layout at its root.
- `scripts/check-dist.mjs` rejects bad imports; `scripts/check-module-graph.mjs` proves the artifact under `/recall/`.
- `npm run smoke` runs a real journey in Chromium, Firefox and WebKit; `npm run a11y` scans the DOM overlays.
- `npm run test:coverage` enforces the 75% line floor.
