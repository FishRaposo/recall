# Recall

A small arcade game about one blade that always comes back.

![Recall gameplay: the blade flies out, cuts through a pack of enemies and curves back to the player](media/demo.gif)

You have one throwing blade. Throw it, call it back early if you need to, and catch it: every catch after a hit raises your score multiplier, and every empty catch while enemies are on the board drops it. Everything you kill leaves ink on the floor, so each run ends as a painting you can save.

Designed and built with AI assistance (Claude) to Vinícius Raposo's brief, then tested like production software.

**Project page:** [fishraposo.github.io/projects/recall.html](https://fishraposo.github.io/projects/recall.html)

**Play:** [on itch.io](https://fishraposo.itch.io/recall) or [the GitHub Pages build](https://fishraposo.github.io/recall/), both in the browser, or run it locally:

```bash
git clone https://github.com/FishRaposo/recall.git
cd recall
npm ci               # dev-only tooling: TypeScript, Playwright and axe
npm start            # builds, watches and serves http://localhost:8080
```

Node 24 LTS is required. `npm start` builds `dist/`; opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

## Task pack

[`tasks/`](tasks/README.md) holds six game-development tasks built on this game: four realistic bugs planted in working code and two feature requests. Each has a brief written the way it would arrive (player report, QA ticket, design review, producer request), acceptance criteria with an input sequence, the expected visual outcome and verifiable game state, a reference solution with root-cause notes, and an automated check. `npm run tasks` proves every check fails on the starting state and passes on the reference solution.

## Controls

| | Mouse + keyboard | Keyboard only | Gamepad | Touch |
|---|---|---|---|---|
| Move | WASD | arrows | left stick | drag |
| Aim | mouse | follows movement | right stick | tap |
| Throw / recall | left click | Z or space | A, RB or RT | tap or **throw** button |
| Dash | right click or shift | X | B, LB or LT | **dash** button |
| Pause · mute · fullscreen | esc · M · F | esc · M · F | start | **pause** button |
| Settings | O or **settings** | O | | **settings** button |
| Continue · copy seed | C · Y | C · Y | | **continue** button |

## How it plays

- **The blade is your only weapon and your only combo meter.** While it's out you can't attack, so every throw is a commitment. Recalling early is a second attack: the blade cuts on the way back too.
- **Six enemies, introduced one per wave** with a one-line note on the wave banner: mites swarm, darters telegraph a straight lunge, splitters break in two, spitters keep their distance and fire ink you can cut out of the air, brutes take three hits and slow the blade down, and shells turn a front plate against the outbound blade.
- **Nothing is unfair on purpose.** Enemies fade in for 0.75 s before they're solid and never spawn within 200 px of you; darters lock their aim and draw the line before they move; spitters glow before they fire.
- **Every third wave restores a heart.** Every fifth wave is heavy on brutes.

## Save and settings

- A run is checkpointed at the start of every wave (`recall.save.v1`): seed, RNG state, wave, score, combo, HP and stats. **Continue** appears on the title after a reload; a new run or death clears it. The ink painting is cosmetic and is not restored.
- The seed is shown on the title and game-over screen; **Y** copies a `?seed=` link and `?seed=N` replays the same wave layout for the same inputs.
- Settings (`recall.settings.v1`) keep volume, mute, shake, flashes and reduced motion. Reduced motion is the default when the operating system asks for it, and it removes screen shake and flashes.
- The pause and settings dialogs are real DOM dialogs with focus handling and `aria-live` announcements; all storage reads are guarded, so private windows still play without persistence.
- The game-over screen exports the painted floor as a PNG with **S**.

## Under the hood

No engine, no runtime dependencies, no asset files: TypeScript compiled to browser-native ES modules, on a 2D canvas. Sound is synthesized at runtime with WebAudio.

- **The simulation is headless.** `src/core/sim.ts` owns the run, waves, collision, scoring, the catch/combo rule and the wave checkpoints. It takes injected input and effects, so the Node tests run the exact loop the browser runs. The browser shell only feeds input, applies sound/ink/particles and draws.
- **Content is one catalog.** `src/content/enemies.ts` is the single source for each enemy's radius, cost, unlock wave, points, knockback, speed and behaviour, including the Shell's `onBladeHit` plate. The wave composer reads the same catalog, so the old cost/radius duplication is gone.
- **Game feel is code you can read.** Hitstop on every hit (the simulation freezes while the camera keeps shaking), trauma-based screen shake, squash on the player, hit flashes, a trail on the blade, and a hit sound that climbs a semitone per enemy struck in one throw.
- **Inputs are buffered for 150 ms**, so a click made during hitstop still throws when the frame resumes.
- **Swept collision.** The blade moves up to ~17 px per frame; enemies are tested against the segment it travelled, not its position, so it never tunnels through a small enemy.
- **Frame-rate independent smoothing** (`expDecay`) for movement and steering: the game plays the same at 30, 60 and 144 Hz, and there's a test for it.
- **Seeded randomness.** Wave composition and spawn positions come from a seeded PRNG; `?seed=123` replays the same run layout. `?debug` shows fps, entity counts and the seed.

The design reasoning and the bug that almost shipped are in [docs/DESIGN.md](docs/DESIGN.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Content: [docs/CONTENT.md](docs/CONTENT.md).

## Tests

```bash
npm run check    # typecheck source and tests
npm run build    # emit the browser build to dist/
npm test         # 31 tests: blade homing, waves, headless sim, Shell, saves, collision, RNG, settings
npm run tasks    # six tasks: every check fails before, passes after
npm run smoke    # real journeys in Chromium, Firefox and WebKit
npm run a11y     # axe scan of the title, settings, pause and game over
npm run verify   # everything above, plus module-graph and boundary checks
```

`scripts/smoke.mjs` plays the real page: title, settings, a wave, keyboard movement, a throw, pause/resume, save/continue, death/restart and a mobile touch drag and throw. It runs in Chromium, Firefox and WebKit and fails on any console error, page error or failed request. `scripts/smoke.py` and `scripts/record_media.py` remain optional Python media tools.

## Development

- [`AGENTS.md`](AGENTS.md) — commands, invariants and the task-pack rules.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, simulation, determinism, build/deploy.
- [`docs/CONTENT.md`](docs/CONTENT.md) — adding an enemy or wave behaviour.
- [`docs/RELEASING.md`](docs/RELEASING.md) — version, checks, tag, release and itch handoff.
- [`../STANDARD.md`](../STANDARD.md) — the shared contract across the three games.

## Project layout

```
src/core/         simulation, entities, waves, config, utilities (no DOM)
src/content/      the enemy catalog
src/platform/     input (keyboard/mouse/touch/pad), audio, storage, settings
src/presentation/ renderer, HUD, effects, accessible dialogs
src/main.ts       composition root: input, screens, effects, save/paint
test/             node:test suites, including the headless simulation
tasks/            the task pack and its verifier
```

## Limitations

- No key rebinding or colour-blind palette yet; reduced motion, shake, flashes and volume are available.
- Smoke-tested in Chromium, Firefox and WebKit. WebKit-on-Linux is a compatibility check, not Safari-on-macOS proof.
- A run is checkpointed at wave start, not mid-wave; the painting is not part of the save.
- Spatial separation is O(n²); fine at the 20 to 40 enemies the waves produce.

## License

[MIT](LICENSE)
