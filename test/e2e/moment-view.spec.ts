/**
 * S4.2 · the rebuilt moment view (T09).
 *
 * P4-2: the three views (Now, Now + Next, Prev · Now · Next) draw different
 * pixels, and next and previous strikes keep their Sound's colour and name.
 * P4-3a: with an event selected, Play shows full-intensity pad flashes and
 * the next-finger preview (the playhead drives the same view).
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis, selectMoment, gridClip } from './project';
import type { Page } from '@playwright/test';

/** The first event with a chord whose previous and next events strike other pads. */
async function layeredEvent(pf: Parameters<typeof waitForAnalysis>[0]): Promise<number> {
  const fingering = (await pf.call('fingering'))!;
  const events = await pf.call('events');
  const padsOf = (i: number) => new Set(fingering.filter(n => n.pad && events[i]!.noteKeys.includes(n.eventKey!)).map(n => n.pad!));
  for (let i = 1; i < events.length - 1; i++) {
    const now = padsOf(i), next = padsOf(i + 1), prev = padsOf(i - 1);
    if (now.size >= 2 && [...next].some(p => !now.has(p)) && [...prev].some(p => !now.has(p) && !next.has(p))) return i;
  }
  throw new Error('no event with a chord between two others');
}

/** Each pad drawn in the layer: its label, and whether its background is its Sound's colour. */
function layerPads(page: Page, attr: 'next' | 'prev' | 'struck') {
  return page.evaluate((a) => {
    const state = window.__pf!.state();
    const layout = state.workingLayout ?? state.activeLayout;
    const rgb = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const hexRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return [...document.querySelectorAll<HTMLElement>(`[data-${a}="true"]`)].map(el => {
      const key = el.dataset.testid!.replace('pad-', '').replace('-', ',');
      const voice = layout.padToVoice[key]!;
      const sound = state.soundStreams.find(s => s.id === voice.id)!;
      const bg = rgb(getComputedStyle(el).backgroundColor);
      const want = hexRgb(sound.color);
      return {
        key,
        label: el.querySelector('[data-testid="pad-label"]')?.textContent ?? '',
        soundName: sound.name,
        ownColour: bg.every((v, i) => Math.abs(v - want[i]!) <= 2),
      };
    });
  }, attr);
}

test.describe('S4.2 · the moment view (T09)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
  });

  test('P4-2: the three views draw different pixels; next and previous strikes keep their Sound’s colour and name', async ({ page, pf }) => {
    const index = await layeredEvent(pf);
    await selectMoment(page, index);
    const clip = await gridClip(page);
    const shots: Record<string, Buffer> = {};
    for (const view of ['now', 'now-next', 'prev-now-next'] as const) {
      await page.getByTestId(`moment-view-${view}`).click();
      await expect(page.getByTestId(`moment-view-${view}`)).toHaveAttribute('aria-pressed', 'true');
      await page.mouse.move(0, 0);
      shots[view] = await page.screenshot({ clip, animations: 'disabled' });
    }
    expect(shots.now!.equals(shots['now-next']!), 'Now and Now + Next draw the same pixels').toBe(false);
    expect(shots['now-next']!.equals(shots['prev-now-next']!), 'Now + Next and Prev · Now · Next draw the same pixels').toBe(false);
    expect(shots.now!.equals(shots['prev-now-next']!), 'Now and Prev · Now · Next draw the same pixels').toBe(false);

    // In Prev · Now · Next, every struck, next and previous pad shows its Sound's name and colour.
    for (const layer of ['struck', 'next', 'prev'] as const) {
      const pads = await layerPads(page, layer);
      expect(pads.length, `${layer} pads`).toBeGreaterThan(0);
      for (const pad of pads) {
        expect(pad.soundName.endsWith(pad.label.replace('…', '')) || pad.soundName.includes(pad.label), `${layer} ${pad.key} reads its Sound (${pad.label} for ${pad.soundName})`).toBe(true);
        expect(pad.ownColour, `${layer} ${pad.key} is in its Sound's colour`).toBe(true);
      }
    }
    await expect(page.locator('[data-next="true"] [data-testid="moment-tag"]').first()).toHaveText('+1');
    await expect(page.locator('[data-prev="true"] [data-testid="moment-tag"]').first()).toHaveText('−1');
  });

  test('P4-3a: with an event selected, Play shows full-intensity flashes and the next-finger preview', async ({ page, pf }) => {
    await selectMoment(page, await layeredEvent(pf));
    await page.getByTestId('moment-view-now-next').click();
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    // Sample every frame for 2 s: flashes, dimming and the next finger shown.
    const seen = await page.evaluate(() => new Promise<{ frames: number; dimmed: number; flashes: number; nextFingers: number; bigFingers: number }>(resolve => {
      const out = { frames: 0, dimmed: 0, flashes: 0, nextFingers: 0, bigFingers: 0 };
      const end = performance.now() + 2000;
      const tick = () => {
        out.frames++;
        const pads = [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')].filter(el => /^pad-\d-\d$/.test(el.dataset.testid ?? ''));
        if (pads.some(el => parseFloat(getComputedStyle(el).opacity) < 0.5 && !/empty/.test(el.title))) out.dimmed++;
        if (pads.some(el => /brightness\(2\)/.test(getComputedStyle(el).filter) || el.className.includes('brightness-200'))) out.flashes++;
        const next = document.querySelectorAll<HTMLElement>('[data-next="true"] [data-testid="moment-finger"][data-layer="next"]');
        if (next.length > 0) out.nextFingers++;
        if ([...document.querySelectorAll<HTMLElement>('[data-testid="moment-finger"]')].some(b => b.style.fontSize === '16px')) out.bigFingers++;
        if (performance.now() < end) requestAnimationFrame(tick); else resolve(out);
      };
      requestAnimationFrame(tick);
    }));
    await page.getByTestId('transport-play').click();
    expect(seen.frames).toBeGreaterThan(30);
    expect({ dimmedFrames: seen.dimmed }).toEqual({ dimmedFrames: 0 });
    expect(seen.flashes, 'frames with a pad flashing').toBeGreaterThan(0);
    expect(seen.nextFingers / seen.frames, 'share of frames showing the next finger').toBeGreaterThan(0.8);
    expect(seen.bigFingers / seen.frames, 'share of frames with 16 px fingers').toBeGreaterThan(0.8);
    // Stop brings the selected event back (S1b.4).
    await expect.poll(async () => (await page.locator('[data-struck="true"]').count())).toBeGreaterThan(0);
  });
});
