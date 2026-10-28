# Recall: design notes

## The constraint

One weapon, and it leaves your hand. A boomerang-style blade forces a decision on every throw: while it's away you can't attack, so you're spending your only tool. The rest of the design follows from making that decision interesting and readable.

## Decisions

**The catch is the combo meter.** Scoring could have rewarded kills alone. Instead the multiplier grows when you *catch* a blade that hit something (one step per two good catches, capped at ×8) and resets when you catch an empty blade while there were enemies to hit, or when you take damage. That puts the skill in the return leg: positioning yourself so the blade comes back through the pack instead of around it. Empty catches between waves don't count, because there was nothing to hit.

**Recall is a second attack, not a cancel.** Pressing throw while the blade is out turns it home immediately, and each enemy can be struck once per leg. An early recall through a crowd hits everything twice.

**Enemies teach one idea each.** Each type arrives in its own wave with a one-line note on the banner, and each one breaks a different habit:

| Enemy | What it punishes |
|---|---|
| Mite | standing still |
| Darter | ignoring telegraphs (its aim locks and a line is drawn 0.62 s before it lunges) |
| Splitter | throwing once and assuming it's dead |
| Spitter | camping at range (its shots can be cut out of the air by the blade) |
| Brute | lazy throws (it soaks three hits and drains the blade's speed on the way out) |

**Shells make the return leg matter.** The Shell's front plate deflects the outbound blade with a spark and a speed loss; the return leg or a back hit damages it. It is the sixth enemy (wave 6) and exists to make the "throw, then position for the catch" decision legible: a straight outbound throw is not enough.

**Fairness is enforced in code, not left to the RNG.** Enemies fade in over 0.75 s and can't spawn within 200 px of the player; if 40 random tries fail, they spawn in the corner farthest away. A debut enemy always appears in its debut wave, so the banner never names something that doesn't show up; that rule has a unit test.

**Feel comes from many small, cheap effects layered together.** Hitstop (40 ms on a hit, 65 ms on a kill, 120 ms when you're hurt) does most of the work: the simulation pauses while the camera keeps shaking, which makes contact read as heavy. Screen shake uses a trauma value that decays linearly while the offset grows with its square, so small events barely move the camera and big ones snap it. The hit sound climbs a semitone for each enemy struck in a single throw.

**Hitstop would eat inputs, so inputs are buffered.** A click during a 120 ms freeze would land on a frame where the simulation doesn't run and then be cleared. Throw and dash presses stay live for 150 ms and are consumed by whichever update runs next.

**The art direction is a constraint too.** Ink on paper with one accent color (vermilion for the blade and for danger) keeps every frame readable: anything red either belongs to you or is about to hurt you. Kills stamp ink into a separate floor canvas that is never cleared during a run, so the arena records the fight and the game-over screen can export it.

## The bug that almost shipped

The returning blade steered by blending two unit vectors, its current heading and the direction to the player, then normalizing. It looked right in casual testing because the player is usually moving and off to one side.

A scripted play-through stalled on wave 3. Tracing the blade frame by frame showed it turning home and then flying off the edge of the map at full speed. Thrown in a straight line and recalled, its heading was the exact opposite of the direction home; blending a vector with its opposite gives a shorter vector pointing the *same* way, so normalizing it undid the turn every frame. A second, subtler failure sat behind it: with a constant turn rate, a fast blade could fall into orbit around a stationary player and never arrive.

The fix rotates the heading by a fraction of the signed angle to the target (no degenerate case at 180°), and scales the turn rate up as the blade closes in (`steer × (1 + 160 / distance)`), which makes orbiting impossible. The returning blade is also clamped inside the arena. `test/blade.test.ts` throws in 24 directions at 30, 60 and 144 fps and requires every throw to come home within 2.5 s; with the old steering, four of those tests fail.

## How it was tested

- 31 unit tests under `node --test`: blade homing (stationary and moving player, early recall, arena bounds), wave budgets, unlock order, determinism under a fixed seed, swept collision, frame-rate independence, saves/settings, the Shell's front plate/return/back behaviour, wave checkpoint resume, and a headless simulation suite that runs the real run loop in Node with injected input and effects.
- Browser journeys in Chromium, Firefox and WebKit: title, settings, a live wave, keyboard movement, a throw, pause/resume, death/restart, and a mobile touch drag and throw. Each fails on any console error, page error or failed request. An axe scan covers the title, settings, pause and game-over DOM overlays.
- The six task checks run against the built game in Chromium; every bug fails before and passes after, and both features fail before and pass after.

## What would change with more time

- **Rebindable controls** and a colour-blind palette.
- **A daily seed** with a shared leaderboard. The seeded RNG already makes a run's waves reproducible; input recording would make whole runs replayable.
- **Spatial partitioning** if enemy counts grow. Separation is O(n²) today, fine at the 20 to 40 enemies the waves produce, not at 500.

## Sixty seconds, out loud

Recall is an arcade game where your only weapon is a blade that comes back to you. The twist is that catching it is the combo: catch a blade that hit something and your multiplier goes up; catch an empty one and it resets. So the skill is in the return, positioning so it comes home through the enemies. It's TypeScript compiled to browser-native ES modules on a canvas, no engine and no asset files; even the sound is synthesized. The interesting engineering was game feel, hitstop, shake and input buffering so presses survive the freeze, and one homing bug where a blade recalled in a straight line flew away forever, because blending a heading with its exact opposite cancels out. The fix was to rotate the heading instead, and there's a test that throws in 24 directions at three frame rates to keep it fixed.
