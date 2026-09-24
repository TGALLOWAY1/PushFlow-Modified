/**
 * Composer data can't be lost (S1a.5; T60, T66, T67).
 *
 * Roadmap P1a exit criteria:
 * - P1a-11a  a Composer note toggled less than 100 ms before a tab switch survives a reload;
 * - P1a-11b  playback continues across the tab switch;
 * - P1a-11c  with the Timeline tab shown, pressing M does nothing in the Composer;
 * - P1a-12a  a Sound renamed in the Sounds panel keeps its name after a Composer edit;
 * - P1a-12b  a Composer finger edit appears in the Sounds panel and can be cleared;
 * - P1a-12c  Undo after Clear restores the notes, Sounds and pads;
 * plus the session check: the timeline re-measures when its tab is shown again.
 *
 * Project state is read through window.__pf; the Sounds panel's rename is the
 * RENAME_SOUND it dispatches.
 */

import { test, expect } from './fixtures';
import { newProject, openTestMidi1, saveAndReload, shownPads } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

const composer = (page: Page) => page.getByTestId('drawer-panel-composer');
const cell = (page: Page, lane: number, step: number) => page.getByTestId(`composer-cell-${lane}-${step}`);

async function openComposer(page: Page) {
  await page.getByTestId('drawer-tab-composer').click();
  await expect(composer(page)).toBeVisible();
}

async function composerSoundIds(pf: PfHandle): Promise<string[]> {
  return (await pf.call('state')).performanceLanes
    .filter(l => l.sourceFileId === 'workspace_pattern_source')
    .map(l => l.id);
}

/** Adds a lane in the Composer, toggles one note on it and waits for its Sound. Returns the Sound id. */
async function addLaneWithNote(page: Page, pf: PfHandle, lane: number, step: number): Promise<string> {
  await composer(page).getByTitle('Add lane').click();
  await cell(page, lane, step).click();
  await expect.poll(async () => (await composerSoundIds(pf)).length).toBe(lane + 1);
  return (await composerSoundIds(pf))[lane]!;
}

const eventCount = async (pf: PfHandle) =>
  (await pf.call('state')).soundStreams.reduce((n, s) => n + s.events.length, 0);

test.describe('S1a.5 · Composer and Timeline tabs', () => {
  test('P1a-11a: a note toggled just before a tab switch survives a reload', async ({ page, pf }) => {
    await newProject(page, pf);
    await openComposer(page);
    await composer(page).getByTitle('Add lane').click();
    // Toggle, then switch tabs straight away (well under 100 ms).
    await cell(page, 0, 0).click();
    await page.getByTestId('drawer-tab-timeline').click();
    // The switch flushes the pending sync (it lands after React's commit).
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(1);

    await saveAndReload(page, pf);
    expect(await eventCount(pf)).toBe(1);
    await openComposer(page);
    await expect(cell(page, 0, 0)).toHaveAttribute('data-on', 'true');
  });

  test('P1a-11b: playback continues across the tab switch', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(0);

    await openComposer(page);
    const t0 = (await pf.call('status')).currentTime;
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(t0 + 0.3);
    expect((await pf.call('status')).isPlaying).toBe(true);

    // The Composer's own playback carries on while the Timeline is shown, too.
    await composer(page).getByRole('button', { name: 'Play' }).click();
    await page.getByTestId('drawer-tab-timeline').click();
    const t1 = (await pf.call('status')).currentTime;
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(t1 + 0.3);
    await openComposer(page);
    await expect(composer(page).getByRole('button', { name: 'Stop' })).toBeVisible();
  });

  test('P1a-11c: with the Timeline tab shown, pressing M does nothing in the Composer', async ({ page, pf }) => {
    await newProject(page, pf);
    await openComposer(page);
    const id = await addLaneWithNote(page, pf, 0, 0);
    // Focus the lane's Mute button, then leave the Composer.
    await composer(page).getByTitle('Mute').focus();
    await page.getByTestId('drawer-tab-timeline').click();
    await expect(composer(page)).toBeHidden();

    const before = await pf.call('state');
    const history = await pf.call('history');
    // Nothing in the hidden Composer can take focus.
    const focusedInComposer = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="drawer-panel-composer"] button[title="Mute"]');
      button?.focus();
      return !!button && document.activeElement === button;
    });
    expect(focusedInComposer).toBe(false);
    for (const key of ['m', 'M', 'Enter', ' ']) await page.keyboard.press(key);

    const after = await pf.call('state');
    expect(after.soundStreams.find(s => s.id === id)?.muted).toBe(false);
    expect(after.performanceLanes).toEqual(before.performanceLanes);
    expect(await pf.call('history')).toEqual(history);
  });

  test('the timeline re-measures when shown again: its ruler fills the container', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const widths = () => page.evaluate(() => ({
      ruler: document.querySelector<HTMLElement>('[data-testid="timeline-ruler"]')!.getBoundingClientRect().width,
      container: document.querySelector<HTMLElement>('[data-testid="timeline-scroll"]')!.clientWidth,
    }));
    const start = await widths();
    expect(start.ruler).toBeCloseTo(start.container, 0);

    await openComposer(page);
    const size = page.viewportSize()!;
    // Wider, so the auto-fit width is not held up by the timeline's minimum zoom.
    await page.setViewportSize({ width: size.width + 240, height: size.height });
    await page.getByTestId('drawer-tab-timeline').click();

    await expect.poll(async () => {
      const w = await widths();
      return Math.abs(w.ruler - w.container) < 1 && w.container > start.container;
    }).toBe(true);
  });
});

test.describe('S1a.5 · Composer edits and project Sounds stay in sync', () => {
  test('P1a-12a: a Sound renamed in the Sounds panel keeps its name after a Composer edit', async ({ page, pf }) => {
    await newProject(page, pf);
    await openComposer(page);
    const id = await addLaneWithNote(page, pf, 0, 0);
    await pf.call('dispatch', { type: 'RENAME_SOUND', payload: { streamId: id, name: 'Kick' } });

    await cell(page, 0, 4).click();
    await expect.poll(() => eventCount(pf)).toBe(2);
    await page.waitForTimeout(400);

    expect((await pf.call('state')).soundStreams.find(s => s.id === id)?.name).toBe('Kick');
    await expect(composer(page).getByTitle('Kick')).toBeVisible();
  });

  test('P1a-12b: a Composer finger edit appears in the Sounds panel and can be cleared', async ({ page, pf }) => {
    await newProject(page, pf);
    await openComposer(page);
    const id = await addLaneWithNote(page, pf, 0, 0);
    const soundsPanelFinger = page.getByTitle('left index — click to edit').and(page.locator(':not([data-testid="drawer-panel-composer"] *)'));

    await composer(page).getByTitle('Click to assign finger (e.g. L1, R5)').click();
    await composer(page).locator('input[maxlength="2"]').fill('L2');
    await composer(page).locator('input[maxlength="2"]').press('Enter');

    expect((await pf.call('state')).voiceConstraints[id]).toEqual({ hand: 'left', finger: 'index' });
    await expect(soundsPanelFinger).toHaveCount(1);

    await composer(page).getByTitle('left index — click to edit').click();
    await composer(page).locator('input[maxlength="2"]').fill('');
    await composer(page).locator('input[maxlength="2"]').press('Enter');

    expect((await pf.call('state')).voiceConstraints[id]).toBeUndefined();
    await expect(soundsPanelFinger).toHaveCount(0);
  });

  test('P1a-12c: Undo after Clear restores the notes, Sounds and pads', async ({ page, pf }) => {
    await newProject(page, pf);
    await openComposer(page);
    const kick = await addLaneWithNote(page, pf, 0, 0);
    const snare = await addLaneWithNote(page, pf, 1, 4);
    const streams = (await pf.call('state')).soundStreams;
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: streams.find(s => s.id === kick)! } });
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,1', stream: streams.find(s => s.id === snare)! } });
    const pads = await shownPads(pf);

    await composer(page).getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('Composer cleared · 2 notes and 2 Sounds removed')).toBeVisible();
    expect((await pf.call('status')).soundCount).toBe(0);
    expect(await shownPads(pf)).toEqual({});

    await page.getByTestId('toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(cell(page, 0, 0)).toHaveAttribute('data-on', 'true');
    await expect(cell(page, 1, 4)).toHaveAttribute('data-on', 'true');
    expect(await composerSoundIds(pf)).toEqual([kick, snare]);
    expect(await shownPads(pf)).toEqual(pads);
  });
});
