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

async function scan(label) {
  await page.addScriptTag({ path: resolve(root, 'node_modules/axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
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
await page.locator('dialog .actions button').last().click();

await page.mouse.click(480, 300);
await page.waitForFunction(() => window.__recall.state === 'playing', undefined, { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('dialog[open]');
await scan('pause dialog');
await page.locator('dialog .actions button').first().click();

await page.evaluate(() => {
  const g = window.__recall;
  g.player.hp = 1;
  g.player.invuln = 0;
  g.hurtPlayer(g.player.x + 5, g.player.y);
});
await page.waitForFunction(() => window.__recall.state === 'over', undefined, { timeout: 5000 });
await scan('game over');

await context.close();
await browser.close();
server.close();

if (problems.length) {
  console.error('a11y failed:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('a11y ok: no WCAG A/AA violations in the DOM overlays');
