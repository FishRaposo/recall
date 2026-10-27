# Acceptance criteria

## Input sequence (by hand)

Follow the ticket's steps to reproduce on wave 3, or use `?harness`:

1. Start with waves enabled and no other enemies.
2. Spawn one splitter 170 px in front of the player and throw through it (it takes two hits: out and back).

## Expected visual outcome

- The splitter breaks into two mites that fly apart.
- No "wave clear" text and no wave-clear sound while either mite is alive.
- After the last mite dies, "wave clear +100" appears and the next wave's banner follows about a second later.

## Verifiable state (`?harness`)

| Step | Expected |
|---|---|
| frame the splitter dies | its two mites exist (in `enemies` or pending) |
| every frame for the next 60 | `waveState === 'fight'` whenever any enemy is alive |
| after 60 frames | still wave 1 |

Automated: `node tasks/verify.mjs bug-02-wave-clears-early`

## Must not change

- A wave whose last enemy is not a splitter still clears on the frame after the last kill.
- Splitter children still appear on the same frame the splitter dies.
