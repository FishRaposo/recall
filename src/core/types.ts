// Shared contracts. Core, content, platform, presentation and main agree on these; core never
// imports a layer above it.

export type Vec = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EnemyKind = 'mite' | 'darter' | 'splitter' | 'spitter' | 'brute';

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
}

export type EnemyCatalog = Record<EnemyKind, EnemyDef>;

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
  drag(): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface BladeWorld {
  input: SimInput;
  hasTargets(): boolean;
  onThrow(b: BladeLike): void;
  onRecall(b: BladeLike): void;
  onBladeBounce(b: BladeLike): void;
  bladeSweep(b: BladeLike, x1: number, y1: number, x2: number, y2: number): void;
  onCatch(hits: number, hadTargets: boolean): void;
  onChargeFull?(b: BladeLike): void;
}

export interface EnemyLike {
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
  hit(dx: number, dy: number, world: EnemyWorld): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface EnemyWorld {
  player: PlayerLike;
  wave: number;
  ink: InkLike;
  sfx: SfxLike;
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
}

export interface Best {
  score: number;
  wave: number;
}

export type SimMode = 'playing' | 'dying' | 'over';
export type WaveState = 'intro' | 'fight' | 'clear';

export interface SpawnGroup {
  at: number;
  kinds: EnemyKind[];
}
