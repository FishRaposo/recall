// Criterion: when a splitter is the last enemy and dies, its two mites keep the wave open.
// The wave clears only after the mites die too, and never while an enemy is alive.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    const g = T.game;
    T.start({ waves: true });
    T.place(300, 290);
    const s = T.spawn('splitter', 470, 290);
    T.aim(1, 0);
    T.press('throw');
    if (T.stepUntil(() => s.dead, 300) < 0) return { pass: false, details: 'splitter never died' };

    // Watch the next second: the wave must not clear while anything is alive.
    let clearedWithEnemies = false;
    let mitesSeen = 0;
    for (let i = 0; i < 60; i++) {
      T.step(1);
      mitesSeen = Math.max(mitesSeen, g.enemies.filter((e) => e.constructor.name === 'Mite').length + g.newEnemies.length);
      if (g.waveState !== 'fight' && g.enemies.length + g.newEnemies.length > 0) clearedWithEnemies = true;
    }
    const st = T.state();
    const pass = mitesSeen === 2 && !clearedWithEnemies && st.waveState === 'fight' && st.wave === 1;
    return { pass, details: `mites after split: ${mitesSeen}; wave ${st.wave} state "${st.waveState}" with ${st.enemies.length} enemies alive; cleared early: ${clearedWithEnemies}` };
  });
