// C2 scenario 3:
//  (a) Undo recovery at human pace right after Generate overwrote a hand-made draft
//  (b) NEG control: all pads placement-locked -> Generate / Preview should keep them
//  (c) Edit made WHILE Generate is running -> is it overwritten when the run finishes?
import { setup, newProjectWithMidi, readGrid, fmt, diff, summaryName, toolbarState,
  buildManualDraft, clickGenerateAndWait, cardLocator, movePad, MANUAL } from './lib.mjs';

const part = process.env.PART || 'a';
const { browser, page, note, shot, dialogs } = await setup(`s3${part}`, {});
await newProjectWithMidi(page);
await buildManualDraft(page);
const G0 = await readGrid(page);
note(`hand-made draft: ${fmt(G0)}`);

if (part === 'a') {
  await clickGenerateAndWait(page, note);
  const G1 = await readGrid(page);
  note(`after Generate: ${fmt(G1)} (moved ${diff(G0, G1).length}/7)`);
  const undo = page.locator('button:has-text("Undo")').first();
  for (let i = 1; i <= 8; i++) {
    const enabled = await undo.isEnabled().catch(() => false);
    if (!enabled) { note(`undo #${i}: Undo button disabled`); break; }
    await undo.click();
    await page.waitForTimeout(1500);   // human pace
    const g = await readGrid(page);
    note(`undo #${i} (1.5s gap): ${fmt(g)} | equals hand-made=${diff(G0, g).length === 0} | summary="${await summaryName(page)}"`);
    if (diff(G0, g).length === 0) { await shot(`undo-recovered-after-${i}`); break; }
    if (i === 1) await shot('undo-after-1');
  }
  await page.waitForTimeout(3000);
  const gEnd = await readGrid(page);
  note(`3s after last undo: equals hand-made=${diff(G0, gEnd).length === 0} ${fmt(gEnd)} toolbar=[${await toolbarState(page)}]`);
  await shot('undo-final');
}

if (part === 'd') {
  // Rapid Undo (presses 150 ms apart, all inside the 1 s auto-analysis debounce)
  await clickGenerateAndWait(page, note);
  const G1 = await readGrid(page);
  note(`after Generate: moved ${diff(G0, G1).length}/7`);
  const undo = page.locator('button:has-text("Undo")').first();
  for (let i = 1; i <= 6; i++) {
    if (!(await undo.isEnabled().catch(() => false))) { note(`rapid undo #${i}: disabled`); break; }
    await undo.click();
    await page.waitForTimeout(150);
    const g = await readGrid(page);
    note(`rapid undo #${i} (150ms gap): equals hand-made=${diff(G0, g).length === 0} ${fmt(g)}`);
    if (diff(G0, g).length === 0) break;
  }
  await page.waitForTimeout(3000);
  const gEnd = await readGrid(page);
  note(`3s after rapid undo: equals hand-made=${diff(G0, gEnd).length === 0} summary="${await summaryName(page)}" candidates=${await page.locator('button:has-text("Preview")').count()}`);
  await shot('rapid-undo-final');
}

if (part === 'b') {
  for (const [r, c] of MANUAL) {
    await page.locator(`[title^="[${r},${c}] "]`).first().click({ button: 'right' });
    await page.waitForTimeout(250);
    await page.locator('button:has-text("Lock to this pad")').first().click();
    await page.waitForTimeout(250);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await shot('locked-all');
  await clickGenerateAndWait(page, note);
  const G1 = await readGrid(page);
  note(`NEG locked + Generate: ${fmt(G1)} | draft positions preserved=${diff(G0, G1).length === 0} | summary="${await summaryName(page)}"`);
  await shot('locked-after-generate');
  const nPrev = await page.locator('button:has-text("Preview")').count();
  note(`candidates listed: ${nPrev}`);
  if (nPrev >= 2) {
    await cardLocator(page, 2).locator('button:has-text("Preview")').click();
    await page.waitForTimeout(2000);
    const G2 = await readGrid(page);
    note(`NEG locked + Preview #2: positions preserved=${diff(G0, G2).length === 0} ${fmt(G2)} summary="${await summaryName(page)}"`);
  }
}

if (part === 'c') {
  await page.locator('button:has-text("Generate")').first().click();
  await page.waitForTimeout(1500);
  const busy = await page.locator('text=/Generating candidates/').first().isVisible().catch(() => false);
  note(`generation running=${busy}`);
  await movePad(page, [7, 3], [7, 7]).catch(e => note('edit during run failed: ' + e.message.split('\n')[0]));
  const Gmid = await readGrid(page);
  note(`edit during generation: [7,7]=${Gmid['7,7'] ?? 'empty'} ${fmt(Gmid)}`);
  await shot('edit-during-generation');
  for (let i = 0; i < 120; i++) {
    const b = await page.locator('text=/Generating candidates/').first().isVisible().catch(() => false);
    if (!b) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);
  const G1 = await readGrid(page);
  note(`after run finished: [7,7]=${G1['7,7'] ?? 'empty'} ${fmt(G1)} summary="${await summaryName(page)}"`);
  await shot('after-run-finished');
}
note(`dialogs=${dialogs.length} ${dialogs.join(' || ')}`);
await browser.close();
