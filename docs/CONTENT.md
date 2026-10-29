# Recall — adding content

## Add an enemy

1. Add its id to `EnemyKind` in `src/core/types.ts`.
2. Add one `EnemyDef` to `src/content/enemies.ts`: radius, hp, points, cost, unlock wave, weight, knockback, note and speed function.
3. Add a class extending `Enemy` with `think(dt, world)` and `drawBody(ctx)`, or reuse an existing behaviour.
4. Add it to `createEnemy` in the same file.
5. If it needs to react to the blade before damage, add `onBladeHit(enemy, dx, dy, world)` to the catalog; return `'deflect'` to stop the hit and slow the blade, or `'damage'` for the normal path. The Shell uses this.
6. Add a wave test that proves it appears in its debut wave and never before.
7. Add a headless sim test for its behaviour.
8. The banner note comes from the catalog; no second copy is needed.

The wave composer derives its budget, unlocks and weights from the catalog, so there is no separate `ENEMY_COST`/`UNLOCK_WAVE` table to update.

## Shell pattern

The Shell (wave 6) is a front-plate enemy: `onBladeHit` sees `world.blade.state`; an outbound blade hitting the face returns `'deflect'`, while the return leg or a back hit returns `'damage'`. This keeps the branch in content, not in `Sim.bladeSweep`.

## Add a technique

1. Add a `TechniqueDef` to `src/content/techniques.ts`: id, name, tag, rarity, maxStacks, minWave, blurb and `mods`.
2. Use existing `Mods` keys. If the effect needs a new key, add it in `src/core/types.ts`, apply it where the entity reads it, and cap it in `src/core/run.ts`.
3. The draft filters by `minWave` and `maxStacks` and weights by rarity; no second table is needed.
4. Add a test for the modifier math or draft eligibility in `test/roguelike.test.ts`.

## Add a pickup

1. Add a `PickupDef` to `src/content/pickups.ts`: id, name, note, kind, weight, minWave, lifetime, color and effect.
2. A buff uses a `BuffDef` with `Mods`; pigment, heal and dash-refill are data fields.
3. Pickups spawn only in Roguelike. They are blue on **collection**; spawning one never stamps the floor.
4. Add a test for collection, effect expiry or the spawn constraints.

## Ink events

`InkLike` exposes `kill`, `hurt`, `death`, `doubleTap`, `pickup` and `motion`. Use the semantic method that matches the event; do not pass a raw color from core. The palette and shape rules live in `src/core/config.ts` and `src/presentation/fx.ts`.

## Change a wave

- `waveBudget(n)` and the heavy-wave multiplier live in `src/core/waves.ts`.
- `spawnGroups` controls group size and timing.
- Both are pure functions of `(n, rng, catalog)` and are covered by `test/waves.test.ts`.

## Add a visual effect or sound

- Effects are applied by the shell through `SimFx`; add a method there and implement it in `Game`.
- Audio methods live on `Sfx`; keep them synthesized, no audio files.
- Do not call `document` or `Audio` from `core/`.

## Rules

- One source of truth for enemy stats.
- Every new random choice goes through `state.rng`.
- The sim must stay headless and testable in Node.
- Task checks must keep failing before and passing after; regenerate the patch, never hand-edit it.
