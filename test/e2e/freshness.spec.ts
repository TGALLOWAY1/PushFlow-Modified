/**
 * S3.3 · Freshness (T14), criterion P3-5.
 *
 * The analysis goes stale only when something it reads changes. A rename
 * leaves it fresh. A lock changes the layout, so it re-solves: the test waits
 * for a plan bound to the locked layout with nothing stale (no wall-clock
 * threshold), and meanwhile the Analysis panel keeps its previous numbers,
 * dimmed, never an empty panel. Opening the Composer tab changes neither
 * analysisStale nor updatedAt.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

/** What the page recorded about the Analysis panel while it re-solved. */
interface PanelWatch {
  missing: number;
  dimmed: number;
}

test.describe('S3.3 · freshness (P3-5)', () => {
  test('a rename leaves the analysis fresh; after a lock the plan re-binds to the new layout; the Composer tab changes nothing', async ({ page, pf }) => {
    test.setTimeout(90_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    const numbers = page.getByTestId('analysis-numbers');
    await expect(page.getByTestId('analysis-score')).toHaveText(/^Score\d+%$/, { timeout: 30_000 });
    const suggested = await pf.call('layoutHash', 'shown');
    expect((await pf.call('status')).planLayoutHash).toBe(suggested);

    // A rename: nothing the analysis reads changed.
    await page.getByTestId('sound-name').first().dblclick();
    const field = page.getByTestId('sound-rename-input');
    await field.fill('Kick drum');
    await field.press('Enter');
    // Enter moves on to rename the next Sound; leave that one as it is.
    if (await field.count()) await field.press('Escape');
    await expect(page.getByTestId('sound-name').first()).toHaveText('Kick drum');
    const renamed = await pf.call('status');
    expect(renamed.analysisStale, 'a rename leaves the analysis fresh').toBe(false);
    expect(renamed.planLayoutHash).toBe(suggested);
    await expect(numbers).not.toHaveAttribute('data-updating', 'true');

    // A lock: the layout changed, so it re-solves. The page watches the panel meanwhile.
    await page.evaluate(() => {
      const w = window as unknown as { __panelWatch: PanelWatch };
      w.__panelWatch = { missing: 0, dimmed: 0 };
      const check = () => {
        const panel = document.querySelector('[data-testid="analysis-numbers"]');
        if (!panel?.querySelector('[data-testid="analysis-score"]')) w.__panelWatch.missing++;
        else if (panel.getAttribute('data-updating') === 'true') w.__panelWatch.dimmed++;
      };
      new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const state = await pf.call('state');
    const [padKey, voice] = Object.entries((state.workingLayout ?? state.activeLayout).padToVoice)[0]!;
    await pf.call('dispatch', { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: voice.id, padKey } });
    const locked = await pf.call('layoutHash', 'shown');
    expect(locked, 'a lock changes the layout').not.toBe(suggested);
    // No wall-clock threshold: wait for a plan bound to the locked layout, with nothing stale.
    await expect.poll(async () => {
      const s = await pf.call('status');
      return !s.analysisStale && !s.isProcessing && s.planLayoutHash === locked;
    }, { timeout: 60_000 }).toBe(true);
    await expect(numbers).not.toHaveAttribute('data-updating', 'true');
    const watch = await page.evaluate(() => (window as unknown as { __panelWatch: PanelWatch }).__panelWatch);
    expect(watch.missing, 'the Analysis panel never went empty while it re-solved').toBe(0);
    expect(watch.dimmed, 'its previous numbers were shown dimmed meanwhile').toBeGreaterThan(0);

    // Opening the Composer tab, and going back, changes nothing the project saves or the analysis reads.
    const before = await pf.call('status');
    await page.getByTestId('drawer-tab-composer').click();
    await expect(page.getByTestId('drawer-panel-composer')).toBeVisible();
    // A negative check: give the Composer's debounced sync (200 ms) and save (500 ms) time to fire.
    await page.waitForTimeout(1_000);
    await page.getByTestId('drawer-tab-timeline').click();
    await page.waitForTimeout(500);
    const after = await pf.call('status');
    expect({ stale: after.analysisStale, updatedAt: after.updatedAt, plan: after.planLayoutHash })
      .toEqual({ stale: false, updatedAt: before.updatedAt, plan: before.planLayoutHash });
  });
});
