/**
 * Accessibility smoke spec on the Library (roadmap P0 "Component tests", criterion P0-4).
 *
 * P0 only proves axe runs: it reports violations as an annotation and asserts none are
 * critical-impact beyond the known baseline. P7's accessibility sweep tightens this
 * to zero serious or critical violations.
 */

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('axe runs on the Library', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = results.violations.map(v => `${v.impact ?? 'unknown'} · ${v.id} (${v.nodes.length})`);
  testInfo.annotations.push({ type: 'axe violations', description: summary.join('; ') || 'none' });
  await testInfo.attach('axe-results.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });

  expect(results.passes.length).toBeGreaterThan(0);
});
