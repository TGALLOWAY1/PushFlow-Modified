/**
 * Playwright screenshot script for PushFlow V3.
 *
 * Usage:  node scripts/take-screenshots.mjs
 *
 * Starts the Vite dev server, navigates to each app route,
 * and saves full-page screenshots to docs/screenshots/.
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCREENSHOTS_DIR = resolve(ROOT, 'docs/screenshots');

const DEV_SERVER_URL = 'http://localhost:5173';

// Routes to screenshot — name used for the filename
const ROUTES = [
  { name: '01-project-library', path: '/', description: 'Project Library (home page)' },
  { name: '02-optimizer-debug', path: '/optimizer-debug', description: 'Optimizer Debug Page' },
  { name: '03-constraint-validator', path: '/validator', description: 'Constraint Validator Page' },
  { name: '04-temporal-evaluator', path: '/temporal-evaluator', description: 'Temporal Evaluator Page' },
];

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready within ${timeoutMs}ms`);
}

async function main() {
  // Start the dev server
  console.log('Starting Vite dev server...');
  const server = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  let serverOutput = '';
  server.stdout.on('data', d => { serverOutput += d.toString(); });
  server.stderr.on('data', d => { serverOutput += d.toString(); });

  try {
    await waitForServer(DEV_SERVER_URL);
    console.log('Dev server is ready.');

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    // Take screenshots of static routes
    for (const route of ROUTES) {
      const page = await context.newPage();
      const url = `${DEV_SERVER_URL}${route.path}`;
      console.log(`Navigating to ${route.description} (${url})...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      // Give any animations/transitions time to settle
      await page.waitForTimeout(1000);

      const filepath = resolve(SCREENSHOTS_DIR, `${route.name}.png`);
      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`  Saved: ${filepath}`);
      await page.close();
    }

    // Try to open a demo project if one exists on the library page
    const page = await context.newPage();
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Click on a demo/project card if available — capture the project editor
    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForTimeout(2000);

      const editorPath = resolve(SCREENSHOTS_DIR, '05-project-editor.png');
      await page.screenshot({ path: editorPath, fullPage: true });
      console.log(`  Saved: ${editorPath}`);
    } else {
      // Try clicking a button that might create/open a project
      const createBtn = page.getByRole('button', { name: /create|new|demo|open/i }).first();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(2000);

        if (page.url().includes('/project/')) {
          const editorPath = resolve(SCREENSHOTS_DIR, '05-project-editor.png');
          await page.screenshot({ path: editorPath, fullPage: true });
          console.log(`  Saved: ${editorPath}`);
        }
      } else {
        console.log('  No project link or create button found — skipping project editor screenshot.');
      }
    }

    await page.close();
    await browser.close();
    console.log('\nDone! Screenshots saved to docs/screenshots/');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
