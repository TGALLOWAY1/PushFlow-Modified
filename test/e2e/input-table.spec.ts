/**
 * S2.4 · one input table (T61, T62, T69).
 *
 * Roadmap P2 exit criteria:
 * - P2-10  Space toggles playback while a button has focus; ArrowDown on a
 *          focused select changes the select, not the event (the per-row
 *          registry tests are in test/ui/input/inputTable.test.tsx);
 * - P2-11  all 7 Sounds can be placed with click-to-place alone;
 * - P2-13  the Composer's bar-8 line aligns with its cells within 1 px, and
 *          enabling Save Preset doesn't move the grid.
 */

import { test, expect } from './fixtures';
import { newProject, openTestMidi1, shownPads, suggestStartingLayout, waitForAnalysis } from './project';
import type { Page } from '@playwright/test';

const pad = (page: Page, key: string) => page.getByTestId(`pad-${key.replace(',', '-')}`);
const soundRow = (page: Page, i: number) => page.getByTestId('sound-row').nth(i);

test.describe('S2.4 · keys (P2-10)', () => {
  test('Space plays and stops while a button has focus, without pressing the button', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const loop = page.getByTestId('transport-loop');
    await loop.focus();
    const loopBefore = (await pf.call('status')).loopEnabled;

    await page.keyboard.press('Space');
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(true);
    await expect(loop).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(async () => (await pf.call('status')).isPlaying).toBe(false);
    // The focused Loop button was never pressed.
    expect((await pf.call('status')).loopEnabled).toBe(loopBefore);
  });

  test('Space in a text field types a space and doesn\'t play', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByTestId('sound-name').first().dblclick();
    const field = page.getByTestId('sound-rename-input');
    await field.fill('My');
    await field.press('Space');
    await expect(field).toHaveValue('My ');
    expect((await pf.call('status')).isPlaying).toBe(false);
    await field.press('Escape');
  });

  test('ArrowDown on a focused select changes the select, not the event', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await page.mouse.click(2, 300);
    await page.keyboard.press('ArrowRight');
    const selected = (await pf.call('status')).selectedEventIndex;
    expect(selected).not.toBeNull();

    const speed = page.getByTestId('transport-speed');
    const rateBefore = (await pf.call('status')).playbackRate;
    await speed.focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await pf.call('status')).playbackRate).not.toBe(rateBefore);
    // Neither ↓ nor → on the select moves the event.
    await page.keyboard.press('ArrowRight');
    expect((await pf.call('status')).selectedEventIndex).toBe(selected);
  });

  test('"?" opens the sheet generated from the table; Escape closes it', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.mouse.click(2, 300);
    await page.keyboard.press('Shift+Slash');
    const sheet = page.getByTestId('shortcut-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Keyboard and mouse' })).toBeVisible();
    await expect(sheet.locator('[data-row-id="space"]')).toContainText('Plays or stops');
    await expect(sheet.locator('[data-row-id="pad-click-armed"]')).toContainText('Pad taken · drag to swap');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // The gear menu opens it too.
    await page.getByRole('button', { name: 'View settings' }).click();
    await page.getByTestId('open-shortcuts').click();
    await expect(sheet).toBeVisible();
  });
});

test.describe('S2.4 · click-to-place (P2-11)', () => {
  test('all 7 Sounds placed by clicking a Sound and then a pad, one undo step each', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const ids = (await pf.call('state')).soundStreams.map(s => s.id);
    const pads = ['0,0', '0,1', '1,0', '1,1', '0,5', '0,6', '1,6'];
    const undoBefore = (await pf.call('history')).undo;

    for (let i = 0; i < 7; i++) {
      await soundRow(page, i).click({ position: { x: 60, y: 12 } });
      await expect.poll(async () => (await pf.call('status')).armedStreamId).toBe(ids[i]);
      await pad(page, pads[i]!).click();
    }

    const placed = await shownPads(pf);
    expect(Object.fromEntries(pads.map((k, i) => [k, ids[i]]))).toEqual(placed);
    expect((await pf.call('history')).undo).toBe(undoBefore + 7);
    // Everything is placed, so nothing is left armed.
    expect((await pf.call('status')).armedStreamId).toBeNull();
    await expect(page.getByTestId('grid-armed-hint')).toHaveCount(0);
  });

  test('with the auto-advance, one Sound click and seven pad clicks place them all', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const ids = (await pf.call('state')).soundStreams.map(s => s.id);
    await soundRow(page, 0).click({ position: { x: 60, y: 12 } });
    await expect(page.getByTestId('grid-armed-hint')).toContainText('click an empty pad to place it');
    // An occupied pad says so and takes nothing.
    await pad(page, '3,3').click();
    await pad(page, '3,3').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Pad taken · drag to swap' })).toBeVisible();
    for (const key of ['3,4', '3,5', '4,3', '4,4', '4,5', '2,4']) await pad(page, key).click();

    const placed = await shownPads(pf);
    expect(Object.keys(placed)).toHaveLength(7);
    expect(new Set(Object.values(placed))).toEqual(new Set(ids));
    expect(placed['3,3']).toBe(ids[0]);
    // Undo takes back the last placement only.
    await pf.call('undo');
    expect(Object.keys(await shownPads(pf))).toHaveLength(6);
  });

  test('Escape stops placing; a click then selects the pad, and Delete takes its Sound off with Undo', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await soundRow(page, 0).click({ position: { x: 60, y: 12 } });
    await pad(page, '2,2').click();
    await page.keyboard.press('Escape');
    expect((await pf.call('status')).armedStreamId).toBeNull();

    await pad(page, '2,2').click();
    expect((await pf.call('status')).selectedPadKey).toBe('2,2');
    await expect(pad(page, '2,2')).toHaveAttribute('data-selected', 'true');
    await page.keyboard.press('Delete');
    expect((await shownPads(pf))['2,2']).toBeUndefined();
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    expect((await shownPads(pf))['2,2']).toBeDefined();
  });
});

test.describe('S2.4 · Composer geometry (P2-13)', () => {
  async function composerWithLane(page: Page) {
    await page.getByTestId('drawer-tab-composer').click();
    const composer = page.getByTestId('drawer-panel-composer');
    await expect(composer).toBeVisible();
    await composer.getByTitle('Add lane').click();
    return composer;
  }

  for (const bars of [8, 16] as const) {
    test(`with ${bars} bars, bar 8's header, line and first cell line up within 1 px`, async ({ page, pf }) => {
      await newProject(page, pf);
      const composer = await composerWithLane(page);
      await composer.getByRole('button', { name: String(bars), exact: true }).click();
      const stepsPerBar = 8; // the default 1/8 grid
      const firstStep = 7 * stepsPerBar;

      const header = (await page.getByTestId('composer-bar-8').boundingBox())!;
      const line = (await page.getByTestId('composer-bar-line-8').boundingBox())!;
      const cell = (await page.getByTestId(`composer-cell-0-${firstStep}`).boundingBox())!;
      const previous = (await page.getByTestId(`composer-cell-0-${firstStep - 1}`).boundingBox())!;
      expect(Math.abs(line.x - cell.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(header.x - cell.x)).toBeLessThanOrEqual(1);
      // Cells are whole, readable and unshrunk: at least 16 px, edge to edge.
      expect(cell.width).toBeGreaterThanOrEqual(16);
      expect(Math.abs(previous.x + previous.width - cell.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(header.width - stepsPerBar * cell.width)).toBeLessThanOrEqual(1);
    });
  }

  test('the first note enables Save Preset without moving the grid, and the toolbar is one row', async ({ page, pf }) => {
    await newProject(page, pf);
    const composer = await composerWithLane(page);
    const savePreset = composer.getByRole('button', { name: 'Save Preset' });
    await expect(savePreset).toBeDisabled();
    const toolbar = page.getByTestId('composer-toolbar');
    // Bring the lane into view first, and click where the cell is, so the only
    // thing that could move the grid is the app itself (Playwright's own
    // scroll-into-view would otherwise nudge the drawer).
    await page.getByTestId('composer-cell-0-9').scrollIntoViewIfNeeded();
    const toolbarBefore = (await toolbar.boundingBox())!;
    const cellBefore = (await page.getByTestId('composer-cell-0-9').boundingBox())!;
    const first = (await page.getByTestId('composer-cell-0-0').boundingBox())!;

    await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
    await expect(page.getByTestId('composer-cell-0-0')).toHaveAttribute('data-on', 'true');
    await expect(savePreset).toBeEnabled();
    // The note has become a Sound in the project (the sync has landed).
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(1);
    expect(await page.getByTestId('composer-cell-0-9').boundingBox()).toEqual(cellBefore);
    expect(await toolbar.boundingBox()).toEqual(toolbarBefore);
    // One row: every control sits on the same line.
    const tops = await toolbar.locator(':scope > *').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  });

  test('a first note on each new lane adds a Sound without moving the Composer', async ({ page, pf }) => {
    await newProject(page, pf);
    const composer = await composerWithLane(page);
    const toolbar = page.getByTestId('composer-toolbar');
    const before = (await toolbar.boundingBox())!;
    for (let lane = 0; lane < 3; lane++) {
      if (lane > 0) await composer.getByTitle('Add lane').click();
      const cell = (await page.getByTestId(`composer-cell-${lane}-2`).boundingBox())!;
      await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2);
      await expect.poll(async () => (await pf.call('status')).soundCount).toBe(lane + 1);
      // The drawer no longer re-fits to the Sound count here, which moved
      // everything up one lane under the pointer.
      expect(await toolbar.boundingBox()).toEqual(before);
    }
  });
});
