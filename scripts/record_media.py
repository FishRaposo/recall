"""Scripted bot run that produces the README/itch media (video, late-game shot, game over, cover).
Usage: npm start, then: python scripts/record_media.py <out-dir>; convert the .webm with ffmpeg.
 The bot plays through real input (mouse + keys);
the only change is that the player can't be hurt, so the footage doesn't end early."""
import sys, time, math, random, base64
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
random.seed(3)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 960, 'height': 540}, record_video_dir=OUT, record_video_size={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.goto('http://localhost:8080/index.html?seed=2024')
    pg.wait_for_timeout(2500)
    pg.mouse.move(700, 320)
    pg.wait_for_timeout(600)
    pg.mouse.click(700, 320)
    pg.wait_for_timeout(200)
    pg.evaluate('() => { const g = window.__recall; g.hurtPlayer = () => {}; }')
    keys = {'up': 'KeyW', 'down': 'KeyS', 'left': 'KeyA', 'right': 'KeyD'}
    held = set()
    def set_keys(want):
        for k in list(held - want):
            pg.keyboard.up(k); held.discard(k)
        for k in want - held:
            pg.keyboard.down(k); held.add(k)
    t0 = time.time()
    last_dash = 0
    while time.time() - t0 < 48:
        s = pg.evaluate('''() => { const g = window.__recall; const p = g.player;
            const es = g.enemies.filter(e => e.active);
            es.sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y));
            return { p: [p.x, p.y], e: es.slice(0, 3).map(e => [e.x, e.y]), held: g.blade.state === 'held', wave: g.wave }; }''')
        px, py = s['p']
        want = set()
        if s['e']:
            ex, ey = s['e'][0]
            d = math.hypot(ex - px, ey - py)
            # Kite: keep ~180px from the nearest enemy, drift toward the middle.
            vx, vy = (px - ex) / (d + 1e-6), (py - ey) / (d + 1e-6)
            if d > 230: vx, vy = -vx * 0.4, -vy * 0.4
            vx += (480 - px) / 600
            vy += (290 - py) / 400
            if vx < -0.3: want.add(keys['left'])
            if vx > 0.3: want.add(keys['right'])
            if vy < -0.3: want.add(keys['up'])
            if vy > 0.3: want.add(keys['down'])
            if s['held']:
                # Aim through the cluster, a little past the target.
                tx, ty = ex + (ex - px) * 0.3, ey + (ey - py) * 0.3
                pg.mouse.move(tx, ty, steps=3)
                pg.mouse.down(); pg.mouse.up()
            if d < 60 and time.time() - last_dash > 1.0:
                pg.mouse.down(button='right'); pg.mouse.up(button='right')
                last_dash = time.time()
        set_keys(want)
        pg.wait_for_timeout(90)
    set_keys(set())
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/late.png')
    # End the run to capture the game-over screen and the painting.
    pg.evaluate('''() => { const g = window.__recall; delete g.hurtPlayer; g.player.hp = 1; g.player.invuln = 0; g.player.dashT = 0; g.hurtPlayer(g.player.x + 4, g.player.y); }''')
    pg.wait_for_timeout(2600)
    pg.screenshot(path=f'{OUT}/gameover.png')
    # Itch cover (630x500): the run's floor with the title over it.
    data = pg.evaluate('''() => { const g = window.__recall; const c = document.createElement('canvas'); c.width = 1260; c.height = 1000;
        const x = c.getContext('2d'); const sx = 480 - 315, sy = 290 - 250;
        x.drawImage(g.bg, sx * 2, sy * 2, 1260, 1000, 0, 0, 1260, 1000);
        x.drawImage(g.ink.canvas, sx * 2, sy * 2, 1260, 1000, 0, 0, 1260, 1000);
        x.scale(2, 2);
        x.fillStyle = 'rgba(239,232,218,0.82)'; x.fillRect(0, 170, 630, 160);
        x.fillStyle = '#1d1b1a'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = 'bold 92px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
        if ('letterSpacing' in x) x.letterSpacing = '12px';
        x.fillText('RECALL', 321, 236);
        x.strokeStyle = '#d9402b'; x.lineWidth = 5; x.lineCap = 'round';
        x.beginPath(); x.moveTo(120, 290); x.quadraticCurveTo(315, 278, 512, 286); x.stroke();
        return c.toDataURL('image/png'); }''')
    open(f'{OUT}/cover.png', 'wb').write(base64.b64decode(data.split(',')[1]))
    ctx.close()
    b.close()
print('done')
