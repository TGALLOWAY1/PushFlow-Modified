// C4 repro probe: undo reliability. Independent from earlier reviewer probes.
// Usage: node probe.mjs <scenario> [W] [H]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { resolve } from 'path';

const DIR = '.ui-repro-out/C4';
const URL = process.env.URL || 'http://localhost:5173';
const SCEN = process.argv[2] || 'manual';
const W = parseInt(process.argv[3] || '1600', 10);
const H = parseInt(process.argv[4] || '1000', 10);
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
const OUT = resolve(DIR, 'shots');
mkdirSync(OUT, { recursive: true });
const LOG = resolve(DIR, `log-${SCEN}-${W}.txt`);
writeFileSync(LOG, `# scenario=${SCEN} viewport=${W}x${H} url=${URL} at ${new Date().toISOString()}\n`);
const t0 = Date.now();
const note = (s) => { const line = `[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; console.log(line); appendFileSync(LOG, line + '\n'); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.on('pageerror', e => note('PAGEERROR ' + e.message));
page.on('dialog', async d => { note(`DIALOG ${d.type()}: ${d.message()}`); await d.accept(); });

let n = 0;
async function shot(name) {
  n += 1;
  const file = resolve(OUT, `${SCEN}-${W}-${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  note(`SHOT ${file}`);
}

// Read undo/redo stacks directly from the ProjectProvider's hooks (current fiber tree).
async function hist() {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const ck = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    if (!ck) return { err: 'no container' };
    let cur = root[ck].stateNode.current;
    // DFS for ProjectProvider
    const stack = [cur]; let prov = null;
    while (stack.length) {
      const f = stack.pop();
      if (f.elementType && f.elementType.name === 'ProjectProvider') { prov = f; break; }
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    if (!prov) return { err: 'no provider' };
    let h = prov.memoizedState;
    const past = h.memoizedState; h = h.next;
    const present = h.memoizedState; h = h.next;
    const future = h.memoizedState;
    const pads = (l) => l ? Object.entries(l.padToVoice).map(([k, v]) => `${k}=${(v.name || '').replace('TEST MIDI 1 ', 'T')}`).sort().join(',') : null;
    const sum = s => ({
      act: Object.keys(s.activeLayout?.padToVoice || {}).length,
      wrk: s.workingLayout ? Object.keys(s.workingLayout.padToVoice).length : null,
      wname: s.workingLayout?.name ?? null,
      stale: s.analysisStale, proc: s.isProcessing,
      an: s.analysisResult ? (s.analysisResult.metadata?.strategy || 'y') : null,
      cands: s.candidates?.length ?? 0,
      vars: s.savedVariants?.length ?? 0,
      streams: s.soundStreams?.length ?? 0, lanes: s.performanceLanes?.length ?? 0,
      shown: pads(s.workingLayout || s.activeLayout),
    });
    return { past: past.map(sum), present: sum(present), future: future.map(sum) };
  });
}

function fmt(s) {
  return `streams=${s.streams} lanes=${s.lanes} act=${s.act} wrk=${s.wrk} stale=${s.stale} proc=${s.proc} an=${s.an} cands=${s.cands} vars=${s.vars} shown=[${s.shown}]`;
}

async function dom() {
  return page.evaluate(() => {
    const pads = [...document.querySelectorAll('[title^="["]')].map(e => e.getAttribute('title')).filter(t => /^\[\d,\d\] /.test(t));
    const placed = pads.filter(t => !t.includes('empty')).map(t => t.split(' |')[0]);
    const btn = (label) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label); return b ? (b.disabled ? 'disabled' : 'enabled') : 'absent'; };
    return { placed, undo: btn('Undo'), redo: btn('Redo'), promote: btn('Promote'), discard: btn('Discard') };
  });
}

async function report(label, full = false) {
  const d = await dom();
  const h = await hist().catch(e => ({ err: e.message }));
  note(`STATE ${label}: DOM placed=${d.placed.length} [${d.placed.join(' ')}] Undo=${d.undo} Redo=${d.redo} Promote=${d.promote} Discard=${d.discard}`);
  if (h.err) { note(`  hist err ${h.err}`); return { d, h }; }
  note(`  past=${h.past.length} future=${h.future.length} present: ${fmt(h.present)}`);
  if (full) {
    h.past.forEach((s, i) => note(`    past[${i}] ${fmt(s)}`));
    h.future.forEach((s, i) => note(`    future[${i}] ${fmt(s)}`));
  }
  return { d, h };
}

async function clickUndo() { await page.locator('button:text-is("Undo")').first().click(); }
async function waitIdle(max = 60) {
  for (let i = 0; i < max; i++) {
    const h = await hist();
    if (!h.err && !h.present.proc && !h.present.stale) return;
    await page.waitForTimeout(500);
  }
  note('WARN waitIdle timed out');
}

async function newProject() {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
  await page.waitForURL('**/project/**');
  await page.waitForTimeout(1500);
}
async function importMidi() {
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
  await page.waitForTimeout(3000);
}
const soundRows = () => page.locator('div[draggable="true"]:has(button[title="Color & group"])');
async function place(i, r, c) {
  await soundRows().nth(i).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first());
}

// Undo presses spaced by `gap` ms, reporting state 150ms after each press and after the gap.
async function spacedUndos(k, gap, tag, useKey = false) {
  for (let i = 1; i <= k; i++) {
    if (useKey) await page.keyboard.press('Control+z'); else await clickUndo();
    await page.waitForTimeout(150);
    await report(`${tag} undo#${i} +150ms`);
    await page.waitForTimeout(gap);
    await report(`${tag} undo#${i} +${gap + 150}ms`, true);
  }
}

try {
  if (SCEN === 'fresh') {
    // Control: brand-new empty project, no import.
    await newProject();
    await report('new project, no import (t+1.5s)', true);
    await page.waitForTimeout(3000);
    await report('new project, no import (t+4.5s)', true);
    await shot('new-project');
    await importMidi();
    await waitIdle();
    await report('after MIDI import settled', true);
    await shot('after-import');
    // Undo right after import: does it undo the import, or something invisible?
    await clickUndo(); await page.waitForTimeout(2500);
    await report('after 1 Undo post-import (+2.5s)', true);
    await shot('undo-after-import');
  }

  if (SCEN === 'manual') {
    await newProject(); await importMidi(); await waitIdle();
    await report('after import', true);
    await place(0, 3, 3);
    await page.waitForTimeout(150);
    await report('150ms after placing sound 0 at [3,3]', true);
    await page.waitForTimeout(3000);
    await report('3s after placing sound 0 (analysis done)', true);
    await shot('placed-1');
    // Condition A: spaced undo at human pace (2.5s)
    await spacedUndos(3, 2500, 'spaced');
    await shot('after-3-spaced-undos');
    // Condition B (control): rapid double Ctrl+Z (200ms apart)
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
    await report('after rapid double Ctrl+Z', true);
    await shot('after-rapid-double');
    // Condition C (control): place then undo within the 1s debounce
    const d = await dom();
    const target = d.placed.length ? [4, 4] : [3, 3];
    await place(1, target[0], target[1]);
    await page.waitForTimeout(250);
    await report(`250ms after placing sound 1 at [${target}]`, true);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    await report('Ctrl+Z within debounce +150ms', true);
    await page.waitForTimeout(2500);
    await report('Ctrl+Z within debounce +2.65s', true);
    await shot('undo-within-debounce');
  }

  if (SCEN === 'discard') {
    await newProject(); await importMidi(); await waitIdle();
    await place(0, 3, 3); await page.waitForTimeout(800);
    await place(1, 3, 4); await page.waitForTimeout(800);
    await place(2, 4, 2); await page.waitForTimeout(3000); await waitIdle();
    await report('3 placed, analysis done', true);
    await shot('3-placed');
    await page.locator('button:text-is("Discard")').first().click();
    await page.waitForTimeout(3000);
    await report('3s after Discard', true);
    await shot('after-discard');
    await spacedUndos(3, 2500, 'discard');
    await shot('after-discard-undos');
  }

  if (SCEN === 'promote') {
    await newProject(); await importMidi(); await waitIdle();
    await place(0, 3, 3); await page.waitForTimeout(800);
    await place(1, 3, 4); await page.waitForTimeout(800);
    await place(2, 4, 2); await page.waitForTimeout(3000); await waitIdle();
    await page.locator('button:text-is("Promote")').first().click();
    await page.waitForTimeout(3000); await waitIdle();
    await report('Promoted first layout (A), analysis done', true);
    // Now make a second working layout B by moving one more sound in, then promote
    await place(3, 4, 5); await page.waitForTimeout(3000); await waitIdle();
    await report('working B (4 pads) analysed', true);
    await page.locator('button:text-is("Promote")').first().click();
    await page.waitForTimeout(3000); await waitIdle();
    await report('3s after Promote B', true);
    await shot('after-promote-B');
    await spacedUndos(4, 2500, 'promote');
    await shot('after-promote-undos');
    // Reopen test: reload page (fresh open of saved project with a layout)
    await page.waitForTimeout(2500); // let autosave flush
    const url = page.url();
    note(`project url ${url}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await report('reopened +0.4s', true);
    await page.waitForTimeout(3000);
    await report('reopened +3.4s (no user action)', true);
    await shot('reopened-with-layout');
    await clickUndo(); await page.waitForTimeout(200);
    await report('reopened: 1 Undo +200ms', true);
    await shot('reopened-undo-200ms');
    await page.waitForTimeout(2500);
    await report('reopened: 1 Undo +2.7s', true);
  }

  if (SCEN === 'reopen-empty') {
    // Control for "Undo enabled on a freshly opened project": project with streams but empty grid
    await newProject(); await importMidi(); await waitIdle();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await report('reopened empty-grid project +0.4s', true);
    await page.waitForTimeout(3000);
    await report('reopened empty-grid project +3.4s', true);
    await shot('reopened-empty');
    // Also: a project with no import at all
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
    await page.waitForURL('**/project/**');
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await report('reopened project with no sounds +3s', true);
  }

  if (SCEN === 'suggest') {
    await newProject(); await importMidi(); await waitIdle();
    await report('before Suggest (empty grid)', true);
    await page.locator('button:has-text("Suggest a starting layout")').first().click();
    await page.waitForTimeout(150);
    await report('150ms after Suggest', true);
    await page.waitForTimeout(3000); await waitIdle();
    await report('after Suggest, analysis done', true);
    await shot('after-suggest');
    await spacedUndos(3, 2500, 'suggest');
    await shot('after-suggest-undos');
    // rapid undos
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(120); }
    await page.waitForTimeout(2500);
    await report('after 4 rapid Ctrl+Z', true);
    await shot('after-suggest-rapid');
  }

  if (SCEN === 'generate') {
    await newProject(); await importMidi(); await waitIdle();
    // hand-built layout: place all sounds manually
    const cnt = await soundRows().count();
    const tgts = [[3,3],[3,4],[4,2],[4,5],[2,3],[2,4],[5,3],[5,4],[3,2],[3,5]];
    for (let i = 0; i < cnt && i < tgts.length; i++) { await place(i, ...tgts[i]); await page.waitForTimeout(400); }
    await page.waitForTimeout(2500); await waitIdle();
    await report(`hand-built layout (${cnt} sounds), analysed`, true);
    await shot('hand-built');
    await page.locator('button:text-is("Generate")').first().click().catch(async () => {
      await page.locator('button:has-text("Generate")').first().click();
    });
    note('clicked Generate');
    for (let i = 0; i < 120; i++) {
      const h = await hist();
      if (!h.err && h.present.cands > 0 && !h.present.proc && !h.present.stale) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(1500);
    await report('after Generate complete', true);
    await shot('after-generate');
    await spacedUndos(4, 2500, 'generate');
    await shot('after-generate-undos');
    // Preview candidate #2
    const prev = page.locator('button:text-is("Preview")');
    note(`preview buttons: ${await prev.count()}`);
    if (await prev.count() > 1) {
      await report('before Preview #2', true);
      await prev.nth(1).click();
      await page.waitForTimeout(3000); await waitIdle();
      await report('after Preview #2, analysed', true);
      await shot('after-preview-2');
      await spacedUndos(3, 2500, 'preview');
      await shot('after-preview-undos');
    }
  }

  if (SCEN === 'genwedge') {
    await newProject(); await importMidi(); await waitIdle();
    await page.locator('button:has-text("Suggest a starting layout")').first().click();
    await page.waitForTimeout(2500); await waitIdle();
    await report('suggested layout analysed (pre-generate)', true);
    await page.locator('button:text-is("Generate")').first().click();
    note('clicked Generate');
    for (let i = 0; i < 120; i++) {
      const h = await hist();
      if (!h.err && h.present.cands > 0 && !h.present.proc && !h.present.stale) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(1500);
    await report('after Generate complete', true);
    await shot('after-generate');
    const toolbar = async (lbl) => {
      const t = await page.evaluate(() => {
        const gen = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Generate');
        const busy = [...document.querySelectorAll('span')].filter(s => /Analyzing|Generating/.test(s.textContent) && s.className.includes('animate-pulse')).map(s => s.textContent.trim());
        const panelBusy = [...document.querySelectorAll('div')].some(d => d.textContent.trim() === 'Generating candidates...');
        const sel = !!document.querySelector('select[title="Optimizer method"]');
        return { generateBtn: gen ? (gen.disabled ? 'disabled' : 'enabled') : 'absent', busy, panelBusy, methodSelect: sel };
      });
      note(`TOOLBAR ${lbl}: ${JSON.stringify(t)}`);
    };
    await toolbar('after generate');
    // Rapid double Ctrl+Z (200ms apart) - the only way to get past the re-analysis loop
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    await report('rapid 2x Ctrl+Z +300ms', true);
    await page.waitForTimeout(6000);
    await report('rapid 2x Ctrl+Z +6.3s', true);
    await toolbar('rapid 2x undo +6.3s');
    await shot('after-rapid-undo-generate');
    // Now try a manual edit: Remove from pad on one pad via its x button, or drag a pad to an empty pad
    const occupied = (await dom()).placed[0];
    note('moving ' + occupied);
    const m = occupied.match(/\[(\d),(\d)\]/);
    await page.locator(`[title^="[${m[1]},${m[2]}] "]`).first().dragTo(page.locator('[title^="[7,7] empty"]').first());
    await page.waitForTimeout(5000);
    await report('after manual move +5s', true);
    await toolbar('after manual move +5s');
    await shot('after-edit-still-wedged');
  }

  if (SCEN === 'promote-rapid') {
    await newProject(); await importMidi(); await waitIdle();
    await place(0, 3, 3); await page.waitForTimeout(800);
    await place(1, 3, 4); await page.waitForTimeout(3000); await waitIdle();
    await report('working (2 pads) analysed', true);
    await page.locator('button:text-is("Promote")').first().click();
    await page.waitForTimeout(3000); await waitIdle();
    await report('3s after Promote', true);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(3000);
    await report('rapid 2x Ctrl+Z after Promote +3s', true);
    await shot('promote-rapid-undo');
  }
} catch (e) {
  note('ERROR ' + e.message.split('\n')[0]);
  await shot('error').catch(() => {});
}
await browser.close();
