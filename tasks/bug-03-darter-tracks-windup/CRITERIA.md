# Acceptance criteria

## Input sequence (by hand)

1. Wave 2, or `?harness` with a darter 260 px to the player's right.
2. When the darter stops and the dashed red line appears, hold down (S) to step off the line.

## Expected visual outcome

- The red line stays pointed where it first appeared for the whole wind-up (about 0.6 s), while the player moves away from it.
- The darter lunges along that line and misses.
- Before the wind-up starts, the darter still turns to face the player as it approaches.

## Verifiable state (`?harness`)

| Moment | Expected |
|---|---|
| darter enters `wind` | record `atan2(ay, ax)` as the locked aim |
| every frame of the wind-up, player moving down | aim angle differs from the locked aim by < 0.01 rad |
| darter enters `dash` | `atan2(vy, vx)` within 0.01 rad of the locked aim |

Automated: `node tasks/verify.mjs bug-03-darter-tracks-windup`

## Must not change

- Wind-up length (0.62 s), lunge speed (560 px/s) and lunge duration.
- Darters still track the player while seeking.
