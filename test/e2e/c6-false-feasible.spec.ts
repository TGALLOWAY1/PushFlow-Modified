/**
 * C6 · Selecting an event shows a false "Feasible · All events playable" (T07).
 *
 * Register root cause: FeasibilityBadge falls back to 'feasible' when it is
 * given no verdict (CostBreakdownBars.tsx), and the selected-event view passes
 * none. The no-analysis "Unknown" case is covered by the FeasibilityBadge
 * component test (test/ui/components/FeasibilityBadge.test.tsx).
 *
 * Flipped in S1b.1 (honest verdict): the whole-layout verdict stays pinned and
 * the selected event gets its own card. S3.3: the partly placed case reads
 * Unfinished (only placed Sounds are scored), still never Feasible.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, placeSounds, waitForAnalysis, selectMoment, SPREAD_PADS } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** Level of every verdict badge on screen after selecting each of the first `n` events. */
async function badgeLevelsWhileSelecting(page: Page, pf: PfHandle, n: number): Promise<string[]> {
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    await selectMoment(page, i);
    await page.getByRole('button', { name: 'Costs', exact: true }).click();
    await expect.poll(async () => { const s = await pf.call('status'); return s.selectedMomentIndex ?? s.selectedEventIndex; }).not.toBeNull();
    // The selected event gets its own card, beside the pinned layout verdict.
    await expect(page.getByTestId('selected-event-card')).toBeVisible();
    for (const badge of await page.getByTestId('verdict-badge').all()) {
      seen.add(`${await badge.getAttribute('data-level')}: ${(await badge.innerText()).replace(/\s+/g, ' ')}`);
    }
  }
  return [...seen];
}

test.describe('C6 · verdict with an event selected', () => {
  // S3.3 (T25): only placed Sounds are scored, so four of seven placed reads
  // Unfinished, not Infeasible (the unplaced Sounds' notes counted as
  // unplayable before). It must still never read Feasible.
  test('a partly placed (Unfinished) layout never shows "Feasible" while an event is selected', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['3,3', '3,4', '4,2', '4,5']);
    await waitForAnalysis(pf);
    await page.getByRole('button', { name: 'Costs', exact: true }).click();
    await expect(page.getByTestId('verdict-badge').first()).toHaveAttribute('data-level', 'unfinished');
    await expect(page.getByTestId('verdict-headline').first()).toHaveText('Unfinished · 4 of 7 Sounds placed');
    const levels = await badgeLevelsWhileSelecting(page, pf, 6);
    expect(levels.filter(l => l.startsWith('feasible'))).toEqual([]);
  });

  test('a Degraded layout never shows "Feasible" while an event is selected', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf, SPREAD_PADS);
    await waitForAnalysis(pf);
    await page.getByRole('button', { name: 'Costs', exact: true }).click();
    await expect(page.getByTestId('verdict-badge').first()).toHaveAttribute('data-level', 'degraded');
    const levels = await badgeLevelsWhileSelecting(page, pf, 6);
    expect(levels.filter(l => l.startsWith('feasible'))).toEqual([]);
  });
});
