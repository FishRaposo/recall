# Acceptance criteria

## Input sequence (by hand)

1. Tap throw: the blade flies and returns exactly as before.
2. Hold throw for about half a second while walking, then release.
3. Hold throw for a moment (under a third of a second) and release.
4. Fully charge and release at a brute; while the blade is out, tap throw to recall.

## Expected visual outcome

- While holding: a ring around the player fills clockwise; at full charge it turns red and thickens, with a short tick sound and a red pulse. The blade in hand grows slightly as it charges.
- The player visibly slows while charging and speeds back up on release.
- The charged blade is drawn larger in flight and passes through a brute without losing speed.
- Step 3 produces an ordinary throw.

## Verifiable state (`?harness`)

Player at (150, 290), aim (1, 0). Distance is from where the blade leaves the hand to the farthest point of its out-flight.

| Input | Expected |
|---|---|
| press, release immediately | blade speed 840 ± 1; out-distance 280–330 px |
| hold 10 frames, release | blade speed 840 ± 1 (normal throw) |
| hold 30 frames, release | blade stays `held` for all 30 frames; speed ≥ 1134 on release; out-distance ≥ 1.8 × the tap's |
| hold 30 frames while moving | player speed ≤ 150 px/s at the end of the hold |
| full charge into a brute at (330, 290) | blade speed after the hit not lower than before it, beyond one frame of normal deceleration |
| then press throw | blade enters `return` once the hit's hitstop ends |

Automated: `node tasks/verify.mjs feat-02-charged-throw`

## Must not change

- Recall (press throw while the blade is out), the catch, combo and scoring rules.
- Dash works while charging.
