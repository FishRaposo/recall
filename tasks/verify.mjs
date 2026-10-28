// Verifies that every task in the pack is solvable and that its check means something.
//
// For each task:
//   1. copy the game into a temp folder and apply starting-state.patch (if any) → the task as handed out
//   2. compile the TypeScript source                                        → the built game
//   3. run the task's check in headless Chromium                            → must FAIL
//   4. apply reference-solution.patch                                       → the solved task
//   5. compile and run the check again                                      → must PASS
//
// A check that passes on the starting state proves nothing, so FAIL→PASS is the only green result.
//
// Usage: node tasks/verify.mjs [task-id ...]     (no ids = every task)
// Chromium: uses Playwright's own install (npx playwright-core install chromium), or CHROMIUM_PATH.

import { readdirSync, existsSync, mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS = join(ROOT, 'tasks');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');

function serve(dir) {
  const server = createServer((req, res) => {
    const path = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(dir) || !existsSync(path)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function applyPatch(dir, patch) {
  execFileSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: dir, stdio: 'pipe' });
}

function build(dir) {
  execFileSync(process.execPath, [TSC, '-p', 'tsconfig.json'], { cwd: dir, stdio: 'pipe' });
  cpSync(join(dir, 'styles.css'), join(dir, 'dist/styles.css'));
}

async function runCheck(browser, dir, checkFile) {
  const server = await serve(dir);
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?harness`);
    await page.waitForFunction(() => window.__recall && window.__recall.test);
    const check = (await import(pathToFileURL(checkFile).href)).default;
    const result = await check(page);
    if (errors.length) return { pass: false, details: `page error: ${errors[0]}` };
    return result;
  } catch (e) {
    return { pass: false, details: `check crashed: ${e.message.split('\n')[0]}` };
  } finally {
    await page.close();
    server.close();
  }
}

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(TASKS).filter((d) => existsSync(join(TASKS, d, 'check.mjs'))).sort();

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let allGood = true;

for (const id of ids) {
  const t = join(TASKS, id);
  const meta = JSON.parse(readFileSync(join(t, 'task.json'), 'utf8'));
  const work = mkdtempSync(join(tmpdir(), `recall-${id}-`));
  cpSync(join(ROOT, 'index.html'), join(work, 'index.html'));
  cpSync(join(ROOT, 'styles.css'), join(work, 'styles.css'));
  cpSync(join(ROOT, 'package.json'), join(work, 'package.json'));
  cpSync(join(ROOT, 'tsconfig.json'), join(work, 'tsconfig.json'));
  cpSync(join(ROOT, 'src'), join(work, 'src'), { recursive: true });

  let before;
  let after;
  try {
    if (existsSync(join(t, 'starting-state.patch'))) applyPatch(work, join(t, 'starting-state.patch'));
    build(work);
    before = await runCheck(browser, work, join(t, 'check.mjs'));
    applyPatch(work, join(t, 'reference-solution.patch'));
    build(work);
    after = await runCheck(browser, work, join(t, 'check.mjs'));
  } catch (e) {
    const detail = e.stderr ? String(e.stderr) : e.message;
    before ??= { pass: true, details: `patch/build failed: ${detail.split('\n')[0]}` };
    after ??= { pass: false, details: `patch/build failed: ${detail.split('\n')[0]}` };
  }
  rmSync(work, { recursive: true, force: true });

  const good = !before.pass && after.pass;
  allGood &&= good;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${id.padEnd(28)} ${meta.kind.padEnd(8)} starting state: ${before.pass ? 'PASS' : 'fail'}  ·  solution: ${after.pass ? 'pass' : 'FAIL'}`);
  console.log(`      before: ${before.details}`);
  console.log(`      after:  ${after.details}`);
}

await browser.close();
process.exit(allGood ? 0 : 1);
