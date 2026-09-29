/**
 * S4.3b · one current moment (T10): the selected event when stopped, the
 * playhead's event while playing.
 *
 * P4-3b: Stop restores the selected moment.
 * P4-3c: after pausing mid-song with nothing selected, the grid shows the
 *        playhead's moment, not a blank grid.
 * Also: the docked inspector follows the playhead while playing (S4.2's
 * follow-up); a ruler click while stopped lands on the nearest event and
 * selects it; ←/→ while playing move the playhead by an event and select
 * nothing (P4-11c's browser half; the registry test is in inputTable.test.tsx);
 * L, [ ] and Home drive the transport.
 *
 * TEST MIDI 1 with the suggested layout: 8 bars at 120 BPM, an event every
 * beat (0.5 s), all of them played by the plan.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, selectMoment } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** The pads the plan strikes at event `index`. */
async function padsOfEvent(pf: PfHandle, index: number): Promise<string[]> {
  const events = await pf.call('events');
  const fingering = (await pf.call('fingering'))!;
  return [...new Set(fingering.filter(n => n.pad && n.eventKey && events[index]!.noteKeys.includes(n.eventKey)).map(n => n.pad!))].sort();
}

/** The pads the grid draws as struck now (the moment view's current layer). */
function struckPads(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-struck="true"]')]
    .map(el => el.dataset.testid!.replace('pad-', '').replace('-', ','))
    .sort());
}

/** The last event starting at or before `time`. */
async function eventAt(pf: PfHandle, time: number): Promise<number> {
  const events = await pf.call('events');
  let index = -1;
  for (const e of events) if (e.startTime <= time + 1e-6) index = e.index;
  return index;
}

async function playUntil(page: Page, pf: PfHandle, time: number) {
  await page.getByTestId('transport-play').click();
  await expect.poll(async () => (await pf.call('status')).currentTime, { timeout: 15_000 }).toBeGreaterThan(time);
}

/** Stops, and waits until the stop has settled: the stored playhead is where the engine rests (P4 audit: CI 36357496247). */
async function stop(page: Page, pf: PfHandle) {
  await page.getByTestId('transport-play').click();
  await expect.poll(async () => { const s = await pf.call('status'), t = (await pf.call('transport'))!; return !s.isPlaying && !t.running && s.currentTime === t.position; }).toBe(true);
}

test.describe('S4.3b · one current moment (T10)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
  });

  test('P4-3c: after pausing mid-song with nothing selected, the grid shows the playhead\'s moment, not a blank grid', async ({ page, pf }) => {
    expect((await pf.call('status')).selectedMomentKey).toBeNull();
    await playUntil(page, pf, 3.1);
    await stop(page, pf);
    const at = (await pf.call('status')).currentTime;
    const index = await eventAt(pf, at);
    expect(index).toBeGreaterThan(4);
    // The playhead stays where it stopped, and its event is the current moment everywhere.
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(index);
    expect((await pf.call('status')).currentTime).toBe(at);
    await expect.poll(() => struckPads(page)).toEqual(await padsOfEvent(pf, index));
    await expect(page.getByTestId('selected-event-label')).toHaveText(new RegExp(`^Event ${index + 1} · `));
    await page.locator('button.pf-tab', { hasText: 'Events' }).first().click();
    await expect(page.locator(`button[data-moment-index="${index}"]`)).toHaveAttribute('data-selected', 'true');

    // A later pause moves it: it follows where playback stops, not where it first did.
    await playUntil(page, pf, at + 2.2);
    await stop(page, pf);
    const later = await eventAt(pf, (await pf.call('status')).currentTime);
    expect(later).toBeGreaterThan(index + 2);
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(later);
    await expect.poll(() => struckPads(page)).toEqual(await padsOfEvent(pf, later));

    // → and ← step on from there (a step is a pick of its own, which Stop then keeps).
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(later + 1);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(later);

    // Escape clears it: the plain grid again.
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await pf.call('status')).selectedMomentKey).toBeNull();
    await expect.poll(() => struckPads(page)).toEqual([]);
  });

  test('P4-3b: Stop restores the selected moment; while playing the inspector follows the playhead', async ({ page, pf }) => {
    await selectMoment(page, 3);
    await expect.poll(() => struckPads(page)).toEqual(await padsOfEvent(pf, 3));
    await expect(page.getByTestId('selected-event-label')).toHaveText(/^Event 4 · /);
    await page.getByTestId('transport-play').click();
    // The dock follows the playhead with the grid, well past the picked event.
    await expect(page.getByTestId('selected-event-card')).toHaveAttribute('data-following', 'true');
    await expect(page.getByTestId('moment-playing-note')).toHaveText('Playing: this follows the playhead. Stop comes back to Event 4.');
    await expect.poll(async () => {
      const label = (await page.getByTestId('selected-event-label').textContent()) ?? '';
      return Number(label.match(/^Event (\d+)/)?.[1] ?? 0);
    }, { timeout: 15_000 }).toBeGreaterThan(8);
    // The selection itself never moved.
    expect((await pf.call('status')).selectedEvent).toBe(3);
    await stop(page, pf);
    const at = (await pf.call('status')).currentTime;
    expect(await eventAt(pf, at)).toBeGreaterThan(6);
    // Stop brings the picked event back: the grid, the dock and the selection.
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(3);
    await expect.poll(() => struckPads(page)).toEqual(await padsOfEvent(pf, 3));
    await expect(page.getByTestId('selected-event-label')).toHaveText(/^Event 4 · /);
    expect(await page.getByTestId('selected-event-card').getAttribute('data-following')).toBeNull();
    await expect(page.locator('button[data-moment-index="3"]')).toHaveAttribute('data-selected', 'true');
  });

  test('a ruler click while stopped lands on the nearest event and selects it; while playing it goes exactly there', async ({ page, pf }) => {
    const numbers = page.getByTestId('ruler-numbers');
    const bar3 = (await page.locator('[data-testid="ruler-bar"][data-bar="3"]').boundingBox())!;
    const box = (await numbers.boundingBox())!;
    const y = box.y + box.height / 2;
    // A click 0.1 s after 3.1.1 (4.0 s) at 120 BPM: a bar is 2 s wide.
    const pxPerSecond = bar3.width / 2;
    await page.mouse.click(bar3.x + 0.1 * pxPerSecond, y);
    await expect.poll(async () => (await pf.call('status')).currentTime).toBe(4);
    const index = await eventAt(pf, 4);
    await expect.poll(async () => (await pf.call('status')).selectedEvent).toBe(index);
    await expect.poll(() => struckPads(page)).toEqual(await padsOfEvent(pf, index));
    // Nearer the next event (4.5 s), it takes that one.
    await page.mouse.click(bar3.x + 0.4 * pxPerSecond, y);
    await expect.poll(async () => (await pf.call('status')).currentTime).toBe(4.5);

    // Playing: the playhead goes where it is put, and the selection stays.
    await page.getByTestId('transport-speed').selectOption('0.25');
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    const selected = (await pf.call('status')).selectedEvent;
    await page.mouse.click(bar3.x + 1.1 * pxPerSecond, y);
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(5.05);
    expect((await pf.call('status')).currentTime).toBeLessThan(5.4);
    expect((await pf.call('status')).selectedEvent).toBe(selected);
    await stop(page, pf);
  });

  test('←/→ while playing move the playhead by an event and select nothing; L, [ ] and Home drive the transport', async ({ page, pf }) => {
    // A quarter speed, so an event lasts 2 s of wall time and the checks never race it.
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    expect((await pf.call('status')).playbackRate).toBe(0.25);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 2.1 });
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    await page.mouse.click(2, 300); // focus the page, not a control
    // Playing at 2.1+ (event 4 is at 2.0 s): → goes to event 5 (2.5 s), ← back to 4, ← to 3.
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThanOrEqual(2.5);
    expect((await pf.call('status')).currentTime).toBeLessThan(2.75);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeLessThan(2.25);
    expect((await pf.call('status')).currentTime).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeLessThan(1.75);
    expect((await pf.call('status')).currentTime).toBeGreaterThanOrEqual(1.5);
    const s = await pf.call('status');
    expect({ playing: s.isPlaying, selected: s.selectedMomentKey }).toEqual({ playing: true, selected: null });

    // ] speeds up a step, L turns the loop on, Home returns to the start and keeps playing.
    await page.keyboard.press(']');
    expect((await pf.call('status')).playbackRate).toBe(0.5);
    await page.keyboard.press('l');
    expect((await pf.call('status')).loopEnabled).toBe(true);
    await page.keyboard.press('Home');
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeLessThan(0.5);
    expect((await pf.call('status')).isPlaying).toBe(true);
    await page.keyboard.press('l');
    expect((await pf.call('status')).loopEnabled).toBe(false);
    await stop(page, pf);
  });
});
