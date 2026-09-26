/**
 * Regenerates the three README screenshots in docs/screenshots/readme/.
 *
 * Usage:  node scripts/take-screenshots.mjs
 *
 * Starts its own Vite dev server (or uses URL if set), opens the demo project
 * (TEST MIDI 1) at 1600×1000 and captures:
 *   editor-workspace.png   the workspace after "Suggest a starting layout"
 *   generated-layouts.png  candidate A, inspected read-only after Generate
 *   project-library.png    the Library with the demo project
 *
 * PW_CHROMIUM points at a Chromium binary if Playwright's bundled browser isn't
 * installed (in a cloud session: /opt/pw-browsers/chromium). PORT sets the dev
 * server's port (default 5199).
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs/screenshots/readme');
const PORT = process.env.PORT || '5199';
const URL = process.env.URL || `http://localhost:${PORT}/`;

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not answer at ${url} within ${timeoutMs} ms`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
  console.log(`  ✓ docs/screenshots/readme/${name}.png`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Run Vite's own binary, not `npm run dev`: killing npm leaves Vite running.
  const server = process.env.URL ? null : spawn(
    process.execPath,
    [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--port', PORT, '--strictPort'],
    { cwd: ROOT, stdio: 'ignore', env: { ...process.env, BROWSER: 'none' } },
  );

  try {
    await waitForServer(URL);
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
    const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
    page.on('dialog', dialog => dialog.accept());

    console.log('Opening the demo project…');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByTestId('library-open-demo').click();
    await page.waitForURL('**/project/**', { timeout: 30_000 });

    console.log('Suggesting a starting layout…');
    await page.getByRole('button', { name: 'Suggest a starting layout' }).click({ timeout: 30_000 });
    await page.getByTestId('save-status').and(page.locator('[data-save-status="saved"]')).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500); // let the scoring worker fill the Layout summary
    await screenshot(page, 'editor-workspace');

    console.log('Generating candidates…');
    await page.getByRole('button', { name: /^Generate( layouts from scratch)?$/ }).click();
    // After Generate the grid shows candidate A read-only (decision Q4).
    await page.getByTestId('state-bar').and(page.locator('[data-read-only="true"]')).waitFor({ timeout: 180_000 });
    await page.waitForTimeout(1500);
    await screenshot(page, 'generated-layouts');

    console.log('Back to the Library…');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await screenshot(page, 'project-library');

    await browser.close();
  } finally {
    server?.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
