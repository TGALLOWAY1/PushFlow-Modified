// C2 scenario 1: Generate, Preview, card-body click overwrite a hand-made draft.
// Also negative controls that should NOT touch the draft (compare checkbox,
// Compare modal, delete candidate), an Undo-recovery attempt at human pace,
// and a reload to see what was persisted.
import { setup, newProjectWithMidi, readGrid, fmt, diff, summaryName, variantsInfo, toolbarState,
  warningText, buildManualDraft, clickGenerateAndWait, cardLocator, movePad } from './lib.mjs';

const W = Number(process.env.W || 1600), H = Number(process.env.H || 1000);
const tag = `s1-${W}`;
const { browser, page, note, shot, dialogs } = await setup(tag, { W, H });

const snap = async (label) => {
  const g = await readGrid(page);
  note(`${label}: grid=${fmt(g)}`);
  note(`${label}: summary="${await summaryName(page)}" toolbar=[${await toolbarState(page)}] variants=${await variantsInfo(page)} warnings=${await warningText(page)} dialogs=${dialogs.length}`);
  return g;
};

await newProjectWithMidi(page);
await buildManualDraft(page);
const G0 = await snap('A0 hand-made draft');
await shot('A0-manual-draft');

// ── A. Generate
const dlgBefore = dialogs.length;
await clickGenerateAndWait(page, note);
const G1 = await snap('A1 after Generate');
await shot('A1-after-generate');
const dA = diff(G0, G1);
note(`RESULT A Generate: ${dA.length}/7 sounds moved; dialogs during Generate=${dialogs.length - dlgBefore}; moved: ${dA.join(', ')}`);

// ── Hand-edit the new draft: move one sound onto [7,7]
const occ = Object.keys(G1).sort()[0].split(',').map(Number);
await movePad(page, occ, (process.env.MANUAL_ALT ? [2, 7] : [7, 7]));
const G2 = await snap('B0 after hand edit (moved to [7,7])');
await shot('B0-hand-edit-7-7');
note(`INFO [7,7] holds: ${G2[process.env.MANUAL_ALT ? '2,7' : '7,7'] ?? 'empty'}`);

// ── Negative controls: these should NOT overwrite the draft
await cardLocator(page, 2).locator('button[title="Select for comparison"]').click();
await page.waitForTimeout(600);
let g = await readGrid(page);
note(`NEG compare-checkbox #2: draft unchanged=${diff(G2, g).length === 0} ([7,7]=${g['7,7'] ?? 'empty'})`);

await cardLocator(page, 3).locator('button[title="Select for comparison"]').click();
await page.waitForTimeout(400);
await page.locator('button:has-text("Compare (")').first().click();
await page.waitForTimeout(1200);
await shot('N-compare-modal-open');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const closeBtn = page.locator('.fixed button:has-text("Close"), .fixed button:has-text("×")').first();
if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
await page.waitForTimeout(800);
g = await readGrid(page);
note(`NEG compare modal open/close: draft unchanged=${diff(G2, g).length === 0} ([7,7]=${g['7,7'] ?? 'empty'}) diffs=${diff(G2, g).join(', ')}`);
// untick compare boxes
await cardLocator(page, 2).locator('button[title="Select for comparison"]').click().catch(() => {});
await cardLocator(page, 3).locator('button[title="Select for comparison"]').click().catch(() => {});

const nCards0 = await page.locator('button:has-text("Preview")').count();
await cardLocator(page, 4).locator('button[title="Delete candidate"]').click();
await page.waitForTimeout(200);
await cardLocator(page, 4).locator('button[title="Confirm Delete"]').click();
await page.waitForTimeout(800);
g = await readGrid(page);
note(`NEG delete candidate #4 (cards ${nCards0}->${await page.locator('button:has-text("Preview")').count()}): draft unchanged=${diff(G2, g).length === 0} ([7,7]=${g['7,7'] ?? 'empty'})`);
const G2b = await snap('B1 after negative controls');

// ── B. Preview button on #2
await cardLocator(page, 2).locator('button:has-text("Preview")').click();
await page.waitForTimeout(2500);
const G3 = await snap('B2 after Preview #2');
await shot('B2-after-preview-2');
note(`RESULT B Preview #2: [7,7] now=${G3['7,7'] ?? 'empty'}; ${diff(G2b, G3).length} sounds moved: ${diff(G2b, G3).join(', ')}`);

// ── C. Card body click (Score text), not the Preview button
const occ3 = Object.keys(G3).sort()[0].split(',').map(Number);
await movePad(page, occ3, (process.env.MANUAL_ALT ? [2, 7] : [7, 7]));
const G4 = await snap('C0 after hand edit again (moved to [7,7])');
await shot('C0-hand-edit-again');
await cardLocator(page, 3).locator('text=/^Score:/').click();
await page.waitForTimeout(2500);
const G5 = await snap('C1 after clicking card #3 body (Score text)');
await shot('C1-after-card-body-click');
note(`RESULT C card-body click #3: [7,7] now=${G5['7,7'] ?? 'empty'}; ${diff(G4, G5).length} sounds moved: ${diff(G4, G5).join(', ')}`);

// ── Persistence: wait for autosave, reload, and see what the project holds
await page.waitForTimeout(3500);
note(`INFO toolbar before reload: [${await toolbarState(page)}]`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const GR = await snap('P after reload');
await shot('P-after-reload');
note(`RESULT persistence: reloaded grid equals last candidate=${diff(G5, GR).length === 0}; equals hand-made G0=${diff(G0, GR).length === 0}`);

note(`SUMMARY dialogs total=${dialogs.length}: ${dialogs.join(' || ') || 'none'}`);
await browser.close();
