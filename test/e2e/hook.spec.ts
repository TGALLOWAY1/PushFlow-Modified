/**
 * The window.__pf test hook exists in e2e builds and exposes read-only state.
 * Its absence from production builds is checked by scripts/check-no-test-hook.mjs.
 */

import { test, expect } from './fixtures';

test('window.__pf exposes project state, layout hash and undo depth in the editor', async ({ page, pf }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project' }).click();
  await pf.ready();
  await expect(page.getByTestId('pad-0-0')).toBeVisible();
  await expect(page.getByTestId('pad-7-7')).toBeVisible();
  await expect(page.getByTestId('drawer-tab-composer')).toBeVisible();

  const state = await pf.call('state');
  expect(state.activeLayout).toBeTruthy();
  expect(typeof (await pf.call('layoutHash', 'active'))).toBe('string');
  expect(await pf.call('history')).toEqual({ undo: expect.any(Number), redo: expect.any(Number) });
  expect(await pf.call('status')).toMatchObject({ isProcessing: expect.any(Boolean), candidateIds: [], soundCount: 0 });

  // The snapshot is a copy: mutating it in the page does not touch app state.
  const unchanged = await page.evaluate(() => {
    const s = window.__pf!.state();
    s.activeLayout.name = 'mutated';
    return window.__pf!.state().activeLayout.name !== 'mutated';
  });
  expect(unchanged).toBe(true);
});
