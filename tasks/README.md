# Task pack

Six self-contained tasks built on Recall, in the format used for evaluating AI agents on game development: four bugs planted in working code and two feature requests. Each one comes with what an agent (or a new hire) would be handed and what a reviewer would grade against.

| Task | Kind | Brief voice | Systems involved |
|---|---|---|---|
| [bug-01 · The blade only cuts once](bug-01-blade-hits-once/BRIEF.md) | bug | player report | blade state machine, collision |
| [bug-02 · Wave clears with enemies alive](bug-02-wave-clears-early/BRIEF.md) | bug | QA ticket | wave flow, spawning, frame order |
| [bug-03 · Darters are undodgeable](bug-03-darter-tracks-windup/BRIEF.md) | bug | design review | enemy AI, telegraphing |
| [bug-04 · Throws get eaten after a hit](bug-04-throw-lost-in-hitstop/BRIEF.md) | bug | player report | input buffering, hitstop, game loop |
| [feat-01 · Bank shots](feat-01-bank-shot/BRIEF.md) | feature | design spec | blade, scoring, feedback |
| [feat-02 · Charged throw](feat-02-charged-throw/BRIEF.md) | feature | producer request | input, blade, player movement, UI, audio |

## What's in each task

| File | Purpose |
|---|---|
| `BRIEF.md` | The request as it would arrive: a player, QA, a designer or a producer. Describes symptoms or goals, never the cause or the code. |
| `CRITERIA.md` | Acceptance criteria: an input sequence, the expected visual outcome, the verifiable game state, and what must not change. |
| `starting-state.patch` | Bugs only: applied to `main`, it produces the broken game the task starts from. |
| `reference-solution.patch` | The fix or the feature. |
| `REFERENCE.md` | Root cause (bugs) or design of the change (features), how to find it by playtesting, and rejected alternatives. |
| `check.mjs` | The criteria as an automated check, run against the real game in headless Chromium. |

Each bug is the kind that reads as plausible in review: a cleanup that clears a buffer too eagerly, a refactor that moves a check one line too far, a "helpful" line that keeps a telegraph on target. None is a typo, and each produces a symptom you have to play the game to see.

## Verifying the pack

```bash
npm install
npx playwright-core install chromium   # once
npm run tasks
```

For every task, `tasks/verify.mjs` copies the game to a temp folder, applies the starting state, runs the check (it must **fail**), applies the reference solution, and runs the check again (it must **pass**). A check that passes on the broken game proves nothing, so fail-then-pass is the only green result.

```
ok    bug-01-blade-hits-once       bug      starting state: fail  ·  solution: pass
ok    bug-02-wave-clears-early     bug      starting state: fail  ·  solution: pass
ok    bug-03-darter-tracks-windup  bug      starting state: fail  ·  solution: pass
ok    bug-04-throw-lost-in-hitstop bug      starting state: fail  ·  solution: pass
ok    feat-01-bank-shot            feature  starting state: fail  ·  solution: pass
ok    feat-02-charged-throw        feature  starting state: fail  ·  solution: pass
```

## How the checks reach into the game

Loading the game with `?harness` stops it from advancing on its own and exposes `window.__recall.test` ([src/harness.js](../src/harness.js)): start a seeded run, place the player, spawn enemies, script movement, aim and button presses or holds, and step frames at a fixed 1/60 s. The checks drive the same code a player does, through the same input layer, and get the same answer every run.

Checks test behavior, not implementation. The bug-02 check, for example, passes for either reasonable fix (moving the wave-clear check back, or counting queued spawns), because it only asserts that a wave never clears while an enemy is alive.

## Playing a broken build

```bash
git apply tasks/bug-03-darter-tracks-windup/starting-state.patch
npm start
# ...play wave 2...
git apply -R tasks/bug-03-darter-tracks-windup/starting-state.patch
```
