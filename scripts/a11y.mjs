import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const server = createStaticServer({ root });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const problems = [];

page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

async function scan(label, target = page) {
  await target.addScriptTag({ path: resolve(root, 'node_modules/axe-core/axe.min.js') });
  const result = await target.evaluate(async () => {
    const axe = window.axe;
    return axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });
  });
  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      problems.push(`${label}: ${violation.id} (${violation.impact}) at ${node.target.join(' ')} — ${violation.help}`);
    }
  }
  console.log(`${label}: ${result.violations.length} violations, ${result.passes.length} checks passed`);
}

await page.goto(`${base}/index.html`);
await page.waitForFunction(() => !!window.__recall, undefined, { timeout: 15000 });
await scan('title');

await page.click('#settings-btn');
await page.waitForSelector('dialog[open]');
await scan('settings dialog');
await page.locator('#recall-volume').focus();
const volumeBefore = await page.locator('#recall-volume').inputValue();
await page.keyboard.press('ArrowRight');
const volumeAfter = await page.locator('#recall-volume').inputValue();
if (volumeBefore === volumeAfter) {
  problems.push('keyboard: ArrowRight does not move the settings volume slider');
}
await page.keyboard.press('Tab');
const focusAfterTab = await page.evaluate(() => document.activeElement?.id ?? '');
if (focusAfterTab === 'recall-volume') {
  problems.push('keyboard: Tab does not move focus inside the settings dialog');
}
await page.keyboard.press('Space');
const mutedAfterSpace = await page.locator('#recall-mute').isChecked();
if (!mutedAfterSpace) {
  problems.push('keyboard: Space does not toggle the settings mute checkbox');
}
await page.keyboard.press('Space');
await page.locator('dialog .actions button').last().click();

await page.mouse.click(480, 300);
await page.waitForFunction(() => window.__recall.state === 'playing', undefined, { timeout: 5000 });
const focusAfterStart = await page.evaluate(() => document.activeElement?.id ?? '');
if (focusAfterStart !== 'game') {
  problems.push(`keyboard: focus after starting a run is #${focusAfterStart}, not the canvas — game keys are ignored on other elements`);
}
await page.keyboard.press('Escape');
let pauseOpened = true;
try {
  await page.waitForSelector('dialog[open]', { timeout: 5000 });
} catch {
  pauseOpened = false;
  const state = await page.evaluate(() => window.__recall.state);
  problems.push(`keyboard: Escape did not open the pause dialog (state "${state}", focus on #${focusAfterStart}) — the key was swallowed`);
}
if (pauseOpened) {
  await scan('pause dialog');
  await page.locator('dialog .actions button').first().click();
}

await page.evaluate(() => {
  const g = window.__recall;
  g.player.hp = 1;
  g.player.invuln = 0;
  g.hurtPlayer(g.player.x + 5, g.player.y);
});
await page.waitForFunction(() => window.__recall.state === 'over', undefined, { timeout: 5000 });
await scan('game over');

const draftPage = await context.newPage();
draftPage.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
draftPage.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
await draftPage.goto(`${base}/index.html`);
await draftPage.waitForFunction(() => !!window.__recall, undefined, { timeout: 15000 });
await draftPage.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
await draftPage.reload();
await draftPage.waitForFunction(() => !!window.__recall, undefined, { timeout: 15000 });
await draftPage.click('#roguelike-btn');
await draftPage.waitForFunction(() => window.__recall.state === 'playing', undefined, { timeout: 5000 });
await draftPage.evaluate(() => {
  const g = window.__recall;
  g.player.invuln = 999;
  g.sim.waveState = 'fight';
  g.sim.groups = [];
  g.sim.enemies = [];
  g.sim.newEnemies = [];
  g.sim.waveLock = false;
});
await draftPage.waitForSelector('dialog[open]', { timeout: 5000 });
await scan('draft dialog', draftPage);
await draftPage.locator('.draft-card').first().click();
await draftPage.close();

await context.close();
await browser.close();
server.close();

if (problems.length) {
  console.error('a11y failed:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('a11y ok: no WCAG A/AA violations in the DOM overlays');
