# Reference solution

**Root cause.** Enemies spawned during the update loop (a splitter's two mites) don't go straight into `enemies`; they're queued in `newEnemies` and merged at the end of the frame, so the array isn't modified while it's being iterated. A refactor moved the wave-clear check to just after dead enemies are filtered out and *before* that merge. On the frame a splitter dies last, `enemies` is momentarily empty, the check sees an empty wave and clears it, and the mites are merged in a moment later.

**How to find it by playtesting.** Only reproducible when a splitter is the last enemy, which is why it reads as intermittent in normal play. The ticket's note about the "same frame" change points at the right commit.

**Fix** (`reference-solution.patch`): move the check back to the top of the `fight` branch of `update()`, where it runs against a complete enemy list (the previous frame's survivors plus any merged spawns). The clear now lands one frame after the last kill, which nobody can see at 60 fps.

**Also acceptable.** Keeping the check where it was but testing `!this.enemies.length && !this.newEnemies.length`. The automated check accepts either, since it tests behavior, not placement.
