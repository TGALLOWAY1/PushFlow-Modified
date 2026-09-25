/**
 * C9 · Dropping a Composer preset on the grid does nothing (T65).
 *
 * Register root cause: handleDragOver sets dropEffect 'move' while preset cards
 * allow only 'copy', so drop never fires (InteractiveGrid.tsx, PresetCard.tsx);
 * the drop handler is also stale. Save Preset invents column/index fingering.
 *
 * Every drop uses a real native drag (Playwright dragTo), never a synthetic event.
 * Flips: the refuse-first cases in S1b.4 (preset safety); the "Add to timeline"
 * case in S8.2, which also adds the mapping-step cases.
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import { newProject, openTestMidi1, shownPads } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

const PRESET = 'C9 Preset';
const PRESETS_KEY = 'pushflow_composer_presets';

/**
 * In the current project: two Composer lanes with notes, their Sounds placed on
 * [0,0] and [0,1], then Save Preset. The pads are cleared again afterwards so
 * the grid starts empty. Returns the two Sound ids (lane 1, lane 2).
 */
async function buildPreset(page: Page, pf: PfHandle): Promise<[string, string]> {
  page.on('dialog', d => d.accept(PRESET));
  await page.getByTestId('drawer-tab-composer').click();
  await page.getByTitle('Add lane').click();
  await page.getByTitle('Add lane').click();
  const cells = page.locator('div.relative.cursor-pointer[style*="height: 32px"]');
  const perLane = (await cells.count()) / 2;
  for (const step of [0, 8]) await cells.nth(step).click();
  for (const step of [4, 12]) await cells.nth(perLane + step).click();
  await expect.poll(async () => (await pf.call('status')).soundCount).toBe(2);
  const [a, b] = (await pf.call('state')).soundStreams;
  await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: a } });
  await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,1', stream: b } });
  await page.getByRole('button', { name: 'Save Preset' }).click();
  await expect.poll(() => page.evaluate(k => localStorage.getItem(k) ?? '', PRESETS_KEY)).toContain(PRESET);
  await pf.call('dispatch', { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: '0,0' } });
  await pf.call('dispatch', { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: '0,1' } });
  expect(await shownPads(pf)).toEqual({});
  return [a.id, b.id];
}

async function openPresets(page: Page) {
  await page.locator('button.pf-tab', { hasText: 'Presets' }).first().click();
}

const presetCard = (page: Page) => page.locator('div[draggable="true"]', { hasText: PRESET }).first();

async function dropPresetOn(page: Page, padKey: string) {
  await presetCard(page).dragTo(page.getByTestId(`pad-${padKey.replace(',', '-')}`));
}

test.describe('C9 · Composer presets on the grid', () => {
  test('dropping a preset on empty pads places its Sounds', async ({ page, pf }) => {
    await newProject(page, pf);
    const [a, b] = await buildPreset(page, pf);
    await openPresets(page);
    await dropPresetOn(page, '4,4');
    const pads = await shownPads(pf);
    expect(Object.values(pads).sort()).toEqual([a, b].sort());
  });

  test('a drop overlapping an occupied pad is refused with a reason', async ({ page, pf }) => {
    await newProject(page, pf);
    const [a] = await buildPreset(page, pf);
    const stream = (await pf.call('state')).soundStreams.find(s => s.id === a)!;
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '4,5', stream } });
    const before = await shownPads(pf);
    await openPresets(page);
    await dropPresetOn(page, '4,4');
    expect(await shownPads(pf)).toEqual(before);
    await expect(page.getByText(/occupied|already (has|in use)|can.t drop|refused/i).first()).toBeVisible();
  });

  test('a Mirror toggle set before dragging is honoured', async ({ page, pf }) => {
    await newProject(page, pf);
    const [a, b] = await buildPreset(page, pf);
    await openPresets(page);
    await dropPresetOn(page, '4,4');
    const plain = await shownPads(pf);
    expect(Object.values(plain).sort()).toEqual([a, b].sort());
    for (const key of Object.keys(plain)) {
      await pf.call('dispatch', { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: key } });
    }
    await presetCard(page).getByTitle('Mirror (flip hand)').click();
    await dropPresetOn(page, '4,4');
    const mirrored = await shownPads(pf);
    expect(Object.values(mirrored).sort()).toEqual([a, b].sort());
    expect(mirrored).not.toEqual(plain);
  });

  test('a preset whose Sounds are not in this project is refused and places nothing', async ({ page, pf }) => {
    await newProject(page, pf);
    await buildPreset(page, pf);
    // A different project: TEST MIDI 1's Sounds, none of them the preset's lanes.
    await openTestMidi1(page, pf);
    const soundIds = new Set((await pf.call('state')).soundStreams.map(s => s.id));
    await openPresets(page);
    await dropPresetOn(page, '4,4');
    const placed = Object.values(await shownPads(pf));
    expect(placed.filter(id => !soundIds.has(id))).toEqual([]);
    await expect(page.getByText("This preset's Sounds aren't in this project")).toBeVisible();
  });

  test('Save Preset leaves fingers blank instead of inventing them', async ({ page, pf }) => {
    await newProject(page, pf);
    await buildPreset(page, pf);
    const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '[]'), PRESETS_KEY) as
      Array<{ name: string; pads: Array<{ finger?: string | null; hand?: string | null }> }>;
    const pads = stored.find(p => p.name === PRESET)!.pads;
    expect(pads.map(p => ({ finger: p.finger ?? null, hand: p.hand ?? null })))
      .toEqual(pads.map(() => ({ finger: null, hand: null })));
  });

  test('"Add to timeline at bar…" inserts the preset\'s notes into this project\'s timeline', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C9: presets cannot be inserted into the timeline yet (flips in S8.2, which adds the mapping steps)');
    await newProject(page, pf);
    await buildPreset(page, pf);
    await openTestMidi1(page, pf);
    const before = await pf.call('state');
    await openPresets(page);
    const addToTimeline = presetCard(page).getByRole('button', { name: /Add to timeline/ });
    await expect(addToTimeline).toBeVisible();
    await addToTimeline.click();
    const after = await pf.call('state');
    const eventCount = (s: typeof before) => s.soundStreams.reduce((n, st) => n + st.events.length, 0);
    expect(eventCount(after)).toBeGreaterThan(eventCount(before));
  });
});
