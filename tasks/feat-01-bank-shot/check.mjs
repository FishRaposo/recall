// Criteria: a kill made after the blade has bounced off a wall during the current throw scores
// double and shows a "bank shot" label; a direct kill scores normally; the bonus doesn't carry
// over to the next throw.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    const g = T.game;
    let bounces = 0;
    const onBounce = g.onBladeBounce.bind(g);
    g.onBladeBounce = (b) => { bounces += 1; onBounce(b); };

    // Kill one mite, return the score ratio against the normal value and whether a label showed.
    const killWith = (mite) => {
      const before = g.score;
      const mult = g.mult;
      T.press('throw');
      T.hold('throw', false);
      if (T.stepUntil(() => mite.dead, 180) < 0) return null;
      const label = g.floaters.list.some((f) => /bank/i.test(f.text));
      return { ratio: (g.score - before) / (mite.points * mult), label };
    };

    // 1. Banked: off the top wall into a mite.
    T.start();
    T.place(300, 150);
    T.aim(1, -1);
    const m1 = T.spawn('mite', 450, 122, { speed: 0 });
    const banked = killWith(m1);
    const bouncedFirst = bounces > 0;

    // 2. Same run, next throw goes straight in: no carry-over.
    T.stepUntil(() => g.blade.state === 'held', 300);
    g.floaters.list.length = 0;
    bounces = 0;
    T.place(300, 290);
    T.aim(1, 0);
    const m2 = T.spawn('mite', 420, 290, { speed: 0 });
    const direct = killWith(m2);

    const ok = banked && direct && bouncedFirst && bounces === 0;
    const pass = ok && Math.abs(banked.ratio - 2) < 1e-9 && banked.label && Math.abs(direct.ratio - 1) < 1e-9 && !direct.label;
    const fmt = (r) => (r ? `×${r.ratio} ${r.label ? 'with' : 'without'} label` : 'no kill');
    return { pass, details: `banked kill ${fmt(banked)} (want ×2 with label); next direct kill ${fmt(direct)} (want ×1 without)` };
  });
