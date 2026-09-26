// Shared helpers for the C9 repro probes (preset drag-and-drop onto the grid).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const DIR = '.ui-repro-out/C9';
export const URL = process.env.URL || 'http://localhost:5173';
export const MIDI = 'test/fixtures/midi/TEST MIDI 1.mid';
export const PRESET_TYPE = 'application/x-pushflow-composer-preset';

export function makeLogger(name) {
  const lines = [];
  const note = (s) => { const t = `[${name}] ${s}`; console.log(t); lines.push(t); };
  const flush = () => writeFileSync(resolve(DIR, `${name}-log.txt`), lines.join('\n') + '\n');
  return { note, flush };
}

export async function launch(W = 1600, H = 1000) {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  return { browser, ctx };
}

export function wirePage(page, note, dialogAnswers = []) {
  const dialogs = [];
  page.on('dialog', async d => {
    dialogs.push(`${d.type()}: ${d.message()}`);
    note(`DIALOG ${d.type()}: ${JSON.stringify(d.message())}`);
    if (d.type() === 'prompt') {
      const ans = dialogAnswers.shift() ?? d.defaultValue();
      await d.accept(ans);
    } else {
      await d.accept();
    }
  });
  page.on('pageerror', e => note(`PAGEERROR ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') note(`CONSOLE.error ${m.text().slice(0, 200)}`); });
  return dialogs;
}

export async function shot(page, name, note) {
  const f = resolve(DIR, `${name}.png`);
  await page.screenshot({ path: f });
  note(`SHOT ${f}`);
  return f;
}

export async function newProject(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("New Performance"), button:has-text("New Project")').first().click();
  await page.waitForURL('**/project/**');
  await page.waitForTimeout(1200);
}

export async function importMidi(page) {
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(MIDI);
  await page.waitForTimeout(2500);
}

export const pad = (page, r, c) => page.locator(`[title^="[${r},${c}] "]`).first();

/** Dump every grid pad title that is not empty. */
export async function occupiedPads(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[title^="["]'))
      .map(el => el.getAttribute('title'))
      .filter(t => /^\[\d,\d\] /.test(t) && !t.includes('empty — drop a sound here'))
  );
}

export async function leftTab(page, name) {
  await page.locator(`button.pf-tab:has-text("${name}")`).first().click();
  await page.waitForTimeout(400);
}

/** Palette sound rows, by visible name. */
export function soundRow(page, name) {
  return page.locator(`div[draggable="true"]:has(button[title="Color & group"]):has-text("${name}")`).first();
}
export function soundRows(page) {
  return page.locator('div[draggable="true"]:has(button[title="Color & group"])');
}

/** Real mouse-driven HTML5 drag (Playwright intercepts and replays it as native drag events). */
export async function mouseDrag(page, fromLoc, toLoc, { midShot, note, holdMs = 400, beforeRelease } = {}) {
  const a = await fromLoc.boundingBox();
  const b = await toLoc.boundingBox();
  const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2, by = b.y + b.height / 2;
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax + 8, ay + 8, { steps: 3 });
  await page.mouse.move(bx, by, { steps: 15 });
  await page.mouse.move(bx + 1, by + 1, { steps: 2 });
  await page.waitForTimeout(holdMs);
  if (beforeRelease) await beforeRelease();
  if (midShot) await shot(page, midShot, note);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

/** Instrument drag events at window (capture) so we can see which ones fire and their dropEffect. */
export async function installDragSpy(page) {
  await page.evaluate((PT) => {
    window.__dragLog = [];
    if (window.__spyInstalled) return;
    window.__spyInstalled = true;
    for (const t of ['dragstart', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend']) {
      window.addEventListener(t, e => {
        const types = Array.from(e.dataTransfer?.types || []);
        const tgt = e.target?.closest?.('[title^="["]')?.getAttribute('title')?.slice(0, 12) ?? e.target?.tagName;
        window.__dragLog.push({ t, isPreset: types.includes(PT), effectAllowed: e.dataTransfer?.effectAllowed, dropEffect: e.dataTransfer?.dropEffect, tgt });
      }, true);
      // bubble-phase listener at window runs after React's root listener -> sees the final dropEffect
      window.addEventListener(t, e => {
        if (t === 'dragover') {
          const last = window.__dragLog[window.__dragLog.length - 1];
          if (last && last.t === 'dragover') last.finalDropEffect = e.dataTransfer?.dropEffect;
        }
      }, false);
    }
  }, PRESET_TYPE);
}

export async function dragSummary(page) {
  return page.evaluate(() => {
    const log = window.__dragLog || [];
    const counts = {};
    for (const e of log) counts[e.t] = (counts[e.t] || 0) + 1;
    const lastOver = [...log].reverse().find(e => e.t === 'dragover');
    const start = log.find(e => e.t === 'dragstart');
    const end = [...log].reverse().find(e => e.t === 'dragend');
    window.__dragLog = [];
    return { counts, start, lastOver, end };
  });
}

/** A/B fix: force dropEffect='copy' for preset drags only (runs after React's handler). */
export async function injectCopyFix(page) {
  await page.evaluate((PT) => {
    window.addEventListener('dragover', e => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(PT)) e.dataTransfer.dropEffect = 'copy';
    }, false);
  }, PRESET_TYPE);
}

export async function ghostCells(page) {
  // Ghost overlay divs: absolute inset-0 z-20 pointer-events-none with a 2px border
  return page.evaluate(() => Array.from(document.querySelectorAll('[title^="["] > div.absolute.inset-0.z-20'))
    .map(d => ({ pad: d.parentElement.getAttribute('title').slice(0, 5), border: d.style.border })));
}

export async function presetsInStorage(page) {
  return page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pushflow_composer_presets') || '[]'); } catch { return []; }
  });
}

export async function placedText(page) {
  const t = await page.locator('text=/Placed \\(\\d+\\)/').first().textContent().catch(() => null);
  return t;
}
