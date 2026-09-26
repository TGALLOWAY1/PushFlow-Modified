/**
 * S3.2 · The layout-state bar (T03), roadmap P3-2.
 *
 * The bar above the grid shows the right role and name for the Active Layout,
 * the Working/Test Layout, a Candidate Solution and a Saved Layout Variant.
 * The Analysis panels, the Events list and the timeline header name the same
 * subject (one SubjectChip). While candidate B is inspected, every timeline
 * pill's hand+finger equals B's own plan, read from the per-layout cache
 * through the test hook; a note click still selects its whole event, and the
 * grid's finger labels ("Show Finger Assignment") are B's plan too.
 */

import { test, expect } from './fixtures';
import {
  chooseMethod,
  generateAndWait,
  openTestMidi1,
  placeSounds,
  suggestStartingLayout,
  waitForAnalysis,
} from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

interface Subject { role: string | null; chip: string | null; name: string | null }

async function subjectOf(page: Page, testId: string): Promise<Subject> {
  const el = page.getByTestId(testId).first();
  await expect(el).toBeVisible();
  return {
    role: await el.getAttribute('data-role'),
    chip: await el.getAttribute('data-chip'),
    name: await el.getAttribute('data-name'),
  };
}

/** The bar's role and name, and the same subject in the Analysis panels, the Events list and the timeline. */
async function expectEverySurfaceNames(page: Page, want: Subject) {
  const bar = page.getByTestId('state-bar');
  await expect(bar).toHaveAttribute('data-role', want.role!);
  await expect(bar).toHaveAttribute('data-chip', want.chip!);
  await expect(bar).toHaveAttribute('data-name', want.name!);
  await expect(bar.getByTestId('state-bar-subject-name')).toHaveText(want.name!);
  await expect(bar.getByTestId('role-chip')).toHaveText(want.chip!, { ignoreCase: true });

  // Layouts tab: the Layout Summary; Costs tab: the Cost Analysis panel.
  await page.locator('button.pf-tab', { hasText: 'Layouts' }).click();
  expect(await subjectOf(page, 'layout-summary'), 'Layout Summary').toEqual(want);
  await page.locator('button.pf-tab', { hasText: 'Costs' }).click();
  expect(await subjectOf(page, 'costs-subject'), 'Cost Analysis').toEqual(want);
  await page.locator('button.pf-tab', { hasText: 'Layouts' }).click();
  // The Events list, then back to Sounds.
  await page.locator('button.pf-tab', { hasText: 'Events' }).click();
  expect(await subjectOf(page, 'events-subject'), 'Events').toEqual(want);
  await page.locator('button.pf-tab', { hasText: 'Sounds' }).click();
  expect(await subjectOf(page, 'timeline-subject'), 'timeline').toEqual(want);
}

async function candidateIds(pf: PfHandle): Promise<string[]> {
  return (await pf.call('status')).candidateIds;
}

test.describe('S3.2 · the layout-state bar (P3-2)', () => {
  test('names Working/Test, Active, Saved variant and Candidate right, and every header names the same subject', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await expectEverySurfaceNames(page, { role: 'working', chip: 'Working/Test', name: 'Draft of Default' });

    await page.getByTitle('Make this layout the new Active Layout').click();
    await waitForAnalysis(pf);
    await expectEverySurfaceNames(page, { role: 'active', chip: 'Active', name: 'Default' });

    // A variant, saved through the bar's own Save variant, then inspected.
    await placeSounds(pf, ['0,0']);
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-role', 'working');
    await page.getByTestId('save-variant').click();
    await page.getByTestId('save-variant-name').fill('Wide hands');
    await page.getByTestId('save-variant-confirm').click();
    await page.getByTestId('variant-row').filter({ hasText: 'Wide hands' }).getByTestId('variant-inspect').click();
    await expectEverySurfaceNames(page, { role: 'variant', chip: 'Saved variant', name: 'Wide hands' });

    // Active while the draft differs: read-only, and it says the draft is kept.
    await page.getByTestId('active-inspect').click();
    await expectEverySurfaceNames(page, { role: 'active', chip: 'Active', name: 'Default' });
    await expect(page.getByTestId('state-bar')).toContainText('Viewing Active · your draft is kept');
    await expect(page.getByTestId('state-bar-back')).toHaveText('Back to my draft');

    // After Generate, candidate A.
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    const bar = page.getByTestId('state-bar');
    await expect(bar).toHaveAttribute('data-chip', 'Candidate A');
    // A candidate is named after how it was made, as its row says (its layout carries the user's base name).
    const name = await bar.getAttribute('data-name');
    const rowLetter = page.getByTestId('candidate-row').first().getByTestId('candidate-letter');
    await expect(rowLetter).toHaveText('A');
    await expect(page.getByTestId('candidate-row').first().getByText(name!, { exact: true })).toBeVisible();
    expect(name).not.toBe('Default');
    await expectEverySurfaceNames(page, { role: 'candidate', chip: 'Candidate A', name });

    // Candidate B, by its row.
    await page.getByTestId('candidate-row').nth(1).getByRole('button', { name: 'Inspect' }).click();
    await expect(bar).toHaveAttribute('data-chip', 'Candidate B');
    await expectEverySurfaceNames(page, { role: 'candidate', chip: 'Candidate B', name: await bar.getAttribute('data-name') });
  });

  test('while candidate B is inspected, every timeline pill reads B\'s plan; a note click selects its whole event', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    const ids = await candidateIds(pf);
    expect(ids.length).toBeGreaterThan(1);
    const b = { kind: 'candidate' as const, id: ids[1]! };

    await page.getByTestId('candidate-row').nth(1).getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-chip', 'Candidate B');
    // B's own plan, straight from the per-layout cache (not what the timeline drew).
    await expect.poll(async () => (await pf.call('fingering', b))?.length ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);
    const plan = (await pf.call('fingering', b))!;
    const byKey = new Map(plan.map(n => [n.eventKey, n.finger]));
    // The timeline draws the plan on screen: every pill of a note in B's plan.
    await expect.poll(async () => page.getByTestId('timeline-pill').count()).toBeGreaterThanOrEqual(plan.length);
    const pills = await page.getByTestId('timeline-pill').evaluateAll(els => els.map(el => ({
      key: el.getAttribute('data-event-key'),
      finger: el.getAttribute('data-finger'),
      text: el.textContent?.trim() ?? '',
    })));
    const planned = pills.filter(p => byKey.has(p.key));
    expect(planned.length).toBe(plan.length);
    for (const pill of planned) {
      expect(pill.finger, `pill ${pill.key}`).toBe(byKey.get(pill.key));
      // Hand and finger, never the finger alone (CLAUDE.md Timeline rule).
      if (pill.text) expect(pill.text).toMatch(/^[LR][1-5]$/);
    }
    // The plan on screen is B's.
    expect(await pf.call('fingering', 'shown')).toEqual(plan);

    // "Show Finger Assignment" on the grid: B's fingers.
    const soundOfPad = await page.evaluate(() => Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')].map(el => [el.dataset.testid, el.textContent ?? ''])));
    const fingersBySound = new Map<string, Set<string>>();
    for (const n of plan) if (n.voiceId && n.finger) fingersBySound.set(n.voiceId, (fingersBySound.get(n.voiceId) ?? new Set()).add(n.finger));
    const layout = (await pf.call('state')).candidates.find(c => c.id === b.id)!.layout;
    for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
      const text = soundOfPad[`pad-${padKey.replace(',', '-')}`] ?? '';
      const shownFingers = text.match(/[LR][1-5]/g) ?? [];
      expect(shownFingers.length, `pad ${padKey} shows a finger`).toBeGreaterThan(0);
      for (const f of shownFingers) expect(fingersBySound.get(voice.id)?.has(f), `pad ${padKey}: ${f}`).toBe(true);
    }

    // A note click selects its whole event: every pill at that time.
    const target = page.getByTestId('timeline-pill').filter({ hasText: /^[LR][1-5]$/ }).nth(3);
    const start = await target.getAttribute('data-start');
    await target.click();
    const sameTime = page.locator(`[data-testid="timeline-pill"][data-start="${start}"]`);
    const count = await sameTime.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(sameTime.nth(i)).toHaveClass(/ring-yellow-400/);
  });
});
