// C6 repro: does selecting an event flip the feasibility banner to "Feasible - All events playable"?
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = '.ui-repro-out/C6';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const SCEN = process.env.SCEN || 'partial'; // partial | suggest
const NPLACE = parseInt(process.env.NPLACE || '3', 10);
const TAG = `${process.env.TAGP || SCEN}-${W}x${H}`;
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { console.log(s); log.push(s); };
const results = [];
let n = 0;
async function shot(page, name) {
  n += 1;
  const file = resolve(OUT, `${TAG}-${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  note(`SHOT ${file}`);
  return file;
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('dialog', d => d.accept());

// Read the right-hand panel: quick stats, feasibility badge, ergonomics rows, difficulty, event chip
async function readPanel() {
  return await page.evaluate(() => {
    const tabsBtn = [...document.querySelectorAll('button.pf-tab')].find(b => /^(Costs|Layouts)$/.test(b.textContent.trim()) && b.classList.contains('active'));
    const panel = tabsBtn ? tabsBtn.closest('.glass-panel') : document.body;
    const out = { tab: tabsBtn?.textContent.trim() ?? null };
    // quick stats
    const stats = {};
    panel.querySelectorAll('div.uppercase.tracking-wider').forEach(l => {
      const v = l.nextElementSibling?.textContent?.trim();
      stats[l.textContent.trim()] = v;
    });
    out.stats = stats;
    // badge: the div.font-medium.capitalize whose text is feasible/degraded/infeasible
    const lvl = [...panel.querySelectorAll('div.font-medium.capitalize')].find(d => /^(feasible|degraded|infeasible)$/i.test(d.textContent.trim()));
    if (lvl) {
      const box = lvl.parentElement.parentElement;
      out.badgeLevel = lvl.textContent.trim();
      out.badgeSummary = lvl.nextElementSibling?.textContent.trim();
      out.badgeClass = (box.className.match(/(green|amber|red)-500\/10/) || [])[1] || box.className;
    } else out.badgeLevel = null;
    // ergonomics rows
    const hdr = [...panel.querySelectorAll('h4.section-header')];
    const ergo = hdr.find(h => h.textContent.trim() === 'Ergonomics');
    out.ergonomics = ergo ? [...ergo.nextElementSibling.children].map(r => r.textContent.trim().replace(/\s+/g, ' ')) : null;
    out.mainBurden = [...panel.querySelectorAll('div')].find(d => d.textContent.startsWith('Main burden:') && d.children.length === 0)?.textContent ?? null;
    const diff = hdr.find(h => h.textContent.trim() === 'Difficulty');
    out.difficulty = diff ? diff.nextElementSibling?.textContent.trim().replace(/\s+/g, ' ') : null;
    const chip = [...panel.querySelectorAll('div.text-cyan-400')].find(d => /^Event \d+/.test(d.textContent.trim()));
    out.eventChip = chip ? chip.textContent.trim() : null;
    return out;
  });
}

async function record(label, extra = {}) {
  const r = await readPanel();
  const file = await shot(page, label);
  const rec = { label, ...extra, ...r, screenshot: file };
  results.push(rec);
  note(`STATE ${label}: ${JSON.stringify(r)}`);
  return rec;
}

async function tab(name) {
  await page.locator(`button.pf-tab:text-is("${name}")`).first().click();
  await page.waitForTimeout(400);
}

// ── Setup
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1200);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);

const soundRows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
const soundCount = await soundRows.count();
note(`INFO sounds in palette: ${soundCount}`);

if (SCEN === 'partial') {
  const targets = process.env.TARGETS ? JSON.parse(process.env.TARGETS) : [[3, 3], [3, 4], [4, 2], [4, 5], [2, 3], [2, 4], [5, 3], [5, 4]];
  for (let i = 0; i < Math.min(NPLACE, soundCount); i++) {
    const [r, c] = targets[i];
    await soundRows.nth(i).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first());
    await page.waitForTimeout(600);
  }
  note(`INFO placed ${Math.min(NPLACE, soundCount)} of ${soundCount} sounds manually`);
} else if (SCEN === 'suggest') {
  await tab('Layouts');
  await page.locator('button:has-text("Suggest a starting layout")').first().click();
  note('INFO clicked Suggest a starting layout');
}
await page.waitForTimeout(3000);

// ── Baseline: nothing selected
await tab('Costs');
await page.waitForTimeout(800);
const base = await record('costs-no-selection');

// Collect timeline pills
async function pills() {
  return await page.evaluate(() => [...document.querySelectorAll('button[title]')]
    .filter(b => /^\d+\.\d{3}s/.test(b.title))
    .map((b, i) => ({ i, title: b.title })));
}
const all = await pills();
note(`INFO timeline pills: ${all.length}; unplayable pills: ${all.filter(p => p.title.includes('Unplayable')).length}`);
const pillLoc = page.locator('button[title]').filter({ hasText: /.*/ });

async function clickPillWhere(pred, label) {
  const handle = await page.evaluateHandle((predSrc) => {
    const f = new Function('t', `return (${predSrc})(t)`);
    return [...document.querySelectorAll('button[title]')].find(b => /^\d+\.\d{3}s/.test(b.title) && f(b.title)) || null;
  }, pred.toString());
  const el = handle.asElement();
  if (!el) { note(`INFO no pill for ${label}`); return null; }
  const title = await el.getAttribute('title');
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await page.waitForTimeout(600);
  note(`INFO clicked pill (${label}): ${title}`);
  return title;
}

// 1) Click an UNPLAYABLE pill
const tU = await clickPillWhere(t => t.includes('Unplayable'), 'unplayable');
if (tU) await record('costs-unplayable-event-selected', { clicked: tU });

// 2) Click a PLAYABLE Hard pill (or any playable)
const tH = await clickPillWhere(t => /\| Hard/.test(t), 'hard');
if (tH) await record('costs-hard-event-selected', { clicked: tH });
const tP = await clickPillWhere(t => /\| [LR]-/.test(t) && !/Hard/.test(t), 'playable');
if (tP) await record('costs-playable-event-selected', { clicked: tP });

// 3) Keyboard stepping: Escape, then ArrowRight x3 (focus body first)
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await record('costs-after-escape');
await page.mouse.click(W / 2, 12);
for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); }
await record('costs-arrow-right-x3');

// 4) Layouts tab (ActiveLayoutSummary) with an unplayable event selected
await tab('Layouts');
if (tU) {
  await clickPillWhere(t => t.includes('Unplayable'), 'unplayable-layouts-tab');
}
await page.waitForTimeout(400);
await record('layouts-unplayable-event-selected');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await record('layouts-no-selection');

note(`ERRORS ${JSON.stringify(errs)}`);
writeFileSync(resolve(OUT, `${TAG}-results.json`), JSON.stringify({ base, results, errs }, null, 2));
writeFileSync(resolve(OUT, `${TAG}-log.txt`), log.join('\n'));
await browser.close();
