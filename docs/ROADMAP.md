# Recall — Ink, Pickups and Roguelike

## Design document

> **Status: implemented in the working tree, unreleased.** The semantic ink, double-tap, pickups, Roguelike mode, draft/techniques, run reset, mode select, painting titles, reveal, save and share are in `src/`. Release and public copy are pending.
>
> **Prerequisite:** the TypeScript migration is complete and Recall is on v1.3.1. This design does **not** add persistence to the Roguelike mode; Arcade keeps its existing wave checkpoint and Continue.
>
> **Location:** `portfolio/games/recall/docs/ROADMAP.md`.
>
> **Last updated:** 2026-10-28
>
> **Owner:** Fish

---

## Contents

1. [What this document is](#1-what-this-document-is)
2. [Current state: recap vs code](#2-current-state-recap-vs-code)
3. [Locked design decisions](#3-locked-design-decisions)
4. [Design pillars](#4-design-pillars)
5. [Terminology](#5-terminology)
6. [Ink grammar](#6-ink-grammar)
7. [Double tap](#7-double-tap)
8. [Pickups](#8-pickups)
9. [Roguelike mode](#9-roguelike-mode)
10. [In-run progression and run lifecycle](#10-in-run-progression-and-run-lifecycle)
11. [Painting presentation](#11-painting-presentation)
12. [Future architecture map](#12-future-architecture-map)
13. [Data flow](#13-data-flow)
14. [Implementation sequence](#14-implementation-sequence)
15. [Testing strategy](#15-testing-strategy)
16. [Documentation plan](#16-documentation-plan)
17. [Risks and guardrails](#17-risks-and-guardrails)
18. [Out of scope](#18-out-of-scope)
19. [Open questions](#19-open-questions)
20. [Document control](#20-document-control)

---

## 1. What this document is

### 1.1 In one paragraph

Recall is a wave-based arena action game built around one throwable sword. The sword is thrown, recalled early, and caught; movement changes the return path; a catch after a hit raises the multiplier; every kill leaves ink on the floor; death turns the floor into a painting. This document designs four additions to that loop: a semantic ink palette, random pickups, a Roguelike mode with a between-wave draft and purely in-run progression, and a stronger final-painting presentation. It does not add a second weapon. The Roguelike mode adds no persistent saves or progression between runs; Arcade keeps its existing checkpoint.

### 1.2 What this document is

- A design record for the planned ink, pickup, Roguelike and painting work.
- The source material for future `docs/ROADMAP.md`, `docs/DESIGN.md` and `docs/CONTENT.md` updates.
- A statement of locked decisions, open questions, content tables, run economy and acceptance criteria.
- Written against the current post-migration TypeScript tree (`core` / `content` / `platform` / `presentation`) at v1.3.1.

### 1.3 What this document is not

- It is not an implementation plan, a branch, a task list or a release note.
- It does not claim that unbuilt features exist; the status banner lists what is implemented and what remains.
- It does not change public claims, the portfolio site or the itch page. The repo README, DESIGN, CONTENT and ARCHITECTURE are updated alongside the implementation; public copy is Claude-owned and goes through the copy handoff.
- It does not reopen the TypeScript migration, which is complete at v1.3.1.
- It does not add persistent saves, a profile, meta progression, unlocks or a Continue button to the Roguelike mode; Arcade keeps its existing checkpoint and Continue. It does not add a second attack button.
- It does not add bosses or an online service.

### 1.4 Design constraints carried over from the existing game

- One weapon, and it leaves your hand. Every addition must deepen throwing, recalling, timing, positioning or catching.
- Arcade remains playable, unchanged, and the default mode.
- Enemies teach one idea each; new systems must not obscure that teaching.
- Fairness is enforced in code: telegraphs, spawn distance, seeded randomness.
- The floor is a record. The scoreboard says how well the run went; the painting says what happened.
- **A Roguelike run is self-contained.** No Roguelike run state survives death, a new run, a page reload or a browser restart. Arcade keeps its existing checkpoint and Continue.

### 1.5 Genre positioning

Recall is **not a bullet hell** in the danmaku sense. The term is useful only as a comparison for its wave-and-dodge rhythm.

- **Primary category:** wave-based arena action / arcade arena combat.
- **Mechanical category:** boomerang action — one thrown weapon, a manipulable return path and a catch-based combo meter.
- **Control category:** twin-stick-style controls (WASD plus mouse aim), but not a twin-stick shooter; there is one weapon and it spends time away from the player.
- **Planned mode:** single-weapon arena roguelike / action roguelike.

A bullet hell depends on dense, patterned projectile fields, a tiny hitbox and dodging as the primary skill. Recall has six enemy archetypes, of which only the spitter fires projectiles; those shots are slow and aimed rather than patterned, the player's hitbox is large, and the primary skill is positioning for the return leg and catch timing. The repo's own README calls it “a small arcade game”, which is closer than “bullet hell”.

Use “bullet hell” only as a reference point when explaining what Recall is not. Do not use it as the game's genre label in the README, the itch page, the portfolio site or public copy.

---

## 2. Current state: recap vs code

This section compares the design recap with the current implementation. It is a documentation audit, not a claim that the code is wrong.

| Recap claim | What is actually there | Delta |
|---|---|---|
| Throw, recall, dynamic return, damage both ways | `src/core/blade.ts` (`throw`, `turnHome`, `update`), `src/core/sim.ts` (`bladeSweep`). Each enemy is hit once per leg; `turnHome` clears `hitSet`. | Implemented. |
| Double taps | `Blade.registerHit` records the outbound leg and detects a return hit inside `DOUBLE_TAP_WINDOW`; `Sim.onDoubleTap` stamps yellow ink, plays the cue and counts `stats.doubleTaps`. | Implemented. |
| Five enemy archetypes, splitter, waves, scoreboard | `src/content/enemies.ts`, `src/core/waves.ts`, `src/core/sim.ts`, `src/presentation/ui.ts`. The current build adds a sixth, the Shell (wave 6). | Implemented; six archetypes now. |
| Black kills, red player blood | `Sim.kill` → black blot; `Sim.hurtPlayer` and `die` → red semantic ink; dash, darter and shot trails use neutral `ink.motion`. | Implemented. |
| Final painting on death | The floor canvas persists; the game-over panel overlays it; `Sim.finishRun` generates a seeded title; `S` exports a 2× PNG with title, mode, wave, score and seed. | Implemented; full-screen reveal and Web Share pending. |
| Yellow double-tap ink | `InkLayer.doubleTap` draws a tapered streak and star in `INK.doubleTap`; `Sim.onDoubleTap` calls it. | Implemented. |
| Blue pickup ink | `InkLayer.pickup` draws blue buff rings, pigment marks and heal rings; `Sim.applyPickup` calls it. | Implemented. |
| Random pickups | `content/pickups.ts` plus `Sim.updatePickups`/`applyPickup`; Roguelike only, blue on collection. | Implemented. |
| Roguelike progression | `content/techniques.ts`, `core/run.ts` draft, pigment and `Sim.chooseTechnique`; no meta progression. | Implemented in-run. |
| Persistent saves or meta progression | The build persists the Arcade best score (`recall.best.v1`), the Arcade wave checkpoint (`recall.save.v1` with Continue), and settings (`recall.settings.v1`); there is no profile or meta currency. | Arcade keeps its checkpoint; Roguelike adds no save, Continue or meta progression. |
| Additional weapons | Absent and explicitly rejected. | Correct. |
| TypeScript migration | `index.html` loads `dist/main.js`; `src/main.ts`, the `core`/`content`/`platform`/`presentation` layers, the build/serve/smoke/a11y scripts and the `.test.ts` suites all exist at v1.3.1. | Complete; Roguelike work is implemented in the working tree. |

One correction to the recap: “double taps deal enormous damage” is true **in effect** (two legs in a short window). The detector is now `Blade.registerHit`, and `Sim.onDoubleTap` turns it into yellow ink, a cue and the run stat.

---

## 3. Locked design decisions

These decisions came from the design review and are treated as fixed for this document.

- **Two modes.** Arcade is the default and behaves exactly as today. Roguelike is additive and selected from the title screen.
- **Roguelike shape.** Between-wave draft (choose 1 of 3), random pickups and in-run techniques. There is no meta progression.
- **No persistent saves in Roguelike.** No run checkpoint, no Continue button, no profile, no unlocks and no currency that survives a Roguelike run. Reloading or closing the page ends the run. A new run always starts from the same baseline.
- **Arcade is unchanged.** Arcade keeps its best score (`recall.best.v1`), its wave checkpoint (`recall.save.v1`) and its Continue button. The Roguelike mode does not read or write either key.
- **Pickups are mixed.** Some grant temporary buffs, some grant a run currency called `pigment`, and a rare one heals. Blue ink is stamped on **collection**, not on spawn, so the painting records player choices rather than RNG.
- **Double tap.** The same enemy is damaged on the outbound leg and again on the return leg of the same throw, within 0.5 seconds of the first hit.
- **No new weapons.** Every technique and pickup modifies throw, recall, timing, positioning, geometry, enemy interaction or combo.
- **Ink is a record of action.** Gameplay RNG never paints. Only player-caused events persist on the floor.
- **Arcade purity.** No pickups, drafts, techniques or pigment in Arcade. Its scoring, combo rules, waves, save/Continue and task pack stay valid.
- **Documentation first.** This document is the design source; code waits for an explicit owner go-ahead.

---

## 4. Design pillars

| Pillar | Feature that expresses it |
|---|---|
| One weapon, infinite mastery | Every technique touches the blade; no item ever replaces it. |
| Movement is offensive | Recall steering, catch radius, dash and position techniques; pickups that reward repositioning. |
| Timing matters | Double-tap window, early-recall techniques, `Afterimage`, `Second Cut`. |
| Enemies create emergent interactions | Splitter double taps, `Sunder` versus brutes, cutting spitter ink, Shell front-plate hook from the migration. |
| Combat creates art | Four-color ink grammar, shape grammar, final painting and title. |
| In-run progression expands depth, not breadth | Draft cards modify existing verbs; the build exists only for the current run. |
| A run is a complete artifact | Every run starts equal, ends in death and leaves a painting. Mastery is the player's, not the profile's. |

---

## 5. Terminology

| Term | Meaning in this document |
|---|---|
| **Arcade** | The current mode: endless waves, score, multiplier, no progression. The default. |
| **Roguelike** | The new mode: waves, draft, pickups and techniques, with all progression contained in the run. No persistence. |
| **Run** | One attempt from the first wave to death. Its state exists only in memory. |
| **Session** | The current browser tab's memory. A reload ends the session and the run. |
| **Ink** | The persistent floor marks left by gameplay events within one run. |
| **Pigment** | The run-only currency dropped by pickups and spent on draft rerolls; skipping a draft grants a small amount. Blue. Reset to zero on death. |
| **Technique** | A draftable upgrade card that modifies the existing verbs. No new weapons, no meta unlocks. |
| **Pickup** | A blue item on the floor that grants a buff, pigment or health. |
| **Draft** | The between-wave choice of one technique from a random hand of three. |
| **Double tap** | A damaging outbound hit and a damaging return hit on the same enemy in the same throw, within 0.5 s. |
| **Painting** | The arena floor after a run, exported as a PNG with a generated title. The export is a user download, not a save. |

---

## 6. Ink grammar

### 6.1 Palette

The palette would live in `core/config.ts`:

```ts
export const INK = {
  kill: '#1d1b1a',       // black: destruction
  hurt: '#d9402b',       // red: player failure
  doubleTap: '#c9971f',  // yellow/ochre: precision
  pickup: '#2f5fa8',     // blue: opportunity / reward
  motion: '#6b6252',     // neutral graphite: movement, not an event
} as const;
```

`COLORS.red` stays the blade and danger-render color. Ink colors are separate from render colors so the floor stays legible.

### 6.2 Event table

| Event | Ink method | Color | Shape | Persistence |
|---|---|---|---|---|
| Enemy killed | `ink.kill(x,y,r,dx,dy)` | black | lumpy blot plus directional droplets | permanent within the run |
| Player hurt | `ink.hurt(x,y,r,dx,dy)` | red | directional spray | permanent within the run |
| Player death | `ink.death(x,y,r)` | red | large blot plus burst | permanent within the run |
| Double tap | `ink.doubleTap(x1,y1,x2,y2)` | yellow | thin tapered streak plus 4-point star | permanent within the run |
| Pickup collected (buff) | `ink.pickup(x,y,'buff')` | blue | small ring of 6 dots | permanent within the run |
| Pickup collected (pigment) | `ink.pickup(x,y,'pigment')` | blue | small blot plus 2 droplets | permanent within the run |
| Pickup collected (heal) | `ink.pickup(x,y,'heal')` | blue | small ring plus a center dot | permanent within the run |
| Dash | `ink.motion(x,y,r,alpha)` | neutral | low-alpha dot | permanent within the run, faint |
| Darter dash or spitter trail | `ink.motion(...)` | neutral | low-alpha dot | permanent within the run, faint |
| Wall bounce | `ink.motion(...)` | neutral | tiny dot | permanent within the run, faint |
| Title decoration | private `blot` / `dot` | black/red | decorative | title screen only |

The current public `blot` and `dot` calls from core would be replaced by these semantic methods. `InkLayer` would keep `blot` and `dot` as private helpers. This keeps core presentation-agnostic and lets tests record events instead of colors.

### 6.3 Shape grammar

- Kill: round, lumpy, heavy.
- Hurt: directional, sharp, flung.
- Double tap: long, thin, directional.
- Pickup: small, ringed, precise.
- Motion: faint, neutral, low alpha.

Shapes carry the meaning; colors reinforce it. This keeps the painting readable in grayscale and for color-vision deficiencies.

### 6.4 Ink budget

- Only event ink persists. Spawn telegraphs, pickups waiting on the floor and draft UI never touch the floor canvas.
- Yellow streaks are thin (2–4 px) with a small star; blue marks are small (4–6 px).
- Black must remain the dominant color. If a screenshot reads as confetti, reduce yellow and blue alpha and size before adding more colors.
- No pigment mixing or secondary colors in this pass. Mixing would blur the four-event read; defer it.

### 6.5 Why semantic methods

The current `InkLike` takes a color string. If core keeps passing `COLORS.ink` or `COLORS.red`, every new event becomes a new convention in every call site. Semantic methods (`kill`, `hurt`, `doubleTap`, `pickup`, `motion`) put the palette and shape rules in one presentation module, keep core free of hex values, and make the test fake trivial:

```ts
const ink = { events: [] as string[], kill() { this.events.push('kill'); }, ... };
```

---

## 7. Double tap

### 7.1 Definition

A double tap is a **damaging outbound hit followed by a damaging return hit on the same enemy, in the same throw, within `DOUBLE_TAP_WINDOW = 0.5 s`**.

- Outbound hit: `Blade.state === 'out'` and the enemy is damaged.
- Return hit: `Blade.state === 'return'` and the same enemy object is damaged.
- The window is measured in simulation time from the outbound hit; hitstop pauses it because `Blade.update` does not run during hitstop.
- A deflected hit (Shell front plate) does not count; only damage counts.

### 7.2 Detection design

In `core/blade.ts`:

- `flightT` — seconds since the throw, incremented in `update`, reset in `throw`.
- `outboundHits: Map<EnemyLike, number>` — records `flightT` on an outbound damaging hit.
- On a return damaging hit, if the map has the enemy and `flightT - t <= DOUBLE_TAP_WINDOW`, emit `g.onDoubleTap(e, px, py, this.x, this.y)`.
- Clear `outboundHits` on a new `throw` and on `catch`; keep it across `turnHome`.
- Do not clear it on wall bounces.

In `core/sim.ts`:

- `bladeSweep` already knows the previous and current blade positions. After `e.hit(...)`, if the enemy died, call `kill` first (black), then `onDoubleTap` (yellow) so the yellow streak sits on top.
- `onDoubleTap` calls `ink.doubleTap(prevX, prevY, x, y)`, `sfx.doubleTap()`, a small particle ring, and increments `stats.doubleTaps`.
- No score change in Arcade. In Roguelike, the `Yellow Streak` technique can add score.

### 7.3 Edge cases

- Enemy killed on the outbound leg → no return hit → no double tap.
- Enemy first hit on the return leg → no outbound record → no double tap.
- Splitter killed on the return leg → double tap fires for the splitter; the two mites spawn into `newEnemies`, so they cannot be hit by the same sweep. They can be hit on later frames of the same return, but they have no outbound record, so they get black ink, not yellow. That matches “the painting shows what happened”.
- A new throw resets the map, so cross-throw hits never count.
- Frame-rate independence: the window is in seconds, not frames; test at 30, 60 and 144 fps.

### 7.4 Why this definition

It rewards a quick recall **and** aim, not just button rhythm. It is testable with two enemy objects, and it reads naturally: “I hit it on the way out and again on the way back.”

---

## 8. Pickups

### 8.1 Registry

A new `src/content/pickups.ts` would hold the definitions:

```ts
export type PickupKind = 'buff' | 'pigment' | 'heal';

export interface BuffDef {
  id: string;
  name: string;
  duration: number;
  mods: Partial<Mods>;
}

export interface PickupDef {
  id: string;
  name: string;
  note: string;          // one-line HUD/floater
  kind: PickupKind;
  weight: number;
  minWave: number;
  lifetime: number;
  color: string;         // blue variants
  buff?: BuffDef;
  pigment?: number;
  heal?: number;
}
```

There is no `unlock` field: every pickup is available from the start of a run, gated only by `minWave`.

Default pool:

| id | Name | Kind | Effect | Weight | Min wave |
|---|---|---|---|---|---|
| `quickening` | Quickening | buff | throw speed +20%, 10 s | 10 | 1 |
| `homing` | Homing | buff | return steer +40%, 10 s | 8 | 2 |
| `wide-edge` | Wide Edge | buff | blade radius +4 px, 10 s | 7 | 3 |
| `feather` | Feather | buff | move speed +10%, dash cooldown −30%, 10 s | 7 | 2 |
| `magnet` | Magnet | buff | catch pad +10 px, 10 s | 6 | 4 |
| `second-wind` | Second Wind | buff | refill dash cooldown instantly | 6 | 1 |
| `pigment` | Pigment Drop | pigment | +3 pigment | 12 | 1 |
| `pigment-cache` | Pigment Cache | pigment | +6 pigment, rare | 4 | 5 |
| `heart` | Heart | heal | +1 HP, capped at max | 3 | 4 |

All pickups use blue floor ink on collection. The `heart` pickup can draw a small red heart icon inside its blue diamond; the floor mark is still blue.

### 8.2 Spawn rules

Roguelike only. Arcade never calls the spawner.

- `pickupClock` lives in `Sim`; first eligible 6 s into a `fight`, then every `rng.float(11, 16)` s.
- Maximum 2 alive. If the field already has 2, reset the clock and try again later.
- Position: 40 tries inside `ARENA`, at least 140 px from the player and 70 px from every active enemy; fallback to the farthest tried point from the player.
- Lifetime 12 s; blink for the last 3 s; despawn at wave clear with no floor mark.
- All gameplay randomness uses `sim.rng`. Cosmetic sparkle may use `Math.random`.
- Pickups pause (and do not tick) during `draft` and hitstop.
- All pickups despawn when the run ends. Nothing carries to the next run.

### 8.3 Collection

In `Sim.update`, after the player moves:

- `circleHit(player, pickup)` → apply, remove, `ink.pickup`, `sfx.pickup`, floater (`+3 pigment`, buff name, `+1`).
- Buff: store in `run.buffs: Map<BuffId, number>`; refresh to full duration if already active; recompute `mods`.
- Pigment: `run.pigment += amount`.
- Heal: `player.hp = min(maxHp, hp + amount)`; if at max, convert to 2 pigment so the pickup is never wasted.
- Buffs tick in `Sim.update` (not during draft or hitstop); on expiry, recompute `mods` and play `sfx.buffEnd`.

### 8.4 Rendering and HUD

- A blue diamond or drop with an ink outline and a slow pulse; a thin blue ring on the floor beneath it (transient, not the ink canvas). This would live in `presentation/fx.ts` or a small `presentation/pickups.ts`.
- HUD in Roguelike: a blue drop glyph plus the `pigment` count next to the score; up to 4 active buff pips with a shrinking arc. Hidden in Arcade.
- The first pickup of a run shows a one-time hint: `blue drops: buffs and pigment`.

### 8.5 Audio

Additions to `SfxLike`: `pickup(kind)`, `buffEnd()`, `pigment()`, `doubleTap()`, `draft()`, `pick()`, `runEnd()`. They would be synthesized with the existing oscillator and noise helpers; no audio files.

---

## 9. Roguelike mode

### 9.1 Mode model

- `RunMode = 'arcade' | 'roguelike'`.
- `newRun(seed, mode = 'arcade')`.
- `SimMode` becomes `'playing' | 'draft' | 'dying' | 'over'`.
- Title screen: Arcade / Roguelike / Settings. Arcade is highlighted by default. The existing Arcade Continue button remains for an Arcade checkpoint; Roguelike never shows Continue.
- Arcade keeps its best score (`recall.best.v1`) and wave checkpoint (`recall.save.v1`). Roguelike has no persistent best and never reads or writes the Arcade save; its results screen describes the current run only.
- Harness: `T.start({ seed, waves, mode })` defaults to Arcade, so every existing task check keeps its behavior. New tests pass `mode: 'roguelike'`.

### 9.2 Run flow

**Arcade:** unchanged.

`intro → fight → clear (1.1 s) → next wave`; death → `dying → over`; no draft, no pickups, no pigment.

**Roguelike:**

```text
title → mode select → wave intro → fight
  → wave clear (bonus + 1 pigment)
  → draft (pick 1 of 3; reroll; skip)
  → next wave intro → fight ...
  → death → painting reveal → results → title
```

- Wave clear bonus stays `100 × wave`, as in Arcade.
- The every-third-wave heal stays in both modes. Roguelike techniques and pickups add more sustain; balance is a later pass.
- **Roguelike:** death ends the run. `finishRun` freezes the score and stats, keeps the final state for the painting and results, and never writes to storage. `newRun` resets everything when the player starts again.
- **Arcade:** unchanged. It checkpoints at wave start (`recall.save.v1`) and offers Continue on the title.
- A new Roguelike run calls `newRun` with a fresh seed and the default baseline. No previous technique, pigment, buff or stat is carried over.

### 9.3 Draft

- 3 cards, always. There is no meta unlock that changes the hand size.
- Cards are filtered to techniques whose `minWave <= current wave` and whose stacks are below `maxStacks`; no duplicates in one draft.
- Rarity weights: common 60%, rare 30%, epic 10%; uniform within rarity.
- If fewer than 3 eligible cards remain, the draft shows what is available. If none remain, the draft offers only Skip.
- Actions:
  - Pick one card: free, applies it, starts the next wave after a 0.6 s beat.
  - Reroll: costs 3 pigment, then 4, then 5… within the same draft.
  - Skip: +2 pigment, starts the next wave.
- The draft pauses the simulation; the battlefield keeps rendering behind a DOM `<dialog>`.
- Card markup: a `<button>` with name, tag, rarity, blurb, stacks (`1/2`) and an `aria-label`. The first card is focused. Escape opens Settings rather than dismissing the draft.
- Keyboard: Tab/Shift+Tab, Enter/Space. Mouse/touch: click. Gamepad: D-pad or stick moves focus, A picks, B opens Settings; a small `MenuNav` adapter polls gamepad edges while a dialog is open.
- `aria-live` announces: “Wave N cleared. Choose a technique.” and “Picked Quick Draw, 2 of 3.”

### 9.4 Technique pool

A new `src/content/techniques.ts` would hold the pool. Every card is a `Partial<Mods>`; no bespoke code branches.

All cards are available from the start of a run; `minWave` controls when they can appear. A card leaves the draft pool once it reaches `maxStacks`.

| id | Name | Tag | Rarity | Max | Min wave | Effect per stack |
|---|---|---|---|---|---|---|
| `quick-draw` | Quick Draw | throw | common | 3 | 1 | throw speed +10% |
| `long-arm` | Long Arm | throw | common | 2 | 1 | outbound decel −15% |
| `piercer` | Piercer | throw | epic | 1 | 4 | outbound hits ignore heavy drag |
| `homecoming` | Homecoming | recall | common | 3 | 1 | return speed +12% |
| `truer-aim` | Truer Aim | recall | common | 2 | 1 | return steer +30% |
| `wide-catch` | Wide Catch | recall | rare | 2 | 3 | catch pad +8 px |
| `orbit` | Orbit | recall | rare | 2 | 3 | return acceleration +20% |
| `afterimage` | Afterimage | double | rare | 2 | 2 | double-tap window +0.15 s |
| `second-cut` | Second Cut | double | epic | 1 | 5 | return-leg hits +1 damage |
| `yellow-streak` | Yellow Streak | double | rare | 2 | 2 | double taps +25 score each |
| `light-feet` | Light Feet | move | common | 2 | 1 | move speed +8% |
| `featherfall` | Featherfall | move | common | 2 | 1 | dash cooldown −12% |
| `second-wind` | Second Wind | move | epic | 1 | 4 | +1 dash charge |
| `broad-blade` | Broad Blade | geometry | rare | 2 | 3 | blade radius +3 px |
| `ricochet` | Ricochet | geometry | rare | 2 | 3 | wall bounce keeps +8% more speed |
| `heavy-hand` | Heavy Hand | enemy | common | 2 | 1 | knockback +25% |
| `sunder` | Sunder | enemy | rare | 1 | 4 | return hits +1 damage to heavy enemies |
| `encore` | Encore | combo | rare | 2 | 2 | catches with 2+ hits grant +1 extra combo |
| `grace` | Grace | combo | epic | 1 | 5 | one empty catch per wave does not reset combo |
| `pigment-hunter` | Pigment Hunter | economy | common | 2 | 2 | pickups grant +1 pigment |

### 9.5 Modifiers

```ts
export interface Mods {
  throwSpeedPct?: number;     // +0.10
  throwDecelPct?: number;     // -0.15
  returnSpeedPct?: number;
  returnAccelPct?: number;
  steerPct?: number;
  bladeRadiusPx?: number;
  catchPadPx?: number;
  doubleTapWindowS?: number;
  returnDamage?: number;
  moveSpeedPct?: number;
  dashCooldownPct?: number;
  dashCharges?: number;
  knockbackPct?: number;
  heavyDragPct?: number;      // + = keeps more speed through a heavy
  comboPerCatch?: number;
  comboShield?: number;
  scorePct?: number;
  ignoreHeavyDrag?: boolean;
  sunderHeavy?: boolean;
}
```

- `computeMods(techniques, buffs)` sums each key; multiplicative stats are applied as `1 + pct`.
- Caps: throw and return +60%, move +40%, dash cooldown −50%, blade radius +6 px, catch pad +18 px, double-tap window +0.4 s, return damage +1, knockback +60%, heavy drag +0.3, combo per catch +2, combo shield 1, score +50%.
- `Sim` owns `mods`; recompute on pick, buff add, buff expiry and wave start (combo shield reset).
- `BladeWorld` and `PlayerWorld` expose `mods`; `EnemyWorld` exposes `mods` for knockback and damage.
- `EnemyLike.hit(dx, dy, world, damage = 1)`; return-leg hits pass `1 + mods.returnDamage`; `sunderHeavy` adds 1 against `heavy`.
- `Blade` applies mods at the point of use; no global mutable constants.
- Arcade uses the identity `Mods` object, so its math is unchanged.

### 9.6 Dash charges

Current `Player` has one dash on a cooldown. For `Second Wind`, the design adds:

- `dashChargesMax = 1 + mods.dashCharges`; `dashCharges = max` at run start and on refill.
- A dash spends one charge; charges recharge one at a time on the existing cooldown.
- HUD: small pips near the dash cooldown ring.
- If this proves too invasive, `Second Wind` becomes “instant dash refill” as a one-shot; the rest of the document is unaffected.

### 9.7 Run economy

Pigment is the only currency, and it exists only inside a run.

| Source or sink | Amount |
|---|---|
| Run start | 0 pigment |
| Wave clear | +1 pigment |
| `Pigment Drop` pickup | +3 pigment |
| `Pigment Cache` pickup | +6 pigment |
| `Pigment Hunter` technique | +1 pigment per pickup |
| Draft reroll | −3, then −4, then −5… in the same draft |
| Draft skip | +2 pigment |
| Death or new run | Reset to 0 |

The economy is deliberately small: a player who never collects a pigment pickup can still reroll once every few waves, and a player who invests in `Pigment Hunter` gets more rerolls but gives up a combat technique.

### 9.8 Run reset contract

`newRun(seed, mode)` must reset every piece of run state:

- Player position, velocity, HP, invulnerability, dash charges and cooldowns.
- Blade state, position, velocity, trail, `flightT`, `outboundHits` and `hitSet`.
- Enemies, shots, pending enemies and pickups.
- Score, combo, multiplier, stats and `doubleTaps`.
- Wave number, wave state, spawn groups and group clock.
- Techniques and their stacks.
- Pigment and active buffs.
- Computed modifiers.
- Draft state.
- The ink layer (the floor starts clean).
- The painting title's run seed, while the session-level last title is kept in memory to avoid an immediate repeat.

For Roguelike, no run field is read from storage. A reload constructs a fresh `newRun` only when the player starts from the title; it never resumes an old Roguelike run. Arcade's existing checkpoint is separate and unchanged.

---

## 10. In-run progression and run lifecycle

### 10.1 What progression means in this mode

Progression is the sequence of choices inside one run:

1. Wave clear → draft one technique.
2. Pickups → temporary buffs, pigment or health.
3. Pigment → rerolls at the next draft; skipping grants a little back.
4. Technique stacks → a build that changes how the blade behaves.
5. Death → the build ends; the painting remains as the record.

There is no second layer. No currency, card, character level or unlock survives the run.

### 10.2 What persists

| Thing | Persists? | Why |
|---|---|---|
| Arcade best score | Yes, as today (`recall.best.v1`) | Arcade is unchanged; a best score is a scoreboard, not progression. |
| Arcade wave checkpoint | Yes, as today (`recall.save.v1`) | Arcade is unchanged; the Roguelike mode never reads or writes it. |
| Settings | Yes (`recall.settings.v1`) | Volume, mute, shake, flashes and reduced motion are preferences, not run state. |
| Roguelike run state | No | The design is a roguelike: death or reload ends the run. |
| Roguelike best score | No | The results screen describes the current run; there is no persistent best. |
| Techniques, pigment, buffs | No | Reset by `newRun`. |
| Painting PNG | Only if the player exports it | A user-initiated download, not a game save. |
| Painting title | The current run only | Generated from the run seed; the session keeps the last title in memory to avoid repeats. |

### 10.3 Why no meta progression

- The game's core promise is mastery of one weapon. A meta-progression tree would move part of the power curve outside the run and weaken that promise.
- A fixed baseline makes runs comparable. Two players at wave 5 have the same underlying sword; their builds differ, not their account bonuses.
- The painting is the record. If progress carried over, the painting would document a grind rather than a run.
- No persistence in Roguelike removes save-scumming, profile validation and “continue” UI from the mode. Arcade keeps its checkpoint, so the two modes have different persistence contracts by design.

### 10.4 Variety without meta progression

The burden of variety falls on content and the draft, not on unlocks:

- 20 technique cards with different tags and rarities.
- 9 pickup types with buff, pigment and heal effects.
- 6 enemy archetypes, including the Shell.
- Seeded wave composition and spawn placement.
- A 3-card draft with rarity weights and a reroll economy.

If playtesting shows repetition, the answer is more cards and more wave modifiers, not a meta tree.

### 10.5 Run summary

The results screen shows:

- Mode, wave reached, score.
- Kills, top multiplier, double taps, pickups collected.
- The techniques picked, with stacks.
- The generated painting title.
- Actions: Again, Save painting, Share (if supported), Title.

No meta progression, no unlock progress, no “new best” for Roguelike.

---

## 11. Painting presentation

### 11.1 Reveal

On death, after the existing 1.1 s `dying` slowdown:

1. Fade the HUD.
2. Show the full arena painting for 1.4 s with the generated title in the letterbox margin, not over the ink.
3. Reveal the results panel.

Arcade would get the same cosmetic reveal; its gameplay, scoring and results content are unchanged. If strict Arcade parity is preferred, the reveal can be gated to Roguelike only. See [Open questions](#19-open-questions).

### 11.2 Generated title

The grammar lives in `src/core/painting.ts` because `core` cannot import `content`:

- Seeded by `run.seed ^ wave ^ kills`, so the same run always gets the same title.
- Patterns:
  - `"{adjective} {noun}"` — “Quiet Massacre”, “Unfinished Chorus”.
  - `"Study in {color}"` — “Study in Vermilion”.
  - `"Composition No. {n}"` — n from 1–99.
- Adjectives: quiet, vermilion, broken, patient, unfinished, bitter, bright, small, long, last.
- Nouns: massacre, study, composition, garden, chorus, argument, portrait, field, lesson, weather.
- Keep the last title in memory for the session; if the generated title matches, reroll once. Nothing is written to storage.
- Unit test: deterministic, non-empty, at most 40 characters, no immediate repeat.

### 11.3 Save and share

- `S` exports the PNG as today, now with title, mode, wave, score and seed in the margin. This is a file download, not a game save.
- `C` copies `title — mode, wave N, score X, seed S` to the clipboard; fallback floater if unavailable.
- `V` shares the PNG with `navigator.share({ files: [png] })` when supported; otherwise it downloads.
- No gallery in this pass. Storing thumbnails would be persistence, which this design excludes.

---

## 12. Future architecture map

This map describes the post-migration TypeScript tree. It is documentation of intended structure, not a change list.

| File | Intended responsibility |
|---|---|
| `src/core/config.ts` | `INK`, `DOUBLE_TAP_WINDOW`, pickup/draft/economy constants, mod caps. |
| `src/core/types.ts` | `RunMode`, `Mods`, `TechniqueDef`, `PickupDef`, `BuffDef`, `DraftCard`, `RunState`; semantic `InkLike`; `SfxLike` additions; `EnemyLike.hit(..., damage)`; `mods` on `BladeWorld`, `PlayerWorld`, `EnemyWorld`. |
| `src/core/blade.ts` | `flightT`, `outboundHits`, double-tap event, mods. |
| `src/core/player.ts` | Mods and dash charges; pickup collision stays in `Sim`. |
| `src/core/sim.ts` | Mode, pickups, draft state, double taps, mods, run reset. No profile or meta currency; the existing Arcade checkpoint path stays Arcade-only. |
| `src/core/run.ts` (new) | `computeMods`, `drawDraft`, pigment math, run reset helpers. |
| `src/core/waves.ts` | Unchanged for Arcade; optional mode scaling hook. |
| `src/content/enemies.ts` | Unchanged; Shell from the migration. |
| `src/content/pickups.ts` (new) | Pickup registry and buff table. |
| `src/content/techniques.ts` (new) | Technique registry. |
| `src/core/painting.ts` (new) | Seeded title grammar. |
| `src/platform/storage.ts` | Arcade best score, wave checkpoint and settings as today. Roguelike never reads or writes `recall.save.v1`; no profile. |
| `src/platform/audio.ts` | New synthesized cues. |
| `src/platform/input.ts` | Unchanged; the menu nav adapter lives in presentation. |
| `src/presentation/fx.ts` | Semantic ink methods, `streak`, pickup visuals, double-tap FX. |
| `src/presentation/ui.ts` | HUD pigment and buffs, painting reveal, results additions. |
| `src/presentation/menus.ts` | Title mode select, draft dialog, results actions, `MenuNav`. |
| `src/presentation/pickups.ts` (new) | Draw pickup diamonds and floor rings. |
| `src/main.ts` | Wire mode select, draft polling, run reset, painting share. No profile wiring; Arcade save wiring stays as today. |
| `test/*.test.ts` | New suites; existing suites stay green. |
| `docs/ROADMAP.md` (new) | This document, published. |
| `docs/DESIGN.md` | “The painting is the record”, “Two modes, one weapon”, double-tap definition, mode-specific persistence rationale. |
| `docs/CONTENT.md` | Add-pickup and add-technique checklists. |
| `docs/ARCHITECTURE.md` | New modules, data flow, run reset contract. |
| `README.md` | Modes, pickups, draft, controls, measured test counts. No meta-progression claims. |
| `CHANGELOG.md`, `src/version.ts` | Version entry and sync. |

Core would never import `platform` or `presentation`. The shell polls `sim.draft` and opens the DOM dialog; `core` only exposes data and pure functions.

---

## 13. Data flow

```text
Input ──▶ Sim.tick(dt)
            ├─ Player.update(mods)
            ├─ Blade.update(mods) ──▶ bladeSweep ──▶ kill/hurt/doubleTap ──▶ InkLike + SfxLike
            ├─ enemies update
            ├─ pickups spawn/collect ──▶ Buffs + pigment ──▶ recomputeMods
            ├─ wave clear ──▶ mode='draft' + DraftState
            └─ death ──▶ finishRun ──▶ painting / results (run state ends)
Main ──▶ reads Sim state ──▶ presentation/ui, menus, fx
```

- `sim.draft` is data; `presentation/menus` renders it.
- `sim.chooseTechnique(id)` applies the card and starts the next wave.
- `sim.collectPickup(p)` is internal; the harness can call `spawnPickup` and `collect` for tests.
- `newRun(seed, mode)` resets the Roguelike run; no storage read or write is involved. Arcade's checkpoint path is separate and unchanged.

---

## 14. Implementation sequence

Status: phases 0–4 are implemented in the working tree; the release is pending. The phases below record the sequence that was followed.

### Phase 0 — Documentation

- Publish this document as `portfolio/games/recall/docs/ROADMAP.md`.
- Add the design-pillar and ink sections to `docs/DESIGN.md`.
- Add pickup and technique authoring steps to `docs/CONTENT.md`.
- No code; `npm run verify` unchanged.
- Gate: docs are accurate to the migrated code; no public claims changed.

### Phase 1 — Ink grammar and double tap

- Semantic `InkLike` and `InkLayer`; audit every `ink.*` call.
- `flightT`, `outboundHits`, `onDoubleTap`, yellow streak, audio, stats.
- `ink.pickup` methods now; pickups arrive in Phase 2.
- Tests: double tap inside and outside the window, wrong enemy, re-throw, splitter, 30/60/144 fps; ink event recording.
- Gate: Arcade parity snapshot unchanged; a screenshot shows yellow on a double tap.

### Phase 2 — Mode plumbing and pickups

- `RunMode`, title mode select, harness `mode` option. Arcade's Continue remains; Roguelike never shows Continue and never reads `recall.save.v1`.
- Pickup registry, spawner, collection, buffs, pigment, HUD, audio.
- Tests: Arcade spawns zero pickups; Roguelike spawn constraints, determinism, buff expiry, currency, maximum 2.
- Gate: Arcade parity; a pickup is visible and collectable in a real run; the title menu passes a11y.

### Phase 3 — Draft, techniques and run reset

- `core/run.ts`, `content/techniques.ts`, `Mods` plumbing, draft dialog, reroll and skip, pause display.
- Run reset contract: `newRun` clears every Roguelike run field; no storage read or write. Arcade's checkpoint is unaffected.
- Tests: modifier math and caps, draft determinism and uniqueness, max stacks, reroll economy, run reset, and Roguelike reload-drops-run.
- Gate: a Roguelike run clears wave 1, drafts, picks, and the effect is measurable; a new run starts at the same baseline with no carryover.

### Phase 4 — Painting, share and polish

- Painting titles, reveal, export and share, balance pass, grayscale and contrast check, a11y, smoke matrix, release.
- Optional after the tree is stable: two new task-pack features (`feat-03-double-tap-ink`, `feat-04-pickup-drop`).
- Gate: `npm run verify` green; measured test counts; release v1.4.0, or v2.0.0 if the Roguelike update is marketed as a major release.

### Phase gates at a glance

| Phase | Code changes | Arcade risk | Persistence |
|---|---|---|---|
| 0 | None | None | None |
| 1 | Ink and double-tap detection | Low | None |
| 2 | Mode plumbing and pickups | Low; Arcade path untouched | None added; Arcade checkpoint unchanged |
| 3 | Draft, techniques, modifiers, run reset | Low; identity mods in Arcade | None added; Arcade checkpoint unchanged |
| 4 | Painting reveal and share | Cosmetic only | PNG export only, user-initiated |

---

## 15. Testing strategy

### 15.1 Unit suites (Node, against `src/*.ts`)

| Suite | Coverage |
|---|---|
| `blade.test.ts` | Homing at 30/60/144 fps, early recall, moving player, arena bounds. |
| `sim.test.ts` | Headless loop, brute combo, splitter wave, darter lock, determinism, Shell, checkpoint resume. |
| `roguelike.test.ts` | Double-tap window, pickups/buffs, draft/reroll/skip, `newRun` reset, modifier caps, painting titles and Arcade isolation. |
| `storage.test.ts` | Best score, settings, legacy mute, checkpoint validation. |
| `util.test.ts` | Swept collision, norm, expDecay, RNG. |
| `waves.test.ts` | Budgets, unlocks, debut wave, heavy waves, spawn groups. |

### 15.2 Harness additions

- `T.start({ seed, waves, mode })`.
- `T.spawnPickup(id, x, y)`, `T.pickupState()`, `T.collect()`.
- `T.draft()`, `T.pick(idOrIndex)`, `T.reroll()`, `T.skipDraft()`.
- `T.reset()` to call `newRun` and verify the baseline.
- `T.state().mode`, `.pigment`, `.buffs`, `.doubleTaps`, `.techniques`.
- `T.inkEvents()` if the browser FX is instrumented; otherwise unit tests cover ink.

### 15.3 Manual and browser matrix

- Arcade: current flow, score/combo/waves, no pickups, no draft, task pack green.
- Roguelike: title → mode → wave 1 → draft → pick → wave 2 → pickup → double tap → death → painting → results → new run; verify the new run has no techniques, pigment or buffs.
- Persistence: reload during a Roguelike run ends the run; Roguelike never shows Continue and writes no run save or profile. Arcade's checkpoint and Continue still work.
- A11y: axe on title/mode, pause, draft and results; keyboard-only draft; gamepad draft; reduced motion.
- Browsers: Chromium, Firefox and WebKit smoke; touch emulation for title and draft.
- Grayscale screenshot: black dominant, red reads as damage, yellow and blue distinguishable by shape.

### 15.4 Commands

```bash
cd portfolio/games/recall
npm ci
npm run check
npm run build
npm test
npm run tasks
npm run smoke
npm run a11y
npm run package
npm run verify
```

---

## 16. Documentation plan

### 16.1 Repository documents

- `docs/ROADMAP.md` — this document, published now that v1.3.1 is tagged.
- `docs/DESIGN.md` — add the four-color ink grammar, the double-tap definition, the mode-specific persistence rationale, and the line “Arcade is the scoreboard; Roguelike is the run; the painting is the record”.
- `docs/CONTENT.md` — add-pickup checklist (definition, weight, `minWave`, effect, render, test, first-pickup hint) and add-technique checklist (definition, tag, rarity, max stacks, `minWave`, mods, test).
- `docs/ARCHITECTURE.md` — new modules, data flow, run reset contract, dependency rules.
- `README.md` — modes, pickups, draft, controls, measured test counts. No meta-progression claims; describe Arcade's save and Roguelike's no-save contract separately.
- `CHANGELOG.md` and `src/version.ts` — version entry and sync.

### 16.2 Hub documents

- `portfolio/games/README.md` — release status and version once shipped.
- `docs/backlog.md` — FTH-044 is complete; update FTH-045 with the v1.3.1 measured counts and the note that the migration's run-save/Continue is Arcade-only; the Roguelike mode must not use it.
- `docs/handoffs.md` — exact commits, tests, browser results and limits after implementation.
- `make check` — stamps, copies, links and unit tests.

### 16.3 Public copy

Public copy (CLAIMS, profile, site, itch) is Claude-owned. This document prepares measured facts and page deltas; it does not edit the copy. Use “roguelike” only once the mode exists and the owner approves the wording.

### 16.4 Task pack

The existing six tasks must still fail before and pass after. `T.start()` must keep defaulting to Arcade. New tasks are added only after the module tree is stable, and they follow the patch-fidelity rules in `portfolio/games/STANDARD.md`.

---

## 17. Risks and guardrails

1. **Build on v1.3.1.** Do not reopen the TypeScript migration. Start from a green `npm run verify` on the current release.
2. **Arcade drift.** Default mode, golden trace, task-pack gate. Any Arcade behavior change is a bug, including its save/Continue.
3. **No persistence in Roguelike is deliberate.** Do not add a “just in case” save, profile, Continue button or meta currency to the Roguelike mode. Arcade already has its checkpoint and Continue; leave them alone. If a future design wants meta progression, it is a separate document.
4. **For Roguelike, reload is a run-ending action.** The mode's title card and first-run hint should say the run is lost on reload. A `beforeunload` warning while a Roguelike run is active is optional; it is not a save. Arcade's Continue is unaffected.
5. **Run variety without meta.** The draft pool, pickups, enemy mix and wave composition must carry replayability. If playtests feel samey, add cards or wave modifiers, not a progression tree.
6. **Ink mud.** Limit yellow and blue size and alpha; shape grammar; grayscale screenshot. Black stays dominant.
7. **Balance.** Caps and diminishing returns; no flat damage stacking beyond +1; playtest before release.
8. **Draft accessibility.** DOM dialog, focus, `aria-live`, keyboard and gamepad navigation; axe scan.
9. **Color vision.** Blue versus black and red versus yellow need shape and contrast checks, not color alone.
10. **Determinism.** Gameplay RNG is seeded; cosmetics may use `Math.random`. Pickups and drafts must be reproducible with `?seed=`.
11. **Scope.** Each phase is shippable. If time runs out, cut painting share, then optional card content, before touching Arcade.

---

## 18. Out of scope

- Persistent saves, run checkpoints, Continue buttons or resume-after-reload **in Roguelike**. Arcade keeps its existing checkpoint.
- A profile, meta progression, unlocks, permanent upgrades or cross-run currency.
- New weapons or a second attack button.
- Bosses, acts or a full campaign map (possible later, but a separate design).
- Online leaderboards, cloud saves or accounts.
- Pigment mixing or secondary colors.
- A gallery of past paintings.
- New enemy archetypes beyond the migration’s Shell.
- Rewriting task briefs or public marketing copy.

---

## 19. Open questions

These do not block the design, but they need an owner decision before the relevant phase.

| Question | Recommendation | Phase |
|---|---|---|
| Should Arcade get the painting reveal, or only Roguelike? | Both, because it is cosmetic and does not change scoring. Gate it if strict parity is preferred. | 4 |
| Should double taps award score in Arcade? | No. Yellow is feedback only in Arcade; Roguelike’s `Yellow Streak` adds score. | 1 |
| Should Arcade ever receive pickups? | No. Arcade stays the pure score mode. | 2 |
| Is three cards the right fixed draft size? | Yes. With no meta layer, three keeps the choice sharp and the run moving. | 3 |
| Should Roguelike show a session best in memory? | Optional and session-only. Recommendation: show the current run only; no persistent best. | 3 |
| Should the page warn before reloading during a Roguelike run? | Yes, a `beforeunload` warning while a Roguelike run is active; it is not a save. Arcade's Continue is unaffected. | 3 |
| Should the run be endless or have a final wave? | Endless for this pass. A win condition or boss is a separate design. | 4 |
| Should techniques cap at 8 picks or continue to the full pool? | Let the pool exhaust naturally through max stacks; if no cards remain, the draft offers Skip. | 3 |
| Should the painting title be editable? | No for this pass. The generated title is part of the record. | 4 |
| Should there be a local painting gallery? | Defer. It would add persistence and a browsing UI. | Later |
| Should `pigment` be awarded at wave clear? | Yes, +1, so a run can reroll even without pickup luck. | 3 |

---

## 20. Document control

| Item | Value |
|---|---|
| Document | Recall — Ink, Pickups and Roguelike |
| Type | Design and implementation record |
| Version | 5 |
| Last updated | 2026-10-28 |
| Owner | Fish |
| Prerequisite | TypeScript migration complete; Recall v1.3.1. No new run-save or profile work; Arcade's existing checkpoint stays. |
| Intended location | `portfolio/games/recall/docs/ROADMAP.md` |
| Related documents | `docs/DESIGN.md`, `docs/CONTENT.md`, `docs/ARCHITECTURE.md`, `portfolio/games/STANDARD.md`, `~/.commandcode/plans/games-public-ready.md` |
| Change process | Code, tests and docs change under the owner's implementation approval; public copy remains Claude-owned. |

### Change log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-10-28 | Initial design document for ink, pickups and a roguelite mode with meta progression. |
| 2 | 2026-10-28 | Reclassified the mode as a roguelike. Removed meta progression from the planned mode: no varnish, profile, Studio, unlocks, permanent upgrades, run save or Continue **in Roguelike**. All Roguelike progression is in-run and resets on death or reload. Arcade keeps its existing checkpoint and Continue. Added the run reset contract and the no-persistence rationale. |
| 3 | 2026-10-28 | Removed the bullet hell label. Added the genre positioning: wave-based arena action, boomerang action, twin-stick-style controls and, with the new mode, a single-weapon arena roguelike. Bullet hell is retained only as a comparison point. |
| 4 | 2026-10-28 | Reconciled the design with Recall v1.3.1: TypeScript migration complete, six enemies including Shell, Arcade save/Continue retained. Scoped no-persistence to Roguelike, fixed the pigment/skip wording, removed stale meta terms from the body, and renamed the section to “Why no meta progression”. |
| 5 | 2026-10-28 | Published as `docs/ROADMAP.md`; updated the status and current-state audit to the implemented working tree, mapped the actual modules and test suites, and recorded the remaining Phase 4 items (Web Share, full-screen reveal, release). |

### Next documentation step

The core implementation is in the working tree. Remaining documentation and release work:

1. Keep `README.md`, `docs/DESIGN.md`, `docs/CONTENT.md`, `docs/ARCHITECTURE.md` and `AGENTS.md` in sync with the code.
2. Decide the remaining Phase 4 items: Web Share, a full-screen painting reveal, and the release version (v1.4.0 or v2.0.0).
3. Release through `docs/RELEASING.md` after the owner approves the public copy handoff.
