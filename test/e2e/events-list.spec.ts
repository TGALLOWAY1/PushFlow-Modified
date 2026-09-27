/**
 * S4.2 · the Events list for finding problems (T27).
 *
 * P4-8: on TEST MIDI 1 with its Sounds spread over the grid (many Hard
 * events), each filter chip shows exactly the matching events, with its count,
 * and Prev hard / Next hard (and Shift+←/→) visit every Hard event in time
 * order and stop at the ends. The expected sets come from the plan itself
 * (each event's worst note), never from the list.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, placeSounds, waitForAnalysis } from './project';
import type { Page } from '@playwright/test';

type Level = 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
const RANK: Record<Level, number> = { Easy: 0, Medium: 1, Hard: 2, Unplayable: 3 };

/** Each event's difficulty under the plan on screen: its worst note, Unplayable if any note is; null with no note. */
async function eventLevels(pf: Parameters<typeof waitForAnalysis>[0]): Promise<Array<Level | null>> {
  const state = await pf.call('state');
  const events = await pf.call('events');
  const notes = state.analysisResult!.executionPlan.fingerAssignments;
  return events.map(event => {
    const mine = notes.filter(n => n.eventKey !== undefined && event.noteKeys.includes(n.eventKey));
    if (mine.length === 0) return null;
    if (mine.some(n => n.assignedHand === 'Unplayable' || !Number.isFinite(n.cost))) return 'Unplayable';
    return mine.reduce<Level>((worst, n) => (RANK[n.difficulty as Level] > RANK[worst] ? n.difficulty as Level : worst), 'Easy');
  });
}

const selectedEvent = async (pf: Parameters<typeof waitForAnalysis>[0]) => (await pf.call('status')).selectedEvent;
const shownRows = (page: Page) => page.getByTestId('event-row').evaluateAll(rows => rows.map(r => Number((r as HTMLElement).dataset.eventIndex)));

test.describe('S4.2 · the Events list (T27)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf);
    await waitForAnalysis(pf);
    await page.locator('button.pf-tab', { hasText: 'Events' }).first().click();
    await expect(page.getByTestId('events-list')).toBeVisible();
  });

  test('P4-8: each filter chip shows exactly the matching events, with its count', async ({ page, pf }) => {
    const levels = await eventLevels(pf);
    const expected: Record<string, number[]> = {
      all: levels.map((_, i) => i),
      'medium-up': levels.flatMap((level, i) => (level && RANK[level] >= RANK.Medium ? [i] : [])),
      hard: levels.flatMap((level, i) => (level === 'Hard' ? [i] : [])),
      unplayable: levels.flatMap((level, i) => (level === 'Unplayable' ? [i] : [])),
    };
    // The spread layout has Hard events and Medium ones that aren't Hard.
    expect(expected.hard!.length).toBeGreaterThan(1);
    expect(expected['medium-up']!.length).toBeGreaterThan(expected.hard!.length);
    for (const [id, want] of Object.entries(expected)) {
      const chip = page.getByTestId(`events-filter-${id}`);
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      expect(Number((await chip.innerText()).match(/(\d+)\s*$/)?.[1]), `${id} chip count`).toBe(want.length);
      expect(await shownRows(page), `${id} rows`).toEqual(want);
      if (want.length === 0) await expect(page.getByTestId('events-none')).toBeVisible();
    }
  });

  test('P4-8: Prev hard and Next hard visit every Hard event in time order and stop at the ends', async ({ page, pf }) => {
    const levels = await eventLevels(pf);
    const hard = levels.flatMap((level, i) => (level === 'Hard' ? [i] : []));
    const next = page.getByTestId('events-next-hard');
    const prev = page.getByTestId('events-prev-hard');
    await expect(page.getByTestId('events-hard-status')).toHaveText(`${hard.length} Hard`);

    // Forward with the buttons, from no selection to the last Hard event.
    const seen: number[] = [];
    while (await next.isEnabled()) {
      const before = await selectedEvent(pf);
      await next.click();
      await expect.poll(() => selectedEvent(pf)).not.toBe(before);
      seen.push((await selectedEvent(pf))!);
    }
    expect(seen).toEqual(hard);
    await expect(page.getByTestId('events-hard-status')).toHaveText(`Hard ${hard.length} of ${hard.length}`);
    await expect(prev).toBeEnabled();

    // Back with Shift+←, one Hard event at a time, and it stays on the first.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const back: number[] = [];
    for (let i = 0; i < hard.length; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
      if (i < hard.length - 1) await expect.poll(() => selectedEvent(pf)).toBe(hard[hard.length - 2 - i]);
      back.push((await selectedEvent(pf))!);
    }
    expect(back).toEqual([...hard.slice(0, -1).reverse(), hard[0]]);
    await expect(prev).toBeDisabled();
    await expect(page.getByTestId('events-hard-status')).toHaveText(`Hard 1 of ${hard.length}`);

    // Shift+→ from the first goes to the second.
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => selectedEvent(pf)).toBe(hard[1]);
  });
});
