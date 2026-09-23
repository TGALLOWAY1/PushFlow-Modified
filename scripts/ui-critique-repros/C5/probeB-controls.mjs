// Probe B: conditions under which onion skin SHOULD produce a visible change.
//  B1 impossible reach: two sounds placed far apart on the left side and both forced to L2,
//     so the finger must jump > 5 pads between consecutive events -> onion-gated red ring.
//  B2 partial layout: select an event whose sound is not on the grid (no selected pads),
//     previous event's pad is on the grid -> grey-out is skipped, so opacity-60 could show.
import { launch, newProjectWithMidi, waitIdle, openEventsTab, setOnion, snapshotPads, gridBox, pixelDiff, diffSnap, save, OUT } from './lib.mjs';
import { resolve } from 'path';

const W = parseInt(process.env.W || '1600', 10), H = parseInt(process.env.H || '1000', 10);
const { browser, page, errors } = await launch(W, H);
const log = [];
const note = s => { console.log(s); log.push(s); };

await newProjectWithMidi(page);

const rowFor = name => page.locator(`div[draggable="true"]:has(button[title="Color & group"])`).filter({ hasText: new RegExp(`${name}$|${name}\\b(?!\\d)`) }).first();
async function place(name, r, c) {
  const pad = page.locator(`[title^="[${r},${c}] empty"]`).first();
  await rowFor(name).dragTo(pad);
  await page.waitForTimeout(800);
}
// sound "TEST MIDI 1 3" is moment 02, "TEST MIDI 1 2" is moment 03 (consecutive single-note moments)
await place('TEST MIDI 1 3', 0, 0);
await place('TEST MIDI 1 2', 7, 3);
await waitIdle(page, 1500);
note('placed: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\] /.test(el.title) && !/empty/.test(el.title)).map(el => el.title))));

// Force both to L2 via the Sounds panel finger input (explicit user action)
async function setFinger(name, val) {
  const row = rowFor(name);
  const btn = row.locator('button[title^="Solver suggestion"], button[title^="Click to assign finger"], button[title$="click to edit"]').first();
  await btn.click();
  const input = row.locator('input[maxlength="2"]').first();
  await input.fill(val);
  await input.press('Enter');
  await page.waitForTimeout(800);
}
await setFinger('TEST MIDI 1 3', 'L2');
await setFinger('TEST MIDI 1 2', 'L2');
await waitIdle(page, 2000);
await page.screenshot({ path: resolve(OUT, `B-${W}x${H}-00-setup.png`) });

await openEventsTab(page);

async function probeMoment(idx, label) {
  await setOnion(page, false);
  await page.locator(`button[data-moment-index="${idx}"]`).first().click();
  await page.waitForTimeout(400);
  const selectedRow = await page.locator(`button[data-moment-index="${idx}"].bg-blue-600\\/20`).count();
  const box = await gridBox(page);
  const off = await snapshotPads(page);
  const imgOff = await page.screenshot({ clip: box });
  await page.screenshot({ path: resolve(OUT, `B-${W}x${H}-${label}-onion-off.png`), clip: box });
  await setOnion(page, true);
  const on = await snapshotPads(page);
  const imgOn = await page.screenshot({ clip: box });
  await page.screenshot({ path: resolve(OUT, `B-${W}x${H}-${label}-onion-on.png`), clip: box });
  await page.screenshot({ path: resolve(OUT, `B-${W}x${H}-${label}-onion-on-full.png`) });
  const px = await pixelDiff(page, imgOff, imgOn);
  const d = diffSnap(off, on);
  const occ = Object.fromEntries(Object.entries(on).filter(([, v]) => !/empty/.test(v.title)).map(([k, v]) => [k, { cls_prev: v.isPreviousClass, cls_grey: v.isGreyClass, redRingClass: v.redRing, opacity: v.opacity, filter: v.filter, boxShadow: v.boxShadow, offOpacity: off[k].opacity, offBoxShadow: off[k].boxShadow }]));
  const selInfo = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === 'SELECTED EVENT');
    return el ? el.parentElement?.parentElement?.innerText.replace(/\s+/g, ' ').slice(0, 200) : null;
  });
  note(`[${label}] moment ${idx + 1} rowSelected=${selectedRow} styleDiffs=${d.length} px=${JSON.stringify(px)}`);
  note(`   occupied pads (onion on): ${JSON.stringify(occ)}`);
  note(`   diffs: ${JSON.stringify(d)}`);
  note(`   right panel: ${selInfo}`);
  await setOnion(page, false);
  return { idx, label, d, px, occ };
}

const r2 = await probeMoment(1, 'm02-impossible-reach');
const r3 = await probeMoment(2, 'm03-prev-on-grid');
const r4 = await probeMoment(3, 'm04-unplaced-sound');
save(`B-${W}x${H}-results.json`, [r2, r3, r4]);
save(`B-${W}x${H}-log.txt`, log.join('\n') + '\n\nERRORS:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
