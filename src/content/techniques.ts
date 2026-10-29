// Draftable technique catalog. Every card modifies the existing verbs; there are no new weapons.
// The draft generator filters by minWave and maxStacks, so all cards live here once.

import type { TechniqueDef } from '../core/types.ts';

export const TECHNIQUES: TechniqueDef[] = [
  {
    id: 'quick-draw', name: 'Quick Draw', tag: 'throw', rarity: 'common', maxStacks: 3, minWave: 1,
    blurb: 'Throw speed +10%.',
    mods: { throwSpeedPct: 0.1 },
  },
  {
    id: 'long-arm', name: 'Long Arm', tag: 'throw', rarity: 'common', maxStacks: 2, minWave: 1,
    blurb: 'Outbound drag -15%.',
    mods: { throwDecelPct: -0.15 },
  },
  {
    id: 'piercer', name: 'Piercer', tag: 'throw', rarity: 'epic', maxStacks: 1, minWave: 4,
    blurb: 'Outbound hits ignore heavy drag.',
    mods: { ignoreHeavyDrag: true },
  },
  {
    id: 'homecoming', name: 'Homecoming', tag: 'recall', rarity: 'common', maxStacks: 3, minWave: 1,
    blurb: 'Return speed +12%.',
    mods: { returnSpeedPct: 0.12 },
  },
  {
    id: 'truer-aim', name: 'Truer Aim', tag: 'recall', rarity: 'common', maxStacks: 2, minWave: 1,
    blurb: 'Return steering +30%.',
    mods: { steerPct: 0.3 },
  },
  {
    id: 'wide-catch', name: 'Wide Catch', tag: 'recall', rarity: 'rare', maxStacks: 2, minWave: 3,
    blurb: 'Blade and catch radius +8 px.',
    mods: { catchPadPx: 8 },
  },
  {
    id: 'orbit', name: 'Orbit', tag: 'recall', rarity: 'rare', maxStacks: 2, minWave: 3,
    blurb: 'Return acceleration +20%.',
    mods: { returnAccelPct: 0.2 },
  },
  {
    id: 'afterimage', name: 'Afterimage', tag: 'double', rarity: 'rare', maxStacks: 2, minWave: 2,
    blurb: 'Double-tap window +0.15 s.',
    mods: { doubleTapWindowS: 0.15 },
  },
  {
    id: 'second-cut', name: 'Second Cut', tag: 'double', rarity: 'epic', maxStacks: 1, minWave: 5,
    blurb: 'Return hits deal +1 damage.',
    mods: { returnDamage: 1 },
  },
  {
    id: 'yellow-streak', name: 'Yellow Streak', tag: 'double', rarity: 'rare', maxStacks: 2, minWave: 2,
    blurb: 'Double taps score +25.',
    mods: { doubleTapScore: 25 },
  },
  {
    id: 'light-feet', name: 'Light Feet', tag: 'move', rarity: 'common', maxStacks: 2, minWave: 1,
    blurb: 'Move speed +8%.',
    mods: { moveSpeedPct: 0.08 },
  },
  {
    id: 'featherfall', name: 'Featherfall', tag: 'move', rarity: 'common', maxStacks: 2, minWave: 1,
    blurb: 'Dash cooldown -12%.',
    mods: { dashCooldownPct: -0.12 },
  },
  {
    id: 'second-wind', name: 'Second Wind', tag: 'move', rarity: 'epic', maxStacks: 1, minWave: 4,
    blurb: 'One extra dash charge.',
    mods: { dashCharges: 1 },
  },
  {
    id: 'broad-blade', name: 'Broad Blade', tag: 'geometry', rarity: 'rare', maxStacks: 2, minWave: 3,
    blurb: 'Blade radius +3 px.',
    mods: { bladeRadiusPx: 3 },
  },
  {
    id: 'ricochet', name: 'Ricochet', tag: 'geometry', rarity: 'rare', maxStacks: 2, minWave: 3,
    blurb: 'Wall bounces keep +8% speed.',
    mods: { bouncePct: 0.08 },
  },
  {
    id: 'heavy-hand', name: 'Heavy Hand', tag: 'enemy', rarity: 'common', maxStacks: 2, minWave: 1,
    blurb: 'Knockback +25%.',
    mods: { knockbackPct: 0.25 },
  },
  {
    id: 'sunder', name: 'Sunder', tag: 'enemy', rarity: 'rare', maxStacks: 1, minWave: 4,
    blurb: 'Return hits deal +1 to heavy enemies.',
    mods: { sunderHeavy: true },
  },
  {
    id: 'encore', name: 'Encore', tag: 'combo', rarity: 'rare', maxStacks: 2, minWave: 2,
    blurb: 'Catches with 2+ hits bank +1 extra combo.',
    mods: { comboPerCatch: 1 },
  },
  {
    id: 'grace', name: 'Grace', tag: 'combo', rarity: 'epic', maxStacks: 1, minWave: 5,
    blurb: 'One empty catch per wave does not reset.',
    mods: { comboShield: 1 },
  },
  {
    id: 'pigment-hunter', name: 'Pigment Hunter', tag: 'economy', rarity: 'common', maxStacks: 2, minWave: 2,
    blurb: 'Pickups grant +1 pigment.',
    mods: { pigmentPerPickup: 1 },
  },
];

export const TECHNIQUE_BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));
