"""Headless smoke test: title -> play -> game over -> restart, failing on console errors.
Usage: npm start (in another terminal), then: python scripts/smoke.py <screenshot-dir>
Needs: pip install playwright && playwright install chromium"""
import sys, time, math
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
URL = 'http://localhost:8080/index.html?seed=1234'
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(URL)
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{OUT}/01-title.png')

    pg.mouse.move(600, 300)
    pg.mouse.click(480, 300)
    pg.wait_for_timeout(300)
    state = pg.evaluate('window.__recall.state')
    print('after click state:', state)

    # Play: circle with WASD, throw at the nearest enemy every so often.
    keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA']
    t0 = time.time()
    shots = 0
    i = 0
    while time.time() - t0 < 22:
        k = keys[i % 4]
        pg.keyboard.down(k)
        for _ in range(4):
            target = pg.evaluate('''() => { const g = window.__recall; if (!g.enemies) return null;
                const e = g.enemies.find(e => e.active); return e ? [e.x, e.y] : null; }''')
            if target:
                # map world -> page coords (viewport 960x540 means scale 1, no offset)
                pg.mouse.move(target[0], target[1])
                pg.mouse.click(target[0], target[1])
                shots += 1
            pg.wait_for_timeout(180)
        pg.keyboard.up(k)
        i += 1
        if i == 8:
            pg.screenshot(path=f'{OUT}/02-midgame.png')
        if pg.evaluate('window.__recall.state') != 'playing':
            break
    info = pg.evaluate('''() => { const g = window.__recall; return {state: g.state, wave: g.wave, score: Math.round(g.score), kills: g.stats.kills, mult: g.mult, bestMult: g.stats.bestMult, hp: g.player.hp, enemies: g.enemies.length, fps: Math.round(g.fps)}; }''')
    print('after play:', info, 'throws:', shots)
    pg.screenshot(path=f'{OUT}/03-later.png')

    # Force a game over to check that flow.
    pg.evaluate('() => { const g = window.__recall; if (g.state === "playing") { g.player.hp = 1; g.player.invuln = 0; g.hurtPlayer(g.player.x + 5, g.player.y); } }')
    pg.wait_for_timeout(2500)
    print('end state:', pg.evaluate('window.__recall.state'))
    pg.screenshot(path=f'{OUT}/04-gameover.png')

    pg.keyboard.press('KeyP')  # no-op on over screen
    pg.mouse.click(480, 300)
    pg.wait_for_timeout(300)
    print('restart state:', pg.evaluate('window.__recall.state'), 'wave', pg.evaluate('window.__recall.wave'))
    b.close()

print('ERRORS:' if errors else 'no console errors')
for e in errors:
    print(' ', e)
