// Pure run helpers: modifier totals, draft generation and weighted pickup choice.
// No DOM and no content imports; the shell passes the catalogs in.

import { DRAFT } from './config.ts';
import type { BuffDef, DraftState, Mods, Rarity, TechniqueDef } from './types.ts';
import type { Rng } from './util.ts';

const NUMERIC_KEYS = [
  'throwSpeedPct', 'throwDecelPct', 'returnSpeedPct', 'returnAccelPct', 'steerPct',
  'bladeRadiusPx', 'catchPadPx', 'bouncePct', 'doubleTapWindowS', 'doubleTapScore',
  'returnDamage', 'moveSpeedPct', 'dashCooldownPct', 'dashCharges', 'knockbackPct',
  'heavyDragPct', 'comboPerCatch', 'comboShield', 'scorePct', 'pigmentPerPickup',
] as const;

type NumericKey = (typeof NUMERIC_KEYS)[number];

const CAPS: Record<NumericKey, [number, number]> = {
  throwSpeedPct: [0, 0.6],
  throwDecelPct: [-0.6, 0],
  returnSpeedPct: [0, 0.6],
  returnAccelPct: [0, 0.6],
  steerPct: [0, 0.6],
  bladeRadiusPx: [0, 6],
  catchPadPx: [0, 18],
  bouncePct: [0, 0.15],
  doubleTapWindowS: [0, 0.4],
  doubleTapScore: [0, 100],
  returnDamage: [0, 1],
  moveSpeedPct: [0, 0.4],
  dashCooldownPct: [-0.5, 0],
  dashCharges: [0, 1],
  knockbackPct: [0, 0.6],
  heavyDragPct: [0, 0.3],
  comboPerCatch: [0, 2],
  comboShield: [0, 1],
  scorePct: [0, 0.5],
  pigmentPerPickup: [0, 2],
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const identityMods = (): Mods => ({});

// Techniques stack per copy; buffs apply once while active. Booleans are OR-ed.
export function computeMods(techniques: Map<string, number>, defs: TechniqueDef[], buffs: Iterable<BuffDef>): Mods {
  const sums = new Map<NumericKey, number>();
  const flags = { ignoreHeavyDrag: false, sunderHeavy: false };

  const add = (mods: Mods): void => {
    for (const key of NUMERIC_KEYS) {
      const value = mods[key];
      if (typeof value === 'number') sums.set(key, (sums.get(key) ?? 0) + value);
    }
    if (mods.ignoreHeavyDrag) flags.ignoreHeavyDrag = true;
    if (mods.sunderHeavy) flags.sunderHeavy = true;
  };

  for (const def of defs) {
    const stacks = techniques.get(def.id) ?? 0;
    for (let i = 0; i < stacks; i++) add(def.mods);
  }
  for (const buff of buffs) add(buff.mods);

  const out: Mods = {};
  for (const key of NUMERIC_KEYS) {
    const value = sums.get(key);
    if (value === undefined) continue;
    const [lo, hi] = CAPS[key];
    out[key] = clamp(value, lo, hi);
  }
  if (flags.ignoreHeavyDrag) out.ignoreHeavyDrag = true;
  if (flags.sunderHeavy) out.sunderHeavy = true;
  return out;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 10 };

export function drawDraft(
  pool: TechniqueDef[],
  wave: number,
  owned: Map<string, number>,
  rng: Rng,
  count = DRAFT.cards,
): DraftState {
  const eligible = pool.filter((def) => def.minWave <= wave && (owned.get(def.id) ?? 0) < def.maxStacks);
  const cards: TechniqueDef[] = [];
  while (cards.length < count && eligible.length) {
    const total = eligible.reduce((sum, def) => sum + RARITY_WEIGHT[def.rarity], 0);
    let roll = rng.float(0, total);
    let picked = eligible.length - 1;
    for (let i = 0; i < eligible.length; i++) {
      roll -= RARITY_WEIGHT[eligible[i].rarity];
      if (roll <= 0) {
        picked = i;
        break;
      }
    }
    cards.push(eligible.splice(picked, 1)[0]);
  }
  return { cards, rerolls: 0 };
}

export const rerollCost = (draft: DraftState): number => DRAFT.rerollBase + draft.rerolls;

export function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0) return null;
  let roll = rng.float(0, total);
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}
