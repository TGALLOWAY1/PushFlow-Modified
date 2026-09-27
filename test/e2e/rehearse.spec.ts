/**
 * S4.3b · Rehearse and the count-in (T10, T59).
 *
 * P4-4: "Rehearse" on a Hard row starts, after a 1-bar count-in, a loop whose
 *       bounds sit on bar lines and contain the moment.
 * Also: the count-in counts 1-2-3-4 over the grid while the playhead waits;
 * the Metronome's menu sets it for every Play (2 bars: eight clicks); Rehearse
 * from the inspector's menu at 50%, and from a chart bar; Rehearse while
 * playing sets the loop and carries on without counting in.
 *
 * TEST MIDI 1 with its Sounds spread over the grid (16 Hard events), 120 BPM:
 * a bar is 2 s.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, placeSounds, waitForAnalysis } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

const BAR = 2;

interface Frame {
  t: number;
  /** The beat and bar the grid shows (the count-in over it), or null. */
  beat: number | null;
  bar: number | null;
  /** The transport's own count-in now (its click, 0-based, of how many), read with the position. */
  live: { beat: number; beats: number } | null;
  position: number | null;
  playing: boolean;
  /** Pads lit by playback (a flash or a strike). */
  lit: number;
}

/**
 * Samples, every animation frame for `ms`, the count-in shown over the grid
 * and the transport's own state. Started before the click that plays, so the
 * first click of the count-in is in it. The grid redraws in the engine's own
 * frame callback, so on the frame the count-in ends it can still show beat 4
 * while the transport has moved on: timing reads the transport, what is shown
 * reads the grid.
 */
function sampleFrames(page: Page, ms: number): Promise<Frame[]> {
  return page.evaluate(duration => new Promise<Frame[]>(resolve => {
    const frames: Frame[] = [];
    const start = performance.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>('[data-testid="count-in"]');
      const transport = window.__pf!.transport();
      frames.push({
        t: performance.now() - start,
        beat: el ? Number(el.dataset.beat) : null,
        bar: el ? Number(el.dataset.bar) : null,
        live: transport?.countIn ?? null,
        position: transport ? transport.position : null,
        playing: !!transport?.running,
        lit: [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')]
          .filter(p => /^pad-\d-\d$/.test(p.dataset.testid ?? '') && /brightness-(150|200)/.test(p.className)).length,
      });
      if (performance.now() - start < duration) requestAnimationFrame(tick); else resolve(frames);
    };
    requestAnimationFrame(tick);
  }), ms);
}

/**
 * The beats the grid showed, in order and without repeats; the frames in which
 * the transport counted in (from Play on, its clicks after a short lead); and
 * how long it clicked, first click to last frame.
 */
function countInOf(frames: Frame[]) {
  const beats: number[] = [];
  for (const f of frames) if (f.beat !== null && beats[beats.length - 1] !== f.beat) beats.push(f.beat);
  const counting = frames.filter(f => f.live !== null);
  const clicking = counting.filter(f => f.live!.beat >= 0);
  const span = clicking.length ? clicking[clicking.length - 1]!.t - clicking[0]!.t : 0;
  return { beats, counting, span, shown: frames.filter(f => f.beat !== null) };
}

async function openEvents(page: Page) {
  await page.locator('button.pf-tab', { hasText: 'Events' }).first().click();
  await expect(page.getByTestId('events-list')).toBeVisible();
}

async function loopOf(pf: PfHandle) {
  const s = await pf.call('state');
  return { enabled: s.loopEnabled, start: s.loopStart!, end: s.loopEnd!, rate: s.playbackRate };
}

const onBarLine = (t: number) => Math.abs(t / BAR - Math.round(t / BAR)) < 1e-9;

test.describe('S4.3b · Rehearse and the count-in (T10, T59)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf);
    await waitForAnalysis(pf);
  });

  test('P4-4: Rehearse on a Hard row counts in one bar, then loops two bars on bar lines around the event', async ({ page, pf }) => {
    await openEvents(page);
    await page.getByTestId('events-filter-hard').click();
    // A Hard event past bar 1, so the loop doesn't simply start at 0.
    const events = await pf.call('events');
    const rows = page.getByTestId('event-row');
    let index = -1;
    for (let i = 0; i < await rows.count(); i++) {
      const at = Number(await rows.nth(i).getAttribute('data-event-index'));
      if (events[at]!.startTime >= 3 && events[at]!.startTime % BAR !== 0) { index = at; break; }
    }
    expect(index).toBeGreaterThan(0);
    const event = events[index]!;
    const row = page.locator(`[data-testid="event-row"][data-event-index="${index}"]`);
    await expect(row.getByTestId('event-difficulty')).toHaveText('Hard');
    await row.locator('button[data-moment-index]').click();
    expect((await pf.call('status')).selectedEvent).toBe(index);
    await expect(row.getByTestId('event-rehearse')).toHaveText(/^Rehearse bars \d+–\d+/);
    expect((await pf.call('state')).countInBars).toBe(0); // the count-in setting is Off: Rehearse counts in a bar anyway

    const sampling = sampleFrames(page, 4500);
    await row.getByTestId('event-rehearse').click();
    const frames = await sampling;

    // The loop: two bars, on bar lines, holding the event; Loop on, at 75%.
    const loop = await loopOf(pf);
    expect(loop.enabled).toBe(true);
    expect(onBarLine(loop.start) && onBarLine(loop.end)).toBe(true);
    expect(loop.end - loop.start).toBe(2 * BAR);
    expect(loop.start).toBeLessThanOrEqual(event.startTime);
    expect(loop.end).toBeGreaterThan(event.startTime);
    expect(loop.rate).toBe(0.75);
    expect((await pf.call('transport'))!.region).toEqual({ start: loop.start, end: loop.end, loops: true });
    await expect(page.getByTestId('transport-loop')).toHaveAttribute('aria-pressed', 'true');

    // The count-in: 1-2-3-4 over the grid, one bar, while the playhead waits at the loop's start.
    const { beats, counting, span, shown } = countInOf(frames);
    expect(beats).toEqual([1, 2, 3, 4]);
    expect(shown.every(f => f.bar === 1)).toBe(true);
    expect(counting.every(f => f.live!.beats === 4 && f.position === loop.start)).toBe(true);
    // No pad lights while it counts in; the first strike flashes when the music starts.
    expect(counting.every(f => f.lit === 0)).toBe(true);
    // A bar at 0.75x of 120 BPM is 8/3 s of clicks.
    expect(span).toBeGreaterThan(2.3 * 1000);
    expect(span).toBeLessThan(2.9 * 1000);

    // Then the loop plays, from its start.
    const after = frames.filter(f => f.t > counting[counting.length - 1]!.t + 150);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every(f => f.beat === null && f.live === null && f.playing)).toBe(true);
    expect(after.some(f => f.lit > 0)).toBe(true);
    expect(after[after.length - 1]!.position!).toBeGreaterThan(loop.start);
    expect(after.every(f => f.position! >= loop.start && f.position! < loop.end)).toBe(true);

    // Stop brings the rehearsed event back.
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);
    expect((await pf.call('status')).selectedEvent).toBe(index);
  });

  test('the count-in set in the Metronome\'s menu applies to Play: 2 bars count eight beats, "bar 2 of 2"; Off plays at once', async ({ page, pf }) => {
    await page.getByTestId('transport-count-in').click();
    await page.getByTestId('count-in-2').check({ force: true });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('transport-count-in-menu')).toHaveCount(0);
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 4 });

    const sampling = sampleFrames(page, 5200);
    await page.getByTestId('transport-play').click();
    const frames = await sampling;
    const { beats, counting, span, shown } = countInOf(frames);
    expect(beats).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(shown[0]!.bar).toBe(1);
    expect(shown[shown.length - 1]!.bar).toBe(2);
    await expect(page.getByTestId('count-in')).toHaveCount(0);
    expect(counting.every(f => f.live!.beats === 8 && f.position === 4)).toBe(true);
    // 8 beats at 120 BPM: 4 s of clicks.
    expect(span).toBeGreaterThan(3.6 * 1000);
    expect(span).toBeLessThan(4.3 * 1000);
    // Then the music played from 4 s.
    expect(frames[frames.length - 1]!.position!).toBeGreaterThan(4.5);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);

    // Off: Play plays at once.
    await page.getByTestId('transport-count-in').click();
    await page.getByTestId('count-in-0').check({ force: true });
    await page.keyboard.press('Escape');
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 4 });
    const plain = sampleFrames(page, 1200);
    await page.getByTestId('transport-play').click();
    const off = await plain;
    expect(off.every(f => f.beat === null && f.live === null)).toBe(true);
    expect(off[off.length - 1]!.position!).toBeGreaterThan(4.3);
    await page.getByTestId('transport-play').click();
  });

  test('Rehearse from the inspector\'s menu at 50%, and from a chart bar; while playing it sets the loop without counting in', async ({ page, pf }) => {
    const events = await pf.call('events');
    // The inspector: the menu's 50%.
    await pf.call('dispatch', { type: 'SELECT_EVENT', payload: { key: events[13]!.key, startTime: events[13]!.startTime } });
    await page.getByTestId('dock-rehearse-menu').click();
    await expect(page.getByTestId('dock-rehearse-speeds')).toBeVisible();
    await page.getByTestId('dock-rehearse-at-50').click();
    await expect(page.getByTestId('count-in')).toBeVisible();
    let loop = await loopOf(pf);
    expect(loop).toEqual({ enabled: true, start: 6, end: 10, rate: 0.5 });
    // The choice is remembered: the button says so, and the next Rehearse uses it.
    await expect(page.getByTestId('dock-rehearse')).toHaveText(/Rehearse bars 4–5 · 50%/);

    // While playing, a chart bar's Rehearse sets its loop and playback carries on into it.
    await expect(page.getByTestId('count-in')).toHaveCount(0, { timeout: 8000 });
    expect((await pf.call('status')).isPlaying).toBe(true);
    await page.locator('button.pf-tab', { hasText: 'Costs' }).first().click();
    const chartToggle = page.getByText('Event difficulty chart').first();
    if (await page.getByTestId('event-bar').count() === 0) await chartToggle.click();
    await page.locator('[data-testid="event-bar"][data-event-index="25"]').click();
    await expect(page.getByTestId('chart-selected-event')).toContainText('Event 26');
    const sampling = sampleFrames(page, 800);
    await page.getByTestId('chart-rehearse').click();
    const frames = await sampling;
    loop = await loopOf(pf);
    expect(loop).toEqual({ enabled: true, start: 12, end: 16, rate: 0.5 });
    expect(frames.every(f => f.beat === null && f.live === null && f.playing)).toBe(true);
    await expect.poll(async () => (await pf.call('status')).currentTime, { timeout: 6000 }).toBeGreaterThanOrEqual(12);
    await page.getByTestId('transport-play').click();
  });
});
