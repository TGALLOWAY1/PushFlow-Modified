/**
 * S3.3 · Compare on the cache (T08 full), criterion P3-4.
 *
 * With a differing draft, Active's Playability in Compare equals Active's
 * standalone analysis, and a greedy candidate (Natural Pose) shows the same
 * score on its row, inspected, as the draft after "Use as my draft" and in
 * Compare. Both Compare sides draw every placed pad with the fingers of the
 * layout's own plan from the per-layout cache, never a stub. (C7's last case
 * checks Active's side with Beam candidates.)
 *
 * Greedy runs one strategy (Natural Pose), as one-yardstick does: "All
 * strategies" blocks the page for minutes.
 */

import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { chooseMethod, generateAndWait, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

const percent = async (locator: Locator) => Number(/(\d+)%/.exec(await locator.innerText())![1]);
const compareCard = (page: Page, id: string) => page.getByTestId('compare-card').and(page.locator(`[data-candidate-id="${id}"]`));

test.describe('S3.3 · Compare on the cache (P3-4)', () => {
  test('with a differing draft, Compare shows Active\'s standalone score and a greedy candidate\'s own score, fingering every pad; the candidate scores the same before and after "Use as my draft"', async ({ page, pf }) => {
    test.setTimeout(300_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await page.getByTestId('state-bar-promote').click();
    await expect.poll(async () => (await pf.call('status')).hasWorkingLayout).toBe(false);
    await waitForAnalysis(pf);
    const tile = page.getByTestId('analysis-score');
    await expect(tile).toHaveText(/^Score\d+%$/, { timeout: 30_000 });
    const activeStandalone = await percent(tile);

    await chooseMethod(page, 'Greedy');
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Natural Pose' });
    await generateAndWait(page, pf, 240_000);
    const row = page.getByTestId('candidate-row').first();
    const id = (await row.getAttribute('data-candidate-id'))!;
    const letter = (await row.getAttribute('data-letter'))!;
    await expect(row.getByTestId('candidate-score')).toHaveText(/^Score: \d+%$/, { timeout: 30_000 });
    const rowScore = await percent(row.getByTestId('candidate-score'));
    // Inspected after Generate: the Analysis tile reads the row's score.
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-chip', `Candidate ${letter}`);
    await expect(tile).toHaveText(`Score${rowScore}%`, { timeout: 30_000 });

    // Use as my draft: there is no draft yet, so it applies at once, and differs from Active.
    await page.getByTestId('state-bar-use').click();
    await expect.poll(async () => (await pf.call('status')).hasWorkingLayout).toBe(true);
    expect(await pf.call('layoutHash', 'working')).not.toBe(await pf.call('layoutHash', 'active'));
    await waitForAnalysis(pf);
    await expect(tile, 'the draft scores what its row showed').toHaveText(`Score${rowScore}%`);
    await expect(row.getByTestId('candidate-score')).toHaveText(`Score: ${rowScore}%`);

    // Compare Active with the candidate.
    await page.getByTestId('compare-toggle-active').click();
    await row.getByTitle('Select for comparison').click();
    await page.getByTestId('toolbar-compare').click();
    await expect(page.getByTestId('compare-dialog')).toBeVisible();
    const activeSide = compareCard(page, '__active__');
    const candidateSide = compareCard(page, id);
    for (const side of [activeSide, candidateSide]) await expect(side).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    expect(await percent(activeSide.getByTestId('compare-score')), 'Active\'s side equals its standalone analysis').toBe(activeStandalone);
    expect(await percent(candidateSide.getByTestId('compare-score')), 'the candidate\'s side equals its row').toBe(rowScore);
    await expect(candidateSide.getByTestId('compare-subject')).toHaveAttribute('data-chip', `Candidate ${letter}`);
    // Every placed pad on both grids (7 Sounds each) shows the fingers of that layout's own plan.
    const dialog = page.getByTestId('compare-dialog');
    await expect(dialog.locator('[title*=" · Fingers "]')).toHaveCount(14);
    await expect(dialog.locator('[title*="no notes in this plan"]')).toHaveCount(0);
  });
});
