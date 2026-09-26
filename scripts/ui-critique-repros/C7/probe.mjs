// C7 repro: Compare vs Active Layout with/without a Working/Test (draft) layout.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = '.ui-repro-out/C7';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const METHOD = process.env.METHOD || 'greedy';
const TAG = `${W}x${H}-${METHOD}`;
const MIDI = 'test/fixtures/midi/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

const log = [];
const results = {};
const note = (s) => { console.log(s); log.push(s); };
let n = 0;
async function shot(page, name, desc) {
  n += 1;
  const file = `${TAG}-${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: resolve(OUT, file) });
  note(`SHOT ${file} :: ${desc}`);
  return resolve(OUT, file);
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('dialog', async d => { note(`DIALOG ${d.type()}: ${d.message()}`); await d.dismiss(); });

async function waitIdle(label, extra = 1800) {
  // idle = optimizer <select> visible (toolbar shows it only when !isProcessing)
  await page.waitForTimeout(300);
  for (let i = 0; i < 180; i++) {
    const idle = await page.locator('select[title="Optimizer method"]').isVisible().catch(() => false);
    const stale = await page.locator('text=Analysis outdated').first().isVisible().catch(() => false);
    if (idle && !stale) break;
    await page.waitForTimeout(500);
  }
  // debounce is 1000ms; allow a re-analysis cycle to start and finish
  await page.waitForTimeout(extra);
  for (let i = 0; i < 180; i++) {
    const idle = await page.locator('select[title="Optimizer method"]').isVisible().catch(() => false);
    if (idle) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  note(`IDLE after ${label}`);
}

const hasDraft = async () => page.locator('button[title="Discard working changes"]').isVisible().catch(() => false);

const activeBox = () => page.locator('div.border-emerald-500 div.w-3\\.5.h-3\\.5').first();
const candBoxes = () => page.locator('button[title="Select for comparison"]');

async function clearCompareSelection() {
  // toggle off anything checked
  const ab = activeBox();
  if (await ab.locator('text=✓').count()) await ab.click();
  const boxes = candBoxes();
  const cnt = await boxes.count();
  for (let i = 0; i < cnt; i++) {
    const b = boxes.nth(i);
    const checked = await b.evaluate(el => el.className.includes('bg-purple') || el.textContent.includes('✓'));
    if (checked) await b.click();
  }
  await page.waitForTimeout(200);
}

async function openCompare(order, label) {
  await clearCompareSelection();
  for (const who of order) {
    if (who === 'active') await activeBox().click();
    else await candBoxes().nth(who).click();
    await page.waitForTimeout(150);
  }
  await page.locator('button:has-text("Compare (")').first().click();
  await page.waitForTimeout(800);
  const modal = page.locator('div.fixed.inset-6').first();
  const text = (await modal.innerText()).replace(/\s+/g, ' ');
  // count filled pads per grid within the modal
  const padTitles = await modal.locator('button[title^="["]').evaluateAll(els => els.map(e => e.getAttribute('title')));
  const grids = [padTitles.slice(0, 64), padTitles.slice(64, 128)];
  const filled = grids.map(g => g.filter(t => !/ empty$/.test(t)).length);
  const summary = (await modal.locator('div.whitespace-pre-line').first().innerText().catch(() => '')).trim();
  const cards = await modal.locator('div.grid.grid-cols-2.gap-4 > div').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  const draft = await hasDraft();
  const r = { label, order, draftExistsBehindModal: draft, filledPadsLeftGrid: filled[0], filledPadsRightGrid: filled[1], verdict: summary, cards, fullText: text.slice(0, 1600) };
  results[label] = r;
  note(`COMPARE[${label}] draft=${draft} filledPads L=${filled[0]} R=${filled[1]}`);
  note(`  verdict: ${summary}`);
  cards.forEach((c, i) => note(`  card${i}: ${c}`));
  await shot(page, `compare-${label}`, `Compare modal: ${label}`);
  await modal.evaluate(el => el.querySelector('.overflow-y-auto')?.scrollTo(0, 99999));
  await page.waitForTimeout(250);
  await shot(page, `compare-${label}-scrolled`, `Compare modal scrolled: ${label}`);
  await modal.locator('button:has-text("×")').first().click();
  await page.waitForTimeout(400);
  return r;
}

async function workspaceActiveSummary(label) {
  // Right-hand panel text: score of the displayed layout
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const m = t.match(/(Score[^A-Za-z]{0,20}[\d.]+%?)/g);
  note(`WORKSPACE[${label}] draft=${await hasDraft()} scoreSnippets=${JSON.stringify((m || []).slice(0, 6))}`);
}

// ── Setup: new project + import
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1200);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);
await page.locator('button:has-text("Suggest a starting layout")').first().click();
await waitIdle('suggest');
note(`INFO draft after suggest: ${await hasDraft()}`);
await page.locator('button[title="Make this layout the new Active Layout"]').click();
await waitIdle('promote suggested');
note(`INFO draft after promote: ${await hasDraft()}`);
await workspaceActiveSummary('active-analysed-before-generate');
await shot(page, 'active-before-generate', 'Active Layout (suggested, promoted) displayed and analysed, no draft');

// ── Generate
if (METHOD !== 'greedy') {
  await page.locator('select[title="Optimizer method"]').selectOption(METHOD);
  await page.waitForTimeout(300);
}
await page.locator('button[title="Generate optimized layouts"]').click();
await page.waitForTimeout(1000);
await waitIdle('generate', 2500);
const candCount = await candBoxes().count();
note(`INFO candidates after generate: ${candCount}; draft after generate: ${await hasDraft()}`);
await shot(page, 'after-generate', 'After Generate (candidate #1 applied as draft)');

// ── A: draft exists (from Generate) -> Active vs #1, Active first
await openCompare(['active', 0], 'A1-draft-active-vs-1');
// ── A2: reversed selection order (#1 checked first)
await openCompare([0, 'active'], 'A2-draft-1-vs-active');
// ── A3: Active vs #2
if (candCount > 1) await openCompare(['active', 1], 'A3-draft-active-vs-2');
// ── A4: control within draft state: #1 vs #2 (no Active involved)
if (candCount > 1) await openCompare([0, 1], 'A4-draft-1-vs-2');

// ── B: Discard -> no draft; Active displayed and re-analysed
await page.locator('button[title="Discard working changes"]').click();
// B0: open compare immediately (before 1s debounce re-analysis)
await page.waitForTimeout(100);
await openCompare(['active', 0], 'B0-immediately-after-discard');
await waitIdle('discard');
await workspaceActiveSummary('after-discard');
await openCompare(['active', 0], 'B1-nodraft-active-vs-1');

// ── C: make a draft IDENTICAL to Active: apply #1 -> Promote -> re-apply #1
await page.locator('button:has-text("Preview")').first().click().catch(async () => {
  // fall back to clicking the card
  await candBoxes().nth(0).locator('xpath=..').click();
});
await waitIdle('apply #1');
note(`INFO draft after apply #1: ${await hasDraft()}`);
await page.locator('button[title="Make this layout the new Active Layout"]').click();
await waitIdle('promote #1 draft');
note(`INFO draft after promote #1: ${await hasDraft()}; candidates now ${await candBoxes().count()}`);
await openCompare(['active', 1], 'C0-nodraft-active(#1)-vs-2');
await page.locator('button:has-text("Preview")').first().click();
await waitIdle('re-apply #1 (identical draft)');
note(`INFO draft after re-apply #1: ${await hasDraft()}`);
await openCompare(['active', 1], 'C1-identical-draft-active-vs-2');

// ── D: make the draft differ by one manual edit (drag a placed pad to an empty pad)
const placed = page.locator('[title^="["]:not([title*="empty"])').filter({ hasNot: page.locator('xpath=ancestor::div[contains(@class,"fixed")]') });
const firstPlaced = await page.locator('[title^="["]').evaluateAll(els => els.map(e => e.getAttribute('title')).filter(t => /^\[\d,\d\]/.test(t)).slice(0, 64));
note(`INFO grid titles sample: ${JSON.stringify(firstPlaced.slice(0, 12))}`);
const src = firstPlaced.find(t => !/empty/.test(t));
const dst = firstPlaced.find(t => /empty/.test(t) && /^\[[2-5],[2-5]\]/.test(t)) || firstPlaced.find(t => /empty/.test(t));
if (src && dst) try {
  const srcKey = src.slice(0, 5), dstKey = dst.slice(0, 5);
  await page.locator(`[title^="${srcKey}"]`).first().dragTo(page.locator(`[title^="${dstKey}"]`).first());
  note(`INFO dragged ${srcKey} -> ${dstKey}`);
  await waitIdle('manual edit');
  note(`INFO draft after manual edit: ${await hasDraft()}`);
  await openCompare(['active', 1], 'D1-manual-draft-active-vs-2');
} catch (e) { note(`FAIL manual edit: ${e.message.split('\n')[0]}`); }

writeFileSync(resolve(OUT, `${TAG}-results.json`), JSON.stringify(results, null, 2));
writeFileSync(resolve(OUT, `${TAG}-log.txt`), log.join('\n') + '\n\nCONSOLE ERRORS:\n' + errors.slice(0, 40).join('\n'));
await browser.close();
