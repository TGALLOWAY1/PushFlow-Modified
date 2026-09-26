/**
 * S4.1 · One identity for each performance event (T24; P4-1).
 *
 * For all 32 TEST MIDI 1 events, selecting an event on any surface (an Events
 * row, a chart bar, a timeline note, →) highlights the same pads on the grid,
 * the same Events row, every note of that event in the timeline and the same
 * chart bar. The selection survives re-analysis, and a click on any timeline
 * note highlights its whole event.
 *
 * Since S3.2 the workspace shows each layout's own plan from the analysis
 * cache, which beam solves; it never shows a candidate's optimizer plan. So
 * here the plans are beam's, for the suggested layout and for a Greedy
 * candidate's layout. The greedy optimizer's own plan is checked on the same
 * four surfaces in test/ui/components/eventIdentity.test.tsx.
 */

import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { chooseMethod, dragPad, generateAndWait, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

type Ev = { index: number; key: string; startTime: number; noteKeys: string[] };

/** The Events list, the Costs panel's chart and the timeline, all on screen. */
async function showSurfaces(page: Page) {
  await page.locator('button.pf-tab', { hasText: 'Events' }).first().click();
  await page.getByRole('button', { name: 'Costs', exact: true }).click();
  await page.getByRole('button', { name: 'Event difficulty chart' }).first().click();
  await expect(page.getByTestId('event-bar').first()).toBeAttached();
}

/** What each surface highlights. */
function onScreen(page: Page) {
  return page.evaluate(() => ({
    pads: [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"][data-struck="true"]')]
      .map(el => el.dataset.testid!.slice(4).replace('-', ',')).sort(),
    rows: [...document.querySelectorAll<HTMLElement>('[data-moment-index][data-selected="true"]')].map(el => Number(el.dataset.momentIndex)),
    notes: [...document.querySelectorAll<HTMLElement>('[data-testid="timeline-pill"][data-selected="true"]')].map(el => el.dataset.eventKey!).sort(),
    bars: [...document.querySelectorAll<HTMLElement>('[data-testid="event-bar"][data-selected="true"]')].map(el => Number(el.dataset.eventIndex)),
  }));
}

/** Every surface shows `event`: the plan's pads for its notes, its row, all its notes, its bar and its label. */
async function expectEverywhere(page: Page, pf: PfHandle, event: Ev) {
  await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(event.index);
  const fingering = (await pf.call('fingering'))!;
  const pads = [...new Set(fingering.filter(f => f.eventKey !== null && event.noteKeys.includes(f.eventKey) && f.pad).map(f => f.pad!))].sort();
  expect(await onScreen(page)).toEqual({ pads, rows: [event.index], notes: [...event.noteKeys].sort(), bars: [event.index] });
  await expect(page.getByTestId('selected-event-label').first()).toHaveText(new RegExp(`^Event ${event.index + 1} · \\d+\\.\\d\\.\\d$`));
}

/** Selects each event on a different surface in turn, checking every surface each time. */
async function selectEveryEventOnEverySurface(page: Page, pf: PfHandle) {
  const events = await pf.call('events');
  expect(events).toHaveLength(32);
  for (const event of events) {
    switch (event.index % 4) {
      case 0: await page.locator(`[data-moment-index="${event.index}"]`).click(); break;
      // A bar's size isn't this session's; its click is.
      case 1: await page.locator(`[data-testid="event-bar"][data-event-index="${event.index}"]`).dispatchEvent('click'); break;
      case 2: await page.locator(`[data-testid="timeline-pill"][data-event-key="${event.noteKeys[0]}"]`).click(); break;
      case 3: await page.keyboard.press('ArrowRight'); break;
    }
    await expectEverywhere(page, pf, event);
  }
}

test.describe('S4.1 · one identity for each performance event (P4-1)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await showSurfaces(page);
  });

  test('all 32 events: one selection on the grid, the Events list, the timeline and the chart, from any of them', async ({ page, pf }) => {
    test.setTimeout(240_000);
    await selectEveryEventOnEverySurface(page, pf);

    // A Greedy candidate's layout, shown read-only with its own plan.
    await chooseMethod(page, 'Greedy');
    await generateAndWait(page, pf, 180_000);
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-role', 'candidate');
    await expect.poll(async () => (await pf.call('fingering')) !== null).toBe(true);
    await page.getByRole('button', { name: 'Costs', exact: true }).click();
    await expect(page.getByTestId('event-bar').first()).toBeAttached();
    await selectEveryEventOnEverySurface(page, pf);
  });

  test('the selected event survives re-analysis after a pad moves', async ({ page, pf }) => {
    const events = await pf.call('events');
    const chord = events.find(e => e.noteKeys.length >= 2)!;
    await page.locator(`[data-moment-index="${chord.index}"]`).click();
    await expectEverywhere(page, pf, chord);
    const before = (await onScreen(page)).pads;
    // Move one of the chord's pads to an empty pad: the layout changes and is re-analysed.
    const from = before[0]!;
    const occupied = new Set(Object.keys((await pf.call('state')).workingLayout!.padToVoice));
    const to = ['7,7', '7,6', '6,7', '0,7'].find(k => !occupied.has(k))!;
    await dragPad(page, from, to);
    await expect.poll(async () => (await pf.call('status')).analysisStale, { timeout: 5_000 }).toBe(false);
    await waitForAnalysis(pf);
    await expect.poll(async () => (await pf.call('fingering'))?.some(f => f.pad === to) ?? false).toBe(true);
    await expectEverywhere(page, pf, chord);
    const after = (await onScreen(page)).pads;
    expect(after).toContain(to);
    expect(after).not.toContain(from);
  });

  test('a click on any timeline note highlights its whole event', async ({ page, pf }) => {
    test.setTimeout(120_000);
    const events = await pf.call('events');
    const pills = page.getByTestId('timeline-pill');
    const count = await pills.count();
    expect(count).toBe(events.reduce((n, e) => n + e.noteKeys.length, 0));
    for (let i = 0; i < count; i++) {
      const pill = pills.nth(i);
      const key = (await pill.getAttribute('data-event-key'))!;
      await pill.click();
      const event = events.find(e => e.noteKeys.includes(key))!;
      await expect.poll(async () => (await onScreen(page)).notes).toEqual([...event.noteKeys].sort());
    }
  });
});
