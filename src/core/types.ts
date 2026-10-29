// Shared contracts. Core, content, platform, presentation and main agree on these; core never
// imports a layer above it.

export type Vec = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EnemyKind = 'mite' | 'darter' | 'splitter' | 'spitter' | 'brute' | 'shell';

export interface EnemyDef {
  kind: EnemyKind;
  r: number;
  hp: number;
  points: number;
  cost: number;
  unlock: number;
  weight: number;
  knock: number;
  heavy?: boolean;
  note: string;
  speed: (wave: number) => number;
  onBladeHit?: (enemy: EnemyLike, dx: number, dy: number, world: EnemyWorld) => 'deflect' | 'damage';
}

export type EnemyCatalog = Record<EnemyKind, EnemyDef>;

export type RunMode = 'arcade' | 'roguelike';

export type TechniqueTag = 'throw' | 'recall' | 'double' | 'move' | 'geometry' | 'enemy' | 'combo' | 'economy';
export type Rarity = 'common' | 'rare' | 'epic';

// Run-time modifiers. Percentages are additive fractions (+0.12 = +12%).
export interface Mods {
  throwSpeedPct?: number;
  throwDecelPct?: number;
  returnSpeedPct?: number;
  returnAccelPct?: number;
  steerPct?: number;
  bladeRadiusPx?: number;
  catchPadPx?: number;
  bouncePct?: number;
  doubleTapWindowS?: number;
  doubleTapScore?: number;
  returnDamage?: number;
  moveSpeedPct?: number;
  dashCooldownPct?: number;
  dashCharges?: number;
  knockbackPct?: number;
  heavyDragPct?: number;
  comboPerCatch?: number;
  comboShield?: number;
  scorePct?: number;
  pigmentPerPickup?: number;
  ignoreHeavyDrag?: boolean;
  sunderHeavy?: boolean;
}

export interface TechniqueDef {
  id: string;
  name: string;
  tag: TechniqueTag;
  rarity: Rarity;
  maxStacks: number;
  minWave: number;
  blurb: string;
  mods: Mods;
}

export type PickupKind = 'buff' | 'pigment' | 'heal';

export interface BuffDef {
  id: string;
  name: string;
  duration: number;
  mods: Mods;
}

export interface PickupDef {
  id: string;
  name: string;
  note: string;
  kind: PickupKind;
  weight: number;
  minWave: number;
  lifetime: number;
  color: string;
  buff?: BuffDef;
  pigment?: number;
  heal?: number;
  dashRefill?: boolean;
}

export interface PickupState {
  def: PickupDef;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export interface DraftState {
  cards: TechniqueDef[];
  rerolls: number;
}

export interface BurstOptions {
  count?: number;
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  color?: string;
  dirX?: number;
  dirY?: number;
  spread?: number;
  drag?: number;
}

export interface FloaterOptions {
  size?: number;
  color?: string;
  life?: number;
  rise?: number;
  font?: string;
}

export interface InkLike {
  clear(): void;
  blot(x: number, y: number, r: number, color: string, dx?: number, dy?: number, alpha?: number): void;
  dot(x: number, y: number, r: number, color: string, alpha: number): void;
  kill(x: number, y: number, r: number, dx?: number, dy?: number): void;
  hurt(x: number, y: number, r: number, dx?: number, dy?: number): void;
  death(x: number, y: number, r: number): void;
  doubleTap(x1: number, y1: number, x2: number, y2: number): void;
  pickup(x: number, y: number, kind: PickupKind): void;
  motion(x: number, y: number, r: number, alpha: number): void;
}

export interface FloatersLike {
  list: Array<{ text: string }>;
  add(x: number, y: number, text: string, opts?: FloaterOptions): void;
}

export interface ParticlesLike {
  burst(x: number, y: number, opts?: BurstOptions): void;
  ring(x: number, y: number, color: string, radius?: number): void;
}

export interface ShakeLike {
  add(amount: number): void;
}

export interface SfxLike {
  throw(): void;
  recall(): void;
  bounce(): void;
  hit(step: number): void;
  kill(): void;
  catch(mult: number): void;
  catchSoft(): void;
  whiff(): void;
  dash(): void;
  hurt(): void;
  spawn(): void;
  shoot(): void;
  clink(): void;
  wave(): void;
  clear(): void;
  heal(): void;
  gameOver(): void;
  pickup(kind: PickupKind): void;
  buffEnd(): void;
  pigment(): void;
  doubleTap(): void;
  draft(): void;
  pick(): void;
}

export interface PlayerLike {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  invuln: number;
  dashT: number;
  dashCd: number;
  dashCharges?: number;
  dashChargesMax?: number;
  dashX: number;
  dashY: number;
  faceX: number;
  faceY: number;
  moveX: number;
  moveY: number;
  squash: number;
  alive: boolean;
  readonly dashing: boolean;
  readonly vulnerable: boolean;
  update(dt: number, world: PlayerWorld): void;
  hurt(world: PlayerWorld, fromX: number, fromY: number): boolean;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface PlayerWorld {
  input: SimInput;
  ink: InkLike;
  blade?: BladeLike;
  mods?: Mods;
  onDash(p: PlayerLike): void;
}

export interface BladeLike {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  r: number;
  state: 'held' | 'out' | 'return';
  flightHits: number;
  hitSet: Set<EnemyLike>;
  hadTargets: boolean;
  trail: number[];
  banked?: boolean;
  charging?: boolean;
  charge?: number;
  charged?: boolean;
  readonly flying: boolean;
  update(dt: number, world: BladeWorld): void;
  throw(world: BladeWorld): void;
  turnHome(world: BladeWorld, early: boolean): void;
  registerHit(e: EnemyLike, x1: number, y1: number, x2: number, y2: number, world: BladeWorld): boolean;
  drag(): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface BladeWorld {
  input: SimInput;
  mods?: Mods;
  doubleTapWindow?: number;
  hasTargets(): boolean;
  onThrow(b: BladeLike): void;
  onRecall(b: BladeLike): void;
  onBladeBounce(b: BladeLike): void;
  bladeSweep(b: BladeLike, x1: number, y1: number, x2: number, y2: number): void;
  onCatch(hits: number, hadTargets: boolean): void;
  onChargeFull?(b: BladeLike): void;
  onDoubleTap?(e: EnemyLike, x1: number, y1: number, x2: number, y2: number): void;
}

export interface EnemyLike {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  points: number;
  heavy: boolean;
  spawnT: number;
  flash: number;
  dead: boolean;
  t: number;
  readonly active: boolean;
  update(dt: number, world: EnemyWorld): void;
  hit(dx: number, dy: number, world: EnemyWorld, damage?: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface EnemyWorld {
  player: PlayerLike;
  wave: number;
  blade?: BladeLike;
  ink: InkLike;
  sfx: SfxLike;
  mods?: Mods;
  addEnemy(e: EnemyLike): void;
  spawnShot(x: number, y: number, vx: number, vy: number): void;
}

export interface SimInput {
  moveVector(): Vec;
  aimDir(px: number, py: number, fx: number, fy: number): Vec;
  consume(action: 'throw' | 'dash'): boolean;
  held?(action: 'throw' | 'dash'): boolean;
}

export interface SimFx {
  sfx: SfxLike;
  ink: InkLike;
  particles: ParticlesLike;
  floaters: FloatersLike;
  shake: ShakeLike;
  flash(amount: number): void;
  onBladeBounce(b: BladeLike): void;
  onFinish(score: number, wave: number): void;
  onDeath(): void;
  onCheckpoint?(save: SimCheckpoint): void;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dead: boolean;
}

export interface RunStats {
  kills: number;
  bestMult: number;
  time: number;
  doubleTaps?: number;
}

export interface Best {
  score: number;
  wave: number;
}

export interface SimCheckpoint {
  version: 1;
  seed: number;
  rngState: number;
  wave: number;
  score: number;
  combo: number;
  hp: number;
  stats: RunStats;
}

export type SimMode = 'playing' | 'draft' | 'dying' | 'over';
export type WaveState = 'intro' | 'fight' | 'clear';

export interface SpawnGroup {
  at: number;
  kinds: EnemyKind[];
}
