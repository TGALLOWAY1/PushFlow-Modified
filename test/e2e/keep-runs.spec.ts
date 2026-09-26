/**
 * S3.3 · Keep candidates (T30) and stable letters (T08).
 *
 * Each Generate adds a run ("Run 2 · … · just now") instead of replacing the
 * list; earlier runs fold under "Earlier runs" and "Clear older runs" removes
 * them. Letters are given once per session. Keep saves a candidate as a Saved
 * Layout Variant named after how it was made. Candidates are never saved, so
 * leaving with unkept ones asks first ("← Library" and the browser's own
 * prompt), and after a reload only the kept variant remains.
 *
 * Beam generates the candidates, as C2 does.
 */

import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { chooseMethod, generateAndWait, openTestMidi1, reloadLeaving, suggestStartingLayout, waitForAnalysis, waitForSaved } from './project';

const row = (page: Page, id: string) => page.locator(`[data-testid="candidate-row"][data-candidate-id="${id}"]`);

/** Candidates whose pads no layout of the project keeps (Active, the draft, the variants). */
async function unkeptCount(pf: PfHandle, ids: string[], keptIds: string[]): Promise<number> {
  const kept = new Set([await pf.call('layoutHash', 'active'), await pf.call('layoutHash', 'working')]);
  let n = 0;
  for (const id of ids) {
    if (keptIds.includes(id)) continue;
    if (!kept.has(await pf.call('layoutHash', { kind: 'candidate', id }))) n++;
  }
  return n;
}

test.describe('S3.3 · runs and Keep (T30)', () => {
  test('runs group and fold, letters stay, Keep saves a variant, leaving warns, and only kept candidates survive a reload', async ({ page, pf }) => {
    test.setTimeout(180_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await chooseMethod(page, 'Beam');

    await generateAndWait(page, pf);
    const run1 = (await pf.call('status')).candidateIds;
    const run1Letters = await Promise.all(run1.map(async id => (await row(page, id).getAttribute('data-letter'))!));
    await generateAndWait(page, pf);
    const all = (await pf.call('status')).candidateIds;
    const run2 = all.slice(0, all.length - run1.length);
    // The newest run comes first; the earlier one is kept, folded.
    expect(all.slice(run2.length)).toEqual(run1);
    await expect(page.getByTestId('candidates-caption')).toHaveText('Candidates are temporary · Save the ones you like as variants');
    await expect(page.getByTestId('candidate-run')).toHaveCount(1);
    await expect(page.getByTestId('candidate-run-title')).toHaveText(/^Run 2 · .+ · (just now|1 min ago)$/);
    await expect(page.getByTestId('earlier-runs-toggle')).toHaveText('Earlier runs (1)');
    await page.getByTestId('earlier-runs-toggle').click();
    await expect(page.getByTestId('candidate-run')).toHaveCount(2);
    await expect(page.getByTestId('candidate-run-title').nth(1)).toHaveText(/^Run 1 · /);
    // Letters are given once: run 1 keeps its own, run 2 continues after them.
    for (const [i, id] of run1.entries()) await expect(row(page, id)).toHaveAttribute('data-letter', run1Letters[i]!);
    const run2Letters = await Promise.all(run2.map(async id => (await row(page, id).getAttribute('data-letter'))!));
    expect(run2Letters.filter(l => run1Letters.includes(l))).toEqual([]);

    // Keep the first candidate of run 2: a variant named after how it was made.
    const keptId = run2[0]!;
    await row(page, keptId).getByTestId('candidate-keep').click();
    await expect(row(page, keptId).getByTestId('candidate-keep')).toHaveText('Kept');
    await expect(row(page, keptId).getByTestId('candidate-keep')).toBeDisabled();
    const toast = page.getByTestId('toast').filter({ hasText: /^Kept Candidate / });
    await expect(toast).toContainText(`Kept Candidate ${run2Letters[0]} as the variant "`);
    const name = /as the variant "(.+)"/.exec(await toast.innerText())![1]!;
    await expect(page.getByTestId('variant-row').filter({ hasText: name })).toHaveCount(1);

    // Clear older runs: run 1 goes; the kept variant stays.
    await page.getByTestId('clear-older-runs').click();
    await expect.poll(async () => (await pf.call('status')).candidateIds).toEqual(run2);
    await expect(page.getByTestId('earlier-runs')).toHaveCount(0);

    // ← Library asks first, naming how many would be lost; Stay stays.
    const unkept = await unkeptCount(pf, run2, [keptId]);
    expect(unkept).toBeGreaterThan(0);
    await page.getByTestId('leave-project').click();
    const popover = page.getByTestId('leave-project-popover');
    await expect(popover).toContainText(unkept === 1 ? '1 candidate isn’t kept' : `${unkept} candidates aren’t kept`);
    await page.getByTestId('leave-project-stay').click();
    await expect(popover).toHaveCount(0);
    expect(new URL(page.url()).pathname).toContain('/project/');

    // Closing or reloading the page asks too (the browser's own prompt), even
    // with the project saved. page.close({ runBeforeUnload }) raises it the
    // same way in every browser (page.reload() doesn't raise it in Firefox);
    // staying keeps the page. After a reload, only the kept variant is left.
    await waitForSaved(page);
    const [prompt] = await Promise.all([
      page.waitForEvent('dialog'),
      page.close({ runBeforeUnload: true }),
    ]);
    expect(prompt.type()).toBe('beforeunload');
    await prompt.dismiss();
    expect(page.isClosed()).toBe(false);
    await reloadLeaving(page);
    await pf.ready();
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(7);
    expect((await pf.call('status')).candidateIds).toEqual([]);
    await expect(page.getByTestId('variant-row').filter({ hasText: name })).toHaveCount(1);
    // With nothing unkept, ← Library leaves at once.
    await page.getByTestId('leave-project').click();
    await page.waitForURL(url => !url.pathname.includes('/project/'));
  });
});
