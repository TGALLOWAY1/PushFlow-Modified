/**
 * S4.3a · a DAW-grade transport (T58), owned by the workspace (T60 part).
 *
 * P4-5a: Loop off plays once and stops at the end; Loop on with no region
 *        repeats the whole song.
 * P4-5d: a drag on the ruler's loop strip from the bar-2 line to the bar-4
 *        line gives exactly 2.1.1–4.1.1, a few pixels off the lines too; a
 *        drag that leaves the ruler carries on (pointer capture); Shift snaps
 *        to beats and Alt not at all; the loop bar moves and resizes.
 * P4-6:  switching to the Composer tab mid-playback leaves time advancing and
 *        pads flashing.
 * Also: the loop presets, Return to the loop start, seeking and scrubbing on
 * the ruler, and the loop and speed coming back after a reload.
 *
 * The 4-bar clip is 120 BPM: a bar is 2 s, a beat 0.5 s.
 */

import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { newProject, openTestMidi1, saveAndReload, suggestStartingLayout, waitForAnalysis } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

const FOUR_BARS = fileURLToPath(new URL('../fixtures/midi/four-bars-120.mid', import.meta.url));

async function openFourBars(page: Page, pf: PfHandle) {
  await newProject(page, pf);
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(FOUR_BARS);
  await expect.poll(async () => (await pf.call('status')).soundCount).toBe(3);
  expect((await pf.call('state')).tempo).toBe(120);
  await expect(page.getByTestId('loop-strip')).toBeVisible();
}

/** The x of a bar's line on the ruler, and the loop strip's vertical centre. */
async function rulerGeometry(page: Page) {
  const strip = (await page.getByTestId('loop-strip').boundingBox())!;
  const barX = async (bar: number) => (await page.locator(`[data-testid="ruler-bar"][data-bar="${bar}"]`).boundingBox())!.x;
  return { stripY: strip.y + strip.height / 2, barX, barWidth: (await barX(2)) - (await barX(1)) };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

const loopOf = async (pf: PfHandle) => {
  const s = await pf.call('state');
  return { enabled: s.loopEnabled, start: s.loopStart, end: s.loopEnd };
};

test.describe('S4.3a · the transport', () => {
  test('P4-5a: Loop off plays to the end once and stops there; Play from the end starts over', async ({ page, pf }) => {
    await openFourBars(page, pf);
    expect((await loopOf(pf)).enabled).toBe(false);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 6.6 });
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    // 1.4 s to the end of bar 4, then it stops by itself, on the end.
    await expect.poll(async () => (await pf.call('status')).isPlaying, { timeout: 6000 }).toBe(false);
    expect((await pf.call('status')).currentTime).toBe(8);
    await expect(page.getByTestId('transport-position')).toHaveText('5.1.1');
    await expect(page.getByTestId('transport-play')).toHaveText('Play');
    // Play from the end plays the song again from the top.
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(0.2);
    expect((await pf.call('status')).currentTime).toBeLessThan(3);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);
  });

  test('P4-5a: Loop on with no region repeats the whole song', async ({ page, pf }) => {
    await openFourBars(page, pf);
    await page.getByTestId('transport-loop').click();
    expect(await loopOf(pf)).toEqual({ enabled: true, start: null, end: null });
    await expect(page.getByTestId('transport-loop')).toHaveAttribute('title', /Loop the whole song/);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 7.4 });
    await page.getByTestId('transport-play').click();
    // Past the end it comes round to the top and carries on.
    await expect.poll(async () => {
      const s = await pf.call('status');
      return s.isPlaying && s.currentTime > 0.1 && s.currentTime < 4;
    }, { timeout: 6000 }).toBe(true);
    await page.getByTestId('transport-play').click();
  });

  test('P4-5d: dragging on the loop strip from the bar-2 line to the bar-4 line gives exactly 2.1.1–4.1.1', async ({ page, pf }) => {
    await openFourBars(page, pf);
    const { stripY, barX } = await rulerGeometry(page);
    // A few pixels off both lines: the edges snap to the bars.
    await drag(page, { x: (await barX(2)) + 3, y: stripY }, { x: (await barX(4)) - 3, y: stripY });
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 2, end: 6 });
    await expect(page.getByTestId('loop-start-label')).toHaveText('2.1.1');
    await expect(page.getByTestId('loop-end-label')).toHaveText('4.1.1');
    await expect(page.getByTestId('timeline-loop-label')).toHaveText('Bars 2–3');
    await expect(page.getByTestId('transport-loop')).toHaveAttribute('title', 'Loop Bars 2–3 (2.1.1–4.1.1)');
    await expect(page.getByTestId('loop-bar')).toHaveAttribute('data-active', 'true');
    // Stopped, the playhead goes to the new loop, so Play starts there.
    expect((await pf.call('status')).currentTime).toBe(2);
    // The lanes are shaded over the same bars.
    const shading = (await page.getByTestId('timeline-loop-shading').boundingBox())!;
    expect(Math.abs(shading.x - (await barX(2)))).toBeLessThanOrEqual(1);
  });

  test('the loop bar moves and resizes, Shift snaps to beats, Alt not at all, and a drag outside the ruler carries on', async ({ page, pf }) => {
    await openFourBars(page, pf);
    const { stripY, barX, barWidth } = await rulerGeometry(page);
    await drag(page, { x: (await barX(2)) + 2, y: stripY }, { x: (await barX(4)) - 2, y: stripY });
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 2, end: 6 });

    // Move it one bar right by its middle: 3.1.1–5.1.1.
    const bar = (await page.getByTestId('loop-bar').boundingBox())!;
    await drag(page, { x: bar.x + bar.width / 2, y: stripY }, { x: bar.x + bar.width / 2 + barWidth + 4, y: stripY });
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 4, end: 8 });

    // Resize its end with Shift: half a bar in, onto a beat.
    const end = (await page.getByTestId('loop-end-handle').boundingBox())!;
    await page.keyboard.down('Shift');
    await drag(page, { x: end.x + end.width / 2, y: stripY }, { x: end.x + end.width / 2 - barWidth / 2 + 3, y: stripY });
    await page.keyboard.up('Shift');
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 4, end: 7 });

    // Alt: no snapping at all.
    await page.keyboard.down('Alt');
    await drag(page, { x: (await barX(1)) + barWidth * 0.3, y: stripY }, { x: (await barX(2)) + barWidth * 0.3, y: stripY });
    await page.keyboard.up('Alt');
    const free = await loopOf(pf);
    expect(free.start! % 0.5).not.toBe(0);
    expect(free.end! - free.start!).toBeCloseTo(2, 1);

    // Out of the ruler and down over the lanes: the drag carries on and ends there.
    const lanes = (await page.getByTestId('timeline-scroll').boundingBox())!;
    await drag(page, { x: (await barX(1)) + 2, y: stripY }, { x: (await barX(3)) - 2, y: lanes.y + lanes.height - 10 });
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 0, end: 4 });
  });

  test('presets loop this bar or two, or the whole song; Return goes to the loop start', async ({ page, pf }) => {
    await openFourBars(page, pf);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 2.7 });
    const preset = async (id: string, label?: string) => {
      await page.getByTestId('transport-loop-menu').click();
      const item = page.getByTestId(id);
      if (label) await expect(item).toHaveText(label);
      await item.click();
      await expect(page.getByTestId('transport-loop-presets')).toHaveCount(0);
    };
    await preset('loop-preset-bar', 'This bar · Bar 2');
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 2, end: 4 });
    expect((await pf.call('status')).currentTime).toBe(2);
    await preset('loop-preset-two-bars', 'Two bars · Bars 2–3');
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 2, end: 6 });

    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 5.1 });
    await page.getByTestId('transport-return').click();
    expect((await pf.call('status')).currentTime).toBe(2);

    await preset('loop-preset-song');
    expect(await loopOf(pf)).toEqual({ enabled: true, start: null, end: null });
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 5.1 });
    await page.getByTestId('transport-return').click();
    expect((await pf.call('status')).currentTime).toBe(0);
  });

  test('a click on the bar numbers moves the playhead there; its handle scrubs', async ({ page, pf }) => {
    await openFourBars(page, pf);
    const { barX, barWidth } = await rulerGeometry(page);
    const numbers = (await page.getByTestId('ruler-numbers').boundingBox())!;
    const y = numbers.y + numbers.height / 2;
    await page.mouse.click((await barX(3)) + barWidth / 4, y);
    // A quarter into bar 3: 4.5 s, give or take a pixel.
    expect((await pf.call('status')).currentTime).toBeCloseTo(4.5, 1);
    const handle = (await page.getByTestId('playhead-handle').boundingBox())!;
    await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: await barX(2), y });
    expect((await pf.call('status')).currentTime).toBeCloseTo(2, 1);
    await expect(page.getByTestId('transport-position')).toHaveText('2.1.1');
  });

  test('the loop and speed come back after a reload', async ({ page, pf }) => {
    await openFourBars(page, pf);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 4.2 });
    await page.getByTestId('transport-loop-menu').click();
    await page.getByTestId('loop-preset-two-bars').click();
    await page.getByTestId('transport-speed').selectOption('0.75');
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 4, end: 8 });
    await saveAndReload(page, pf);
    expect(await loopOf(pf)).toEqual({ enabled: true, start: 4, end: 8 });
    expect((await pf.call('state')).playbackRate).toBe(0.75);
    await expect(page.getByTestId('transport-speed')).toHaveValue('0.75');
    await expect(page.getByTestId('loop-start-label')).toHaveText('3.1.1');
    await expect(page.getByTestId('transport-loop')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('S4.3a · the transport belongs to the workspace (P4-6)', () => {
  test('switching to the Composer tab mid-playback leaves time advancing and pads flashing', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(0.2);

    await page.getByTestId('drawer-tab-composer').click();
    await expect(page.getByTestId('drawer-panel-composer')).toBeVisible();
    await expect(page.getByTestId('drawer-panel-timeline')).toBeHidden();
    // The transport is still in view and still playing.
    await expect(page.getByTestId('transport-bar')).toBeVisible();
    await expect(page.getByTestId('transport-play')).toHaveText('Stop');

    const before = (await pf.call('status')).currentTime;
    // 60 frames with the Composer shown: pads flash, and the position readout moves.
    const seen = await page.evaluate(() => new Promise<{ frames: number; flashing: number; positions: number }>(resolve => {
      const out = { frames: 0, flashing: 0, positions: 0 };
      const texts = new Set<string>();
      const end = performance.now() + 8000;
      const tick = () => {
        out.frames++;
        const pads = [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')].filter(el => /^pad-\d-\d$/.test(el.dataset.testid ?? ''));
        if (pads.some(el => el.className.includes('brightness-200') || el.className.includes('brightness-150'))) out.flashing++;
        texts.add(document.querySelector('[data-testid="transport-position"]')?.textContent ?? '');
        if (out.frames < 60 && performance.now() < end) requestAnimationFrame(tick);
        else { out.positions = texts.size; resolve(out); }
      };
      requestAnimationFrame(tick);
    }));
    const after = await pf.call('status');
    expect(after.isPlaying).toBe(true);
    expect(after.currentTime).toBeGreaterThan(before + 0.3);
    expect(seen.flashing, 'frames with a pad flashing').toBeGreaterThan(0);
    expect(seen.positions, 'positions the readout showed').toBeGreaterThan(2);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);
  });
});
