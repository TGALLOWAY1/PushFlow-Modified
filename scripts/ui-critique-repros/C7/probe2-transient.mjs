// C7 probe 2: does the Active side stay a stub while the modal is open with a draft,
// and is there a transient stub window right after Discard (before re-analysis)?
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = '.ui-repro-out/C7';
const URL = process.env.URL || 'http://localhost:5173';
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
const log = [];
const note = (s) => { console.log(s); log.push(s); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
page.on('dialog', async d => { await d.dismiss(); });

async function waitIdle(extra = 1800) {
  await page.waitForTimeout(300);
  for (let i = 0; i < 180; i++) {
    const idle = await page.locator('select[title="Optimizer method"]').isVisible().catch(() => false);
    const stale = await page.locator('text=Analysis outdated').first().isVisible().catch(() => false);
    if (idle && !stale) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(extra);
  for (let i = 0; i < 180; i++) {
    if (await page.locator('select[title="Optimizer method"]').isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
}
const modal = () => page.locator('div.fixed.inset-6').first();
const activeCard = async () => (await modal().locator('div.grid.grid-cols-2.gap-4 > div').first().innerText()).replace(/\s+/g, ' ');

await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1200);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);
await page.locator('button:has-text("Suggest a starting layout")').first().click();
await waitIdle();
await page.locator('button[title="Make this layout the new Active Layout"]').click();
await waitIdle();
await page.locator('button[title="Generate optimized layouts"]').click();
await page.waitForTimeout(1000);
await waitIdle(2500);

// select Active + #1 (selection persists across Discard since it's workspace-local state)
await page.locator('div.border-emerald-500 div.w-3\\.5.h-3\\.5').first().click();
await page.locator('button[title="Select for comparison"]').nth(0).click();

// 1) with draft: open modal and keep it open 8s — does the Active side ever get analysed?
await page.locator('button:has-text("Compare (")').first().click();
for (const t of [200, 3000, 8000]) {
  await page.waitForTimeout(t === 200 ? 200 : t - (t === 3000 ? 200 : 3000));
  note(`WITH DRAFT modal open ~${t}ms: ${await activeCard()}`);
}
await page.screenshot({ path: resolve(OUT, 'p2-01-draft-modal-open-8s.png') });
await modal().locator('button:has-text("×")').first().click();
await page.waitForTimeout(300);

// 2) Discard then open Compare as fast as possible
await page.locator('button[title="Discard working changes"]').click();
await page.locator('button:has-text("Compare (")').first().click();
const t0 = Date.now();
note(`AFTER DISCARD +${Date.now() - t0}ms: ${await activeCard()}`);
await page.screenshot({ path: resolve(OUT, 'p2-02-discard-immediate.png') });
await page.waitForTimeout(3000);
note(`AFTER DISCARD +${Date.now() - t0}ms: ${await activeCard()}`);
await page.screenshot({ path: resolve(OUT, 'p2-03-discard-after-3s.png') });

writeFileSync(resolve(OUT, 'p2-log.txt'), log.join('\n'));
await browser.close();
