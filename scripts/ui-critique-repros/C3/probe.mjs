// C3 repro probe: do Beam / Annealing Generate ignore placement locks and discard the user's arrangement?
// Independent probe. Each scenario runs in a fresh browser context.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { resolve } from 'path';

const OUT = '.ui-repro-out/C3';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });
const LOG = resolve(OUT, `probe-log-${W}${process.env.LOGTAG ? "-" + process.env.LOGTAG : ""}.txt`);
writeFileSync(LOG, `C3 probe ${new Date().toISOString()} viewport ${W}x${H} url ${URL}\n`);
const note = (s) => { console.log(s); appendFileSync(LOG, s + '\n'); };

// User arrangement deliberately far from the pose0 anchor pads (rows 2-6, cols 0-7 used by the seeder).
const USER_PADS = process.env.PADS ? JSON.parse(process.env.PADS) : [[7, 0], [7, 1], [7, 2], [6, 0], [6, 1], [6, 2], [7, 3], [6, 3], [7, 4], [6, 4]];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

async function gridState(page) {
  return page.evaluate(() => {
    const out = {};
    const locks = [];
    for (const el of document.querySelectorAll('[title^="["]')) {
      const t = el.getAttribute('title');
      const m = /^\[(\d),(\d)\] (.*)$/.exec(t);
      if (!m) continue;
      const key = `${m[1]},${m[2]}`;
      const rest = m[3];
      if (rest.startsWith('empty')) continue;
      out[key] = rest.split(' | ')[0];
      if (el.querySelector('span[title="Placement locked"]')) locks.push(key);
    }
    return { pads: out, gridLocks: locks };
  });
}

async function readIdb(page) {
  return page.evaluate(() => new Promise((res) => {
    const req = indexedDB.open('pushflow');
    req.onerror = () => res({ error: 'open failed' });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('projects', 'readonly');
      const all = tx.objectStore('projects').getAll();
      all.onsuccess = () => {
        const summ = (l) => l ? {
          name: l.name, role: l.role,
          pads: Object.fromEntries(Object.entries(l.padToVoice || {}).map(([k, v]) => [k, v.name + '#' + v.id])),
          placementLocks: l.placementLocks,
        } : null;
        res(all.result.map(p => {
          const s = p.state || p.data || p;
          return {
            id: p.id,
            keys: Object.keys(p),
            active: summ(s.activeLayout),
            working: summ(s.workingLayout),
            candidates: (s.candidates || []).map(c => ({ strategy: c.metadata?.strategy, ...summ(c.layout) })),
            savedVariants: (s.savedVariants || []).map(summ),
          };
        }));
      };
      all.onerror = () => res({ error: 'getAll failed' });
    };
  }));
}

async function save(page) {
  const b = page.locator('button[title="Save project"]').first();
  await b.click().catch(() => {});
  await page.waitForTimeout(900);
}

async function waitIdle(page, maxMs = 240000) {
  const t0 = Date.now();
  await page.waitForTimeout(600);
  while (Date.now() - t0 < maxMs) {
    const genVisible = await page.locator('button:has-text("Generate")').first().isVisible().catch(() => false);
    const analyzing = await page.locator('span.animate-pulse').first().isVisible().catch(() => false);
    if (genVisible && !analyzing) return Date.now() - t0;
    await page.waitForTimeout(400);
  }
  return -1;
}

async function contextMenuLabel(page, padKey) {
  const [r, c] = padKey.split(',');
  await page.locator(`[title^="[${r},${c}] "]`).first().click({ button: 'right' });
  await page.waitForTimeout(300);
  const lockBtn = page.locator('button:has-text("Lock to this pad"), button:has-text("Unlock placement")').first();
  const txt = (await lockBtn.textContent().catch(() => null))?.trim();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return txt;
}

async function setupProject(page, tag) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
  await page.waitForURL('**/project/**');
  await page.waitForTimeout(1200);
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
  await page.waitForTimeout(2500);
  const rows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
  const n = await rows.count();
  note(`[${tag}] sounds in palette: ${n}`);
  return { rows, n };
}

async function placeAll(page, rows, n, tag) {
  // Palette rows may re-render after each drop; resolve by index each time.
  for (let i = 0; i < n; i++) {
    const [r, c] = USER_PADS[i];
    const unplaced = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
    // Drag the i-th palette row (order is stable in the palette).
    await unplaced.nth(i).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first());
    await page.waitForTimeout(500);
  }
  const g = await gridState(page);
  note(`[${tag}] user arrangement: ${JSON.stringify(g.pads)}`);
  return g;
}

async function lockPad(page, padKey, tag) {
  const [r, c] = padKey.split(',');
  await page.locator(`[title^="[${r},${c}] "]`).first().click({ button: 'right' });
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Lock to this pad")').first().click();
  await page.waitForTimeout(400);
  const g = await gridState(page);
  note(`[${tag}] after lock on [${padKey}]: grid lock icons at ${JSON.stringify(g.gridLocks)}; ctx menu now says "${await contextMenuLabel(page, padKey)}"`);
  return g;
}

async function generate(page, method, intensity, tag) {
  await page.locator('select[title="Optimizer method"]').selectOption(method);
  await page.waitForTimeout(300);
  if (intensity) {
    await page.locator('select[title="Intensity"]').selectOption(intensity);
    await page.waitForTimeout(200);
  }
  const t0 = Date.now();
  await page.locator('button:has-text("Generate")').first().click();
  const w = await waitIdle(page, parseInt(process.env.GEN_MAX || "300000", 10));
  await page.waitForTimeout(1500);
  const w2 = await waitIdle(page, 60000);
  note(`[${tag}] Generate(${method}${intensity ? '/' + intensity : ''}) finished in ~${Date.now() - t0}ms (idle waits ${w}/${w2})`);
}

function where(pads, name) {
  return Object.entries(pads).filter(([, v]) => v === name).map(([k]) => k);
}

async function scenario(tag, { method, intensity, lockIdx = 0, lockPadKey = null, lock = true, place = true, promoteFirst = false, afterGen = [] }) {
  if (ONLY && !ONLY.includes(tag)) return;
  note(`\n===== SCENARIO ${tag}: method=${method} intensity=${intensity ?? '-'} lock=${lock} place=${place} promoteFirst=${promoteFirst}`);
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  try {
    const { rows, n } = await setupProject(page, tag);
    let user = { pads: {} };
    if (place) user = await placeAll(page, rows, n, tag);
    let lockedKey = null; let lockedName = null;
    if (lock) {
      lockedKey = lockPadKey ?? `${USER_PADS[lockIdx][0]},${USER_PADS[lockIdx][1]}`;
      if (lockPadKey && place) {
        // move the chosen sound onto the lock pad first (drag pad -> pad)
        const [sr, sc] = USER_PADS[lockIdx];
        const [tr, tc] = lockPadKey.split(',');
        await page.locator(`[title^="[${sr},${sc}] "]`).first().dragTo(page.locator(`[title^="[${tr},${tc}] "]`).first());
        await page.waitForTimeout(500);
        user = await gridState(page);
        note(`[${tag}] arrangement after moving sound to ${lockPadKey}: ${JSON.stringify(user.pads)}`);
      }
      lockedName = (await gridState(page)).pads[lockedKey];
      await lockPad(page, lockedKey, tag);
      note(`[${tag}] LOCKED: "${lockedName}" on [${lockedKey}]`);
    }
    await waitIdle(page, 60000);
    if (promoteFirst) {
      const p = page.locator('button[title="Make this layout the new Active Layout"]').first();
      await p.click();
      await page.waitForTimeout(1200);
      await waitIdle(page, 60000);
      const g = await gridState(page);
      note(`[${tag}] after Promote (before Generate): locks ${JSON.stringify(g.gridLocks)}`);
    }
    await save(page);
    const idbBefore = await readIdb(page);
    note(`[${tag}] IDB before generate: ${JSON.stringify(idbBefore.map(p => ({ active: p.active, working: p.working })))}`);
    await page.screenshot({ path: resolve(OUT, `${tag}-${W}-1-before.png`) });

    await generate(page, method, intensity, tag);
    const after = await gridState(page);
    note(`[${tag}] grid AFTER generate: ${JSON.stringify(after.pads)}`);
    note(`[${tag}] grid lock icons AFTER: ${JSON.stringify(after.gridLocks)}`);
    const moved = Object.keys(user.pads).filter(k => after.pads[k] !== user.pads[k]);
    note(`[${tag}] user pads changed: ${moved.length}/${Object.keys(user.pads).length} -> ${JSON.stringify(moved)}`);
    if (lock) {
      const nowAt = where(after.pads, lockedName);
      note(`[${tag}] locked sound "${lockedName}" now at ${JSON.stringify(nowAt)} (locked pad [${lockedKey}] now holds "${after.pads[lockedKey] ?? 'EMPTY'}")`);
      if (nowAt[0]) note(`[${tag}] ctx menu on "${lockedName}" at [${nowAt[0]}]: "${await contextMenuLabel(page, nowAt[0])}"`);
      if (after.pads[lockedKey]) note(`[${tag}] ctx menu on original locked pad [${lockedKey}]: "${await contextMenuLabel(page, lockedKey)}"`);
    }
    const errBanner = await page.locator('text=/Generation failed|error/i').first().textContent().catch(() => null);
    if (errBanner) note(`[${tag}] error text on page: ${errBanner.slice(0, 200)}`);
    await page.screenshot({ path: resolve(OUT, `${tag}-${W}-2-after-generate.png`) });
    await save(page);
    const idbAfter = await readIdb(page);
    for (const p of idbAfter) {
      note(`[${tag}] IDB after: active.locks=${JSON.stringify(p.active?.placementLocks)} working.locks=${JSON.stringify(p.working?.placementLocks)} working.name=${p.working?.name}`);
      p.candidates.forEach((c, i) => {
        const at = lockedName ? Object.entries(c.pads).filter(([, v]) => v.startsWith(lockedName + '#')).map(([k]) => k) : [];
        note(`[${tag}]   candidate #${i + 1} strategy=${c.strategy} locks=${JSON.stringify(c.placementLocks)} lockedSoundAt=${JSON.stringify(at)} pads=${JSON.stringify(c.pads)}`);
      });
    }
    for (const step of afterGen) {
      if (step === 'candidates') {
        const prev = page.locator('button:has-text("Preview")');
        const pc = await prev.count();
        note(`[${tag}] candidate cards: ${pc}`);
        for (let i = 0; i < pc; i++) {
          await page.locator('button:has-text("Preview")').nth(i).click();
          await page.waitForTimeout(700);
          await waitIdle(page, 60000);
          const g = await gridState(page);
          note(`[${tag}]   Preview #${i + 1}: locked sound "${lockedName}" at ${JSON.stringify(where(g.pads, lockedName))}, locked pad [${lockedKey}]="${g.pads[lockedKey] ?? 'EMPTY'}", grid lock icons ${JSON.stringify(g.gridLocks)}, pads=${JSON.stringify(g.pads)}`);
        }
        await page.screenshot({ path: resolve(OUT, `${tag}-${W}-3-candidates.png`) });
      }
      if (step === 'undo') {
        for (let u = 1; u <= 8; u++) {
          const ub = page.locator('button[title="Undo (Ctrl+Z)"]').first();
          if (await ub.isDisabled().catch(() => true)) { note(`[${tag}] Undo disabled after ${u - 1} presses`); break; }
          await ub.click();
          await page.waitForTimeout(700);
          const g = await gridState(page);
          note(`[${tag}] after ${u}x Undo: locked "${lockedName}" at ${JSON.stringify(where(g.pads, lockedName))} lock icons ${JSON.stringify(g.gridLocks)} pads=${JSON.stringify(g.pads)}`);
          if (g.gridLocks.length) { await page.screenshot({ path: resolve(OUT, `${tag}-${W}-3-after-undo-${u}.png`) }); break; }
        }
      }
      if (step === 'discard') {
        await page.locator('button[title="Discard working changes"]').first().click();
        await page.waitForTimeout(800);
        await waitIdle(page, 60000);
        const g = await gridState(page);
        note(`[${tag}] after Discard: grid ${JSON.stringify(g.pads)} locks ${JSON.stringify(g.gridLocks)}`);
        await page.screenshot({ path: resolve(OUT, `${tag}-${W}-3-after-discard.png`) });
      }
      if (step === 'promote') {
        await page.locator('button[title="Make this layout the new Active Layout"]').first().click();
        await page.waitForTimeout(1200);
        await waitIdle(page, 60000);
        const g = await gridState(page);
        await save(page);
        const idb = await readIdb(page);
        note(`[${tag}] after Promote generated draft: grid locks ${JSON.stringify(g.gridLocks)}; IDB active.locks=${JSON.stringify(idb[0]?.active?.placementLocks)}; variants=${JSON.stringify(idb[0]?.savedVariants?.map(v => ({ name: v.name, locks: v.placementLocks })))}`);
        await page.screenshot({ path: resolve(OUT, `${tag}-${W}-3-after-promote.png`) });
      }
    }
    if (errs.length) note(`[${tag}] console errors: ${errs.slice(0, 5).join(' || ').slice(0, 800)}`);
  } catch (e) {
    note(`[${tag}] FAIL: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: resolve(OUT, `${tag}-${W}-FAIL.png`) }).catch(() => {});
  }
  await ctx.close();
}

// Positive cases (expect lock violation if C3 is real)
await scenario('A-beam-lock', { method: 'beam', lockIdx: 0, afterGen: ['candidates', 'discard'] });
await scenario('A2-beam-lock-undo', { method: 'beam', lockIdx: 0, afterGen: ['undo'] });
await scenario('B-anneal-quick-lock', { method: 'annealing', intensity: 'fast', lockIdx: 1, afterGen: ['candidates'] });
await scenario('C-anneal-thorough-lock', { method: 'annealing', intensity: 'deep', lockIdx: 0, afterGen: ['candidates'] });
// Lock on the pad the seeder would itself choose for that sound (coincidence case)
await scenario('D-beam-lock-on-seed-pad', { method: 'beam', lockIdx: 0, lockPadKey: '3,3', afterGen: ['candidates'] });
// Locked on Active Layout (promote first), then beam, then promote result
await scenario('E-beam-lock-promoted-then-promote', { method: 'beam', lockIdx: 0, promoteFirst: true, afterGen: ['promote'] });
// Negative controls
await scenario('F-greedy-lock', { method: 'greedy', lockIdx: 0, afterGen: ['candidates'] });
await scenario('G-beam-nolock', { method: 'beam', lock: false });

await browser.close();
note('\nDONE');
