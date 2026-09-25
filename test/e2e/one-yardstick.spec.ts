/**
 * S3.1 · One yardstick (T21 slice).
 *
 * Every displayed Score is the layout's Playability from the canonical
 * evaluator, served by getAnalysisForLayout and computed in the scoring worker,
 * so a greedy candidate reads the same number on its row before Preview and on
 * the Analysis panel after it. Before S3.1 the row showed the greedy
 * optimizer's own plan score and the draft the beam analysis's.
 *
 * Greedy runs one strategy (Natural Pose), as C3 does: "All strategies" blocks
 * the page for minutes.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, chooseMethod, generateAndWait } from './project';

test.describe('S3.1 · one yardstick', () => {
  test('a greedy candidate scores the same on its row and, after Preview, on the Analysis panel; scoring ran in the worker', async ({ page, pf }) => {
    test.setTimeout(240_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await expect(page.getByTestId('analysis-score')).toHaveText(/^Score\d+%$/, { timeout: 30_000 });

    await chooseMethod(page, 'Greedy');
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Natural Pose' });
    await generateAndWait(page, pf, 200_000);

    const row = page.getByTestId('candidate-row').first();
    const candidateScore = row.getByTestId('candidate-score');
    await expect(candidateScore).toHaveText(/^Score: \d+%$/, { timeout: 30_000 });
    await expect(candidateScore).toHaveAttribute('title', /^Playability · canonical evaluator · higher = easier/);
    const before = /(\d+)%/.exec(await candidateScore.innerText())![1]!;

    // Preview (APPLY_GENERATION_TO_LAYOUT): the draft becomes the candidate's pads.
    await row.getByRole('button', { name: 'Preview' }).click();
    await expect.poll(async () => (await pf.call('status')).hasWorkingLayout).toBe(true);
    await waitForAnalysis(pf);
    const tile = page.getByTestId('analysis-score');
    await expect(tile).toHaveText(`Score${before}%`);
    await expect(tile).toHaveAttribute('title', /^Playability · canonical evaluator · higher = easier/);

    // The draft itself, with no candidate selected, reads the same number.
    await pf.call('dispatch', { type: 'SELECT_CANDIDATE', payload: null });
    await expect.poll(async () => (await pf.call('status')).analysisStale).toBe(false);
    await expect(tile).toHaveText(`Score${before}%`);
    await expect(candidateScore).toHaveText(`Score: ${before}%`);

    // Solving and scoring ran in the module worker, never on the page.
    const scoring = await pf.call('scoring');
    expect(scoring.worker).toBeGreaterThan(0);
    expect(scoring.inline).toBe(0);
  });
});
