# Changelog

All notable changes to Recall are recorded here. The format follows Keep a Changelog; versions follow SemVer.

## [1.1.0] — 2026-10-28

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

## [1.0.0] — 2026-10-27

- Initial public release: one returning blade, five enemies, wave composition, ink painting, task pack, GitHub Pages and itch builds.
