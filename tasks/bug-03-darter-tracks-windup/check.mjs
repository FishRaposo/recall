// Criterion: once a darter starts its wind-up, its aim is locked. The telegraph line doesn't
// follow the player, and the lunge goes where the line pointed when the wind-up began.
export default (page) =>
  page.evaluate(() => {
    const T = window.__recall.test;
    T.start();
    T.place(300, 290);
    const d = T.spawn('darter', 560, 290, { stateT: 0 });
    if (T.stepUntil(() => d.state === 'wind', 120) < 0) return { pass: false, details: 'darter never wound up' };
    const lock = Math.atan2(d.ay, d.ax);
    T.move(0, 1); // the player sidesteps down during the wind-up
    let maxDrift = 0;
    const done = T.stepUntil(() => {
      maxDrift = Math.max(maxDrift, Math.abs(Math.atan2(d.ay, d.ax) - lock));
      return d.state === 'dash';
    }, 120);
    if (done < 0) return { pass: false, details: 'darter never lunged' };
    const lunge = Math.atan2(d.vy, d.vx);
    const deg = (r) => ((r * 180) / Math.PI).toFixed(1);
    const err = Math.abs(lunge - lock);
    const pass = maxDrift < 0.01 && err < 0.01;
    return { pass, details: `telegraph drift during wind-up ${deg(maxDrift)}°, lunge vs locked aim ${deg(err)}° (want 0)` };
  });
