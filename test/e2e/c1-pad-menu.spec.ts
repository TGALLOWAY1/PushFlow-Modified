/**
 * C1 · The pad context menu renders off-cursor and off-screen (T06).
 *
 * Register root cause: PadContextMenu renders inline inside the CSS-scaled,
 * backdrop-filtered grid wrapper with no portal, so its position:fixed is
 * offset, scaled and clipped (InteractiveGrid.tsx, PerformanceWorkspace.tsx).
 *
 * Runs at 1366x768, 1600x1000 and 1920x1080 (the chromium-1920 project runs this spec only).
 * All cases flip in S1b.2 (Dialog/Popover primitive).
 */

import { test, expect } from './fixtures';
import { openTestMidi1, placeSounds, visiblePadPoint, SPREAD_PADS } from './project';
import type { Page } from '@playwright/test';

const ALL_PADS = Array.from({ length: 64 }, (_, i) => `${Math.floor(i / 8)},${i % 8}`);

interface MenuGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Items whose centre hit-tests to the menu itself (not covered or clipped). */
  clickable: number;
  items: number;
}

/** Right-clicks the centre of the pad's visible part (see visiblePadPoint). */
async function openMenuAt(page: Page, padKey: string): Promise<{ x: number; y: number }> {
  const point = await visiblePadPoint(page, padKey);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.getByTestId('pad-menu')).toBeVisible();
  return point;
}

function measureMenu(page: Page): Promise<MenuGeometry> {
  return page.getByTestId('pad-menu').evaluate(menu => {
    const r = menu.getBoundingClientRect();
    const buttons = [...menu.querySelectorAll('button')];
    const clickable = buttons.filter(b => {
      const br = b.getBoundingClientRect();
      const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
      return !!hit && menu.contains(hit);
    }).length;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, clickable, items: buttons.length };
  });
}

async function closeMenu(page: Page) {
  await page.mouse.click(2, 2);
  await expect(page.getByTestId('pad-menu')).toHaveCount(0);
}

test.describe('C1 · pad context menu', () => {
  test.beforeEach(async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await placeSounds(pf, SPREAD_PADS);
  });

  test('opens at the cursor, or clamped fully inside the viewport, for all 64 pads', async ({ page }) => {
    test.setTimeout(120_000);
    const viewport = page.viewportSize()!;
    const misplaced: string[] = [];
    for (const padKey of ALL_PADS) {
      const cursor = await openMenuAt(page, padKey);
      const m = await measureMenu(page);
      // Each axis: at the cursor, or pushed back just inside the viewport edge
      // (within a 12px margin) because the menu would overflow there.
      const w = m.right - m.left;
      const h = m.bottom - m.top;
      const axisOk = (pos: number, cur: number, size: number, limit: number) =>
        Math.abs(pos - cur) <= 4 || (cur + size > limit - 12 && pos + size <= limit && pos + size >= limit - 12);
      const inside = m.left >= 0 && m.top >= 0 && m.right <= viewport.width && m.bottom <= viewport.height;
      if (!inside || !axisOk(m.left, cursor.x, w, viewport.width) || !axisOk(m.top, cursor.y, h, viewport.height)) {
        misplaced.push(`[${padKey}] cursor ${cursor.x},${cursor.y} menu ${Math.round(m.left)},${Math.round(m.top)} ${Math.round(w)}x${Math.round(h)}`);
      }
      await closeMenu(page);
    }
    expect(misplaced).toEqual([]);
  });

  test('all 12 items of an occupied pad\'s menu are clickable', async ({ page }) => {
    const results: string[] = [];
    for (const padKey of SPREAD_PADS) {
      await openMenuAt(page, padKey);
      const m = await measureMenu(page);
      results.push(`[${padKey}] ${m.clickable}/${m.items}`);
      await closeMenu(page);
    }
    expect(results).toEqual(SPREAD_PADS.map(p => `[${p}] 12/12`));
  });

  test('the first Escape closes the menu and focus returns to the pad', async ({ page }) => {
    await openMenuAt(page, '4,3');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pad-menu')).toHaveCount(0);
    await expect(page.getByTestId('pad-4-3')).toBeFocused();
  });
});
