# Acceptance criteria

## Input sequence (by hand)

1. Let a mite touch you (or kill one), then click to throw within about 0.1 s.
2. Repeat with dash (right-click) right after taking a hit.

Doing this reliably by hand is hard, which is why the harness version exists.

## Expected visual outcome

- The game still freezes briefly on the hit (hitstop), then the throw (or dash) comes out as soon as the freeze ends, every time.
- No double throws: one press, one throw.

## Verifiable state (`?harness`)

| Step | Expected |
|---|---|
| player at (300, 290), stationary mite at (306, 290), step 1 frame | `hitstop > 0` (player was hit) |
| step 2 more frames, press throw, step until `hitstop <= 0`, step 2 | `blade.state !== 'held'` |
| same setup, press dash instead | `player.dashCd > 0` (dash happened) |

Automated: `node tasks/verify.mjs bug-04-throw-lost-in-hitstop`

## Must not change

- Hitstop durations (40 / 65 / 120 ms).
- A press still expires if it isn't used within its buffer window (150 ms), so a stale click can't fire a throw seconds later.
