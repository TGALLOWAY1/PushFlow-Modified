// C8 deterministic flash capture: fake clock, step playback frame by frame, screenshot the grid
// at the same transport times with and without an event selected.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = '.ui-repro-out/C8';
const URL = process.env.URL || 'http://localhost:5173';
const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const OUT = resolve(BASE, `clock-${W}`);
const MIDI = 'test/fixtures/midi/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (s) => { console.log(s); log.push(s); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
await page.clock.install();
const lumPage = await ctx.newPage();
await lumPage.setContent('<canvas id=c></canvas>');

async function lum(buf) {
  return lumPage.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.getElementById('c'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let s = 0, sat = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      s += 0.2126 * r + 0.7152 * gg + 0.0722 * bb;
      sat += Math.max(r, gg, bb) - Math.min(r, gg, bb);
    }
    return { meanLum: +(s / n).toFixed(1), meanChroma: +(sat / n).toFixed(1) };
  }, buf.toString('base64'));
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
await page.waitForURL('**/project/**');
await page.waitForTimeout(1000);
await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
await page.waitForTimeout(2500);
await page.locator('button:has-text("Suggest a starting layout")').first().click();
await page.waitForTimeout(3500);

await page.evaluate(() => {
  window.__pads = () => [...document.querySelectorAll('div[title^="["]')]
    .filter(el => /^\[\d,\d\]/.test(el.title) && el.className.includes('w-14') && !el.title.includes('empty'))
    .map(el => {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return { key: el.title.match(/^\[(\d,\d)\]/)[1], op: parseFloat(cs.opacity), filter: cs.filter,
        lit: el.className.includes('brightness-200') || el.className.includes('brightness-150'),
        sel: el.className.includes('brightness-125'), text: el.innerText.replace(/\s+/g, ' ').trim(),
        box: { x: r.left, y: r.top, width: r.width, height: r.height } };
    });
  window.__t = () => { const sp = [...document.querySelectorAll('span.font-mono')].find(s => /^\d+\.\d\ds$/.test(s.textContent.trim())); return sp ? parseFloat(sp.textContent) : null; };
});
const clip = await page.evaluate(() => {
  const ps = window.__pads(); const all = [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\]/.test(el.title) && el.className.includes('w-14'));
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (const e of all) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  return { x: Math.max(0, x0 - 12), y: Math.max(0, y0 - 12), width: x1 - x0 + 24, height: y1 - y0 + 24 };
});

async function resetTransport() {
  const stop = page.locator('button:has-text("STOP")').first();
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await page.getByRole('button', { name: 'RESET', exact: true }).click();
  await page.waitForTimeout(200);
}

// Pause the fake clock; from here playback only advances when we step it.
await page.clock.pauseAt(Date.now() + 60_000);
await page.waitForTimeout(300);

const STEP = 16;
async function runPass(label, targetTimes /* null = discover strikes */) {
  await resetTransport();
  note(`DBG ${label} t after reset=${await page.evaluate(() => window.__t())}`);
  await page.locator('button:has-text("PLAY")').first().click();
  await page.waitForTimeout(150);
  note(`DBG ${label} t after play=${await page.evaluate(() => window.__t())}`);
  await page.clock.runFor(STEP); await page.waitForTimeout(25);
  note(`DBG ${label} t after 1 step=${await page.evaluate(() => window.__t())}`);
  const captured = [];
  let prevLit = new Set();
  let steps = 0;
  const pending = targetTimes ? [...targetTimes] : null;
  while (steps < 400) {
    await page.clock.runFor(STEP);
    await page.waitForTimeout(25);
    steps++;
    const st = await page.evaluate(() => ({ t: window.__t(), pads: window.__pads() }));
    const litNow = new Set(st.pads.filter(p => p.lit).map(p => p.key));
    let fire = false;
    if (!pending) {
      const newLit = [...litNow].filter(k => !prevLit.has(k));
      fire = newLit.length > 0 && captured.length < 6;
    } else if (pending.length && st.t >= pending[0]) {
      pending.shift(); fire = true;
    }
    prevLit = litNow;
    if (fire) {
      await page.waitForTimeout(300); // let 100ms CSS transitions settle (clock is paused)
      const st2 = await page.evaluate(() => ({ t: window.__t(), pads: window.__pads() }));
      const idx = captured.length;
      const file = `${label}-${idx}-t${st2.t.toFixed(2)}.png`;
      await page.screenshot({ path: resolve(OUT, file), clip });
      const padStats = [];
      for (const p of st2.pads) {
        const b = await page.screenshot({ clip: p.box });
        padStats.push({ key: p.key, text: p.text, lit: p.lit, sel: p.sel, op: p.op, filter: p.filter, ...(await lum(b)) });
      }
      captured.push({ t: st2.t, file, pads: padStats });
      note(`CAP ${label} t=${st2.t} ${file} :: ${padStats.map(p => `${p.key}${p.lit ? '*LIT*' : ''}${p.sel ? '[SEL ' + p.text + ']' : ''} op=${p.op} lum=${p.meanLum} chroma=${p.meanChroma}`).join(' | ')}`);
      if (captured.length === 1 && label.startsWith('B')) await page.screenshot({ path: resolve(OUT, `${label}-full-t${st2.t.toFixed(2)}.png`) });
      if (captured.length === 1 && label.startsWith('A')) await page.screenshot({ path: resolve(OUT, `${label}-full-t${st2.t.toFixed(2)}.png`) });
    }
    if (!pending && captured.length >= 6) break;
    if (pending && pending.length === 0) break;
  }
  await resetTransport();
  return captured;
}

const A = await runPass('A-noselect', null);
const times = A.map(c => c.t);
note(`INFO strike capture times from control: ${times.join(', ')}`);

// Select an event (Events tab row 09 → Event 13 at t=4.000s)
await page.locator('button.pf-tab:has-text("Events")').first().click();
await page.waitForTimeout(400);
await page.locator('div.overflow-y-auto.space-y-0\\.5 > *').nth(8).click();
await page.waitForTimeout(400);
const B = await runPass('B-selected', times);

// Summary table: per capture time, lit pads in A vs B
const rows = [];
for (let i = 0; i < Math.min(A.length, B.length); i++) {
  const a = A[i], b = B[i];
  const aLit = a.pads.filter(p => p.lit).map(p => p.key);
  for (const k of aLit) {
    const pa = a.pads.find(p => p.key === k), pb = b.pads.find(p => p.key === k);
    rows.push({ tA: a.t, tB: b.t, pad: k, A: { lit: pa.lit, op: pa.op, lum: pa.meanLum, chroma: pa.meanChroma }, B: { lit: pb.lit, sel: pb.sel, op: pb.op, filter: pb.filter, lum: pb.meanLum, chroma: pb.meanChroma, text: pb.text } });
  }
}
for (const r of rows) note(`CMP ${JSON.stringify(r)}`);
writeFileSync(resolve(OUT, 'compare.json'), JSON.stringify({ A, B, rows }, null, 1));
writeFileSync(resolve(OUT, 'log.txt'), log.join('\n'));
await browser.close();
