/**
 * C2 · Generate and Preview overwrite the Working/Test Layout (T01).
 *
 * Register root cause: APPLY_GENERATION_TO_LAYOUT replaces workingLayout with a
 * clone of the candidate without checking for an existing draft
 * (projectState.ts), and Generate dispatches it after every run
 * (useAutoAnalysis.ts). Preview, a card-body click, Load Draft and Promote
 * replace the draft the same way, with no copy kept.
 *
 * Flipped in S1a.2: the Generate, mid-run edit and recoverable-draft cases
 * (Generate only proposes; Recovered drafts). Flipped in S3.2: the Inspect
 * case. Preview became Inspect, which shows a layout read-only and never
 * writes; "Load Draft" became "Edit as draft", which asks before replacing a
 * draft that differs from Active; after Generate, candidate A is shown
 * read-only, so the hand-made draft is built after "Back to my draft".
 */

import { test, expect } from './fixtures';
import {
  openTestMidi1,
  placeSounds,
  suggestStartingLayout,
  chooseMethod,
  generateAndWait,
  shownPads,
  saveAndReload,
  isLayoutRecoverable,
  backToMyDraft,
} from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** A hand-made draft on deliberately unusual pads (from the C2 probe). */
const HAND_PADS = ['0,0', '0,1', '1,0', '0,7', '1,7', '0,6', '7,3'];

/**
 * Suggest → save it as a variant → Generate (Beam) → back to the draft → then
 * hand-build it. The draft is built after Generate so each case below tests
 * only its own action.
 */
async function candidatesAndHandDraft(page: Page, pf: PfHandle): Promise<Record<string, string>> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await pf.call('dispatch', { type: 'SAVE_AS_VARIANT', payload: { name: 'Suggested shape', source: 'working' } });
  await chooseMethod(page, 'Beam');
  await generateAndWait(page, pf);
  await backToMyDraft(page);
  await placeSounds(pf, HAND_PADS);
  const pads = await shownPads(pf);
  expect(Object.keys(pads).sort()).toEqual([...HAND_PADS].sort());
  return pads;
}

async function expectRecoverableNowAndAfterReload(page: Page, pf: PfHandle, pads: Record<string, string>) {
  expect(await isLayoutRecoverable(pf, pads), 'hand-made draft is the draft or a Recovered draft').toBe(true);
  await saveAndReload(page, pf);
  expect(await isLayoutRecoverable(pf, pads), 'hand-made draft survives a reload').toBe(true);
}

test.describe('C2 · Working/Test Layout overwritten', () => {
  test('Generate leaves the draft unchanged', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf, HAND_PADS);
    const draftHash = await pf.call('layoutHash', 'working');
    expect(draftHash).not.toBeNull();
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
  });

  // "An edit made while Generate runs is kept" (S1a.2) is a hook test,
  // test/ui/hooks/generateMidRunEdit.test.tsx: in the browser, greedy Generate
  // with an edit mid-run did not finish within 10 minutes.

  test.describe('the hand-made draft stays recoverable, including after a reload', () => {
    test('after Inspect, which leaves it the draft', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('candidate-row').nth(1).getByRole('button', { name: 'Inspect' }).click();
      await expect(page.getByTestId('state-bar')).toHaveAttribute('data-role', 'candidate');
      expect(await shownPads(pf), 'Inspect leaves the draft as it was').toEqual(pads);
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a card-body click, which does nothing', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('candidate-row').nth(2).getByTestId('candidate-letter').click();
      expect(await pf.call('inspected')).toMatchObject({ kind: 'working', readOnly: false });
      expect(await shownPads(pf)).toEqual(pads);
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after Edit as draft, replacing it', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('variant-row').first().getByRole('button', { name: 'Edit as draft' }).click();
      // It asks first: the draft differs from Active.
      expect(await shownPads(pf)).toEqual(pads);
      await page.getByTestId('use-as-draft-replace').click();
      await expect.poll(async () => JSON.stringify(await shownPads(pf))).not.toBe(JSON.stringify(pads));
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after Use as my draft on a candidate, saving it as a variant first', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('candidate-row').nth(1).getByRole('button', { name: 'Inspect' }).click();
      await page.getByTestId('state-bar-use').click();
      await page.getByTestId('use-as-draft-save-first').click();
      await expect.poll(async () => JSON.stringify(await shownPads(pf))).not.toBe(JSON.stringify(pads));
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a candidate card Promote', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      const promote = page.getByTestId('candidate-row').nth(1).getByRole('button', { name: /Promote|Confirm\?/ });
      const activeBefore = await pf.call('layoutHash', 'active');
      await promote.click();
      await promote.click();
      await expect.poll(() => pf.call('layoutHash', 'active')).not.toBe(activeBefore);
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a saved variant Promote', async ({ page, pf }) => {
      const pads = await candidatesAndHandDraft(page, pf);
      const promote = page.getByTestId('variant-row').first().getByRole('button', { name: /Promote|Confirm\?/ });
      const activeBefore = await pf.call('layoutHash', 'active');
      await promote.click();
      await promote.click();
      await expect.poll(() => pf.call('layoutHash', 'active')).not.toBe(activeBefore);
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });
  });

  test('inspecting a candidate never writes the Working/Test Layout', async ({ page, pf }) => {
    await candidatesAndHandDraft(page, pf);
    const draftHash = await pf.call('layoutHash', 'working');
    const rows = page.getByTestId('candidate-row');
    for (let i = 0; i < await rows.count(); i++) {
      await rows.nth(i).getByRole('button', { name: 'Inspect' }).click();
      const id = await rows.nth(i).getAttribute('data-candidate-id');
      await expect.poll(() => pf.call('inspected')).toEqual({ kind: 'candidate', id, readOnly: true });
      expect(await pf.call('layoutHash', 'working'), `after inspecting candidate #${i + 1}`).toBe(draftHash);
    }
  });
});
