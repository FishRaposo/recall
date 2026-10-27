// Wave composition is a pure function of (wave number, rng) so it can be unit-tested and replayed.

export const ENEMY_COST = { mite: 2, darter: 3, splitter: 4, spitter: 4, brute: 5 };
export const UNLOCK_WAVE = { mite: 1, darter: 2, splitter: 3, spitter: 4, brute: 5 };
const WEIGHT = { mite: 5, darter: 3, splitter: 2, spitter: 2, brute: 1.5 };

// Shown on the wave banner the first time each enemy appears.
export const DEBUT_NOTE = {
  mite: 'mites swarm. throw, then catch.',
  darter: 'darters wind up, then lunge in a straight line.',
  splitter: 'splitters break in two.',
  spitter: 'spitters keep their distance. your blade cuts their ink.',
  brute: 'brutes are heavy. they slow the blade down.',
};

export const isHeavyWave = (n) => n % 5 === 0;

export function waveBudget(n) {
  return 6 + Math.round(n * 3.2);
}

export function waveRoster(n, rng) {
  const kinds = Object.keys(ENEMY_COST).filter((k) => n >= UNLOCK_WAVE[k]);
  let budget = waveBudget(n);
  const roster = [];

  // A newly unlocked enemy always shows up in its debut wave, so the banner never lies.
  const debut = kinds.find((k) => UNLOCK_WAVE[k] === n);
  if (debut) {
    roster.push(debut);
    budget -= ENEMY_COST[debut];
  }

  for (;;) {
    const affordable = kinds.filter((k) => ENEMY_COST[k] <= budget);
    if (affordable.length === 0) break;
    const weights = affordable.map((k) => WEIGHT[k] * (isHeavyWave(n) && k === 'brute' ? 4 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.float(0, total);
    let pick = affordable[affordable.length - 1];
    for (let i = 0; i < affordable.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = affordable[i];
        break;
      }
    }
    roster.push(pick);
    budget -= ENEMY_COST[pick];
  }
  return roster;
}

// Splits a roster into timed groups. Later waves arrive in bigger, faster groups.
export function spawnGroups(roster, n, rng) {
  const interval = Math.max(0.5, 1.5 - n * 0.06);
  const maxGroup = Math.min(4, 2 + Math.floor(n / 3));
  const groups = [];
  let i = 0;
  let t = 0;
  while (i < roster.length) {
    const size = rng.int(2, maxGroup);
    groups.push({ at: t, kinds: roster.slice(i, i + size) });
    i += size;
    t += interval * size * 0.6;
  }
  return groups;
}
