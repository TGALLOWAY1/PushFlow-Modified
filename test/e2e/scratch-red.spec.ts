// Scratch (S0.1 P0-1): a deliberately failing e2e spec. Never merge.
import { test, expect } from './fixtures';
test('fails on purpose', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'This button does not exist' })).toBeVisible({ timeout: 2000 });
});
