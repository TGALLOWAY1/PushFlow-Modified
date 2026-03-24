/**
 * Playwright screenshot script for PushFlow V3.
 *
 * Usage:  node scripts/take-screenshots.mjs
 *
 * Starts the Vite dev server, imports TEST MIDI 1, and captures
 * screenshots of the real workflow: library → workspace → generate → event analysis.
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCREENSHOTS_DIR = resolve(ROOT, 'docs/screenshots');
const TEST_MIDI = resolve(ROOT, 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid');

const DEV_SERVER_URL = 'http://localhost:5173';

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

async function screenshot(page, name, description) {
  const filepath = resolve(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${description} → ${name}.png`);
}

async function main() {
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
    console.log('Dev server is ready.\n');

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    // ── Step 1: Go to library and import MIDI via "Import MIDI" quick action ──
    console.log('Step 1: Import MIDI file from Project Library...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click "Import MIDI" in the Quick Actions sidebar — this creates a new project
    // and navigates to the editor. We need to handle the file input.
    // The Quick Actions "Import MIDI" button calls onNewProject() which navigates
    // to /project/{id}. The actual file import happens in the workspace timeline.
    // So let's click "+ New Performance" first, then import MIDI in the workspace.
    const newPerfBtn = page.locator('button:has-text("New Performance")').first();
    await newPerfBtn.click();
    await page.waitForURL('**/project/**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log('Step 2: Import TEST MIDI 1 into the workspace...');
    // Find the MIDI file input in the timeline area and upload
    const fileInput = page.locator('input[type="file"][accept=".mid,.midi"]').first();
    await fileInput.setInputFiles(TEST_MIDI);
    // Wait for MIDI to be parsed and streams to appear
    await page.waitForTimeout(3000);

    // ── Step 2: Screenshot the workspace with MIDI loaded ──
    console.log('Step 3: Capturing workspace with MIDI loaded...');
    await screenshot(page, '01-workspace-midi-loaded', 'Workspace with TEST MIDI 1 loaded');

    // ── Step 3: Go back to library and screenshot with the project visible ──
    console.log('Step 4: Capturing Project Library with project...');
    const libraryBtn = page.locator('button:has-text("Library")').first();
    await libraryBtn.click();
    await page.waitForURL('**/', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '02-project-library', 'Project Library with imported project');

    // ── Step 4: Go back into the project ──
    console.log('Step 5: Re-opening project...');
    // Try different selectors — could be a link or button
    const openBtn = page.locator('button:has-text("Open Layout Editor"), a:has-text("Open Layout Editor"), button:has-text("Resume Practice"), a:has-text("Resume Practice"), a[href*="/project/"]').first();
    await openBtn.click();
    await page.waitForURL('**/project/**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // ── Step 5: Click Generate and wait for results ──
    console.log('Step 6: Running Generate...');
    const generateBtn = page.locator('button:has-text("Generate")').first();
    if (await generateBtn.isVisible({ timeout: 5000 })) {
      await generateBtn.click();
      // Wait for generation to complete — watch for the button to become
      // enabled again or for candidates to appear
      await page.waitForTimeout(10000);

      // Check if still processing; wait longer if needed
      const stillProcessing = await page.locator('button:has-text("Generating")').isVisible().catch(() => false);
      if (stillProcessing) {
        console.log('  Still generating, waiting more...');
        await page.waitForTimeout(15000);
      }

      await screenshot(page, '03-workspace-after-generate', 'Workspace after Generate with candidates');
    } else {
      console.log('  Generate button not found, taking screenshot anyway...');
      await screenshot(page, '03-workspace-after-generate', 'Workspace (generate button not found)');
    }

    // ── Step 6: Switch to Layouts tab to see candidates ──
    console.log('Step 7: Showing Layouts/Candidates panel...');
    const layoutsTab = page.locator('button:has-text("Layouts")').first();
    if (await layoutsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await layoutsTab.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '04-candidates-panel', 'Candidates panel after generation');
    }

    // ── Step 7: Switch to Costs tab to see analysis ──
    console.log('Step 8: Showing Costs/Analysis panel...');
    const costsTab = page.locator('button:has-text("Costs")').first();
    if (await costsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await costsTab.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '05-costs-analysis', 'Performance costs and analysis');
    }

    // ── Step 8: Switch to Events tab and click an event for event detail ──
    console.log('Step 9: Showing Events panel with event analysis...');
    const eventsTab = page.locator('button:has-text("Events")').first();
    if (await eventsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventsTab.click();
      await page.waitForTimeout(1000);

      // Click on the first event moment to select it and show detail
      const eventRow = page.locator('[class*="cursor-pointer"]').first();
      if (await eventRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await eventRow.click();
        await page.waitForTimeout(1000);
      }
      await screenshot(page, '06-event-analysis', 'Event analysis view with selected event');
    }

    // ── Step 9: Timeline view screenshot ──
    console.log('Step 10: Capturing timeline view...');
    const timelineTab = page.locator('button:has-text("Timeline")').first();
    if (await timelineTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timelineTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '07-timeline-view', 'Timeline with performance events');

    await browser.close();
    console.log('\nDone! All screenshots saved to docs/screenshots/');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
