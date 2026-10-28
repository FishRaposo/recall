// Wave composition is a pure function of (wave number, rng, catalog) so it can be unit-tested and
// replayed. Stats live in the content catalog; this module never duplicates them.

import type { EnemyCatalog, EnemyKind, SpawnGroup } from './types.ts';
import type { Rng } from './util.ts';

export const isHeavyWave = (n: number): boolean => n % 5 === 0;

export function waveBudget(n: number): number {
  return 6 + Math.round(n * 3.2);
}

function unlocked(n: number, catalog: EnemyCatalog): EnemyKind[] {
  return (Object.keys(catalog) as EnemyKind[]).filter((k) => n >= catalog[k].unlock);
}

export function waveRoster(n: number, rng: Rng, catalog: EnemyCatalog): EnemyKind[] {
  const kinds = unlocked(n, catalog);
  let budget = waveBudget(n);
  const roster: EnemyKind[] = [];

  // A newly unlocked enemy always shows up in its debut wave, so the banner never lies.
  const debut = kinds.find((k) => catalog[k].unlock === n);
  if (debut) {
    roster.push(debut);
    budget -= catalog[debut].cost;
  }

  for (;;) {
    const affordable = kinds.filter((k) => catalog[k].cost <= budget);
    if (affordable.length === 0) break;
    const weights = affordable.map((k) => catalog[k].weight * (isHeavyWave(n) && k === 'brute' ? 4 : 1));
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
    budget -= catalog[pick].cost;
  }
  return roster;
}

// Splits a roster into timed groups. Later waves arrive in bigger, faster groups.
export function spawnGroups(roster: EnemyKind[], n: number, rng: Rng): SpawnGroup[] {
  const interval = Math.max(0.5, 1.5 - n * 0.06);
  const maxGroup = Math.min(4, 2 + Math.floor(n / 3));
  const groups: SpawnGroup[] = [];
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
