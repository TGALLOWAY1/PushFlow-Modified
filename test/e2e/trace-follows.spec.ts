/**
 * S3.4 · the trace follows the candidate (T33; roadmap P3-9 in the browser).
 *
 * After Generate the trace panel reads "How candidate A was found · Stopped:
 * …"; inspecting candidate B switches it to B's own trace; a replayed step
 * reads "Replaying step 2/N · Esc to exit" above the grid, read-only, and Esc
 * leaves it; after B is promoted the panel still renders B's trace. Every
 * candidate card's line leads with why its run stopped, for greedy and beam.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, chooseMethod, generateAndWait } from './project';

test.describe('The trace follows the candidate (T33)', () => {
  test('greedy: A’s trace after Generate, B’s when inspected, a replay Esc leaves, and B’s after Promote', async ({ page, pf }) => {
    test.setTimeout(180_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await chooseMethod(page, 'Greedy');
    // Exploratory's noisy starting layouts leave the hill climb real steps to take.
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Exploratory' });
    await generateAndWait(page, pf);
    await page.locator('button.pf-tab', { hasText: 'Layouts' }).first().click();

    const run = await pf.call('generation');
    expect(run.candidates.length).toBeGreaterThan(1);
    const [a, b] = run.candidates;
    const title = page.getByTestId('trace-title');
    await expect(title).toHaveText(/^How candidate A was found · Stopped: [a-z]/);
    expect(await pf.call('trace')).toMatchObject({ candidateId: a!.id, letter: 'A', stopReason: a!.stopReason, iterationCount: a!.iterationCount });
    // Every card's line leads with why its run stopped (P3-9).
    const lines = page.getByTestId('candidate-run-line');
    await expect(lines).toHaveCount(run.candidates.length);
    for (const line of await lines.all()) await expect(line).toHaveText(/^Stopped: [a-z][^·]* · Greedy /);

    // Inspecting B shows B's own trace.
    await page.getByTestId('candidate-row').nth(1).getByTestId('candidate-inspect').click();
    await expect(title).toHaveText(/^How candidate B was found · Stopped: [a-z]/);
    expect(await pf.call('trace')).toMatchObject({ candidateId: b!.id, letter: 'B', iterationCount: b!.iterationCount });
    expect(b!.iterationCount).toBeGreaterThan(1);

    // A replayed step: read-only, said above the grid; Esc leaves it.
    await page.getByTestId('trace-row').nth(1).getByRole('button').click();
    await expect(page.getByTestId('state-bar-replay')).toHaveText(`Replaying step 2/${b!.iterationCount} · Esc to exit`);
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-read-only', 'true');
    expect((await pf.call('trace')).replayStep).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('state-bar-replay')).toHaveCount(0);
    expect((await pf.call('trace')).replayStep).toBeNull();
    await expect(title).toHaveText(/^How candidate B was found/);

    // Promote B: it leaves the list, and its trace stays on screen.
    await page.getByTestId('state-bar-promote').click();
    await expect.poll(async () => (await pf.call('status')).candidateIds).not.toContain(b!.id);
    await expect(page.getByTestId('trace-panel')).toBeVisible();
    await expect(title).toHaveText(/^How candidate B was found · Stopped: [a-z]/);
    expect(await pf.call('trace')).toMatchObject({
      candidateId: b!.id, letter: 'B', iterationCount: b!.iterationCount,
      resting: { candidateId: b!.id, letter: 'B', promoted: true },
    });
  });

  test('beam: the panel summarises the search and says it finished; every card line leads with the stop reason', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    await page.locator('button.pf-tab', { hasText: 'Layouts' }).first().click();

    await expect(page.getByTestId('trace-title')).toHaveText('How candidate A was found · Stopped: finished');
    await expect(page.getByTestId('trace-panel')).toHaveAttribute('data-method', 'beam');
    await expect(page.getByTestId('trace-beam')).toContainText('Beam search fingered 48 notes on its starting layout');
    const count = (await pf.call('status')).candidateIds.length;
    const lines = page.getByTestId('candidate-run-line');
    await expect(lines).toHaveCount(count);
    for (const line of await lines.all()) await expect(line).toHaveText(/^Stopped: finished · /);
    // Candidate B's summary replaces A's.
    await page.getByTestId('candidate-row').nth(1).getByTestId('candidate-inspect').click();
    await expect(page.getByTestId('trace-title')).toHaveText('How candidate B was found · Stopped: finished');
  });
});
