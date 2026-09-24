/**
 * C5 · Onion skin has no visible effect (T09).
 *
 * Register root cause: inline opacity and saturate(0) on every non-selected pad
 * (InteractiveGrid.tsx) override the onion-skin classes, and the previous-event
 * ghost renders only on empty pads.
 *
 * Flips in S1b.4 (moment-view stop-gaps).
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, selectMoment, gridClip } from './project';

test.describe('C5 · onion skin', () => {
  test('turning onion skin on changes grid pixels for a selected event', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C5: inline opacity/saturate on non-selected pads hide the onion layers (flips in S1b.4)');
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    // An event with a previous and a next event, so both onion layers have something to show.
    await selectMoment(page, 3);
    const toggle = page.getByTitle(/Show previous\/next event layers on grid|Disable onion skin/);
    await expect(toggle).toHaveAttribute('title', 'Show previous/next event layers on grid');
    const clip = await gridClip(page);
    await page.mouse.move(0, 0);
    const off = await page.screenshot({ clip, animations: 'disabled' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('title', 'Disable onion skin');
    await page.mouse.move(0, 0);
    const on = await page.screenshot({ clip, animations: 'disabled' });
    expect(on.equals(off), 'grid pixels are identical with onion skin off and on').toBe(false);
  });
});
