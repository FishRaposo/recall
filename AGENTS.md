# Agent instructions — Recall

Read the shared contract first: [`../STANDARD.md`](../STANDARD.md). This file is the Recall-specific working procedure.

## Commands

```bash
npm ci
npm run check          # tsc -p tsconfig.test.json
npm run build          # clean + tsc + check-dist
npm start              # build, watch and serve http://localhost:8080
npm test               # node --test "test/**/*.test.ts"
npm run test:coverage
npm run tasks          # fail-before / pass-after task pack
npm run smoke          # Chromium, Firefox and WebKit journeys
npm run a11y           # axe scan of the DOM overlays
npm run package        # dist/recall-web.zip
npm run verify         # everything above
```

Node 24 LTS is required. Runtime dependencies stay at zero; TypeScript, Playwright and axe are dev-only.

## Layout

```
src/core/         simulation, player/blade, waves, config, utilities (no DOM)
src/content/      the enemy catalog and behaviours
src/platform/     input, audio, storage, settings
src/presentation/ renderer, HUD, effects, accessible dialogs
src/main.ts       composition root: input, screens, effects, saving the painting
src/harness.ts    deterministic ?harness surface
test/             node:test suites, including the headless simulation
tasks/            task pack and verifier
scripts/          build, serve, smoke, a11y, package, release
```

Dependency rule, enforced by `scripts/check-boundaries.mjs`: `core` imports only core; `content` imports core; `platform` never imports presentation; `presentation` imports core/content types and receives platform services from `main.ts`; `main.ts` wires everything.

## Invariants

- `core/sim.ts` is headless: no DOM, no timers. The shell polls input and passes deltas; the sim owns the run.
- Effects are injected through `SimFx`; checkpoints go through `onCheckpoint`. Do not reach for `document`, `Audio`, `localStorage` or `performance` inside core.
- Enemy radius, cost, unlock wave, points, knockback, speed and behaviour live once in `src/content/enemies.ts`. The wave composer reads the catalog; do not add a second stat table. Blade reactions use `EnemyDef.onBladeHit` (the Shell pattern).
- Inputs stay buffered for 150 ms across hitstop.
- Darter wind-up aim is locked; splitter children keep a wave open; the blade can hit each enemy once per leg.
- Wave checkpoints save seed, RNG state, wave, score, combo, HP and stats; `Sim.resume` must rebuild the same wave. A new run or death clears the save.
- Task checks must fail before and pass after. Do not weaken a check to make a refactor pass.

## Task pack

- Checks stay `.mjs` and drive `window.__recall.test` against the built game.
- Patches target `src/**/*.ts`; the verifier compiles each temp copy with `tsc`.
- Regenerate patches from a temp copy; never hand-edit hunks. After a move or rename:
  1. `git apply --check` the existing patch.
  2. Rebuild the starting/feature state, regenerate with `git diff`, re-run `npm run tasks`.
- For bugs, current minus the fix is the starting state; reference restores current. For features, current is the starting state and the reference adds the feature.

## Release

Read [`docs/RELEASING.md`](docs/RELEASING.md). Bump `package.json` and `src/version.ts` together, add a dated `CHANGELOG.md` entry, run `npm run verify`, then merge/tag/release/Pages/itch. Public page copy and profile claims are Claude-owned; prepare measured facts, do not rewrite the descriptions.

## Never

- Commit `dist/`, `node_modules/`, `site/`, `coverage/` or `.tmp/`.
- Add a runtime dependency.
- Put gameplay back in `main.ts`.
- Duplicate an enemy stat outside the catalog.
- Claim a browser was verified when only Chromium ran.
