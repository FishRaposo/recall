// Criterion: one throw out and back through a brute strikes it twice (once per leg),
// both on a natural return and on an early recall.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    const g = T.game;

    // Natural return: throw into a brute; the blade slows on impact, turns home and comes back through it.
    T.start();
    T.place(300, 290);
    const a = T.spawn('brute', 520, 290);
    T.aim(1, 0);
    T.press('throw');
    const caught = T.stepUntil(() => g.blade.state === 'held' && g.blade.flightHits > 0, 300) >= 0;
    const natural = a.maxHp - a.hp;

    // Early recall: throw through a stationary brute, recall as soon as the blade is past it.
    T.start();
    T.place(200, 290);
    const b = T.spawn('brute', 330, 290, { speed: 0 });
    T.aim(1, 0);
    T.press('throw');
    T.step(1);
    T.stepUntil(() => g.blade.x > b.x + 40 || g.blade.state !== 'out', 120);
    T.press('throw');
    T.stepUntil(() => g.blade.state === 'held', 300);
    const recalled = b.maxHp - b.hp;

    const pass = caught && natural === 2 && recalled === 2;
    return { pass, details: `brute hits per throw: natural return ${natural} (want 2), early recall ${recalled} (want 2)` };
  });
