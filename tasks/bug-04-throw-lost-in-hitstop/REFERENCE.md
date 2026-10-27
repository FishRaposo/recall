# Reference solution

**Root cause.** Hitstop pauses the simulation: for its duration, frames render but `update()` doesn't run, so nothing consumes input. Presses are stored in a short buffer (`Input.buffers`, 150 ms) precisely so they survive that gap. `Input.endFrame()` was changed to zero the buffers every frame, "so a press belongs to the frame it happened in". In normal frames that's harmless, because the press is consumed in the same frame. During hitstop it throws away every press.

**How to find it by playtesting.** The report's pattern is the clue: only right after hits and kills, worst when swarmed (more hits, more hitstop), on every input device (so it isn't device handling). Anything common to all devices that only happens around hits points at hitstop.

**Fix** (`reference-solution.patch`): remove the two lines from `endFrame()`. Buffers already decay on their own in `Input.poll()`, which enforces the 150 ms expiry.

**Rejected alternative.** Running input handling during hitstop would throw the blade mid-freeze, which breaks the freeze-frame effect and moves the throw earlier than the player sees it.
