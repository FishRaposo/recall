// Criteria for the charged throw. Distances are measured from where the blade leaves the hand
// to the farthest point of its out-flight.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    const g = T.game;
    const fail = [];

    // Hold throw for `frames` (0 = a tap), release, and measure the throw.
    const throwAfter = (frames, { moving = false } = {}) => {
      T.start();
      T.place(150, 290);
      T.aim(1, 0);
      if (moving) T.move(0, 1);
      T.press('throw');
      T.hold('throw', frames > 0);
      let heldDuringCharge = true;
      let chargeSpeed = 0;
      for (let i = 0; i < frames; i++) {
        T.step(1);
        if (g.blade.state !== 'held') heldDuringCharge = false;
        chargeSpeed = Math.hypot(g.player.vx, g.player.vy);
      }
      T.move(0, 0);
      T.hold('throw', false);
      if (T.stepUntil(() => g.blade.state === 'out', 5) < 0) return null;
      const x0 = g.blade.x;
      const y0 = g.blade.y;
      const speed = g.blade.speed;
      let dist = 0;
      T.stepUntil(() => {
        dist = Math.max(dist, Math.hypot(g.blade.x - x0, g.blade.y - y0));
        return g.blade.state !== 'out';
      }, 240);
      return { speed, dist, heldDuringCharge, chargeSpeed };
    };

    const tap = throwAfter(0);
    const short = throwAfter(10); // ~0.17 s: not a full charge
    const full = throwAfter(30); // 0.5 s
    const moving = throwAfter(30, { moving: true });
    if (!tap || !short || !full || !moving) return { pass: false, details: 'a throw never left the hand' };

    if (Math.abs(tap.speed - 840) > 1 || tap.dist < 280 || tap.dist > 330) fail.push(`tap changed: speed ${tap.speed.toFixed(0)}, ${tap.dist.toFixed(0)}px`);
    if (Math.abs(short.speed - 840) > 1) fail.push(`short hold should be a normal throw, got speed ${short.speed.toFixed(0)}`);
    if (!full.heldDuringCharge) fail.push('blade left the hand before release');
    if (full.speed < 1134) fail.push(`charged speed ${full.speed.toFixed(0)} (want ≥ 1134)`);
    if (full.dist < tap.dist * 1.8) fail.push(`charged distance ${full.dist.toFixed(0)}px vs tap ${tap.dist.toFixed(0)}px (want ≥ 1.8×)`);
    if (moving.chargeSpeed > 150) fail.push(`player speed while charging ${moving.chargeSpeed.toFixed(0)} px/s (want ≤ 150)`);

    // A charged blade isn't slowed by a brute.
    T.start();
    T.place(150, 290);
    T.aim(1, 0);
    T.spawn('brute', 330, 290, { speed: 0 });
    T.press('throw');
    T.hold('throw', true);
    T.step(30);
    T.hold('throw', false);
    let before = 0;
    T.stepUntil(() => {
      if (g.blade.flightHits > 0) return true;
      before = g.blade.speed;
      return false;
    }, 60);
    const after = g.blade.speed;
    if (after < before - 1150 / 60 - 1) fail.push(`charged blade slowed by brute: ${before.toFixed(0)} → ${after.toFixed(0)}`);

    // Recall still works on a charged throw (it lands after the hit's hitstop ends).
    T.press('throw');
    T.stepUntil(() => g.blade.state !== 'out', 12);
    if (g.blade.state !== 'return') fail.push('recall did nothing during a charged throw');

    return {
      pass: fail.length === 0,
      details: fail.length ? fail.join('; ') : `tap ${tap.dist.toFixed(0)}px @${tap.speed.toFixed(0)}, charged ${full.dist.toFixed(0)}px @${full.speed.toFixed(0)}, charging move ${moving.chargeSpeed.toFixed(0)} px/s`,
    };
  });
