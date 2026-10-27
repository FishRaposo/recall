# Acceptance criteria

## Input sequence (by hand)

1. Start a run and wait for wave 5 (the first brute), or run with `?harness` and set up the scenario below.
2. Stand on the same horizontal line as a brute, about 200 px away.
3. Throw straight at it and let the blade come back on its own.
4. Next brute: throw straight through it and press throw again (recall) once the blade is past it.

## Expected visual outcome

- On each throw, the brute flashes white twice: once as the blade passes going out, once as it passes coming back.
- After step 3 the brute shows one remaining pip out of three; after step 4, the same.

## Verifiable state (`?harness`)

| Scenario | Setup | Input | Expected |
|---|---|---|---|
| Natural return | player (300, 290), brute (520, 290) | aim (1, 0), throw, step until caught | brute `maxHp − hp === 2` |
| Early recall | player (200, 290), brute (330, 290) with speed 0 | aim (1, 0), throw, step until blade x > brute x + 40, throw again, step until caught | brute `maxHp − hp === 2` |

Automated: `node tasks/verify.mjs bug-01-blade-hits-once`

## Must not change

- An enemy is still struck at most once per leg (a blade grinding through a brute must not hit it every frame).
- Wave clearing, scoring and the catch/combo rules are unchanged.
