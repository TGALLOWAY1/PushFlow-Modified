// Why does the menu stretch when rendered with the viewport as containing block? (fix-shape question)
import { chromium } from 'playwright';
const URL = 'http://localhost:5173';
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1000);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2000);
await page.locator('div[draggable="true"]:has(button[title="Color & group"])').nth(0).dragTo(page.locator('[title^="[4,3] empty"]').first());
await page.waitForTimeout(600);
await page.locator('[title^="[4,3] "]').first().click({ button: 'right' });
await page.waitForTimeout(400);
const out = await page.evaluate(() => {
  const menu = [...document.querySelectorAll('div.fixed.z-50')].find(d => d.textContent.includes('Pad ['));
  const c = menu.cloneNode(true);
  c.style.left = '0px'; c.style.top = '0px'; c.style.width = 'max-content'; c.style.visibility = 'hidden';
  document.body.appendChild(c);
  const maxContent = c.getBoundingClientRect().width;
  const kids = [...c.querySelectorAll('*')].map(el => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), w: Math.round(el.getBoundingClientRect().width), ws: getComputedStyle(el).whiteSpace, txt: el.textContent.slice(0, 30) }))
    .sort((a, b) => b.w - a.w).slice(0, 5);
  const bodyWs = getComputedStyle(document.body).whiteSpace;
  c.remove();
  return { maxContent: Math.round(maxContent), widest: kids, bodyWhiteSpace: bodyWs, menuWhiteSpace: getComputedStyle(menu).whiteSpace };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
