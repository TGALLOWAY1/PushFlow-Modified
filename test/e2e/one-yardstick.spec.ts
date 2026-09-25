/**
 * S3.1 · One yardstick (T21 slice).
 *
 * Every displayed Score is the layout's Playability from the canonical
 * evaluator, served by getAnalysisForLayout and computed in the scoring worker,
 * so a greedy candidate reads the same number on its row, on the Analysis panel
 * while it is inspected (S3.2: shown read-only after Generate, with its own
 * plan from the cache) and as the draft after "Use as my draft". Before S3.1
 * the row showed the greedy optimizer's own plan score and the draft the beam
 * analysis's.
 *
 * Greedy runs one strategy (Natural Pose), as C3 does: "All strategies" blocks
 * the page for minutes.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, chooseMethod, generateAndWait } from './project';

test.describe('S3.1 · one yardstick', () => {
  test('a greedy candidate scores the same on its row, inspected, and as the draft after "Use as my draft"; scoring ran in the worker', async ({ page, pf }) => {
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

    // Candidate A (this row) is inspected after Generate: the Analysis tile reads its Score.
    const tile = page.getByTestId('analysis-score');
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-chip', 'Candidate A');
    await expect(tile).toHaveText(`Score${before}%`, { timeout: 30_000 });
    await expect(tile).toHaveAttribute('title', /^Playability · canonical evaluator · higher = easier/);
    const draftHash = await pf.call('layoutHash', 'working');

    // Use as my draft (APPLY_GENERATION_TO_LAYOUT): the suggested draft differs
    // from Active, so it asks; Replace. The draft is the candidate's pads now.
    await page.getByTestId('state-bar-use').click();
    await page.getByTestId('use-as-draft-replace').click();
    await expect.poll(() => pf.call('layoutHash', 'working')).not.toBe(draftHash);
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-role', 'working');
    await waitForAnalysis(pf);
    await expect(tile).toHaveText(`Score${before}%`);
    await expect(candidateScore).toHaveText(`Score: ${before}%`);

    // Solving and scoring ran in the module worker, never on the page.
    const scoring = await pf.call('scoring');
    expect(scoring.worker).toBeGreaterThan(0);
    expect(scoring.inline).toBe(0);
  });
});
