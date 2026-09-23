// Probe A: full layout (via explicit "Suggest a starting layout"), every event, onion OFF vs ON.
import { launch, newProjectWithMidi, waitIdle, openEventsTab, setOnion, snapshotPads, gridBox, pixelDiff, diffSnap, save, OUT } from './lib.mjs';
import { resolve } from 'path';

const W = parseInt(process.env.W || '1600', 10), H = parseInt(process.env.H || '1000', 10);
const GEN = process.env.GEN === '1';
const TAG = `${W}x${H}${GEN ? '-generated' : ''}`;
const { browser, page, errors } = await launch(W, H);
const log = [];
const note = s => { console.log(s); log.push(s); };

await newProjectWithMidi(page);
await page.locator('button:has-text("Suggest a starting layout")').first().click();
await waitIdle(page, 2500);
if (GEN) {
  await page.locator('button:has-text("Generate")').first().click();
  await page.waitForTimeout(1500);
  await waitIdle(page, 3000);
  const prev = page.locator('button:has-text("Preview")');
  note(`preview buttons: ${await prev.count()}`);
  if (await prev.count() > 1) { await prev.nth(1).click(); await page.waitForTimeout(1500); }
}
const placed = await page.evaluate(() => [...document.querySelectorAll('div[title^="["]')].filter(el => /^\[\d,\d\] /.test(el.title) && !/empty/.test(el.title)).map(el => el.title));
note(`placed pads: ${placed.length} :: ${placed.join(' ; ')}`);

await openEventsTab(page);
const nMoments = await page.locator('button[data-moment-index]').count();
note(`moments: ${nMoments}`);

// Before any selection: onion off vs on
await setOnion(page, false);
const noSelOff = await snapshotPads(page);
const box0 = await gridBox(page);
const imgNoSelOff = await page.screenshot({ clip: box0 });
await setOnion(page, true);
const noSelOn = await snapshotPads(page);
const imgNoSelOn = await page.screenshot({ clip: box0 });
note(`NO SELECTION: style diffs off->on = ${diffSnap(noSelOff, noSelOn).length}; pixels ${JSON.stringify(await pixelDiff(page, imgNoSelOff, imgNoSelOn))}`);
await setOnion(page, false);

const results = [];
const LIMIT = Math.min(nMoments, parseInt(process.env.LIMIT || '999', 10));
for (let i = 0; i < LIMIT; i++) {
  await page.locator(`button[data-moment-index="${i}"]`).first().click();
  await page.waitForTimeout(350);
  const box = await gridBox(page);
  await setOnion(page, false);
  const off = await snapshotPads(page);
  const imgOff = await page.screenshot({ clip: box });
  const on = (await setOnion(page, true), await snapshotPads(page));
  const imgOn = await page.screenshot({ clip: box });
  const d = diffSnap(off, on);
  const px = await pixelDiff(page, imgOff, imgOn);
  const prevPads = Object.entries(on).filter(([, v]) => v.isPreviousClass).map(([k, v]) => ({ k, opacity: v.opacity, filter: v.filter, greyClass: v.isGreyClass, occupied: !/empty/.test(v.title) }));
  const selPads = Object.entries(on).filter(([, v]) => /scale-105 brightness-125/.test(v.cls)).map(([k]) => k);
  const nextPads = Object.entries(on).filter(([, v]) => /border-dashed/.test(v.cls)).map(([k]) => k);
  const redRing = Object.entries(on).filter(([, v]) => v.redRing).map(([k]) => k);
  const ghosts = Object.entries(on).filter(([, v]) => v.dottedGhost).map(([k]) => k);
  // "next" hint also visible with onion OFF?
  const nextPadsOff = Object.entries(off).filter(([, v]) => /border-dashed/.test(v.cls)).map(([k]) => k);
  results.push({ moment: i + 1, selPads, prevPads, nextPads, nextPadsOff, redRing, ghosts, styleDiffs: d.length, diffs: d.slice(0, 6), px });
  if (i === 4 || i === 1 || (d.length > 0 && !results.slice(0, -1).some(r => r.styleDiffs > 0))) {
    await page.screenshot({ path: resolve(OUT, `A-${TAG}-m${String(i + 1).padStart(2, '0')}-onion-on-full.png`) });
    await setOnion(page, false);
    await page.screenshot({ path: resolve(OUT, `A-${TAG}-m${String(i + 1).padStart(2, '0')}-onion-off-full.png`) });
    await page.screenshot({ path: resolve(OUT, `A-${TAG}-m${String(i + 1).padStart(2, '0')}-onion-off-grid.png`), clip: box });
    await setOnion(page, true);
    await page.screenshot({ path: resolve(OUT, `A-${TAG}-m${String(i + 1).padStart(2, '0')}-onion-on-grid.png`), clip: box });
  }
  await setOnion(page, false);
}

const withPrev = results.filter(r => r.prevPads.length > 0);
const anyStyle = results.filter(r => r.styleDiffs > 0);
const anyPx = results.filter(r => r.px.differing > 0);
note(`events probed: ${results.length}; with previous pads: ${withPrev.length}; with ANY computed-style diff off->on: ${anyStyle.length}; with ANY pixel diff: ${anyPx.length}`);
note(`previous-pad computed opacities seen (onion on): ${[...new Set(withPrev.flatMap(r => r.prevPads.map(p => p.opacity + '/' + p.filter)))].join(', ')}`);
note(`previous pads occupied: ${withPrev.flatMap(r => r.prevPads).filter(p => p.occupied).length} / ${withPrev.flatMap(r => r.prevPads).length}`);
note(`red impossible rings seen: ${results.filter(r => r.redRing.length).length}; dotted ghosts seen: ${results.filter(r => r.ghosts.length).length}`);
note(`events with 'next' dashed hint while onion OFF: ${results.filter(r => r.nextPadsOff.length).length}`);
for (const r of anyStyle.slice(0, 10)) note(`  DIFF m${r.moment}: ${JSON.stringify(r.diffs)} px=${JSON.stringify(r.px)}`);
for (const r of results.slice(0, 6)) note(`  m${r.moment}: sel=${r.selPads} prev=${JSON.stringify(r.prevPads)} next=${r.nextPads} px=${r.px.differing}`);
save(`A-${TAG}-results.json`, results);
save(`A-${TAG}-log.txt`, log.join('\n') + '\n\nERRORS:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
