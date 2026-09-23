// Shared helpers for the C5 (onion skin) repro probes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const OUT = '.ui-repro-out/C5';
export const URL = process.env.URL || 'http://localhost:5173';
export const MIDI = 'archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';
mkdirSync(OUT, { recursive: true });

export async function launch(W = 1600, H = 1000) {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  return { browser, ctx, page, errors };
}

export async function newProjectWithMidi(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
  await page.waitForURL('**/project/**');
  await page.waitForTimeout(1000);
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
  await page.waitForTimeout(2500);
}

export async function waitIdle(page, ms = 1500) {
  for (let i = 0; i < 60; i++) {
    const busy = await page.locator('text=/Generating|Analyzing/').first().isVisible().catch(() => false);
    if (!busy) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(ms);
}

export async function openEventsTab(page) {
  await page.locator('button.pf-tab:has-text("Events")').first().click();
  await page.waitForTimeout(500);
}

export const onionBtn = (page) =>
  page.locator('button[title="Show previous/next event layers on grid"], button[title="Disable onion skin"]').first();

export async function setOnion(page, on) {
  const btn = onionBtn(page);
  const t = await btn.getAttribute('title');
  const isOn = t === 'Disable onion skin';
  if (isOn !== on) { await btn.click(); await page.waitForTimeout(400); }
  return (await btn.getAttribute('title')) === 'Disable onion skin';
}

/** Snapshot every pad: computed opacity/filter/border/ring + onion-specific markers. */
export async function snapshotPads(page) {
  return page.evaluate(() => {
    const out = {};
    const pads = [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\]/.test(el.title));
    for (const el of pads) {
      const key = el.title.slice(1, 4);
      const cs = getComputedStyle(el);
      const dotted = [...el.children].some(c => c.style && /dotted/.test(c.style.border || ''));
      out[key] = {
        title: el.title,
        cls: el.className.replace(/\s+/g, ' ').trim(),
        opacity: cs.opacity,
        filter: cs.filter,
        borderStyle: cs.borderTopStyle,
        borderColor: cs.borderTopColor,
        boxShadow: cs.boxShadow,
        transform: cs.transform,
        bg: cs.backgroundColor,
        isPreviousClass: /(^|\s)opacity-60(\s|$)/.test(el.className),
        isGreyClass: /opacity-20/.test(el.className),
        redRing: /ring-red-500/.test(el.className),
        dottedGhost: dotted,
        text: el.innerText.replace(/\s+/g, ' ').trim(),
      };
    }
    return out;
  });
}

export async function gridBox(page) {
  return page.evaluate(() => {
    const a = [...document.querySelectorAll('div[title^="[7,0]"]')][0];
    const b = [...document.querySelectorAll('div[title^="[0,7]"]')][0];
    if (!a || !b) return null;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return { x: Math.floor(ra.left - 30), y: Math.floor(ra.top - 12), width: Math.ceil(rb.right - ra.left + 44), height: Math.ceil(rb.bottom - ra.top + 24) };
  });
}

/** Count differing pixels between two PNG buffers (decoded in-page via canvas). */
export async function pixelDiff(page, bufA, bufB) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, w, h).data;
    g.clearRect(0, 0, w, h); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, w, h).data;
    let n = 0, maxd = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 12) n++;
      if (d > maxd) maxd = d;
    }
    return { differing: n, total: w * h, maxChannelSum: maxd, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height] };
  }, [bufA.toString('base64'), bufB.toString('base64')]);
}

export function diffSnap(a, b) {
  const diffs = [];
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    if (!y) continue;
    for (const f of ['opacity', 'filter', 'borderStyle', 'borderColor', 'boxShadow', 'transform', 'bg', 'dottedGhost', 'text']) {
      if (x[f] !== y[f]) diffs.push({ pad: k, field: f, off: x[f], on: y[f] });
    }
  }
  return diffs;
}

export function save(name, obj) { writeFileSync(resolve(OUT, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }
