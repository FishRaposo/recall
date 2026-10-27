# Wave clears with enemies still alive

*QA ticket · severity: major · build: main*

**Summary.** When a splitter is the last enemy of a wave, killing it shows "wave clear" and starts the next wave's countdown while its two mites are still alive and chasing the player.

**Steps to reproduce**
1. Play to wave 3 (first wave with splitters).
2. Kill every other enemy first, leaving one splitter.
3. Kill the splitter.

**Expected.** The two mites it splits into keep the wave going. "Wave clear" appears only after they die.

**Actual.** "wave clear +300" appears the moment the splitter dies. The mites stay alive into the next wave's intro and the next wave spawns on top of them. Wave-clear bonus and the every-third-wave heal are awarded early.

**Frequency.** 100% when a splitter is the last enemy; never otherwise.

**Notes.** Started after the change that made the wave clear "on the same frame as the last kill".
