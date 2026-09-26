/**
 * S3.3 · One Promote (T13), criterion P3-3.
 *
 * Compare, a candidate row, the state bar (the candidate inspected) and a
 * variant row (the candidate kept first) promote the same candidate to the
 * same Active Layout and the same plan: the layout's own plan from the
 * per-layout cache, rebound to the new Active, so it is fresh at once. Each
 * acts on one click, with no confirm() and no "Confirm?", as one undo step
 * with one toast, and the toast's Undo brings back the Active Layout and the
 * candidate.
 *
 * Beam generates the candidates, as C2 does.
 */

import type { Dialog, Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { chooseMethod, generateAndWait, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

/** What a Promote leaves: the Active Layout, the layout its plan is bound to, and the plan's fingering. */
interface Outcome {
  active: string;
  planLayout: string | null;
  fingering: string;
}

const row = (page: Page, id: string) => page.locator(`[data-testid="candidate-row"][data-candidate-id="${id}"]`);
const promoteToasts = (page: Page) => page.getByTestId('toast').filter({ hasText: /^Promoted/ });
/** The toasts Promote and Keep show (one at a time: a new one replaces the last). */
const actionToasts = (page: Page) => page.getByTestId('toast').filter({ hasText: /^(Promoted|Kept)/ });

/**
 * Suggest → the draft's Promote (Active, analysed) → Generate with Beam. Returns
 * a candidate whose pads differ from Active's, once its row has been scored
 * (its plan is in the cache), with its session letter.
 */
async function activeWithCandidates(page: Page, pf: PfHandle): Promise<{ id: string; letter: string }> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
  await page.getByTestId('state-bar-promote').click();
  await expect.poll(async () => (await pf.call('status')).hasWorkingLayout).toBe(false);
  await waitForAnalysis(pf);
  await chooseMethod(page, 'Beam');
  await generateAndWait(page, pf);

  const active = await pf.call('layoutHash', 'active');
  for (const id of (await pf.call('status')).candidateIds) {
    if (await pf.call('layoutHash', { kind: 'candidate', id }) === active) continue;
    await expect(row(page, id).getByTestId('candidate-score')).toHaveText(/^Score: \d+%$/, { timeout: 30_000 });
    return { id, letter: (await row(page, id).getAttribute('data-letter'))! };
  }
  throw new Error('every candidate has Active\'s pads');
}

/** After one Promote: one more undo step, one toast naming what was promoted, and a fresh plan for the new Active. */
async function promoted(page: Page, pf: PfHandle, undoBefore: number, what: string): Promise<Outcome> {
  await expect.poll(async () => (await pf.call('history')).undo).toBe(undoBefore + 1);
  await expect(actionToasts(page)).toHaveCount(1);
  await expect(promoteToasts(page)).toContainText(`Promoted ${what} to Active Layout · `);
  await expect(page.getByRole('button', { name: 'Confirm?' })).toHaveCount(0);
  await waitForAnalysis(pf);
  const active = (await pf.call('layoutHash', 'active'))!;
  const { planLayoutHash } = await pf.call('status');
  return { active, planLayout: planLayoutHash, fingering: JSON.stringify(await pf.call('fingering', 'shown')) };
}

/** The toast's Undo: the Active Layout, the undo depth and the candidate all come back. */
async function undoFromToast(page: Page, pf: PfHandle, before: { active: string | null; undo: number }, id: string) {
  await promoteToasts(page).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => pf.call('layoutHash', 'active')).toBe(before.active);
  expect((await pf.call('history')).undo).toBe(before.undo);
  await expect(row(page, id)).toHaveCount(1);
  await expect(promoteToasts(page)).toHaveCount(0);
}

test.describe('S3.3 · one Promote (P3-3)', () => {
  test('Compare, a candidate row, the state bar and a variant row promote a candidate to the same Active and plan, as one undo step with one toast', async ({ page, pf }) => {
    test.setTimeout(180_000);
    const dialogs: string[] = [];
    page.on('dialog', (d: Dialog) => {
      dialogs.push(d.type());
      d.dismiss().catch(() => {});
    });
    const { id, letter } = await activeWithCandidates(page, pf);
    const chip = `Candidate ${letter}`;
    const start = { active: await pf.call('layoutHash', 'active'), undo: (await pf.call('history')).undo };
    const outcomes: Record<string, Outcome> = {};

    // 1. Compare: Active against the candidate, then Promote on the candidate's side.
    await page.getByTestId('compare-toggle-active').click();
    await row(page, id).getByTitle('Select for comparison').click();
    await page.getByTestId('toolbar-compare').click();
    const side = page.getByTestId('compare-card').and(page.locator(`[data-candidate-id="${id}"]`));
    await expect(side).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await side.getByTestId('compare-promote').click();
    await expect(page.getByTestId('compare-dialog')).toHaveCount(0);
    outcomes.compare = await promoted(page, pf, start.undo, chip);
    // The promoted candidate is Active now, so it leaves the list.
    await expect(row(page, id)).toHaveCount(0);
    await undoFromToast(page, pf, start, id);

    // 2. The candidate's row.
    await row(page, id).getByTestId('candidate-promote').click();
    outcomes.card = await promoted(page, pf, start.undo, chip);
    await undoFromToast(page, pf, start, id);

    // 3. The state bar, with the candidate inspected.
    await row(page, id).getByTestId('candidate-inspect').click();
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-chip', chip);
    await page.getByTestId('state-bar-promote').click();
    outcomes.bar = await promoted(page, pf, start.undo, chip);
    await undoFromToast(page, pf, start, id);

    // 4. A variant row: Keep the candidate (its own undo step), then Promote the variant.
    await row(page, id).getByTestId('candidate-keep').click();
    await expect(row(page, id).getByTestId('candidate-keep')).toHaveText('Kept');
    const kept = await actionToasts(page).innerText();
    const name = /as the variant "(.+)"/.exec(kept)![1]!;
    const afterKeep = { active: start.active, undo: (await pf.call('history')).undo };
    expect(afterKeep.undo).toBe(start.undo + 1);
    await page.getByTestId('variant-row').filter({ hasText: name }).getByTestId('variant-promote').click();
    outcomes.variant = await promoted(page, pf, afterKeep.undo, `"${name}"`);

    // One Active Layout and one plan, bound to it, whichever way it was promoted.
    for (const [route, outcome] of Object.entries(outcomes)) {
      expect(outcome.active, route).not.toBe(start.active);
      expect(outcome.planLayout, `${route}: the plan is bound to the new Active`).toBe(outcome.active);
      expect(outcome, route).toEqual(outcomes.compare);
    }
    expect(JSON.parse(outcomes.compare!.fingering).length).toBeGreaterThan(0);
    expect(dialogs, 'no confirm() or other native dialog').toEqual([]);
  });
});
