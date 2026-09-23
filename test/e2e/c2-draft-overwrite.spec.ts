/**
 * C2 · Generate and Preview overwrite the Working/Test Layout (T01).
 *
 * Register root cause: APPLY_GENERATION_TO_LAYOUT replaces workingLayout with a
 * clone of the candidate without checking for an existing draft
 * (projectState.ts), and Generate dispatches it after every run
 * (useAutoAnalysis.ts). Preview, a card-body click, Load Draft and Promote
 * replace the draft the same way, with no copy kept.
 *
 * Flips: the Generate, mid-run edit and recoverable-draft cases in S1a.2
 * (Generate only proposes; Recovered drafts); the Inspect case in S3.2.
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import {
  openTestMidi1,
  placeSounds,
  suggestStartingLayout,
  chooseMethod,
  generateAndWait,
  shownPads,
  saveAndReload,
  isLayoutRecoverable,
} from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** A hand-made draft on deliberately unusual pads (from the C2 probe). */
const HAND_PADS = ['0,0', '0,1', '1,0', '0,7', '1,7', '0,6', '7,3'];

/**
 * Suggest → save it as a variant → Generate (Beam) → then hand-build a draft.
 * The draft is built after Generate so each case below tests only its own action.
 */
async function candidatesAndHandDraft(page: Page, pf: PfHandle): Promise<Record<string, string>> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await pf.call('dispatch', { type: 'SAVE_AS_VARIANT', payload: { name: 'Suggested shape', source: 'working' } });
  await chooseMethod(page, 'Beam');
  await generateAndWait(page, pf);
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
    test.fail(EXPECTED_FAIL, 'C2: Generate dispatches APPLY_GENERATION_TO_LAYOUT, replacing the draft (flips in S1a.2)');
    await openTestMidi1(page, pf);
    await placeSounds(pf, HAND_PADS);
    const draftHash = await pf.call('layoutHash', 'working');
    expect(draftHash).not.toBeNull();
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
  });

  test('an edit made while Generate runs is kept', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C2: the finished run replaces the draft, losing the mid-run edit (flips in S1a.2)');
    test.setTimeout(300_000);
    await openTestMidi1(page, pf);
    const ids = await placeSounds(pf, HAND_PADS);
    await chooseMethod(page, 'Greedy');
    // One greedy family: long enough to edit during, far shorter than all five.
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Coordination' });
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    // The toolbar shows the run's progress text only while Generate itself runs.
    await expect(page.getByText(/Greedy optimization/)).toBeVisible();
    // The same action a drag from the Sounds panel dispatches.
    const stream = (await pf.call('state')).soundStreams.find(s => s.id === ids[0])!;
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream } });
    const mid = await pf.call('state');
    expect(mid.isProcessing && mid.candidates.length === 0, 'the edit landed while the run was still going').toBe(true);
    await expect.poll(async () => {
      const s = await pf.call('state');
      return !s.isProcessing && s.candidates.length > 0;
    }, { timeout: 240_000 }).toBe(true);
    expect((await shownPads(pf))['7,7']).toBe(ids[0]);
  });

  test.describe('the hand-made draft stays recoverable, including after a reload', () => {
    test('after Preview', async ({ page, pf }) => {
      test.fail(EXPECTED_FAIL, 'C2: Preview clones the candidate over the draft and keeps no copy (flips in S1a.2)');
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('candidate-row').nth(1).getByRole('button', { name: 'Preview' }).click();
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a card-body click', async ({ page, pf }) => {
      test.fail(EXPECTED_FAIL, 'C2: a card-body click previews, replacing the draft (flips in S1a.2)');
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('candidate-row').nth(2).getByText(/^#3$/).click();
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after Load Draft', async ({ page, pf }) => {
      test.fail(EXPECTED_FAIL, 'C2: Load Draft replaces the draft with the variant (flips in S1a.2)');
      const pads = await candidatesAndHandDraft(page, pf);
      await page.getByTestId('variant-row').first().getByRole('button', { name: 'Load Draft' }).click();
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a candidate card Promote', async ({ page, pf }) => {
      test.fail(EXPECTED_FAIL, 'C2: card Promote discards the draft (flips in S1a.2)');
      const pads = await candidatesAndHandDraft(page, pf);
      const promote = page.getByTestId('candidate-row').nth(1).getByRole('button', { name: /Promote|Confirm\?/ });
      const activeBefore = await pf.call('layoutHash', 'active');
      await promote.click();
      await promote.click();
      await expect.poll(() => pf.call('layoutHash', 'active')).not.toBe(activeBefore);
      await expectRecoverableNowAndAfterReload(page, pf, pads);
    });

    test('after a saved variant Promote', async ({ page, pf }) => {
      test.fail(EXPECTED_FAIL, 'C2: variant Promote discards the draft (flips in S1a.2)');
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
    test.fail(EXPECTED_FAIL, 'C2: Preview writes workingLayout instead of inspecting read-only (flips in S3.2)');
    await candidatesAndHandDraft(page, pf);
    const draftHash = await pf.call('layoutHash', 'working');
    const rows = page.getByTestId('candidate-row');
    for (let i = 0; i < await rows.count(); i++) {
      await rows.nth(i).getByRole('button', { name: 'Preview' }).click();
      expect(await pf.call('layoutHash', 'working'), `after inspecting candidate #${i + 1}`).toBe(draftHash);
    }
  });
});
