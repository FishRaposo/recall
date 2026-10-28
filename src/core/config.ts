// Every tunable number lives here, so feel can be adjusted without touching logic.

export const W = 960;
export const H = 540;

// Playfield. The band above it holds the HUD.
export const ARENA = { x: 28, y: 52, w: W - 56, h: H - 80 };

export const COLORS = {
  paper: '#efe8da',
  paperDark: '#e0d6c2',
  letterbox: '#cfc4ad',
  ink: '#1d1b1a',
  red: '#d9402b',
  redDark: '#9e2b1c',
  ochre: '#c18d22',
  grey: '#958c7c',
} as const;

export const FONT = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const PLAYER = {
  r: 11,
  speed: 250,
  accel: 16, // exponential approach rate toward target velocity
  dashSpeed: 640,
  dashTime: 0.13,
  dashCooldown: 0.7,
  maxHp: 3,
  invuln: 1.3,
} as const;

export const BLADE = {
  r: 9,
  throwSpeed: 840,
  decel: 1150, // out-flight travels roughly throwSpeed² / (2·decel) ≈ 300px
  minSpeed: 70, // below this the blade turns home
  returnAccel: 1900,
  returnMax: 1050,
  steer: 9, // how hard the returning blade curves toward the player
  bounce: 0.82, // speed kept on a wall bounce
  catchPad: 6,
  heavyDrag: 0.6, // speed kept after striking a heavy enemy
} as const;

export const INPUT_BUFFER = 0.15; // seconds a press stays "live" (survives hitstop)

export const MULT_CAP = 8;
export const CATCHES_PER_MULT = 2;

export const INTRO_TIME = 1.7;
export const SPAWN_TIME = 0.75;
export const HITSTOP_HIT = 0.04;
export const HITSTOP_KILL = 0.065;
export const HITSTOP_HURT = 0.12;
export const DEATH_TIME = 1.1;
