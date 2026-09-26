// Shared helpers for the C2 reproduction probe (written from scratch).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { resolve } from 'path';

export const OUT = '.ui-repro-out/C2';
export const URL = process.env.URL || 'http://localhost:5173';
export const MIDI = 'test/fixtures/midi/TEST MIDI 1.mid';

export async function setup(tag, { W = 1600, H = 1000 } = {}) {
  mkdirSync(OUT, { recursive: true });
  const logFile = resolve(OUT, `${tag}-log.txt`);
  writeFileSync(logFile, `# ${tag} ${new Date().toISOString()} viewport ${W}x${H}\n`);
  const note = (s) => { console.log(`[${tag}] ${s}`); appendFileSync(logFile, s + '\n'); };
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(`${d.type()}: ${d.message()}`); note(`DIALOG ${d.type()}: ${d.message()}`); await d.accept(); });
  page.on('pageerror', e => note('PAGEERROR ' + e.message));
  let n = 0;
  const shot = async (name) => {
    n += 1;
    const f = resolve(OUT, `${tag}-${String(n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: f });
    note(`SHOT ${f}`);
    return f;
  };
  return { browser, ctx, page, note, shot, dialogs };
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

/** Read the main interactive grid: { "r,c": "voiceName" } for occupied pads. */
export async function readGrid(page) {
  return await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[title]')) {
      const t = el.getAttribute('title') || '';
      const m = t.match(/^\[(\d),(\d)\] (.+)$/);
      if (!m) continue;
      if (m[3].startsWith('empty')) continue;
      const name = m[3].split(' | ')[0];
      out[`${m[1]},${m[2]}`] = name;
    }
    return out;
  });
}

export const fmt = (g) => Object.entries(g).sort().map(([k, v]) => `[${k}] ${v.replace('TEST MIDI 1 ', 'S')}`).join('; ') || '(empty)';

/** Pads that differ between two grid maps (by sound->pad). */
export function diff(a, b) {
  const inv = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [v, k]));
  const ia = inv(a), ib = inv(b);
  const names = new Set([...Object.keys(ia), ...Object.keys(ib)]);
  const moved = [];
  for (const nm of names) if (ia[nm] !== ib[nm]) moved.push(`${nm.replace('TEST MIDI 1 ', 'S')}: ${ia[nm] ?? '-'} -> ${ib[nm] ?? '-'}`);
  return moved;
}

export async function summaryName(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
  const i = lines.findIndex(l => /^layout summary$/i.test(l));
  if (i < 0) return '(no summary)';
  return lines.slice(i + 1, i + 4).filter(l => !/^learn more$/i.test(l)).slice(0, 2).join(' | ');
}

export async function variantsInfo(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  const m = txt.match(/Saved Variants \((\d+)\)/i);
  return m ? Number(m[1]) : 0;
}

export async function toolbarState(page) {
  return await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean);
    return btns.filter(t => /^(Promote|Save Variant|Discard|Save|Saved|Undo|Redo|Generate)$/.test(t)).join(',');
  });
}

/** Search visible text for any warning language about losing/replacing a draft. */
export async function warningText(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  const hits = txt.split('\n').filter(l => /(replace|overwrit|unsaved|will be lost|lose your|discard your|your draft)/i.test(l));
  return hits.length ? hits.join(' || ') : 'none';
}

export async function dragSoundToPad(page, soundIdx, r, c) {
  const rows = page.locator('div[draggable="true"]:has(button[title="Color & group"])');
  await rows.nth(soundIdx).dragTo(page.locator(`[title^="[${r},${c}] empty"]`).first());
  await page.waitForTimeout(500);
}

export async function movePad(page, from, to) {
  const src = page.locator(`[title^="[${from[0]},${from[1]}] "]`).first();
  const dst = page.locator(`[title^="[${to[0]},${to[1]}] "]`).first();
  await src.dragTo(dst);
  await page.waitForTimeout(600);
}

/** Build a hand-made draft: 7 sounds on deliberately unusual pads. */
export const MANUAL = process.env.MANUAL_ALT
  ? [[6, 0], [6, 1], [5, 0], [6, 7], [5, 7], [6, 6], [1, 3]]
  : [[0, 0], [0, 1], [1, 0], [0, 7], [1, 7], [0, 6], [7, 3]];
export async function buildManualDraft(page) {
  for (let i = 0; i < MANUAL.length; i++) await dragSoundToPad(page, i, MANUAL[i][0], MANUAL[i][1]);
  await page.waitForTimeout(1200);
}

export async function clickGenerateAndWait(page, note) {
  const btn = page.locator('button:has-text("Generate")').first();
  await btn.click();
  const t0 = Date.now();
  await page.waitForTimeout(600);
  for (let i = 0; i < 120; i++) {
    const busy = await page.locator('text=/Generating candidates|Greedy optimization|optimization:|Preparing layout|Ranking results/').first().isVisible().catch(() => false);
    if (!busy) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);
  note?.(`INFO generate took ~${Date.now() - t0}ms`);
}

export function cardLocator(page, rank) {
  return page.locator(`div.cursor-pointer:has(> div.p-2\\.5 span:text-is("#${rank}"))`).first();
}
