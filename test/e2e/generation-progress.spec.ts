/**
 * Generation progress, Cancel and the trace a run leaves (S3.4; T35, T33 slice;
 * roadmap P3-7a in the browser).
 *
 * A slow Generate (Annealing, Thorough) shows "Candidate 1 of 3 · iteration … ·
 * ~N s left" with Cancel beside it, while the method, intensity and Generate
 * controls stay in place, disabled. Cancel stops it: isProcessing goes false,
 * the candidate list is the one from before, there is no "Generation failed"
 * banner, and a toast says "Stopped: cancelled". A finished run leaves its
 * top candidate's trace, with its stop reason, in the trace panel.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, chooseMethod, generateAndWait } from './project';

test.describe('Generation progress and Cancel', () => {
  test('Thorough shows progress with an ETA; Cancel stops it and keeps the previous candidates', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    // A quick run first, so Cancel has candidates to keep.
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    const before = await pf.call('generation');
    expect(before.candidates.length).toBeGreaterThan(0);
    expect(before.candidates.every(c => c.stopReason === 'completed' && c.hasBeamSummary)).toBe(true);

    await chooseMethod(page, 'Annealing');
    await page.getByTitle('Intensity').selectOption({ label: 'Thorough' });
    const generate = page.getByRole('button', { name: 'Generate', exact: true });
    await generate.click();

    // Progress with an ETA from the measured rate, and an iteration count.
    const progress = page.getByTestId('generation-progress');
    await expect(progress).toHaveText(/^Candidate 1 of 3 · ~\d+ (s|min)( \d+ s)? left · iteration [\d,]+ of [\d,]+$/, { timeout: 30_000 });
    // The time left is never cut, however crowded the bar (a draft is open
    // here): its whole box lies inside the pill, and the bar still fits.
    const etaInsidePill = await progress.evaluate(pill => {
      const eta = Array.from(pill.querySelectorAll('span')).find(s => /left$/.test(s.textContent ?? ''));
      if (!eta) return false;
      const p = pill.getBoundingClientRect();
      const e = eta.getBoundingClientRect();
      return e.width > 0 && e.left >= p.left && e.right <= p.right;
    });
    expect(etaInsidePill).toBe(true);
    await expect(page.getByTestId('generation-cancel')).toBeVisible();
    expect(await page.getByTestId('toolbar-compare').evaluate(el => el.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
    await expect(page.getByTestId('generation-announcer')).toHaveText('Generating candidates');
    // The controls stay in place during the run, disabled.
    await expect(page.getByTitle('Optimizer method')).toBeDisabled();
    await expect(page.getByTitle('Intensity')).toBeDisabled();
    await expect(generate).toBeDisabled();
    expect((await pf.call('status')).isProcessing).toBe(true);

    await page.getByTestId('generation-cancel').click();
    await expect.poll(async () => (await pf.call('status')).isProcessing, { timeout: 10_000 }).toBe(false);

    const after = await pf.call('generation');
    expect(after.candidates.map(c => c.id)).toEqual(before.candidates.map(c => c.id));
    expect(after.trace).toEqual(before.trace);
    expect(after.lastRun).toMatchObject({ outcome: 'cancelled', stopReason: 'cancelled', method: 'annealing', candidateCount: 0 });
    // The stop reason is shown (and announced: the toast region is a polite live region).
    await expect(page.getByTestId('toast').filter({ hasText: 'Stopped: cancelled' }))
      .toHaveText(/^Stopped: cancelled · nothing from that run was kept/);
    await expect(progress).toHaveCount(0);
    await expect(page.getByText('Generation failed')).toHaveCount(0);
    await expect(generate).toBeEnabled();
    await expect(page.getByTestId('candidate-row')).toHaveCount(before.candidates.length);
  });

  test('a finished greedy run leaves its top candidate’s trace and stop reason in the trace panel', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await chooseMethod(page, 'Greedy');
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Natural Pose' });
    await generateAndWait(page, pf);

    const run = await pf.call('generation');
    expect(run.lastRun).toMatchObject({ outcome: 'completed', stopReason: 'completed', method: 'greedy' });
    const top = run.candidates[0];
    expect(top.moveCount).toBeGreaterThan(0);
    expect(run.trace).toEqual({ moveCount: top.moveCount, iterationCount: top.iterationCount, stopReason: top.stopReason });
    // Every candidate carries its own stop reason (T33).
    expect(run.candidates.every(c => typeof c.stopReason === 'string' && c.moveCount > 0)).toBe(true);
    await expect(page.getByTestId('trace-stop-reason')).toHaveText(/^Stopped: [a-z]/);
    // The panel names whose trace it is (T33): the run's candidate A, shown read-only.
    await expect(page.getByTestId('trace-title')).toHaveText(/^How candidate A was found · Stopped: [a-z]/);
    const count = run.candidates.length;
    await expect(page.getByTestId('generation-announcer')).toHaveText(`Generation finished: ${count} candidate${count === 1 ? '' : 's'}.`);
    // A normal finish needs no toast: the list fills.
    await expect(page.getByTestId('toast').filter({ hasText: 'Stopped:' })).toHaveCount(0);
  });
});
