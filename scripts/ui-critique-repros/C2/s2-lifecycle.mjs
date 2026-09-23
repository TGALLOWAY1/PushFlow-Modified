// C2 scenario 2: Load Draft / Promote candidate / Promote variant vs. an unsaved draft,
// plus negative controls: Generate when there is NO draft (Active only), Active-card click,
// and the "user saved a variant first" mitigation.
import { setup, newProjectWithMidi, readGrid, fmt, diff, summaryName, variantsInfo, toolbarState,
  warningText, buildManualDraft, clickGenerateAndWait, cardLocator, movePad } from './lib.mjs';

const { browser, page, note, shot, dialogs } = await setup('s2', {});
const snap = async (label) => {
  const g = await readGrid(page);
  note(`${label}: grid=${fmt(g)}`);
  note(`${label}: summary="${await summaryName(page)}" toolbar=[${await toolbarState(page)}] variants=${await variantsInfo(page)} warnings=${await warningText(page)} dialogs=${dialogs.length}`);
  return g;
};
const variantNames = async () => page.evaluate(() =>
  [...document.querySelectorAll('div.p-3')].filter(d => [...d.querySelectorAll('button')].some(b => b.innerText.trim() === 'Load Draft'))
    .map(d => d.querySelector('.font-medium')?.innerText.trim()));
const variantCard = (name) => page.locator('div.p-3:has(button:has-text("Load Draft"))', { hasText: name }).first();

await newProjectWithMidi(page);
await buildManualDraft(page);
const G0 = await snap('S0 hand-made draft');

// Mitigation path: user explicitly saves the draft as a variant, then promotes it to Active.
await page.locator('button:has-text("Save Variant")').first().click();
await page.waitForTimeout(600);
await page.locator('button[title="Make this layout the new Active Layout"]').click();
await page.waitForTimeout(2500);
const GA = await snap('S1 after Save Variant + toolbar Promote (Active = hand-made)');
note(`INFO variants: ${JSON.stringify(await variantNames())}`);
await shot('S1-active-is-handmade');

// ── NEG 1: Generate with no Working draft — Active must survive.
await clickGenerateAndWait(page, note);
const GG = await snap('N1 after Generate with no draft');
await page.locator('div.cursor-pointer:has(span:text-is("Active"))').first().click();   // Active card click
await page.waitForTimeout(800);
const GAc = await readGrid(page);
note(`NEG Active-card click: working draft unchanged=${diff(GG, GAc).length === 0}`);
await page.locator('button[title="Discard working changes"]').click();
await page.waitForTimeout(2500);
const GD = await snap('N1b after Discard (grid should be Active)');
note(`NEG Generate-without-draft: Active preserved=${diff(GA, GD).length === 0}`);
await shot('N1-active-preserved-after-discard');

// ── D. Load Draft over an unsaved edit
await movePad(page, Object.keys(GD).sort()[0].split(',').map(Number), [7, 7]);
const D1 = await snap('D0 unsaved edit on top of Active (moved to [7,7])');
await shot('D0-unsaved-edit');
await variantCard('variant').locator('button:has-text("Load Draft")').click();
await page.waitForTimeout(2500);
const D1b = await snap('D1 after Load Draft on saved variant');
await shot('D1-after-load-draft');
note(`RESULT D Load Draft: [7,7] now=${D1b['7,7'] ?? 'empty'}; moved=${diff(D1, D1b).join(', ')}; dialogs=${dialogs.length}`);

// ── E. Promote a candidate over an unsaved edit
await movePad(page, Object.keys(D1b).sort()[0].split(',').map(Number), [7, 7]);
const E0 = await snap('E0 unsaved edit (moved to [7,7])');
const vBefore = await variantNames();
const card2 = cardLocator(page, 2);
await card2.locator('button:has-text("Promote")').click();
await page.waitForTimeout(300);
await shot('E0b-card-promote-confirm-state');
await card2.locator('button:has-text("Confirm?")').click();
await page.waitForTimeout(2500);
const E1 = await snap('E1 after card #2 Promote -> Confirm?');
await shot('E1-after-candidate-promote');
const vAfter = await variantNames();
note(`RESULT E Promote candidate: [7,7] now=${E1['7,7'] ?? 'empty'}; variants before=${JSON.stringify(vBefore)} after=${JSON.stringify(vAfter)}; working-layout buttons visible=${await page.locator('button:has-text("Discard")').count() > 0}`);
// Did any auto-saved variant capture the edit? Load the newest one and check [7,7].
const newest = vAfter.find(v => !vBefore.includes(v));
if (newest) {
  await variantCard(newest).locator('button:has-text("Load Draft")').click();
  await page.waitForTimeout(2000);
  const chk = await readGrid(page);
  note(`CHECK newest auto-saved variant "${newest}": ${fmt(chk)} -> contains the [7,7] edit=${chk['7,7'] === E0['7,7']}; equals old Active (hand-made)=${diff(GA, chk).length === 0}`);
}

// ── F. Promote a saved variant over an unsaved edit
const Fstart = await readGrid(page);
await movePad(page, Object.keys(Fstart).sort()[0].split(',').map(Number), [7, 6]);
const F0 = await snap('F0 unsaved edit (moved to [7,6])');
const target = variantCard('variant');
await target.locator('button:has-text("Promote")').click();
await page.waitForTimeout(300);
await target.locator('button:has-text("Confirm?")').click();
await page.waitForTimeout(2500);
const F1 = await snap('F1 after variant Promote -> Confirm?');
await shot('F1-after-variant-promote');
note(`RESULT F Promote variant: [7,6] now=${F1['7,6'] ?? 'empty'} (edit was ${F0['7,6']}); variants now=${JSON.stringify(await variantNames())}`);

note(`SUMMARY dialogs total=${dialogs.length}: ${dialogs.join(' || ') || 'none'}`);
await browser.close();
