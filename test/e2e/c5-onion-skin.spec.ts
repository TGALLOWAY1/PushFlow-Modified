/**
 * C5 · Onion skin has no visible effect (T09).
 *
 * Register root cause: inline opacity and saturate(0) on every non-selected pad
 * (InteractiveGrid.tsx) override the onion-skin classes, and the previous-event
 * ghost renders only on empty pads.
 *
 * Flipped in S1b.4 (moment-view stop-gaps). Since S4.2 the onion-skin toggle
 * is the moment view's Prev · Now · Next (the control beside the grid), so the
 * case switches to that view from Now + Next.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, selectMoment, gridClip } from './project';

test.describe('C5 · onion skin', () => {
  test('showing the previous event (Prev · Now · Next) changes grid pixels for a selected event', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    // An event with a previous and a next event, so both layers have something to show.
    await selectMoment(page, 3);
    const nowNext = page.getByTestId('moment-view-now-next');
    const prevNowNext = page.getByTestId('moment-view-prev-now-next');
    await nowNext.click();
    await expect(nowNext).toHaveAttribute('aria-pressed', 'true');
    const clip = await gridClip(page);
    await page.mouse.move(0, 0);
    const off = await page.screenshot({ clip, animations: 'disabled' });
    await prevNowNext.click();
    await expect(prevNowNext).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    const on = await page.screenshot({ clip, animations: 'disabled' });
    expect(on.equals(off), 'grid pixels are identical with and without the previous event shown').toBe(false);
  });
});
