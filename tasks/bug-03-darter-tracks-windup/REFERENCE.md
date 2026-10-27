# Reference solution

**Root cause.** The darter is a four-state machine: `seek → wind → dash → rest`. Its aim (`ax, ay`) is set toward the player on entering `wind`, and both the telegraph line and the lunge use it. A line added to the `wind` case recomputed the aim every frame "to keep the telegraph on the player", which turned a telegraphed attack into a homing one.

**How to find it by playtesting.** Sidestep during the wind-up and watch the line. The design note describes exactly that: players reacting correctly and still getting hit is the tell that the telegraph and the attack disagree.

**Fix** (`reference-solution.patch`): delete the re-aim from the `wind` case. The aim is already locked on the `seek → wind` transition.

**Design note.** If darters feel too easy after the fix, the levers are wind-up length or lunge speed in `enemies.js`, not tracking: a telegraph the attack doesn't honor reads as the game cheating.
