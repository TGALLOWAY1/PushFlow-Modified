// C6 secondary probe: select a moment from the left Events tab list (not the timeline) on a partial layout.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = '.ui-repro-out/C6';
const URL = 'http://localhost:5173';
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const badge = () => page.evaluate(() => {
  const costs = [...document.querySelectorAll('button.pf-tab')].find(b => b.textContent.trim() === 'Costs');
  const panel = costs.closest('.glass-panel');
  const lvl = [...panel.querySelectorAll('div.font-medium.capitalize')].find(d => /^(feasible|degraded|infeasible)$/i.test(d.textContent.trim()));
  const un = [...panel.querySelectorAll('div.uppercase.tracking-wider')].find(d => d.textContent.trim() === 'Unplay');
  return { level: lvl?.textContent.trim(), summary: lvl?.nextElementSibling?.textContent.trim(), unplayTile: un?.nextElementSibling?.textContent.trim() };
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1000);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);
const rows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
for (const [i, [r, c]] of [[3, 3], [3, 4], [4, 2]].entries()) {
  await rows.nth(i).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first());
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2500);
await page.locator('button.pf-tab:text-is("Costs")').first().click();
await page.waitForTimeout(500);
const out = { before: await badge() };
// Left Events tab
await page.locator('button.pf-tab:text-is("Events"), button:text-is("Events")').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/events-tab-01-list.png` });
// click the 2nd moment row (beat list rows have a '#' column in font-mono w-8)
const momentRows = page.locator('span.font-mono.w-8.flex-shrink-0').filter({ hasText: /^\d+$/ });
out.momentRowCount = await momentRows.count();
await momentRows.nth(1).click();
await page.waitForTimeout(700);
out.afterEventsTabSelect = await badge();
await page.screenshot({ path: `${OUT}/events-tab-02-moment-selected.png` });
console.log(JSON.stringify(out, null, 2));
writeFileSync(`${OUT}/events-tab-results.json`, JSON.stringify(out, null, 2));
await browser.close();
