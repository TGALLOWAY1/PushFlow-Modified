/**
 * C7 · Compare shows the Active Layout as empty and zero-scored (T08).
 *
 * Register root cause: buildActiveCandidate falls back to a zero stub whenever
 * the Active Layout has no fresh plan (CompareModal.tsx), so with a differing
 * draft the Active side shows no fingering and SCORE 0.0. The compare set is
 * never pruned, and Compare has no Escape handling.
 *
 * Flips: the stop-gap cases in S1b.3 (Compare evaluates Active; analysis cache);
 * the "equals the standalone analysis" case in S3.3 (Compare on the cache).
 * The "served from the cache without re-solving, storage unchanged" criterion is
 * a unit test S1b.3 adds with getAnalysisForLayout.
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, chooseMethod, generateAndWait } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

const compareButton = (page: Page) => page.getByTitle(/^Compare \d+ selected layouts$|^Select 2\+ candidates to compare$/);

/** Suggest → Promote (so Active is analysed) → Generate with Beam, which leaves a differing draft. Returns Active's standalone score. */
async function activeThenCandidates(page: Page, pf: PfHandle): Promise<number> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
  await page.getByTitle('Make this layout the new Active Layout').click();
  await waitForAnalysis(pf);
  const s = await pf.call('state');
  expect(s.workingLayout).toBeNull();
  const standalone = s.analysisResult!.executionPlan.score;
  await chooseMethod(page, 'Beam');
  await generateAndWait(page, pf);
  expect((await pf.call('state')).workingLayout, 'Generate left a draft that differs from Active').not.toBeNull();
  return standalone;
}

async function openActiveVsFirst(page: Page) {
  await page.getByTestId('compare-toggle-active').click();
  await page.getByTestId('candidate-row').first().getByTitle('Select for comparison').click();
  await compareButton(page).click();
  await expect(page.getByTestId('compare-dialog')).toBeVisible();
}

async function activeCardScore(page: Page): Promise<{ text: string; score: number | null }> {
  const text = (await page.getByTestId('compare-card').and(page.locator('[data-candidate-id="__active__"]')).innerText()).replace(/\s+/g, ' ');
  const m = /SCORE ([\d.]+)/i.exec(text);
  return { text, score: m ? Number(m[1]) : null };
}

test.describe('C7 · Compare with the Active Layout', () => {
  test('with a differing draft, the Active side shows its real fingering and score, or "Couldn\'t analyse"', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C7: the Active side is a zero stub: no fingering on its grid and SCORE 0.0 (flips in S1b.3)');
    await activeThenCandidates(page, pf);
    await openActiveVsFirst(page);
    const { text, score } = await activeCardScore(page);
    const analysed = score !== null && score > 0;
    expect(analysed || /Couldn.t analyse/i.test(text), `Active card: ${text}`).toBe(true);
  });

  test('Escape closes Compare', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C7: Compare has no Escape handling (flips in S1b.3)');
    await activeThenCandidates(page, pf);
    await openActiveVsFirst(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compare-dialog')).toHaveCount(0);
  });

  test('after promoting a compared candidate, Compare is disabled rather than comparing a layout with itself', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C7: the compare set is never pruned, so Active vs the promoted candidate is a self-compare (flips in S1b.3)');
    await activeThenCandidates(page, pf);
    await page.getByTestId('compare-toggle-active').click();
    const first = page.getByTestId('candidate-row').first();
    await first.getByTitle('Select for comparison').click();
    await expect(compareButton(page)).toBeEnabled();
    const promote = first.getByRole('button', { name: /Promote|Confirm\?/ });
    await promote.click();
    await promote.click();
    await expect.poll(async () => (await pf.call('status')).hasWorkingLayout).toBe(false);
    await expect(compareButton(page)).toBeDisabled();
  });

  test('after deleting a compared candidate, Compare is disabled rather than opening a screen with no Close', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C7: the deleted id stays in the compare set; Compare opens "Not enough candidates" with no Close (flips in S1b.3)');
    await activeThenCandidates(page, pf);
    const rows = page.getByTestId('candidate-row');
    await rows.nth(0).getByTitle('Select for comparison').click();
    await rows.nth(1).getByTitle('Select for comparison').click();
    await rows.nth(1).getByTitle('Delete candidate').click();
    await rows.nth(1).getByTitle('Confirm Delete').click();
    await expect(rows).toHaveCount(2);
    await expect(compareButton(page)).toBeDisabled();
  });

  test('with a differing draft, Active\'s score in Compare equals its standalone analysis', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C7: Compare shows the zero stub instead of the cached Active analysis (flips in S3.3)');
    const standalone = await activeThenCandidates(page, pf);
    await openActiveVsFirst(page);
    const { score } = await activeCardScore(page);
    expect(score).toBeCloseTo(standalone, 0);
  });
});
