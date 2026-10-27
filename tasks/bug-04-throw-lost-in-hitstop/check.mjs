// Criterion: a throw pressed during hitstop (the freeze after a hit) still happens when the
// freeze ends. Same for dash.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    const g = T.game;
    const run = (action, happened) => {
      T.start();
      T.place(300, 290);
      T.spawn('mite', 306, 290, { speed: 0 }); // touching the player: the hit starts a 120 ms freeze
      T.step(1);
      const froze = g.hitstop > 0;
      T.step(2);
      T.press(action);
      T.stepUntil(() => g.hitstop <= 0, 30);
      T.step(2);
      return froze && happened();
    };
    const threw = run('throw', () => g.blade.state !== 'held');
    const dashed = run('dash', () => g.player.dashCd > 0);
    return { pass: threw && dashed, details: `press during hitstop → throw ${threw ? 'happened' : 'lost'}, dash ${dashed ? 'happened' : 'lost'}` };
  });
