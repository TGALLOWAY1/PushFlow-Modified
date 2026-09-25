/**
 * S2.2b · Readability floor (T64, T38 and T31 slices).
 *
 * P2-4: a DOM audit finds no grid or timeline text node under 11 px, with the
 * default labels, with every grid label on, and with a moment selected.
 * T38: token colours take Tailwind's opacity modifier, so Save Variant has its
 * fill. T31: disabled buttons keep their pointer events and say why inline.
 */

import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { newProject, openTestMidi1, selectMoment, suggestStartingLayout, waitForAnalysis } from './project';

/** Every visible text node under 11 px inside the element with this test id. */
async function textUnder11px(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).evaluate(root => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.getClientRects().length === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      const size = parseFloat(style.fontSize);
      if (size < 11) found.push(`"${text}" at ${size}px in <${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}">`);
    }
    return found;
  });
}

async function gridAndTimelineAudit(page: Page): Promise<string[]> {
  await expect(page.getByTestId('timeline-ruler')).toBeVisible();
  return [...await textUnder11px(page, 'grid-region'), ...await textUnder11px(page, 'bottom-drawer')];
}

/** The button is disabled, still takes the pointer, and its reason is visible text tied to it. */
async function expectDisabledWithReason(button: Locator, reason: string): Promise<void> {
  await expect(button).toBeDisabled();
  expect(await button.evaluate(el => getComputedStyle(el).pointerEvents)).not.toBe('none');
  // A click lands on the button itself, not on whatever is underneath.
  expect(await button.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  })).toBe(true);
  const describedBy = await button.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const note = button.page().locator(`[id="${describedBy}"]`);
  await expect(note).toBeVisible();
  await expect(note).toHaveText(reason);
  expect(parseFloat(await note.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
}

test.describe('S2.2b · readability floor', () => {
  test('no grid or timeline text is under 11 px (P2-4)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    expect(await gridAndTimelineAudit(page), 'default labels').toEqual([]);

    // Every grid label on: note names, positions and fingers.
    await page.getByRole('button', { name: 'View settings' }).click();
    await page.getByRole('button', { name: 'Show Note Labels' }).click();
    await page.getByRole('button', { name: 'Show Position Labels' }).click();
    await page.keyboard.press('Escape');
    const s = await pf.call('state');
    expect(s.soundStreams).toHaveLength(7);
    expect(await gridAndTimelineAudit(page), 'every grid label on').toEqual([]);

    // A selected moment: its fingers on the pads and the transition preview.
    await selectMoment(page, 3);
    await expect(page.getByTestId('state-bar-slot')).toContainText('Transition preview');
    expect(await gridAndTimelineAudit(page), 'moment selected').toEqual([]);
  });

  test('Save Variant has its accent fill (T38 token alpha)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    const save = page.getByRole('button', { name: 'Save Variant' });
    await expect(save).toBeVisible();
    const { background, border } = await save.evaluate(el => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: cs.borderTopColor };
    });
    // bg-accent-primary/80 and border-accent-primary/30 used to compile to
    // nothing: a transparent button with Tailwind's default grey border.
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    expect(border).not.toBe('rgb(229, 231, 235)');
  });

  test('disabled buttons keep pointer events and say why inline (T31)', async ({ page, pf }) => {
    await newProject(page, pf);
    await expectDisabledWithReason(page.getByRole('button', { name: 'Generate', exact: true }), 'Import MIDI or build a pattern first');
    await expectDisabledWithReason(page.getByRole('button', { name: 'Compare', exact: true }), 'Generate candidates first');

    await page.getByRole('button', { name: 'View settings' }).click();
    await expectDisabledWithReason(
      page.getByRole('button', { name: 'Calculate Cost' }),
      'Place a Sound on the grid first: the cost needs a finger assignment',
    );
  });
});
