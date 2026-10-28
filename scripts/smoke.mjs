import { chromium, firefox, webkit } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const arg = (name, fallback) => {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const engines = { chromium, firefox, webkit };
const requested = arg('browser', 'all');
const names = requested === 'all' ? ['chromium', 'firefox', 'webkit'] : requested.split(',');
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

const server = createStaticServer({ root });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

function attach(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
}

async function waitReady(page) {
  await page.waitForFunction(() => !!window.__recall, undefined, { timeout: 15000 });
}

async function waitState(page, state) {
  await page.waitForFunction((s) => window.__recall.state === s, state, { timeout: 8000 });
}

let failed = false;

for (const name of names) {
  const engine = engines[name];
  const errors = [];
  if (!engine) {
    console.error(`unknown browser ${name}`);
    failed = true;
    continue;
  }
  let browser;
  try {
    browser = await engine.launch();
  } catch (e) {
    console.error(`FAIL ${name}: launch failed: ${e.message}`);
    console.error(`      run: npx playwright-core install ${name}`);
    failed = true;
    continue;
  }

  let step = 'load';
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage();
    attach(page, errors);
    const expect = (ok, message) => { if (!ok) errors.push(message); };

    await page.goto(`${base}/index.html`);
    await waitReady(page);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload();
    await waitReady(page);
    expect(await page.evaluate(() => window.__recall.state) === 'title', 'does not start on the title');
    if (shots) await page.screenshot({ path: join(shots, `${name}-title.png`) });

    step = 'settings';
    await page.click('#settings-btn');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Settings', 'settings dialog has the wrong title');
    await page.locator('#recall-reduced').check();
    await page.locator('dialog .actions button').last().click();
    await page.waitForSelector('dialog', { state: 'detached' });
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('recall.settings.v1') || '{}'));
    expect(settings.reducedMotion === true, 'reduced-motion setting did not persist');

    step = 'start and fight';
    await page.mouse.click(480, 300);
    await waitState(page, 'playing');
    await page.waitForTimeout(2400);
    const started = await page.evaluate(() => ({ wave: window.__recall.wave, enemies: window.__recall.enemies.length, waveState: window.__recall.waveState }));
    expect(started.wave === 1 && started.enemies > 0, `wave did not start (${JSON.stringify(started)})`);

    step = 'move and throw';
    await page.evaluate(() => {
      const g = window.__recall;
      g.player.x = 300;
      g.player.y = 290;
      g.player.invuln = 2;
      g.sim.hitstop = 0;
    });
    await page.waitForTimeout(120);
    const before = await page.evaluate(() => ({ x: window.__recall.player.x, y: window.__recall.player.y }));
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowRight');
    const moved = await page.evaluate(() => window.__recall.player.x);
    expect(moved > before.x + 10, `keyboard move did not move the player (${before.x} -> ${moved})`);
    const target = await page.evaluate(() => {
      const g = window.__recall;
      const p = g.player;
      const es = g.enemies.filter((e) => e.active);
      es.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      return es[0] ? { x: es[0].x, y: es[0].y } : null;
    });
    if (target) {
      await page.mouse.move(target.x, target.y);
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(300);
    }
    const throwState = await page.evaluate(() => ({ state: window.__recall.blade.state, hits: window.__recall.blade.flightHits }));
    expect(throwState.state !== 'held' || throwState.hits > 0, 'throw did not leave the hand or hit');
    if (shots) await page.screenshot({ path: join(shots, `${name}-play.png`) });

    step = 'pause';
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Paused', 'pause dialog has the wrong title');
    await page.locator('dialog .actions button').first().click();
    await page.waitForSelector('dialog', { state: 'detached' });
    expect(await page.evaluate(() => window.__recall.state) === 'playing', 'did not resume after pause');

    step = 'save and continue';
    expect(await page.evaluate(() => !!localStorage.getItem('recall.save.v1')), 'wave checkpoint was not saved');
    await page.reload();
    await waitReady(page);
    await page.waitForFunction(() => window.__recall.state === 'title', undefined, { timeout: 5000 });
    expect(await page.locator('#continue-btn').isVisible(), 'continue button is not visible with a save');
    await page.click('#continue-btn');
    await waitState(page, 'playing');
    expect(await page.evaluate(() => window.__recall.wave) >= 1, 'continue did not restore a wave');

    step = 'death and restart';
    await page.evaluate(() => {
      const g = window.__recall;
      g.player.hp = 1;
      g.player.invuln = 0;
      g.hurtPlayer(g.player.x + 5, g.player.y);
    });
    await waitState(page, 'over');
    expect(await page.evaluate(() => window.__recall.overT) >= 0, 'game over did not settle');
    await page.waitForTimeout(900);
    await page.keyboard.press('KeyR');
    await waitState(page, 'playing');
    expect(await page.evaluate(() => window.__recall.wave) === 1, 'restart did not begin at wave 1');
    await context.close();

    step = 'mobile';
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const mp = await mobile.newPage();
    attach(mp, errors);
    await mp.goto(`${base}/index.html`);
    await waitReady(mp);
    await mp.touchscreen.tap(195, 420);
    await waitState(mp, 'playing');
    const touchStart = await mp.evaluate(() => window.__recall.player.x);
    await mp.evaluate(() => {
      const c = document.getElementById('game');
      const opts = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, buttons: 1, clientX: 150, clientY: 420 };
      c.dispatchEvent(new PointerEvent('pointerdown', opts));
      c.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 280, clientY: 420 }));
    });
    await mp.waitForTimeout(350);
    await mp.evaluate(() => {
      const c = document.getElementById('game');
      const opts = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 280, clientY: 420 };
      c.dispatchEvent(new PointerEvent('pointerup', opts));
    });
    const touchEnd = await mp.evaluate(() => window.__recall.player.x);
    expect(touchEnd > touchStart + 10, `touch drag did not move the player (${touchStart} -> ${touchEnd})`);
    await mp.tap('#throw-btn');
    await mp.waitForTimeout(220);
    const touchThrow = await mp.evaluate(() => ({ state: window.__recall.blade.state, hits: window.__recall.blade.flightHits }));
    expect(touchThrow.state !== 'held' || touchThrow.hits > 0, 'touch throw button did not throw');
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(!overflow, 'page overflows horizontally at 390px');
    await mobile.close();
  } catch (e) {
    errors.push(`journey failed at ${step}: ${String(e.message).split('\n')[0]}`);
  } finally {
    await browser.close();
  }

  if (errors.length) {
    failed = true;
    console.error(`FAIL ${name}`);
    for (const error of errors) console.error(`      ${error}`);
  } else {
    console.log(`ok   ${name}: title, settings, wave, move, throw, pause, save/continue, death/restart, touch drag/throw`);
  }
}

server.close();
process.exit(failed ? 1 : 0);
