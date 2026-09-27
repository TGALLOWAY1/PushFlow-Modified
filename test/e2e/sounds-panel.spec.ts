/**
 * S5.1 · one soft finger-preference control, a real Sounds panel, drag
 * feedback (T19, T45, T46).
 *
 * Roadmap P5 exit criteria:
 * - P5-1  a finger preference set in any panel appears in the others within
 *         one render (the round trips through the reducer and the export
 *         file are in test/ui/state/voiceIdentityWorkflow.test.ts; the
 *         Composer in test/ui/components/fingerPreference.test.tsx);
 * - P5-2  with no preference, the solver's suggestion at reduced opacity,
 *         never "(L2)";
 * - P5-3  with groups, the other Sounds under "Ungrouped", "On grid" never a
 *         section label, and the "To place" and "On grid" counts match the
 *         grid.
 * Plus the drags: the hint and ghost while dragging, the eviction toast with
 * Undo, a pad dropped on the Sounds panel, and reordering by the handle.
 * Every drag is a real native one.
 */

import { test, expect } from './fixtures';
import { openTestMidi1, selectMoment, shownPads, suggestStartingLayout, visiblePadPoint, waitForAnalysis } from './project';
import type { Locator, Page } from '@playwright/test';

const rows = (page: Page) => page.getByTestId('sound-row');
const rowOf = (page: Page, id: string) => page.locator(`[data-testid="sound-row"][data-sound-id="${id}"]`);
const count = async (page: Page, filter: string) => Number(await page.getByTestId(`sounds-filter-${filter}`).getAttribute('data-count'));
/** The Sounds on the grid, as the pads show them. */
const padsWithSounds = (page: Page) => page.locator('[data-testid^="pad-"][aria-label]:not([aria-label$=", empty"])');

async function suggested(page: Page, pf: Parameters<typeof openTestMidi1>[1]) {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
}

/** A real drag from a point in `from` to the centre of `to`. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, during?: () => Promise<void>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 });
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  await during?.();
  await page.mouse.up();
}

/** A point on the row's hit count: plain text, clear of its name, handle and buttons. */
async function rowGrip(row: Locator) {
  const box = (await row.getByTestId('sound-hits').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('S5.1 · the Sounds panel (P5-3)', () => {
  test('the To place and On grid counts match the grid; with a group, "Ungrouped", never "On grid"', async ({ page, pf }) => {
    await suggested(page, pf);
    // Take two Sounds off the grid from their rows' menus.
    for (const i of [0, 1]) {
      await rows(page).nth(i).getByTestId('sound-menu-button').click();
      await page.getByTestId('sound-menu-unplace').click();
    }
    await expect(padsWithSounds(page)).toHaveCount(5);
    const onGrid = await padsWithSounds(page).count();
    expect(await count(page, 'on-grid')).toBe(onGrid);
    expect(await count(page, 'to-place')).toBe(7 - onGrid);
    expect(await count(page, 'all')).toBe(7);
    await expect(page.getByTestId('sounds-progress')).toHaveAttribute('aria-valuetext', '5 of 7 on the grid');
    // Each filter shows exactly its Sounds.
    await page.getByTestId('sounds-filter-to-place').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByTestId('sound-to-place')).toHaveCount(2);
    await page.getByTestId('sounds-filter-on-grid').click();
    await expect(rows(page)).toHaveCount(5);
    await page.getByTestId('sounds-filter-all').click();

    // No groups: no section labels at all.
    await expect(page.getByTestId('sounds-section-label')).toHaveCount(0);
    // Group two placed Sounds: the other five, placed or not, sit under "Ungrouped".
    await rows(page).nth(3).getByTestId('sound-hits').click({ modifiers: ['Control'] });
    await rows(page).nth(4).getByTestId('sound-hits').click({ modifiers: ['Control'] });
    await page.keyboard.press('Control+g');
    await expect(page.getByTestId('sounds-section-label')).toHaveText(['Group 1', 'Ungrouped']);
    const ungrouped = page.getByTestId('sounds-section').nth(1);
    await expect(ungrouped.getByTestId('sound-row')).toHaveCount(5);
    await expect(ungrouped.getByTestId('sound-to-place')).toHaveCount(2);
    for (const label of await page.getByTestId('sounds-section-label').allTextContents()) {
      expect(label).not.toMatch(/on grid|to place|unassigned/i);
    }
    // The timeline lists the group first, as the panel does.
    const panelOrder = await rows(page).evaluateAll(els => els.map(el => (el as HTMLElement).dataset.soundId));
    const laneOrder = await page.getByTestId('timeline-lane-header').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.soundId));
    expect(laneOrder).toEqual(panelOrder);
    // The counts still match the grid.
    expect(await count(page, 'on-grid')).toBe(await padsWithSounds(page).count());
  });

  test('search narrows the list; a short label shows on the Sound\'s pad', async ({ page, pf }) => {
    await suggested(page, pf);
    await page.getByTestId('sounds-search').fill('midi 1 c');
    await expect(rows(page)).toHaveCount(1);
    await page.getByTestId('sounds-search').fill('');
    const id = (await rows(page).nth(2).getAttribute('data-sound-id'))!;
    const pad = Object.entries(await shownPads(pf)).find(([, v]) => v === id)![0];
    await rows(page).nth(2).getByTestId('sound-menu-button').click();
    await page.getByTestId('sound-short-label-input').fill('Clap');
    await page.getByTestId('sound-short-label-save').click();
    await expect(page.getByTestId(`pad-${pad.replace(',', '-')}`).getByTestId('pad-label')).toHaveText('Clap');
  });
});

test.describe('S5.1 · one "Hand & finger preference (soft)" control (P5-1, P5-2)', () => {
  test('P5-2: with no preference, every Sounds row shows the plan\'s finger faintly, and "(L2)" appears nowhere', async ({ page, pf }) => {
    await suggested(page, pf);
    const chips = page.getByTestId('sound-finger');
    await expect(chips).toHaveCount(7);
    for (const chip of await chips.all()) {
      await expect(chip).toHaveAttribute('data-preference', '');
      await expect(chip).toHaveText(/^([LR][1-5](\/[LR][1-5])?|mixed)$/);
      expect(await chip.evaluate(el => getComputedStyle(el).opacity)).toBe('0.5');
    }
    await chips.first().click();
    await expect(page.getByTestId('finger-preference-popover')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/\([LR][1-5]\)/);
  });

  test('P5-1: a preference set in the Sounds row shows in the pad inspector and the selected event at once, and back', async ({ page, pf }) => {
    await suggested(page, pf);
    const id = (await rows(page).first().getAttribute('data-sound-id'))!;
    const pad = Object.entries(await shownPads(pf)).find(([, v]) => v === id)![0];
    // An event the Sound plays in (read now: the plan is re-analysed after each change below).
    const note = (await pf.call('fingering'))!.find(n => n.voiceId === id && n.eventKey)!;
    const event = (await pf.call('events')).find(e => e.noteKeys.includes(note.eventKey!))!;
    // The pad inspector and the Sounds row show the same Sound.
    await page.getByTestId(`pad-${pad.replace(',', '-')}`).click();
    const inspector = page.getByTestId('pad-inspector-finger');
    const row = rowOf(page, id).getByTestId('sound-finger');

    await row.click();
    await page.getByTestId('finger-hand-right').click();
    await page.getByTestId('finger-finger-4').click();
    await expect(row).toHaveAttribute('data-preference', 'R4');
    await expect(inspector).toHaveAttribute('data-preference', 'R4');
    await page.keyboard.press('Escape');

    // From the pad inspector back to the row, typed.
    await inspector.click();
    await page.getByTestId('finger-input').fill('L1');
    await page.getByTestId('finger-input').press('Enter');
    await expect(row).toHaveAttribute('data-preference', 'L1');
    await expect(inspector).toHaveAttribute('data-preference', 'L1');
    expect((await pf.call('state')).voiceConstraints[id]).toEqual({ hand: 'left', finger: 'thumb' });

    // The selected event's strike shows it, and its Auto (solver) clears it in the row too.
    await selectMoment(page, event.index);
    const strike = page.locator(`[data-testid="moment-strike"][data-sound-id="${id}"]`).getByTestId('moment-strike-finger');
    await expect(strike).toHaveAttribute('data-preference', 'L1');
    await strike.click();
    await page.getByTestId('finger-auto').click();
    await expect(strike).toHaveAttribute('data-preference', '');
    await page.locator('button.pf-tab', { hasText: 'Sounds' }).first().click();
    await expect(row).toHaveAttribute('data-preference', '');
    expect((await pf.call('state')).voiceConstraints[id]).toBeUndefined();
  });
});

test.describe('S5.1 · drag feedback (T46)', () => {
  test('dragging a Sound onto a taken pad says "Replace: … goes back to To place", and the toast undoes it', async ({ page, pf }) => {
    await suggested(page, pf);
    const pads = await shownPads(pf);
    const [targetPad, occupant] = Object.entries(pads)[0]!;
    const occupantName = (await rowOf(page, occupant).getByTestId('sound-name').textContent())!;
    const source = rows(page).nth(4);
    const incoming = (await source.getAttribute('data-sound-id'))!;
    await drag(page, await rowGrip(source), await visiblePadPoint(page, targetPad), async () => {
      await expect(page.getByTestId('drag-hint')).toHaveText(`Replace: ${occupantName} goes back to To place`);
      await expect(page.getByTestId('pad-drag-ghost')).toBeVisible();
    });
    await expect(page.getByTestId('drag-hint')).toHaveCount(0);
    expect((await shownPads(pf))[targetPad]).toBe(incoming);
    await expect(rowOf(page, occupant).getByTestId('sound-to-place')).toBeVisible();
    const toast = page.getByRole('status').filter({ hasText: `${occupantName} went back to To place` });
    await toast.getByRole('button', { name: 'Undo' }).click();
    expect((await shownPads(pf))[targetPad]).toBe(occupant);
  });

  test('a pad onto another says "Swap with …"; a pad dropped on the Sounds panel is unplaced, with Undo', async ({ page, pf }) => {
    await suggested(page, pf);
    const pads = await shownPads(pf);
    const [[a, va], [b, vb]] = Object.entries(pads);
    const nameB = (await rowOf(page, vb!).getByTestId('sound-name').textContent())!;
    await drag(page, await visiblePadPoint(page, a!), await visiblePadPoint(page, b!), async () => {
      await expect(page.getByTestId('drag-hint')).toHaveText(`Swap with ${nameB}`);
    });
    expect((await shownPads(pf))[b!]).toBe(va);

    const panel = (await page.getByTestId('sounds-list').boundingBox())!;
    await drag(page, await visiblePadPoint(page, b!), { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 }, async () => {
      await expect(page.getByTestId('sounds-drop-zone')).toBeVisible();
    });
    expect((await shownPads(pf))[b!]).toBeUndefined();
    await expect(rowOf(page, va!).getByTestId('sound-to-place')).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).last().click();
    expect((await shownPads(pf))[b!]).toBe(va);
  });

  test('only a row\'s handle reorders the Sounds, and the timeline follows', async ({ page, pf }) => {
    await suggested(page, pf);
    const order = () => rows(page).evaluateAll(els => els.map(el => (el as HTMLElement).dataset.soundId));
    const before = await order();
    const handle = rows(page).nth(5).getByTestId('sound-reorder-handle');
    await rows(page).nth(5).hover();
    const from = (await handle.boundingBox())!;
    const target = (await rows(page).nth(0).boundingBox())!;
    await drag(page, { x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: target.x + 40, y: target.y + 4 });
    const after = await order();
    expect(after).toEqual([before[5], ...before.filter(id => id !== before[5])]);
    const lanes = await page.getByTestId('timeline-lane-header').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.soundId));
    expect(lanes).toEqual(after);
  });
});
