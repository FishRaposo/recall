# Reference solution

Three systems: the blade (knows when it bounced), scoring (decides the value) and feedback (popup, label, sound).

1. **Blade** (`blade.js`): a `banked` flag, set in `bounce()` when the blade hits a wall, reset in `throw()`. Resetting on throw rather than on catch is what makes it per-throw: a recall that never bounces after a banked out-leg is still the same throw, so its kills still count.
2. **Scoring** (`main.js → kill()`): `points × mult × (banked ? 2 : 1)`.
3. **Feedback** (same place): red popup, a second floater with the label, and the existing bounce sound reused as the tick.

`reference-solution.patch` is the full change (about 15 lines).

**Edge worth noting.** A blade that bounces *after* a kill doesn't retroactively bank that kill. That matches the spec ("has bounced… during the current throw" at the time of the kill) and is what the check expects.
