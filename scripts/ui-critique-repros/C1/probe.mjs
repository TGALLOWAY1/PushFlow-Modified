// C1 repro: pad right-click context menu position / clipping / Escape.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = '.ui-repro-out/C1';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const TAG = `${W}x${H}`;
const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { console.log(s); log.push(typeof s === 'string' ? s : JSON.stringify(s)); };
const shot = async (page, name) => { const f = resolve(OUT, `${TAG}-${name}.png`); await page.screenshot({ path: f }); note(`SHOT ${f}`); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.on('pageerror', e => note('PAGEERROR ' + e.message));
page.on('dialog', d => d.accept());

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1200);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);

// Manually place sounds on pads spread over the grid (explicit user drags).
const rows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
const count = await rows.count();
note(`sound rows: ${count}`);
const targets = [[0, 0], [7, 0], [4, 3], [3, 7], [7, 7], [0, 7], [5, 5]];
for (let i = 0; i < Math.min(targets.length, count); i++) {
  const [r, c] = targets[i];
  await rows.nth(i).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first()).catch(e => note(`drag fail ${r},${c}: ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(500);
}
// Sounds placed are removed from the unplaced list? re-check which pads have voices
const placed = await page.$$eval('[title^="["]', els => els.map(e => e.getAttribute('title')).filter(t => /^\[\d,\d\] /.test(t) && !t.includes('empty')));
note(`placed pads: ${JSON.stringify(placed)}`);
await page.mouse.click(5, H - 5);
await page.waitForTimeout(800);
await shot(page, '00-placed');

const measure = () => page.evaluate(() => {
  const menu = [...document.querySelectorAll('div.fixed.z-50')].find(d => d.textContent.includes('Pad ['));
  if (!menu) return { open: false };
  const r = menu.getBoundingClientRect();
  const cs = getComputedStyle(menu);
  // Ancestors that make a containing block for position:fixed, and clipping ancestors
  const cbAnc = []; const clipAnc = [];
  for (let a = menu.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    const why = [];
    if (s.transform !== 'none') why.push(`transform:${s.transform}`);
    if (s.backdropFilter && s.backdropFilter !== 'none') why.push(`backdrop-filter:${s.backdropFilter}`);
    if (s.filter !== 'none') why.push(`filter:${s.filter}`);
    if (s.willChange && /transform|filter/.test(s.willChange)) why.push(`will-change:${s.willChange}`);
    if (s.contain && /paint|layout|strict|content/.test(s.contain)) why.push(`contain:${s.contain}`);
    const rr = a.getBoundingClientRect();
    const box = { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width), h: Math.round(rr.height) };
    if (why.length) cbAnc.push({ cls: (a.className || '').toString().slice(0, 60), why, box });
    if (s.overflow !== 'visible' || s.overflowX !== 'visible') clipAnc.push({ cls: (a.className || '').toString().slice(0, 60), overflow: s.overflow, box });
  }
  // Effective visible rect = menu rect ∩ all clip ancestors ∩ viewport
  let vis = { l: r.left, t: r.top, r: r.right, b: r.bottom };
  const inter = (b) => { vis = { l: Math.max(vis.l, b.x), t: Math.max(vis.t, b.y), r: Math.min(vis.r, b.x + b.w), b: Math.min(vis.b, b.y + b.h) }; };
  clipAnc.forEach(c => inter(c.box));
  inter({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  const visArea = Math.max(0, vis.r - vis.l) * Math.max(0, vis.b - vis.t);
  // Hit-test every button
  const buttons = [...menu.querySelectorAll('button')].map(b => {
    const br = b.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { label: b.textContent.trim(), cx: Math.round(cx), cy: Math.round(cy), h: +br.height.toFixed(1), hittable: !!hit && menu.contains(hit), hitEl: hit ? (hit.className || hit.tagName).toString().slice(0, 40) : null };
  });
  return {
    open: true,
    styleLeftTop: [menu.style.left, menu.style.top],
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    layoutW: menu.offsetWidth, layoutH: menu.offsetHeight,
    effScale: +(r.width / menu.offsetWidth).toFixed(3),
    fontSizeCss: cs.fontSize,
    visibleAreaPct: +(100 * visArea / (r.width * r.height)).toFixed(1),
    containingBlockAncestors: cbAnc,
    clipAncestors: clipAnc.map(c => ({ cls: c.cls, box: c.box })),
    hittableButtons: buttons.filter(b => b.hittable).length,
    totalButtons: buttons.length,
    buttons,
  };
});
const menuCount = () => page.evaluate(() => [...document.querySelectorAll('div.fixed.z-50')].filter(d => d.textContent.includes('Pad [')).length);

const results = [];
for (const t of placed) {
  const key = t.match(/^\[(\d,\d)\]/)[1];
  const pad = page.locator(`[title^="[${key}] "]`).first();
  const pb = await pad.boundingBox();
  const cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2;
  await page.mouse.click(cx, cy, { button: 'right' });
  await page.waitForTimeout(400);
  const m = await measure();
  const d = m.open ? Math.round(Math.hypot(m.rect.x - cx, m.rect.y - cy)) : null;
  const rec = { pad: key, click: [Math.round(cx), Math.round(cy)], menuTopLeftDistFromCursor: d, ...m };
  results.push(rec);
  note(`PAD ${key} click=(${Math.round(cx)},${Math.round(cy)}) open=${m.open} rect=${JSON.stringify(m.rect)} dist=${d} effScale=${m.effScale} visible%=${m.visibleAreaPct} hittable=${m.hittableButtons}/${m.totalButtons}`);
  await page.evaluate(([x, y]) => { const d = document.createElement('div'); d.id = '__mk'; d.style.cssText = `position:fixed;left:${x - 9}px;top:${y - 9}px;width:18px;height:18px;border:3px solid #ff2d55;border-radius:50%;z-index:99999;pointer-events:none`; document.body.appendChild(d); }, [cx, cy]);
  // Portal simulation: clone the open menu (same inline left/top) into <body> and measure where it WOULD sit
  rec.portalClone = await page.evaluate(() => {
    const menu = [...document.querySelectorAll('div.fixed.z-50')].find(d => d.textContent.includes('Pad ['));
    if (!menu) return null;
    const c = menu.cloneNode(true); c.style.visibility = 'hidden'; document.body.appendChild(c);
    const r = c.getBoundingClientRect(); c.remove();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  note(`   portal-clone rect for ${key}: ${JSON.stringify(rec.portalClone)} (cursor ${Math.round(cx)},${Math.round(cy)})`);
  await shot(page, `ctx-${key.replace(',', '-')}`);
  await page.evaluate(() => document.getElementById('__mk')?.remove());
  // close via outside click (control: should close)
  await page.mouse.click(5, H - 5);
  await page.waitForTimeout(250);
}
note('CB ancestors (first pad): ' + JSON.stringify(results[0]?.containingBlockAncestors));
note('Clip ancestors (first pad): ' + JSON.stringify(results[0]?.clipAncestors));

// ── Try to actually lock via real mouse on the best-case pad
const best = [...results].sort((a, b) => b.hittableButtons - a.hittableButtons)[0];
note(`best-case pad for lock attempt: ${best?.pad} hittable ${best?.hittableButtons}`);
for (const r of results) {
  const key = r.pad;
  const pad = page.locator(`[title^="[${key}] "]`).first();
  await pad.click({ button: 'right' });
  await page.waitForTimeout(300);
  const lockBtn = (await measure()).buttons?.find(b => /Lock to this pad/.test(b.label));
  if (!lockBtn) { note(`LOCK ${key}: no lock button`); continue; }
  if (!lockBtn.hittable) {
    note(`LOCK ${key}: lock button at (${lockBtn.cx},${lockBtn.cy}) NOT hittable (covered/clipped, hit=${lockBtn.hitEl}); clicking there anyway`);
  }
  await page.mouse.click(lockBtn.cx, lockBtn.cy);
  await page.waitForTimeout(400);
  const locked = await page.locator(`[title^="[${key}] "] [title="Placement locked"]`).count();
  note(`LOCK ${key}: after real click at lock button -> lock indicator present=${locked > 0}; menus open=${await menuCount()}`);
  await page.mouse.click(5, H - 5);
  await page.waitForTimeout(200);
}

// ── Escape behaviour (real key presses)
const escKey = results.find(r => r.pad === '4,3')?.pad || results[0].pad;
const esc = [];
for (let trial = 0; trial < 3; trial++) {
  await page.locator(`[title^="[${escKey}] "]`).first().click({ button: 'right' });
  await page.waitForTimeout(300);
  const before = await menuCount();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const after1 = await menuCount();
  if (trial === 0) await shot(page, 'after-1st-escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const after2 = await menuCount();
  esc.push({ trial, before, after1stRealEscape: after1, after2ndRealEscape: after2 });
  await page.mouse.click(5, H - 5);
  await page.waitForTimeout(200);
}
note('ESC real keyboard: ' + JSON.stringify(esc));

// Control: synthetic Escape dispatched from script (same JS stack; no microtask checkpoint between listeners)
await page.locator(`[title^="[${escKey}] "]`).first().click({ button: 'right' });
await page.waitForTimeout(300);
const synB = await menuCount();
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(300);
note(`ESC synthetic dispatch: before=${synB} after=${await menuCount()}`);
await page.mouse.click(5, H - 5);
await page.waitForTimeout(200);

// Control: listener order hypothesis. Wrap addEventListener to log keydown listener registration order during a real Escape.
await page.evaluate(() => {
  window.__kd = [];
  const origAdd = document.addEventListener.bind(document);
  const origRem = document.removeEventListener.bind(document);
  document.addEventListener = function (t, fn, o) { if (t === 'keydown') window.__kd.push('add:' + (fn.toString().includes('SELECT_EVENT') ? 'global' : fn.toString().includes('onClose') ? 'menu' : 'other')); return origAdd(t, fn, o); };
  document.removeEventListener = function (t, fn, o) { if (t === 'keydown') window.__kd.push('rem:' + (fn.toString().includes('SELECT_EVENT') ? 'global' : fn.toString().includes('onClose') ? 'menu' : 'other')); return origRem(t, fn, o); };
});
await page.locator(`[title^="[${escKey}] "]`).first().click({ button: 'right' });
await page.waitForTimeout(300);
await page.evaluate(() => window.__kd.push('--- escape pressed ---'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => window.__kd.push('--- 2nd escape pressed ---'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
note('keydown listener churn: ' + JSON.stringify(await page.evaluate(() => window.__kd)));
note(`menus after that sequence: ${await menuCount()}`);
await page.mouse.click(5, H - 5);
await page.waitForTimeout(200);

// ── Root-cause control: neutralise the containing-block ancestors (no transform / backdrop-filter) → menu should land at the cursor
await page.addStyleTag({ content: `.glass-panel-blur{backdrop-filter:none!important} div[style*="scale("]{transform:none!important}` });
await page.waitForTimeout(400);
const ctlKey = results.find(r => r.pad === '3,7')?.pad || results[0].pad;
const cpb = await page.locator(`[title^="[${ctlKey}] "]`).first().boundingBox();
const ccx = cpb.x + cpb.width / 2, ccy = cpb.y + cpb.height / 2;
await page.mouse.click(ccx, ccy, { button: 'right' });
await page.waitForTimeout(400);
const cm = await measure();
note(`CONTROL (containing block neutralised) pad ${ctlKey} click=(${Math.round(ccx)},${Math.round(ccy)}) rect=${JSON.stringify(cm.rect)} effScale=${cm.effScale} visible%=${cm.visibleAreaPct} hittable=${cm.hittableButtons}/${cm.totalButtons} cbAnc=${JSON.stringify(cm.containingBlockAncestors)}`);
await shot(page, 'control-no-transform');

writeFileSync(resolve(OUT, `${TAG}-results.json`), JSON.stringify({ results, esc }, null, 1));
writeFileSync(resolve(OUT, `${TAG}-log.txt`), log.join('\n'));
await browser.close();
