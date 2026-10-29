// Pickup catalog. Every pickup is blue on the floor; its icon can differ.
// Buffs are temporary modifiers, pigment is the run currency, heart is a rare heal.

import { INK } from '../core/config.ts';
import type { BuffDef, PickupDef } from '../core/types.ts';

const BUFFS: Record<string, BuffDef> = {
  quickening: {
    id: 'quickening', name: 'Quickening', duration: 10,
    mods: { throwSpeedPct: 0.2 },
  },
  homing: {
    id: 'homing', name: 'Homing', duration: 10,
    mods: { steerPct: 0.4 },
  },
  'wide-edge': {
    id: 'wide-edge', name: 'Wide Edge', duration: 10,
    mods: { bladeRadiusPx: 4 },
  },
  feather: {
    id: 'feather', name: 'Feather', duration: 10,
    mods: { moveSpeedPct: 0.1, dashCooldownPct: -0.3 },
  },
  magnet: {
    id: 'magnet', name: 'Magnet', duration: 10,
    mods: { catchPadPx: 10 },
  },
};

export const PICKUPS: PickupDef[] = [
  {
    id: 'quickening', name: 'Quickening', note: 'faster throws', kind: 'buff',
    weight: 10, minWave: 1, lifetime: 12, color: INK.pickup, buff: BUFFS.quickening,
  },
  {
    id: 'homing', name: 'Homing', note: 'the blade curves home', kind: 'buff',
    weight: 8, minWave: 2, lifetime: 12, color: INK.pickup, buff: BUFFS.homing,
  },
  {
    id: 'wide-edge', name: 'Wide Edge', note: 'a broader blade', kind: 'buff',
    weight: 7, minWave: 3, lifetime: 12, color: INK.pickup, buff: BUFFS['wide-edge'],
  },
  {
    id: 'feather', name: 'Feather', note: 'faster feet', kind: 'buff',
    weight: 7, minWave: 2, lifetime: 12, color: INK.pickup, buff: BUFFS.feather,
  },
  {
    id: 'magnet', name: 'Magnet', note: 'a wider catch', kind: 'buff',
    weight: 6, minWave: 4, lifetime: 12, color: INK.pickup, buff: BUFFS.magnet,
  },
  {
    id: 'second-wind', name: 'Second Wind', note: 'dash refilled', kind: 'buff',
    weight: 6, minWave: 1, lifetime: 12, color: INK.pickup, dashRefill: true,
    buff: { id: 'second-wind', name: 'Second Wind', duration: 0, mods: {} },
  },
  {
    id: 'pigment', name: 'Pigment Drop', note: '+3 pigment', kind: 'pigment',
    weight: 12, minWave: 1, lifetime: 12, color: INK.pickup, pigment: 3,
  },
  {
    id: 'pigment-cache', name: 'Pigment Cache', note: '+6 pigment', kind: 'pigment',
    weight: 4, minWave: 5, lifetime: 12, color: INK.pickup, pigment: 6,
  },
  {
    id: 'heart', name: 'Heart', note: '+1 heart', kind: 'heal',
    weight: 3, minWave: 4, lifetime: 12, color: INK.pickup, heal: 1,
  },
];

export const PICKUP_BY_ID = new Map(PICKUPS.map((p) => [p.id, p]));
