# Acceptance criteria

## Input sequence (by hand)

1. Stand near the top wall. Throw up and to the right so the blade bounces off the wall into a mite.
2. Catch the blade, then throw straight at another mite.

## Expected visual outcome

- Step 1: the kill popup is red, shows double the usual number (20 at ×1), with a small red "bank shot" above it.
- Step 2: a normal ink popup (10 at ×1), no label.

## Verifiable state (`?harness`)

| Scenario | Setup | Input | Expected |
|---|---|---|---|
| Bank shot | player (300, 150), mite (450, 122) speed 0 | aim (1, −1), throw | at least one wall bounce before the kill; score gained = 2 × 10 × multiplier; a floater containing "bank" exists |
| Next throw, direct | same run after the catch: player (300, 290), mite (420, 290) speed 0 | aim (1, 0), throw | no bounce; score gained = 10 × multiplier; no "bank" floater |

Automated: `node tasks/verify.mjs feat-01-bank-shot`

## Must not change

- Direct kills, shot cuts, the pierce bonus and wave-clear bonus score exactly as before.
