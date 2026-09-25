/**
 * Library screenshot baseline (roadmap P0 "Deterministic fonts and screenshots").
 * Baselines are generated in CI by update-snapshots.yml, never locally.
 */

import { test, expect, FIXED_NOW } from './fixtures';

test('empty Library matches its screenshot with remote fonts blocked', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('library-empty.png', { fullPage: true });
});
