/**
 * S4.4 · audition vs analysis (T15, T16; roadmap P4-7a–e), in the browser.
 *
 * - Mute and Solo are rehearsal-only: S lights yellow and M red, Unmute works
 *   while another Sound is soloed, and neither changes the verdict, the Score
 *   or the fingering (they change only what the transport plays).
 * - A muted pad is dragged and dropped like any other.
 * - "Exclude from analysis" does change the analysis, and the scope line says
 *   so; muted and excluded Sounds stay in the timeline.
 * - "Hands: L" silences the right hand and dims its pads, and leaves
 *   Playability unchanged.
 */

import type { Locator, Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { dragPad, openTestMidi1, shownPads, suggestStartingLayout, waitForAnalysis } from './project';

const row = (page: Page, id: string) => page.locator(`[data-testid="sound-row"][data-sound-id="${id}"]`);
const lane = (page: Page, id: string) => page.locator(`[data-testid="timeline-lane-header"][data-sound-id="${id}"]`);
const pills = (page: Page, id: string) => page.locator(`[data-testid="timeline-pill"][data-sound-id="${id}"]`);

/** What the analysis says right now: the Score tile, the verdict, the scope line and the plan's fingering. */
async function analysisNow(page: Page, pf: PfHandle) {
  return {
    score: await page.getByTestId('analysis-score').textContent(),
    verdict: await page.getByTestId('verdict-badge').first().getAttribute('data-level'),
    scope: await page.getByTestId('verdict-scope').first().textContent(),
    fingering: JSON.stringify(await pf.call('fingering')),
    planLayoutHash: (await pf.call('status')).planLayoutHash,
  };
}

/** A control's settled background: the pointer moved off it, so no hover colour is caught mid-transition. */
async function background(page: Page, locator: Locator): Promise<string> {
  await page.mouse.move(0, 0);
  let last = '';
  await expect.poll(async () => {
    const now = await locator.evaluate(el => getComputedStyle(el).backgroundColor);
    const settled = now === last;
    last = now;
    return settled;
  }).toBe(true);
  return last;
}

async function ready(page: Page, pf: PfHandle) {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
  await expect(page.getByTestId('analysis-score')).toHaveText(/^Score\d+%$/, { timeout: 30_000 });
}

test.describe('S4.4 · Mute and Solo are rehearsal-only', () => {
  test('P4-7b: Solo lights yellow and Mute red; Unmute works while another Sound is soloed; the transport plays only what is audible', async ({ page, pf }) => {
    await ready(page, pf);
    const [kick, snare, hat] = (await pf.call('state')).soundStreams.map(s => s.id);
    const allSounds = (await pf.call('transport'))!.hitSoundIds;
    expect(allSounds).toHaveLength(7);
    const { undo } = await pf.call('history');

    await row(page, hat!).getByTestId('sound-mute').click();
    await expect(row(page, hat!).getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'true');
    expect(await background(page, row(page, hat!).getByTestId('sound-mute'))).toBe('rgb(220, 38, 38)');
    await expect.poll(async () => (await pf.call('transport'))!.hitSoundIds).toEqual(allSounds.filter(id => id !== hat));

    await row(page, kick!).getByTestId('sound-solo').click();
    await expect(row(page, kick!).getByTestId('sound-solo')).toHaveAttribute('aria-pressed', 'true');
    expect(await background(page, row(page, kick!).getByTestId('sound-solo'))).toBe('rgb(250, 204, 21)');
    await expect(row(page, snare!).getByTestId('sound-silent')).toHaveAttribute('data-reason', 'not-soloed');
    await expect.poll(async () => (await pf.call('transport'))!.hitSoundIds).toEqual([kick]);

    // Unmute Hat while Kick is soloed: the mute goes; it is silent only by the solo.
    await row(page, hat!).getByTestId('sound-mute').click();
    await expect(row(page, hat!).getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'false');
    await expect(row(page, hat!).getByTestId('sound-silent')).toHaveAttribute('data-reason', 'not-soloed');
    expect((await pf.call('state')).mutedSoundIds).toEqual([]);

    // Un-solo: everything sounds again, and none of it was an undo step.
    await row(page, kick!).getByTestId('sound-solo').click();
    await expect.poll(async () => (await pf.call('transport'))!.hitSoundIds).toEqual(allSounds);
    expect((await pf.call('history')).undo).toBe(undo);
  });

  test('P4-7c: muting and soloing change no verdict, Score or fingering, and save nothing', async ({ page, pf }) => {
    await ready(page, pf);
    const [kick, snare] = (await pf.call('state')).soundStreams.map(s => s.id);
    const before = await analysisNow(page, pf);
    const { updatedAt } = await pf.call('status');

    await row(page, kick!).getByTestId('sound-mute').click();
    await row(page, snare!).getByTestId('sound-solo').click();
    // Give a re-analysis every chance to start: none does.
    await page.waitForTimeout(1500);
    const status = await pf.call('status');
    expect({ stale: status.analysisStale, processing: status.isProcessing, updatedAt: status.updatedAt })
      .toEqual({ stale: false, processing: false, updatedAt });
    expect(await analysisNow(page, pf)).toEqual(before);
  });

  test('P4-7a: a muted pad is dragged and dropped, and stays muted', async ({ page, pf }) => {
    await ready(page, pf);
    const kick = (await pf.call('state')).soundStreams[0]!.id;
    await row(page, kick).getByTestId('sound-mute').click();
    const pads = await shownPads(pf);
    const from = Object.entries(pads).find(([, id]) => id === kick)![0];
    const to = ['7,7', '7,6', '6,7', '0,7'].find(k => !pads[k])!;
    const pad = page.getByTestId(`pad-${from.replace(',', '-')}`);
    await expect(pad).toHaveAttribute('data-silent', 'muted');
    await expect(pad.getByTestId('pad-silent')).toBeVisible();
    await expect(pad).toHaveAttribute('draggable', 'true');

    await dragPad(page, from, to);
    await expect.poll(async () => (await shownPads(pf))[to]).toBe(kick);
    expect((await shownPads(pf))[from]).toBeUndefined();
    expect((await pf.call('state')).mutedSoundIds).toEqual([kick]);
    await expect(page.getByTestId(`pad-${to.replace(',', '-')}`)).toHaveAttribute('data-silent', 'muted');
  });
});

test.describe('S4.4 · Exclude from analysis', () => {
  test('P4-7c, P4-7d: excluding changes the analysis and the scope line says so; muted and excluded Sounds stay in the timeline', async ({ page, pf }) => {
    await ready(page, pf);
    const streams = (await pf.call('state')).soundStreams;
    const [kick, snare] = [streams[0]!, streams[1]!];
    const before = await analysisNow(page, pf);
    expect(before.scope).toBe('Analysing 7 of 7 Sounds');
    const { undo } = await pf.call('history');

    await row(page, kick.id).getByTestId('sound-mute').click();
    await row(page, snare.id).getByTestId('sound-menu-button').click();
    await page.getByTestId('sound-menu-exclude').click();
    await expect(row(page, snare.id).getByTestId('sound-excluded')).toHaveText('Excluded');
    // The badge leaves the name the end that tells it apart, and the row fits the 320 px panel.
    expect(await row(page, snare.id).evaluate(el => {
      const end = el.querySelector('[data-testid="sound-name"]')!.lastElementChild as HTMLElement;
      const width = end.getBoundingClientRect().width;
      return {
        nameEnd: width > 0 && end.scrollWidth <= Math.ceil(width),
        menuInside: el.querySelector('[data-testid="sound-menu-button"]')!.getBoundingClientRect().right <= el.getBoundingClientRect().right,
      };
    })).toEqual({ nameEnd: true, menuInside: true });
    await waitForAnalysis(pf);
    await expect(page.getByTestId('verdict-scope').first()).toHaveText('Analysing 6 of 7 Sounds · 1 excluded');

    const after = await analysisNow(page, pf);
    const fingering = await pf.call('fingering');
    expect(fingering!.some(n => n.voiceId === snare.id)).toBe(false);
    expect(fingering!.some(n => n.voiceId === kick.id)).toBe(true);
    expect(after.fingering).not.toBe(before.fingering);
    // The exclusion is one undo step; the mute none.
    expect((await pf.call('history')).undo).toBe(undo + 1);

    // Every Sound keeps its lane and all its notes (invariant 4).
    await expect(page.getByTestId('timeline-lane-header')).toHaveCount(7);
    for (const s of [kick, snare]) await expect(pills(page, s.id)).toHaveCount(s.events.length);
    await expect(lane(page, kick.id)).toHaveAttribute('data-silent', 'muted');
    await expect(lane(page, snare.id)).toHaveAttribute('data-excluded', 'true');
    expect(await pills(page, snare.id).evaluateAll(els => els.every(el => el.getAttribute('data-excluded') === 'true'))).toBe(true);
    // The excluded Sound stays on its pad, marked.
    const snarePad = Object.entries(await shownPads(pf)).find(([, id]) => id === snare.id)![0];
    await expect(page.getByTestId(`pad-${snarePad.replace(',', '-')}`).getByTestId('pad-excluded')).toBeVisible();

    // Undo brings the analysis back to where it was.
    await page.keyboard.press('Control+z');
    await waitForAnalysis(pf);
    await expect(page.getByTestId('verdict-scope').first()).toHaveText('Analysing 7 of 7 Sounds');
    await expect.poll(async () => (await analysisNow(page, pf)).fingering).toBe(before.fingering);
  });
});

test.describe('S4.4 · Hands: Both / L / R', () => {
  test('P4-7e: "Hands: L" silences the right hand and dims its pads, and leaves Playability unchanged', async ({ page, pf }) => {
    await ready(page, pf);
    const before = await analysisNow(page, pf);
    const allHits = (await pf.call('transport'))!.hitCount;
    const rightNotes = (await pf.call('fingering'))!.filter(n => n.finger.startsWith('R')).length;
    expect(rightNotes).toBeGreaterThan(0);

    await page.getByTestId('transport-mix').click();
    await page.getByTestId('transport-mix-menu').getByText('Left', { exact: true }).click();
    await expect(page.getByTestId('transport-mix')).toHaveText('L');
    await expect.poll(async () => (await pf.call('transport'))!.hitCount).toBe(allHits - rightNotes);
    await expect(page.locator('[data-testid^="pad-"][data-hand-filtered="true"]').first()).toBeVisible();

    await page.waitForTimeout(1000);
    expect((await pf.call('status')).analysisStale).toBe(false);
    expect(await analysisNow(page, pf)).toEqual(before);

    await page.getByTestId('transport-mix-menu').getByText('Both', { exact: true }).click();
    await expect.poll(async () => (await pf.call('transport'))!.hitCount).toBe(allHits);
    await expect(page.locator('[data-hand-filtered="true"]')).toHaveCount(0);
  });

  test('P4-11b in the browser: Alt-click a pad auditions it through the transport and changes nothing', async ({ page, pf }) => {
    await ready(page, pf);
    const pads = await shownPads(pf);
    const [key] = Object.keys(pads);
    const before = await pf.call('status');
    await page.getByTestId(`pad-${key!.replace(',', '-')}`).click({ modifiers: ['Alt'] });
    await expect.poll(async () => (await pf.call('transport'))!.auditions).toBe(1);
    const after = await pf.call('status');
    expect({ pad: after.selectedPadKey, updatedAt: after.updatedAt }).toEqual({ pad: null, updatedAt: before.updatedAt });
    expect(await shownPads(pf)).toEqual(pads);
  });
});
