/**
 * Overlays on the one Dialog/Popover primitive (S1b.2, T06): one case per
 * migrated overlay. Each is portalled to <body> with dialog semantics, the
 * first Escape closes it, and focus returns to the control that opened it.
 * (The pad menu has its own spec, C1.)
 */

import { test, expect } from './fixtures';
import { openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';
import type { Locator, Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

async function analysedProject(page: Page, pf: PfHandle) {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
}

/** Five candidates copied from the current analysis, so "View all" (more than 4) and Compare exist. */
async function injectCandidates(pf: PfHandle) {
  const s = await pf.call('state');
  const base = s.analysisResult!;
  // Each copy swaps the Sounds of two pads, so every candidate is a distinct layout.
  const keys = Object.keys(base.layout.padToVoice);
  const candidates = Array.from({ length: 5 }, (_, i) => {
    const padToVoice = { ...base.layout.padToVoice };
    const [a, b] = [keys[0]!, keys[i + 1]!];
    [padToVoice[a], padToVoice[b]] = [padToVoice[b]!, padToVoice[a]!];
    return { ...base, id: `e2e-cand-${i}`, layout: { ...base.layout, id: `e2e-layout-${i}`, padToVoice }, metadata: { ...base.metadata, strategy: `copy ${i + 1}` } };
  });
  await pf.call('dispatch', { type: 'SET_CANDIDATES', payload: candidates });
}

async function expectPortalledDialog(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const labelled = await dialog.evaluate(el => {
    const id = el.getAttribute('aria-labelledby');
    return { inBody: el.parentElement === document.body, label: id ? document.getElementById(id)?.textContent ?? '' : '' };
  });
  expect(labelled.inBody).toBe(true);
  expect(labelled.label.length).toBeGreaterThan(0);
}

async function escapeClosesAndRefocuses(page: Page, dialog: Locator, trigger: Locator) {
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

test.describe('Overlays (Dialog primitive)', () => {
  test.beforeEach(async ({ page, pf }) => {
    await analysedProject(page, pf);
  });

  test('Learn More', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Learn more' });
    await trigger.click();
    const dialog = page.getByTestId('learn-more-dialog');
    await expectPortalledDialog(dialog);
    // Tab stays inside the dialog.
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await escapeClosesAndRefocuses(page, dialog, trigger);
  });

  test('the enlarged chart', async ({ page }) => {
    await page.getByRole('button', { name: /Event Difficulty Chart/ }).click();
    const trigger = page.getByRole('button', { name: 'Enlarge' }).first();
    await trigger.click();
    const dialog = page.getByTestId('chart-dialog');
    await expectPortalledDialog(dialog);
    await escapeClosesAndRefocuses(page, dialog, trigger);
  });

  test('View all', async ({ page, pf }) => {
    await injectCandidates(pf);
    const trigger = page.getByRole('button', { name: 'View all' });
    await trigger.click();
    const dialog = page.getByTestId('view-all-dialog');
    await expectPortalledDialog(dialog);
    await escapeClosesAndRefocuses(page, dialog, trigger);
    // An outside press closes it too.
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(dialog).toHaveCount(0);
  });

  test('Compare, including its Close button', async ({ page, pf }) => {
    await injectCandidates(pf);
    const rows = page.getByTestId('candidate-row');
    await rows.nth(0).getByTitle('Select for comparison').click();
    await rows.nth(1).getByTitle('Select for comparison').click();
    const trigger = page.getByTitle(/^Compare \d+ selected layouts$/);
    await trigger.click();
    const dialog = page.getByTestId('compare-dialog');
    await expectPortalledDialog(dialog);
    await escapeClosesAndRefocuses(page, dialog, trigger);
    await trigger.click();
    await page.getByTestId('compare-close').click();
    await expect(dialog).toHaveCount(0);
  });
});
