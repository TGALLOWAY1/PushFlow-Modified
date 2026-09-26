/**
 * S2.1 · Measured grid, reachable transport, full-width timeline (T04, T05, T50).
 *
 * P2-1: at 1366x768 and 1600x1000 with default panels, all 64 pads, the
 * hand-zone labels and the state-bar slot are inside the viewport and not
 * clipped by any ancestor; pads are at least 32 px; every transport control
 * can be clicked.
 * P2-2: after importing a 4-bar clip at 120 BPM, the ruler is exactly as wide
 * as its container (T50's regression: the width was never measured when the
 * import left the default 4-bar duration unchanged).
 */

import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { newProject, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';
import type { Page } from '@playwright/test';

const FOUR_BARS = fileURLToPath(new URL('../fixtures/midi/four-bars-120.mid', import.meta.url));

/**
 * Test ids whose whole box is not visible: outside the viewport, or cut by an
 * ancestor that clips its overflow. Empty when everything is fully visible.
 */
async function clippedOf(page: Page, testIds: string[]): Promise<string[]> {
  return page.evaluate((ids) => {
    const bad: string[] = [];
    for (const id of ids) {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) { bad.push(`${id}: missing`); continue; }
      const r = el.getBoundingClientRect();
      const inside = (o: { left: number; top: number; right: number; bottom: number }) =>
        r.left >= o.left - 0.5 && r.top >= o.top - 0.5 && r.right <= o.right + 0.5 && r.bottom <= o.bottom + 0.5;
      if (!inside({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })) {
        bad.push(`${id}: outside the viewport (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`);
        continue;
      }
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        if (!inside(a.getBoundingClientRect())) { bad.push(`${id}: clipped by ${a.tagName.toLowerCase()}.${a.className.split(' ')[0]}`); break; }
      }
    }
    return bad;
  }, testIds);
}

const PAD_IDS = Array.from({ length: 64 }, (_, i) => `pad-${Math.floor(i / 8)}-${i % 8}`);

/** True when a click at the element's centre lands on the element itself. */
async function hitsItself(page: Page, testId: string): Promise<boolean> {
  return page.getByTestId(testId).evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit)) && r.right <= innerWidth && r.bottom <= innerHeight;
  });
}

test.describe('S2.1 · measured grid (P2-1)', () => {
  test('all 64 pads, the hand-zone labels and the state-bar slot are fully visible; pads are at least 32 px', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);

    expect(await clippedOf(page, [...PAD_IDS, 'zone-label-left', 'zone-label-right', 'state-bar-slot'])).toEqual([]);

    const sizes = await page.evaluate((ids) => ids.map(id => {
      const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return Math.min(r.width, r.height);
    }), PAD_IDS);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(32);
    // Integer, identical pads: the grid is measured, not CSS-scaled.
    expect(new Set(sizes).size).toBe(1);
    expect(Number.isInteger(sizes[0])).toBe(true);
  });

  test('the grid is not transformed, and a selected event does not resize it', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    const transformed = await page.getByTestId('pad-0-0').evaluate(el => {
      for (let a: HTMLElement | null = el; a; a = a.parentElement) {
        if (a.dataset.testid === 'grid-region') return null;
        const t = getComputedStyle(a).transform;
        if (t && t !== 'none') return a.className;
      }
      return null;
    });
    expect(transformed).toBeNull();

    const before = await page.getByTestId('pad-0-0').boundingBox();
    const [first] = await pf.call('events');
    await pf.call('dispatch', { type: 'SELECT_EVENT', payload: { key: first!.key, startTime: first!.startTime } });
    // The transition preview moved from the state-bar slot to the selected-event card (S3.2).
    await expect(page.getByTestId('transition-preview').first()).toContainText('Transition preview');
    expect(await page.getByTestId('pad-0-0').boundingBox()).toEqual(before);
  });
});

test.describe('S2.1 · transport reach (P2-1)', () => {
  const TRANSPORT = ['transport-play', 'transport-return', 'transport-speed', 'transport-loop', 'transport-metronome', 'transport-hits'];

  test('every transport control is inside the viewport and clickable', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    for (const id of TRANSPORT) {
      await expect(page.getByTestId(id), id).toBeVisible();
      expect(await hitsItself(page, id), `${id} receives a click at its centre`).toBe(true);
    }
    expect(await clippedOf(page, TRANSPORT)).toEqual([]);

    // And each one works.
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    await expect(page.getByTestId('transport-play')).toHaveText('Stop');
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);

    await page.getByTestId('transport-speed').selectOption('0.5');
    expect((await pf.call('state')).playbackRate).toBe(0.5);

    for (const [id, read] of [
      ['transport-loop', (s: { loopEnabled: boolean }) => s.loopEnabled],
      ['transport-metronome', (s: { rehearsalAudio: { metronome: boolean } }) => s.rehearsalAudio.metronome],
      ['transport-hits', (s: { rehearsalAudio: { hits: boolean } }) => s.rehearsalAudio.hits],
    ] as const) {
      const before = read((await pf.call('state')) as never);
      await page.getByTestId(id).click();
      expect(read((await pf.call('state')) as never), id).toBe(!before);
      await expect(page.getByTestId(id)).toHaveAttribute('aria-pressed', String(!before));
    }

    // Return goes back to the start.
    await pf.call('dispatch', { type: 'SET_CURRENT_TIME', payload: 3.5 });
    await page.getByTestId('transport-return').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBe(0);
  });

  test('controls that do not fit are in the "More" menu, and work from there', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const width = page.viewportSize()!.width;
    const inline = await page.getByTestId('timeline-import').count();
    if (width <= 1366) expect(inline, 'at 1366 + MIDI is in the menu').toBe(0);
    await expect(page.getByTestId('timeline-more')).toBeVisible();
    await page.getByTestId('timeline-more').click();
    const menu = page.getByTestId('timeline-more-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('slider', { name: 'Timeline zoom' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });
});

test.describe('S2.1 · the timeline fills its width (P2-2)', () => {
  test('after importing a 4-bar clip at 120 BPM, the ruler is as wide as its container', async ({ page, pf }) => {
    await newProject(page, pf);
    expect((await pf.call('state')).tempo).toBe(120);
    await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(FOUR_BARS);
    await expect.poll(async () => (await pf.call('status')).soundCount).toBeGreaterThan(0);

    const widths = async () => page.evaluate(() => {
      const ruler = document.querySelector('[data-testid="timeline-ruler"]')!.getBoundingClientRect().width;
      const container = document.querySelector<HTMLElement>('[data-testid="timeline-scroll"]')!.clientWidth;
      return { ruler: Math.round(ruler), container };
    });
    await expect.poll(async () => { const w = await widths(); return Math.abs(w.ruler - w.container); }).toBeLessThanOrEqual(1);
    expect((await widths()).container).toBeGreaterThan(300);
  });
});

test.describe('S2.1 · the drawer splitter', () => {
  test('dragging resizes the drawer, the grid follows, and the size is remembered', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const drawer = page.getByTestId('bottom-drawer');
    const startHeight = (await drawer.boundingBox())!.height;
    const padBefore = (await page.getByTestId('pad-0-0').boundingBox())!.width;

    const bar = (await page.getByTestId('drawer-splitter').boundingBox())!;
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2 + 60, { steps: 6 });
    await page.mouse.up();

    await expect.poll(async () => Math.round((await drawer.boundingBox())!.height)).toBeLessThan(startHeight - 40);
    const padAfter = (await page.getByTestId('pad-0-0').boundingBox())!.width;
    expect(padAfter).toBeGreaterThanOrEqual(padBefore);

    const remembered = Math.round((await drawer.boundingBox())!.height);
    await page.reload();
    await pf.ready();
    await expect.poll(async () => Math.round((await page.getByTestId('bottom-drawer').boundingBox())!.height)).toBe(remembered);
  });

  test('collapsing keeps the tab bar, so the Composer tab stays reachable (invariant 3)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByTestId('drawer-collapse').click();
    await expect(page.getByTestId('drawer-collapse')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('drawer-tab-composer')).toBeVisible();
    expect(await clippedOf(page, PAD_IDS)).toEqual([]);
    // A tab click opens the drawer again on that tab.
    await page.getByTestId('drawer-tab-composer').click();
    await expect(page.getByTestId('drawer-collapse')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('drawer-panel-composer')).toBeVisible();
  });
});

test.describe('S2.1 · short windows, narrow windows and wide panels (review on #107)', () => {
  const TRANSPORT_AND_MORE = [
    'transport-play', 'transport-return', 'transport-position', 'transport-speed',
    'transport-loop', 'transport-metronome', 'transport-hits', 'timeline-more',
  ];

  async function dragBy(page: Page, testId: string, dx: number) {
    const box = (await page.getByTestId(testId).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  test('in a short window the drawer gives way, so every pad stays fully visible', async ({ page, pf }) => {
    await page.setViewportSize({ width: 1366, height: 540 });
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    expect(await clippedOf(page, [...PAD_IDS, 'zone-label-left', 'zone-label-right'])).toEqual([]);
    // The drawer is shorter than its usual open minimum, and its tabs stay reachable (invariant 3).
    expect((await page.getByTestId('bottom-drawer').boundingBox())!.height).toBeLessThan(120);
    await expect(page.getByTestId('drawer-tab-composer')).toBeVisible();
  });

  test('widening both side panels never clips the transport or its "⋯" button', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await dragBy(page, 'left-panel-handle', 400);
    await dragBy(page, 'right-panel-handle', -400);
    expect(await clippedOf(page, TRANSPORT_AND_MORE)).toEqual([]);
    for (const id of TRANSPORT_AND_MORE) expect(await hitsItself(page, id), id).toBe(true);
    await page.getByTestId('timeline-more').click();
    await expect(page.getByTestId('timeline-more-menu')).toBeVisible();
  });

  test('in a narrow window the side panels give way to the transport', async ({ page, pf }) => {
    await page.setViewportSize({ width: 1200, height: 768 });
    await openTestMidi1(page, pf);
    expect(await clippedOf(page, TRANSPORT_AND_MORE)).toEqual([]);
    for (const id of TRANSPORT_AND_MORE) expect(await hitsItself(page, id), id).toBe(true);
  });
});
