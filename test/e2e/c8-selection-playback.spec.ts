/**
 * C8 · A selected event freezes the grid during playback (T10).
 *
 * Register root cause: the selected-event greying (InteractiveGrid.tsx,
 * isGreyedOut → opacity-20 saturate-0) stays applied during playback, so it
 * overrides the playback pad flash. Arrow keys also select events while playing.
 *
 * Flips in S1b.4 (moment-view stop-gaps).
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, selectMoment } from './project';
import type { Page } from '@playwright/test';

/** Pads drawn greyed out (dimmed or desaturated) right now. */
function greyedPads(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')]
    .filter(el => /^pad-\d-\d$/.test(el.dataset.testid ?? ''))
    .filter(el => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.opacity) < 0.5 || /saturate\(0\)/.test(cs.filter);
    })
    .map(el => el.dataset.testid!));
}

/** Samples greyed occupied pads every animation frame for `ms`; returns how many frames had any. */
function framesWithGreyedPads(page: Page, ms: number): Promise<{ frames: number; greyed: number }> {
  return page.evaluate(duration => new Promise(resolve => {
    let frames = 0, greyed = 0;
    const end = performance.now() + duration;
    const tick = () => {
      frames++;
      const any = [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')]
        .filter(el => /^pad-\d-\d$/.test(el.dataset.testid ?? '') && !/empty/.test(el.title))
        .some(el => {
          const cs = getComputedStyle(el);
          return parseFloat(cs.opacity) < 0.5 || /saturate\(0\)/.test(cs.filter);
        });
      if (any) greyed++;
      if (performance.now() < end) requestAnimationFrame(tick); else resolve({ frames, greyed });
    };
    requestAnimationFrame(tick);
  }), ms);
}

test.describe('C8 · selected event during playback', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
  });

  test('with an event selected, struck pads look as they do with nothing selected, and Stop restores the selection', async ({ page, pf }) => {
    // Control: playing with nothing selected greys nothing.
    await page.getByTestId('transport-play').click();
    const control = await framesWithGreyedPads(page, 1500);
    await page.getByTestId('transport-play').click();
    expect(control.greyed).toBe(0);

    await selectMoment(page, 8);
    await expect.poll(async () => (await greyedPads(page)).length, { message: 'selection overlay is shown while stopped' }).toBeGreaterThan(0);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    const selected = await framesWithGreyedPads(page, 1500);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);
    await page.waitForTimeout(500);
    const afterStop = (await greyedPads(page)).length;
    expect({ greyedFramesWhilePlaying: selected.greyed, overlayBackAfterStop: afterStop > 0 })
      .toEqual({ greyedFramesWhilePlaying: 0, overlayBackAfterStop: true });
  });

  test('ArrowRight during playback neither seeks nor selects the first event', async ({ page, pf }) => {
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(1);
    const before = (await pf.call('status')).currentTime;
    await page.mouse.click(2, 300);
    await page.keyboard.press('ArrowRight');
    const s = await pf.call('status');
    expect({ selectedEventIndex: s.selectedEventIndex, playing: s.isPlaying, seekedBack: s.currentTime < before })
      .toEqual({ selectedEventIndex: null, playing: true, seekedBack: false });
  });
});
