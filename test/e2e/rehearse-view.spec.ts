/**
 * S4.4 · the Rehearse view (F7-03; roadmap P4-10), in the browser.
 *
 * The toggle beside the drawer's collapse button collapses both side panels,
 * so the grid, the inspector beside it and the timeline get the room, and
 * turning it off restores them exactly as they were. It is view state only:
 * no analysis value, undo step or save changes, and it is remembered per
 * viewer across a reload. Opening a panel from its strip leaves it.
 */

import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, waitForSaved } from './project';

const width = async (page: Page, testId: string) => Math.round((await page.getByTestId(testId).boundingBox())!.width);

/** Every analysis value in state: the plan, its fingering, freshness, the last save and the undo history. */
async function analysisValues(pf: PfHandle) {
  const status = await pf.call('status');
  const state = await pf.call('state');
  return {
    plan: JSON.stringify(state.analysisResult?.executionPlan.fingerAssignments),
    difficulty: JSON.stringify(state.analysisResult?.difficultyAnalysis),
    fingering: JSON.stringify(await pf.call('fingering')),
    planLayoutHash: status.planLayoutHash,
    analysisStale: status.analysisStale,
    updatedAt: status.updatedAt,
    history: await pf.call('history'),
  };
}

/** What the Analysis panel shows (it is hidden in the Rehearse view). */
async function shownAnalysis(page: Page) {
  return {
    score: await page.getByTestId('analysis-score').textContent(),
    verdict: await page.getByTestId('verdict-badge').first().getAttribute('data-level'),
  };
}

test.describe('S4.4 · the Rehearse view (P4-10)', () => {
  test('hides and restores both side panels without changing any analysis value; remembered across a reload', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await expect(page.getByTestId('analysis-score')).toHaveText(/^Score\d+%$/, { timeout: 30_000 });
    const toggle = page.getByTestId('rehearse-view');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    const panels = { left: await width(page, 'left-panel'), right: await width(page, 'right-panel') };
    const grid = await width(page, 'grid-region');
    const dock = await width(page, 'grid-dock');
    expect(panels.left).toBeGreaterThan(200);
    const before = await analysisValues(pf);
    const shown = await shownAnalysis(page);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Both panels collapse to their strips; the centre, and the inspector beside the grid, get the room.
    await expect.poll(() => width(page, 'left-panel')).toBe(36);
    await expect.poll(() => width(page, 'right-panel')).toBe(36);
    await expect(page.getByTestId('left-panel-expand')).toBeVisible();
    await expect(page.getByTestId('right-panel-expand')).toBeVisible();
    expect(await width(page, 'grid-region')).toBeGreaterThan(grid + 500);
    expect(await width(page, 'grid-dock')).toBeGreaterThanOrEqual(dock);
    await page.waitForTimeout(1000);
    expect(await analysisValues(pf)).toEqual(before);

    // Remembered per viewer: after a reload the panels open collapsed.
    await waitForSaved(page);
    await page.reload();
    await pf.ready();
    await expect(page.getByTestId('rehearse-view')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => width(page, 'left-panel')).toBe(36);

    // Off: both panels come back exactly as wide as they were.
    await page.getByTestId('rehearse-view').click();
    await expect(page.getByTestId('rehearse-view')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => width(page, 'left-panel')).toBe(panels.left);
    await expect.poll(() => width(page, 'right-panel')).toBe(panels.right);
    // The same Score and verdict as before, from the same plan.
    await waitForAnalysis(pf);
    expect(await shownAnalysis(page)).toEqual(shown);
    expect((await analysisValues(pf)).plan).toBe(before.plan);
  });

  test('opening a panel from its strip leaves the Rehearse view, and a panel collapsed before stays collapsed', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const panels = { left: await width(page, 'left-panel'), right: await width(page, 'right-panel') };
    // Collapse the right panel first: the Rehearse view must hand it back collapsed.
    await page.getByTestId('right-panel').getByTitle('Collapse sidebar').click();
    await expect.poll(() => width(page, 'right-panel')).toBe(36);

    await page.getByTestId('rehearse-view').click();
    await expect.poll(() => width(page, 'left-panel')).toBe(36);
    await page.getByTestId('rehearse-view').click();
    await expect.poll(() => width(page, 'left-panel')).toBe(panels.left);
    expect(await width(page, 'right-panel')).toBe(36);

    await page.getByTestId('rehearse-view').click();
    await page.getByTestId('left-panel-expand').click();
    await expect(page.getByTestId('rehearse-view')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => width(page, 'left-panel')).toBe(panels.left);
    // The Composer tab, and every transport control, stay reachable meanwhile (invariant 3).
    await expect(page.getByTestId('drawer-tab-composer')).toBeVisible();
  });

  test('a hidden panel has no resize handle, so a drag there can\'t change the width it comes back at (P4 audit)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const right = await width(page, 'right-panel');
    await page.getByTestId('rehearse-view').click();
    await expect.poll(() => width(page, 'right-panel')).toBe(36);
    // On dc344ac the handle stayed, and a drag on it started from width 0, so the
    // panel came back at its 280 px minimum instead of its width.
    await expect(page.getByTestId('right-panel-handle')).toHaveCount(0);
    await expect(page.getByTestId('left-panel-handle')).toHaveCount(0);
    const strip = (await page.getByTestId('right-panel').boundingBox())!;
    await page.mouse.move(strip.x - 4, strip.y + 300);
    await page.mouse.down();
    await page.mouse.move(strip.x - 54, strip.y + 300, { steps: 5 });
    await page.mouse.up();
    await page.getByTestId('rehearse-view').click();
    await expect.poll(() => width(page, 'right-panel')).toBe(right);
    await expect(page.getByTestId('right-panel-handle')).toHaveCount(1);
  });
});
