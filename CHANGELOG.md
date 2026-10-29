# Changelog

All notable changes to Recall are recorded here. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added

- Roguelike mode: a three-card technique draft at every wave clear, run-only pigment, temporary pickups (buff, pigment, heal, dash refill) and a full run reset. No meta progression and no save; Arcade keeps its checkpoint.
- Semantic ink grammar: black kills, red damage, yellow double-tap streaks, blue pickup marks and neutral motion trails. `InkLike` exposes `kill`, `hurt`, `death`, `doubleTap`, `pickup` and `motion`.
- Double-tap detection in `Blade.registerHit` and `Sim.onDoubleTap`, with a run stat and yellow floor ink.
- Technique and pickup registries (`content/techniques.ts`, `content/pickups.ts`) and pure draft/modifier helpers (`core/run.ts`).
- Seeded painting titles (`core/painting.ts`), a 1.4 s painting reveal, and PNG export/share. `S` saves, `V` shares via Web Share when supported and otherwise downloads, `C` copies the title/seed.
- Title mode select for Arcade and Roguelike; `T` returns to the title from the results panel.

### Changed

- Arcade checkpoints remain Arcade-only; Roguelike never reads or writes `recall.save.v1`.
- Dash charges, dash-cooldown and movement modifiers; the HUD shows pigment, buff timers and extra dash pips in Roguelike.
- The game-over panel reports the mode, double taps, techniques picked and painting title.

### Tests

- 42 unit tests: the existing suite plus double-tap window, pickups, buff expiry, draft determinism/rerolls/skip, run reset and painting titles.
- Smoke journeys include a Roguelike draft/pickup path in Chromium, Firefox and WebKit; the axe scan includes the draft dialog.

## [1.3.1] — 2026-10-28

### Fixed

- `AudioContext.resume()` rejections during a page navigation are caught instead of surfacing as a Firefox console error during the save/continue smoke journey.

## [1.3.0] — 2026-10-28

### Added

- **Shell** demo enemy (wave 6): its front plate deflects the outbound blade; the return leg or a hit from behind damages it. The catalog's `onBladeHit` hook is covered by tests.
- Wave checkpoint save/resume (`recall.save.v1`): seed, RNG state, wave, score, combo, HP and stats; **Continue** on the title; a new run or death clears it.
- Seed display on the title and game-over screen; **Y** copies a `?seed=` replay link.
- Coverage floor (75% lines) in `npm run test:coverage`.

### Changed

- New runs checkpoint at wave start; `Sim.resume` rebuilds the wave from the saved RNG state.
- Title and game-over screens show the run seed.
- README, content, architecture and agent documentation updated for the Shell/save flow.

### Tests

- 31 unit tests: three Shell tests (front deflect/slow, return damage, back damage), checkpoint round-trip/resume determinism, storage validation, plus the existing suite.
- Coverage: 77.19% lines, 81.05% branches.

## [1.2.0] — 2026-10-28

### Added

- Strict TypeScript build and a deployable `dist/` artifact.
- `core` / `content` / `platform` / `presentation` split with module-boundary checks.
- Headless `core/sim.ts`: the whole run loop now runs in Node with injected effects, no browser harness required.
- Touch controls: drag to move, tap or the on-screen throw button to throw/recall, and a dash button.
- Settings dialog (volume, mute, shake, flashes, reduced motion) with guarded persistence, plus pause/settings accessibility and `aria-live` announcements.
- Chromium, Firefox and WebKit smoke journeys; axe scan of the title, pause, settings and game-over overlays.
- Build, serve, module-graph, packaging and release-check scripts; CI browser and a11y jobs.
- Architecture, content, release, contributing and agent documentation.

### Changed

- Enemy radius, cost, unlock wave, points, knockback and speed live in one catalog (`src/content/enemies.ts`); the wave composer no longer duplicates stats.
- The browser shell is now composition and rendering; gameplay lives in the simulation.
- The task verifier patches TypeScript source and compiles each state before running its check.
- Version metadata is aligned with the release.

### Fixed

- The returning blade can strike the same enemy again (per-leg hit set).
- A wave cannot clear while splitter children are queued.
- Darter wind-up aim is locked.
- Throw and dash presses survive hitstop.

### Tests

- 26 unit tests, including a headless simulation suite (wave flow, collision, combo, darter lock, determinism).
- Six task checks: every bug fails before and passes after; both features fail before and pass after.
- Three browser journeys and axe clean at the WCAG A/AA level.

## [1.1.0] — 2026-10-27

- Previous tagged release. The package metadata still said 1.0.0; the 1.2.0 rebuild supersedes it.

## [1.0.0] — 2026-10-27

- Initial public release: one returning blade, five enemies, wave composition, ink painting, task pack, GitHub Pages and itch builds.
