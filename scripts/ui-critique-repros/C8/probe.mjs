// C8 repro: with an event selected, does the grid freeze during playback and hide pad flashes?
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = '.ui-repro-out/C8';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const OUT = resolve(BASE, `out-${W}`);
const MIDI = 'test/fixtures/midi/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { console.log(s); log.push(s); };
let n = 0;
async function shot(page, name, desc, opts = {}) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: resolve(OUT, file), ...opts });
  note(`SHOT ${file} :: ${desc}`);
  return file;
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('dialog', async d => { await d.accept(); });

// In-page helpers: pad snapshot + rAF sampler
async function installHelpers() {
  await page.evaluate(() => {
    const padEls = () => [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\]/.test(el.title) && el.className.includes('w-14'));
    window.__padSnap = () => {
      const out = [];
      for (const el of padEls()) {
        const key = el.title.match(/^\[(\d,\d)\]/)[1];
        if (el.title.includes('empty')) continue;
        const cs = getComputedStyle(el);
        const cls = el.className;
        out.push({
          key,
          name: el.title.split('|')[0].replace(/^\[\d,\d\]\s*/, '').trim(),
          opacity: parseFloat(cs.opacity),
          filter: cs.filter,
          blink: cls.includes('brightness-200'),
          active: cls.includes('brightness-150'),
          selected: cls.includes('brightness-125'),
          greyClass: cls.includes('saturate-0'),
          text: el.innerText.replace(/\s+/g, ' ').trim(),
        });
      }
      return out;
    };
    window.__readout = () => {
      const sp = [...document.querySelectorAll('span.font-mono')].find(s => /^\d+\.\d\ds$/.test(s.textContent.trim()));
      return sp ? sp.textContent.trim() : null;
    };
    window.__startSampler = () => {
      window.__samples = [];
      window.__sampling = true;
      const tick = () => {
        if (!window.__sampling) return;
        const pads = window.__padSnap();
        window.__samples.push({
          t: window.__readout(),
          greyed: pads.filter(p => p.opacity < 0.3).map(p => p.key),
          lit: pads.filter(p => p.blink || p.active).map(p => ({ key: p.key, op: p.opacity, filter: p.filter, blink: p.blink })),
          selected: pads.filter(p => p.selected).map(p => p.key + ':' + p.text),
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.__stopSampler = () => { window.__sampling = false; return window.__samples; };
  });
}

function summarize(label, samples) {
  const frames = samples.length;
  const framesGreyed = samples.filter(s => s.greyed.length > 0).length;
  const litFrames = samples.filter(s => s.lit.length > 0);
  const litEntries = litFrames.flatMap(s => s.lit);
  const litVisible = litEntries.filter(l => l.op >= 0.9).length;
  const litDimmed = litEntries.filter(l => l.op < 0.3).length;
  const distinctSel = [...new Set(samples.map(s => s.selected.join(' ')))];
  const times = samples.map(s => s.t).filter(Boolean);
  const litKeys = [...new Set(litEntries.map(l => l.key))];
  const filters = [...new Set(litEntries.map(l => l.filter))].slice(0, 4);
  const summary = { label, frames, tFirst: times[0], tLast: times[times.length - 1], framesWithGreyedPads: framesGreyed,
    framesWithLitPad: litFrames.length, litPadEntries: litEntries.length, litEntriesFullOpacity: litVisible, litEntriesAtOpacity0_2: litDimmed,
    distinctLitPads: litKeys, litFilters: filters, distinctSelectedPadSets: distinctSel.slice(0, 6), distinctSelectedCount: distinctSel.length };
  note(`SUMMARY ${JSON.stringify(summary)}`);
  return summary;
}

async function play() { await page.locator('button:has-text("PLAY")').first().click(); }
async function stopReset() {
  const stop = page.locator('button:has-text("STOP")').first();
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await page.getByRole('button', { name: 'RESET', exact: true }).click();
  await page.waitForTimeout(300);
}
async function rightPanelSelectedEvent() {
  return page.evaluate(() => {
    const h = [...document.querySelectorAll('h4')].find(e => e.textContent.trim() === 'Selected Event');
    const lbl = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^Event \d+ \(t=/.test(e.textContent.trim()));
    return { selectedEventCard: !!h, card: h ? h.parentElement.parentElement.innerText.replace(/\s+/g, ' ').slice(0, 160) : null, costLabel: lbl ? lbl.textContent.trim() : null };
  });
}

// Capture a burst of screenshots of the grid area to catch flashes; record lit state at each shot
async function burst(label, count, clip) {
  const hits = [];
  for (let i = 0; i < count; i++) {
    const before = await page.evaluate(() => ({ t: window.__readout(), lit: window.__padSnap().filter(p => p.blink || p.active).map(p => `${p.key}@${p.opacity}`) }));
    const file = `${label}-b${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: resolve(OUT, file), clip });
    hits.push({ file, ...before });
  }
  note(`BURST ${label}: ${JSON.stringify(hits.filter(h => h.lit.length > 0).slice(0, 12))}`);
  return hits;
}

// ── Setup: new project, import, explicit "Suggest a starting layout"
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1000);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);
await page.locator('button:has-text("Suggest a starting layout")').first().click();
await page.waitForTimeout(3500);
await installHelpers();
const pads0 = await page.evaluate(() => window.__padSnap());
note(`INFO occupied pads after Suggest: ${pads0.length} :: ${pads0.map(p => p.key + '=' + p.name + '[' + p.text + ']').join('; ')}`);
await shot(page, 'setup-layout', 'Layout after explicit Suggest a starting layout; no event selected');

// Grid clip for bursts
const gridBox = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\]/.test(el.title) && el.className.includes('w-14'));
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (const e of els) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  return { x: Math.max(0, x0 - 12), y: Math.max(0, y0 - 12), width: x1 - x0 + 24, height: y1 - y0 + 24 };
});
note(`INFO grid clip ${JSON.stringify(gridBox)}`);
note(`INFO buttons matching /reset/i: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /reset/i.test(b.textContent)).map(b => b.textContent.trim() + ' @title=' + (b.title||''))))}`);

// Slow down to 0.25x so flashes are catchable in screenshots (same for all conditions)
const speedSel = page.locator('select').filter({ has: page.locator('option:has-text("0.25x")') }).first();
await speedSel.selectOption({ label: '0.25x' }).catch(e => note('WARN speed select ' + e.message));

const results = {};

// ── Condition A (control): no event selected → PLAY
note('--- A: control, no event selected');
note(`INFO A selectedEvent panel: ${JSON.stringify(await rightPanelSelectedEvent())}`);
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(2500);
results.A_burst = await burst('A-noselect', 14, gridBox);
await page.waitForTimeout(500);
await shot(page, 'A-playing-noselect', 'Control: playing with no event selected');
results.A = summarize('A_no_selection', await page.evaluate(() => window.__stopSampler()));
await stopReset();

// ── Condition B: select an event via Events tab → PLAY
note('--- B: event selected from Events tab, then PLAY');
await page.locator('button.pf-tab:has-text("Events")').first().click();
await page.waitForTimeout(600);
const rows = page.locator('div.overflow-y-auto.space-y-0\\.5 > *');
note(`INFO events rows ${await rows.count()}`);
await rows.nth(8).click();
await page.waitForTimeout(700);
const selPads = await page.evaluate(() => window.__padSnap().map(p => `${p.key}:${p.opacity}:${p.selected ? 'SEL' : ''}:${p.text}`));
note(`INFO B pads after selecting (stopped): ${selPads.join(' | ')}`);
note(`INFO B right panel: ${JSON.stringify(await rightPanelSelectedEvent())}`);
await shot(page, 'B-selected-stopped', 'Event selected from Events tab (stopped)');
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(2500);
results.B_burst = await burst('B-selected', 14, gridBox);
await page.waitForTimeout(500);
await shot(page, 'B-playing-selected', 'Playing with event selected');
note(`INFO B right panel during play: ${JSON.stringify(await rightPanelSelectedEvent())}`);
await page.waitForTimeout(2500);
await shot(page, 'B-playing-selected-later', 'Playing with event selected, later');
results.B = summarize('B_event_selected_events_tab', await page.evaluate(() => window.__stopSampler()));

// ── Condition C: Escape during playback clears selection → should unfreeze
note('--- C: press Escape while still playing (B continues)');
await page.evaluate(() => window.__startSampler());
await page.mouse.click(5, 5); // move focus off the transport button to body area
await page.keyboard.press('Escape');
await page.waitForTimeout(3000);
results.C_burst = await burst('C-after-escape', 10, gridBox);
await shot(page, 'C-playing-after-escape', 'Playing after Escape (selection cleared)');
results.C = summarize('C_after_escape_while_playing', await page.evaluate(() => window.__stopSampler()));
note(`INFO C right panel: ${JSON.stringify(await rightPanelSelectedEvent())}`);

// ── Condition D: ArrowRight during playback re-selects → should re-freeze
note('--- D: press ArrowRight while playing');
await page.evaluate(() => window.__startSampler());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(3000);
await shot(page, 'D-playing-after-arrowright', 'Playing after ArrowRight (selection re-set)');
results.D = summarize('D_arrowright_while_playing', await page.evaluate(() => window.__stopSampler()));

// ── Condition E: STOP + RESET does not clear selection
note('--- E: STOP then RESET');
await stopReset();
const afterReset = await page.evaluate(() => window.__padSnap().filter(p => p.opacity < 0.3).length);
note(`INFO E greyed pads after STOP+RESET: ${afterReset}; panel ${JSON.stringify(await rightPanelSelectedEvent())}`);
await shot(page, 'E-after-reset', 'After STOP + RESET: selection still present?');

// ── Condition F: Deselect via panel button, then PLAY → should behave like control
note('--- F: Deselect via Escape, then PLAY');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(3000);
results.F = summarize('F_deselected_then_play', await page.evaluate(() => window.__stopSampler()));
await stopReset();

// ── Condition G: select via timeline pill click while playing
note('--- G: click a timeline note pill while playing');
await page.locator('button.pf-tab:has-text("Sounds")').first().click().catch(() => {});
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(1500);
const pill = page.locator('div:text-is("L2"), span:text-is("L2"), div:text-is("R2"), span:text-is("R2")').first();
const pillOk = await pill.isVisible().catch(() => false);
note(`INFO G pill visible ${pillOk}`);
if (pillOk) { await pill.click({ force: true }); }
await page.waitForTimeout(3000);
await shot(page, 'G-playing-after-pill-click', 'Playing after clicking a timeline pill during playback');
results.G = summarize('G_pill_click_while_playing', await page.evaluate(() => window.__stopSampler()));
await stopReset();

// ── Condition H: 1x speed with selection (normal rehearsal speed)
note('--- H: 1x speed with an event selected');
await speedSel.selectOption({ label: '1x' }).catch(() => {});
await page.keyboard.press('Escape');
await page.locator('button.pf-tab:has-text("Events")').first().click();
await page.waitForTimeout(400);
await rows.nth(3).click();
await page.waitForTimeout(400);
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(5000);
await shot(page, 'H-playing-1x-selected', 'Playing at 1x with an event selected');
results.H = summarize('H_1x_selected', await page.evaluate(() => window.__stopSampler()));
await stopReset();
await page.keyboard.press('Escape');
await page.evaluate(() => window.__startSampler());
await play();
await page.waitForTimeout(5000);
results.H2 = summarize('H2_1x_no_selection', await page.evaluate(() => window.__stopSampler()));
await stopReset();

note(`ERRORS ${errs.length}: ${errs.slice(0, 5).join(' || ')}`);
writeFileSync(resolve(OUT, 'log.txt'), log.join('\n'));
writeFileSync(resolve(OUT, 'results.json'), JSON.stringify(results, null, 1));
await browser.close();
