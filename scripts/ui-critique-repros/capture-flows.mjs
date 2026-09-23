// Flow-by-flow screenshot capture for UI critique.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = process.env.OUT || '.ui-repro-out/shots';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { console.log(s); log.push(s); };
let n = 0;
async function shot(page, name, desc) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: resolve(OUT, file) });
  note(`SHOT ${file} :: ${desc}`);
}
async function tryStep(label, fn) {
  try { await fn(); } catch (e) { note(`FAIL ${label}: ${e.message.split('\n')[0]}`); }
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR ' + e.message));
page.on('dialog', async d => { note(`DIALOG ${d.type()}: ${d.message()}`); await d.accept(); });

// ── Flow 6a: library empty
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await shot(page, 'library-empty', 'Project library, first run (no projects)');

// ── Flow 1: new project + import MIDI
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1500);
await shot(page, 'workspace-new-empty', 'Brand-new project workspace before any import');

await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(3000);
await shot(page, 'workspace-after-import', 'Workspace right after importing TEST MIDI 1 (empty grid)');

// Right panel costs tab while empty
await tryStep('costs-empty', async () => {
  await page.locator('button.pf-tab:has-text("Costs")').first().click();
  await page.waitForTimeout(500);
  await shot(page, 'costs-tab-empty-grid', 'Costs tab while grid is still empty');
  await page.locator('button.pf-tab:has-text("Layouts")').first().click();
  await page.waitForTimeout(300);
});

// ── Flow 2: manual arrangement via drag
const soundRows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
const soundCount = await soundRows.count();
note(`INFO sound rows in palette: ${soundCount}`);
const targets = [[3, 3], [3, 4], [4, 2], [4, 5]];
for (let i = 0; i < Math.min(3, soundCount); i++) {
  const [r, c] = targets[i];
  await tryStep(`drag sound ${i}`, async () => {
    const pad = page.locator(`[title^="[${r},${c}] empty"]`).first();
    await soundRows.nth(i).dragTo(pad);
    await page.waitForTimeout(700);
  });
}
await shot(page, 'manual-3-placed', 'After manually dragging 3 sounds onto pads (Working/Test Layout)');

// hover a placed pad for tooltip
await tryStep('context menu', async () => {
  const placed = page.locator('[title^="[3,3] "]').first();
  await placed.click({ button: 'right' });
  await page.waitForTimeout(500);
  await shot(page, 'pad-context-menu', 'Right-click context menu on a placed pad');
  await page.keyboard.press('Escape');
  await page.mouse.click(5, H - 5);
  await page.waitForTimeout(300);
});

// pad click selection
await tryStep('pad click', async () => {
  await page.locator('[title^="[3,4] "]').first().click();
  await page.waitForTimeout(500);
  await shot(page, 'pad-clicked', 'After left-clicking a placed pad');
});

// Swap: drag pad 3,3 to 3,4
await tryStep('pad swap drag', async () => {
  await page.locator('[title^="[3,3] "]').first().dragTo(page.locator('[title^="[3,4] "]').first());
  await page.waitForTimeout(600);
  await shot(page, 'pad-swap', 'After dragging one placed pad onto another (swap)');
});

// Costs tab with partial layout
await tryStep('costs-partial', async () => {
  await page.locator('button.pf-tab:has-text("Costs")').first().click();
  await page.waitForTimeout(800);
  await shot(page, 'costs-tab-partial-layout', 'Costs tab with only 3 of 7 sounds placed');
  await page.locator('button.pf-tab:has-text("Layouts")').first().click();
  await page.waitForTimeout(300);
});

// Discard to get back empty, then suggest
await tryStep('discard', async () => {
  await page.locator('button:has-text("Discard")').first().click();
  await page.waitForTimeout(600);
  await shot(page, 'after-discard', 'After clicking Discard on the working layout');
});

// ── Flow 3a: suggest starting layout
await tryStep('suggest', async () => {
  await page.locator('button:has-text("Suggest a starting layout")').first().click();
  await page.waitForTimeout(2500);
  await shot(page, 'suggested-layout', 'After clicking "Suggest a starting layout"');
});

// Toolbar menus
await tryStep('optimizer select', async () => {
  const opts = await page.locator('select[title="Optimizer method"] option').allTextContents();
  const strat = await page.locator('select[title="Layout seeding strategy"] option').allTextContents().catch(() => []);
  note(`INFO optimizer options: ${opts.join(' | ')} ; greedy strategies: ${strat.join(' | ')}`);
});

// Settings gear
await tryStep('settings gear', async () => {
  const gear = page.locator('button[title*="ettings"]').last();
  await gear.click();
  await page.waitForTimeout(500);
  await shot(page, 'settings-gear-open', 'Settings gear popover open');
  // enable show finger assignment if present
  const fa = page.locator('text=Show Finger Assignment').first();
  if (await fa.isVisible().catch(() => false)) {
    await fa.click();
    await page.waitForTimeout(400);
    await shot(page, 'settings-finger-assignment-on', 'Show Finger Assignment toggled on');
  }
  await page.keyboard.press('Escape');
  await page.mouse.click(W / 2, 20);
  await page.waitForTimeout(300);
});

// ── Flow 3b: Generate
await tryStep('generate', async () => {
  await page.locator('button:has-text("Generate")').first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'generating-in-progress', 'While Generate is running');
  for (let i = 0; i < 60; i++) {
    const busy = await page.locator('text=/Generating|Analyzing/').first().isVisible().catch(() => false);
    if (!busy) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);
  await shot(page, 'after-generate-layouts', 'After Generate completes — Layouts tab');
});

// Scroll layouts panel to see candidates & trace
await tryStep('scroll layouts', async () => {
  const panel = page.locator('div.overflow-y-auto.flex-1.min-h-0').last();
  await panel.evaluate(el => el.scrollTo(0, el.scrollHeight / 2));
  await page.waitForTimeout(400);
  await shot(page, 'layouts-scrolled-mid', 'Layouts panel scrolled to middle (candidates)');
  await panel.evaluate(el => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, 'layouts-scrolled-bottom', 'Layouts panel scrolled to bottom (trace)');
  await panel.evaluate(el => el.scrollTo(0, 0));
});

// Click first candidate card
await tryStep('candidate select', async () => {
  const cards = page.locator('text=/Candidate|Option|#1/').first();
  note(`INFO candidate text sample: ${await cards.textContent().catch(() => 'none')}`);
});

// Compare checkboxes
await tryStep('compare', async () => {
  const boxes = page.locator('input[type="checkbox"]');
  const cnt = await boxes.count();
  note(`INFO checkboxes: ${cnt}`);
  const cmpBtns = page.locator('button[title*="ompare"]');
  note(`INFO compare-titled buttons: ${await cmpBtns.count()}`);
});

// Costs tab after generate
await tryStep('costs after generate', async () => {
  await page.locator('button.pf-tab:has-text("Costs")').first().click();
  await page.waitForTimeout(800);
  await shot(page, 'costs-after-generate', 'Costs tab after generation');
  const chart = page.locator('text=Event Difficulty Chart').first();
  if (await chart.isVisible().catch(() => false)) {
    await chart.click();
    await page.waitForTimeout(600);
    await shot(page, 'costs-difficulty-chart', 'Event Difficulty Chart expanded');
  }
});

// Learn more modal
await tryStep('learn more', async () => {
  await page.locator('button.pf-tab:has-text("Layouts")').first().click();
  await page.waitForTimeout(300);
  await page.locator('text=Learn more').first().click();
  await page.waitForTimeout(700);
  await shot(page, 'learn-more-modal', 'Learn More modal');
  const tabs = await page.locator('[role="dialog"] button, .fixed button').allTextContents();
  note(`INFO learn-more buttons: ${tabs.slice(0, 20).join(' | ')}`);
  for (const t of ['App Flow', 'Cost Factors', 'Constraints']) {
    await page.locator(`.fixed button:has-text("${t}")`).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `learn-more-${t.replace(/ /g, '-').toLowerCase()}`, `Learn More modal — ${t} tab`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const stillOpen = await page.locator('text=Why PushFlow Matters, .fixed >> text=Learn More').first().isVisible().catch(() => false);
  note(`INFO learn-more still open after Escape: ${stillOpen}`);
  await page.mouse.click(60, 500);
  await page.waitForTimeout(400);
});

// Compare two candidates + preview
await tryStep('compare flow', async () => {
  const sel = page.locator('button[title="Select for comparison"]');
  note(`INFO compare select buttons: ${await sel.count()}`);
  await sel.nth(0).click();
  await sel.nth(1).click();
  await page.waitForTimeout(300);
  await shot(page, 'two-selected-for-compare', 'Two candidates selected for comparison');
  await page.locator('button:has-text("Compare (")').first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'compare-modal', 'Compare modal with two candidates');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closeBtn = page.locator('.fixed button:has-text("Close"), .fixed button:has-text("×")').first();
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); note('INFO closed compare via button'); }
  else note('INFO compare closed via Escape (or no close button)');
  await page.waitForTimeout(400);
});
await tryStep('preview candidate 2', async () => {
  const prev = page.locator('button:has-text("Preview")');
  note(`INFO preview buttons: ${await prev.count()}`);
  await prev.nth(1).click();
  await page.waitForTimeout(1000);
  await shot(page, 'candidate-2-previewed', 'After clicking Preview on candidate #2');
});

// ── Flow 4: Events + onion skin
await tryStep('events tab', async () => {
  await page.locator('button.pf-tab:has-text("Events")').first().click();
  await page.waitForTimeout(600);
  await shot(page, 'events-tab', 'Events tab list');
  const rows = page.locator('div.overflow-y-auto.space-y-0\\.5 > *');
  note(`INFO event rows: ${await rows.count()}`);
  await rows.nth(4).click();
  await page.waitForTimeout(700);
  await shot(page, 'event-selected', 'An event selected (grid + timeline sync)');
  await page.locator('button[title="Show previous/next event layers on grid"]').first().click();
  await page.waitForTimeout(700);
  await shot(page, 'onion-skin-on', 'Onion skin enabled with event selected');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await shot(page, 'onion-skin-arrow-next', 'After pressing ArrowRight (next event?)');
});

// Click a timeline note
await tryStep('timeline note click', async () => {
  const pill = page.locator('div:text-is("L2"), span:text-is("L2")').last();
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
    await page.waitForTimeout(500);
    await shot(page, 'timeline-note-clicked', 'After clicking a note in the timeline');
  } else note('INFO no timeline pill with finger title');
});

// ── Flow 7: rehearse
await tryStep('play', async () => {
  await page.locator('button.pf-tab:has-text("Sounds")').first().click();
  await page.locator('button:has-text("PLAY")').first().click();
  await page.waitForTimeout(1800);
  await shot(page, 'playing', 'Playback running (rehearsal)');
  await page.waitForTimeout(2500);
  await shot(page, 'playing-later', 'Playback ~4s in');
  const stop = page.locator('button:has-text("STOP")').first();
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await page.waitForTimeout(400);
});

// Promote
await tryStep('promote', async () => {
  const p = page.locator('button:has-text("Promote")').first();
  if (await p.isVisible().catch(() => false)) {
    await p.click();
    await page.waitForTimeout(1500);
    await shot(page, 'after-promote', 'After clicking Promote in toolbar');
  } else note('INFO Promote not visible');
});

// ── Composer & presets
await tryStep('composer', async () => {
  await page.locator('button.pf-tab:has-text("Composer")').first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'composer-tab', 'Composer tab in bottom drawer');
  await page.locator('button.pf-tab:has-text("Timeline")').first().click();
});
await tryStep('presets', async () => {
  await page.locator('button.pf-tab:has-text("Presets")').first().click();
  await page.waitForTimeout(700);
  await shot(page, 'presets-tab', 'Presets tab in left panel');
  await page.locator('button.pf-tab:has-text("Sounds")').first().click();
});

// ── Flow 6: back to library
await tryStep('library populated', async () => {
  await page.locator('button:has-text("Library")').first().click();
  await page.waitForURL(URL + '/');
  await page.waitForTimeout(1500);
  await shot(page, 'library-with-project', 'Library after working on one project');
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(400);
  await shot(page, 'library-scrolled', 'Library scrolled down');
});

// Demo project?
await tryStep('quick actions', async () => {
  const qa = await page.locator('button, a').allTextContents();
  note(`INFO library buttons: ${qa.map(s => s.trim()).filter(Boolean).slice(0, 40).join(' | ')}`);
});

writeFileSync(resolve(OUT, 'capture-log.txt'), log.join('\n') + '\n\nCONSOLE ERRORS:\n' + consoleErrors.slice(0, 50).join('\n'));
await browser.close();
