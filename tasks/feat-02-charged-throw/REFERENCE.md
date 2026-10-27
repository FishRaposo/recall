# Reference solution

The change touches five systems; `reference-solution.patch` has all of it.

1. **Tuning** (`config.js`): a `CHARGE` block with the three design numbers, next to every other tunable.
2. **Input** (`input.js` already has `held(action)`, which reports whether the button is physically down, separate from the buffered press). The charge needs both: the buffered press *starts* a charge, so it still survives hitstop, and `held` decides when it ends.
3. **Blade** (`blade.js`): while held, a press enters a `charging` state instead of throwing. Each frame the button stays down adds to `charge`, capped at full. On release, `throw(g, charged)` fires with `charged = charge >= full`, which scales the launch speed. `drag()` (the brute slowdown) skips charged throws.
4. **Player** (`player.js`): target speed × 0.55 while `blade.charging`.
5. **Feedback** (`main.js`, `blade.js`): the ring around the player, a red ring and tick on full charge (`onChargeFull`), and the blade scaled up by its charge in hand and by 1.3 in flight when charged.

**The one real design decision.** Throwing on *release* instead of on press is unavoidable once holding means something: the game can't know at press time whether you're tapping or charging. A tap therefore throws one frame later than before (16 ms at 60 fps). That's below what players notice, and it's why the brief's "tap stays exactly as it is" is checked by speed and distance, not frame timing.

**Rejected alternative.** Throwing on press and "upgrading" the blade if the button is still held a moment later feels wrong: the blade would already be flying when it got faster.
