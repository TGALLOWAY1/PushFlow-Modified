/**
 * S3.2 · Look without overwriting (T01), roadmap P3-1.
 *
 * Inspecting the Active Layout, every candidate and every variant, 20 times in
 * a row, leaves the Working/Test Layout's hash unchanged. After Generate the
 * draft is unchanged, the grid shows candidate A read-only under the violet
 * bar, and "Back to my draft" shows the untouched draft. Drag, the pad menu,
 * click-to-place and Delete are each refused while a layout is inspected, with
 * the hint "Use as my draft to edit" (one test per path).
 *
 * Beam generates the candidates, as C2 does (Greedy's "All strategies" blocks
 * the page for minutes).
 */

import { test, expect } from './fixtures';
import {
  chooseMethod,
  dragPad,
  generateAndWait,
  openTestMidi1,
  placeSounds,
  suggestStartingLayout,
  visiblePadPoint,
  waitForAnalysis,
} from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** The violet of --role-candidate (#a78bfa). */
const CANDIDATE_VIOLET = [167, 139, 250];
const HINT = 'Use as my draft to edit';

/** An element's computed text colour as 0–255 channels ("rgb(…)" or color-mix's "color(srgb …)"). */
async function textColour(page: Page, testId: string): Promise<number[]> {
  const css = await page.getByTestId('state-bar').getByTestId(testId).evaluate(el => getComputedStyle(el).color);
  const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(css);
  if (srgb) return srgb.slice(1, 4).map(v => Math.round(Number(v) * 255));
  return (/rgba?\((\d+), (\d+), (\d+)/.exec(css) ?? []).slice(1, 4).map(Number);
}

/**
 * TEST MIDI 1, suggested and promoted (Active); two saved variants; a
 * hand-made draft that differs from Active; then Generate with Beam.
 * Returns the draft's hash from before Generate.
 */
async function activeVariantsDraftAndCandidates(page: Page, pf: PfHandle): Promise<string> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await waitForAnalysis(pf);
  await page.getByTitle('Make this layout the new Active Layout').click();
  await waitForAnalysis(pf);
  await placeSounds(pf, ['0,0']);
  await pf.call('dispatch', { type: 'SAVE_AS_VARIANT', payload: { name: 'Corner kick', source: 'working' } });
  await placeSounds(pf, ['0,0', '0,7']);
  await pf.call('dispatch', { type: 'SAVE_AS_VARIANT', payload: { name: 'Both corners', source: 'working' } });
  await placeSounds(pf, ['7,0', '7,7', '6,0']);
  const draftHash = (await pf.call('layoutHash', 'working'))!;
  expect(draftHash).not.toBeNull();
  await chooseMethod(page, 'Beam');
  await generateAndWait(page, pf);
  return draftHash;
}

/** Pad key → the Sound name its aria-label reads, for every occupied pad on the grid. */
async function gridSounds(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')) {
      const m = /^pad-(\d)-(\d)$/.exec(el.dataset.testid ?? '');
      // "Row 3, column 4, TEST MIDI 1 A" or "…, empty".
      const label = el.getAttribute('aria-label') ?? '';
      const name = label.slice(label.lastIndexOf(', ') + 2);
      if (m && name && name !== 'empty') out[`${m[1]},${m[2]}`] = name;
    }
    return out;
  });
}

/** Pad key → Sound name for a layout in project state. */
async function layoutSounds(pf: PfHandle, pick: (s: Awaited<ReturnType<PfHandle['call']>> & object) => unknown): Promise<Record<string, string>> {
  const s = await pf.call('state');
  const layout = pick(s as never) as { padToVoice: Record<string, { id: string }> };
  const names = new Map(s.soundStreams.map(x => [x.id, x.name]));
  return Object.fromEntries(Object.entries(layout.padToVoice).map(([k, v]) => [k, names.get(v.id)!]));
}

async function expectHint(page: Page) {
  await expect(page.getByTestId('toast').filter({ hasText: HINT })).toBeVisible();
}

test.describe('S3.2 · inspecting never writes (P3-1)', () => {
  test('after Generate the draft is unchanged, candidate A is on the grid read-only under the violet bar, and "Back to my draft" shows the draft', async ({ page, pf }) => {
    const draftHash = await activeVariantsDraftAndCandidates(page, pf);
    expect(await pf.call('layoutHash', 'working')).toBe(draftHash);

    const { candidateIds } = await pf.call('status');
    const bar = page.getByTestId('state-bar');
    await expect(bar).toHaveAttribute('data-role', 'candidate');
    await expect(bar).toHaveAttribute('data-chip', 'Candidate A');
    await expect(bar).toHaveAttribute('data-read-only', 'true');
    expect(await textColour(page, 'role-chip'), 'the violet candidate chip').toEqual(CANDIDATE_VIOLET);
    expect(await pf.call('inspected')).toEqual({ kind: 'candidate', id: candidateIds[0], readOnly: true });
    expect(await pf.call('layoutHash', 'shown')).toBe(await pf.call('layoutHash', { kind: 'candidate', id: candidateIds[0]! }));
    expect(await gridSounds(page)).toEqual(await layoutSounds(pf, s => (s as { candidates: Array<{ layout: unknown }> }).candidates[0]!.layout));

    await bar.getByRole('button', { name: 'Back to my draft' }).click();
    await expect(bar).toHaveAttribute('data-role', 'working');
    expect(await pf.call('inspected')).toMatchObject({ kind: 'working', readOnly: false });
    expect(await pf.call('layoutHash', 'shown')).toBe(draftHash);
    expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
    expect(await gridSounds(page)).toEqual(await layoutSounds(pf, s => (s as { workingLayout: unknown }).workingLayout));
  });

  test('inspecting Active, every candidate and every variant 20 times in a row leaves the draft hash unchanged', async ({ page, pf }) => {
    test.setTimeout(240_000);
    const draftHash = await activeVariantsDraftAndCandidates(page, pf);
    const candidates = page.getByTestId('candidate-row');
    const variants = page.getByTestId('variant-row');
    const candidateCount = await candidates.count();
    const variantCount = await variants.count();
    expect(candidateCount).toBeGreaterThan(1);
    expect(variantCount).toBe(2);

    const history = await pf.call('history');
    const inspectAndCheck = async (click: () => Promise<void>, kind: string, what: string) => {
      await click();
      await expect.poll(async () => (await pf.call('inspected')).kind, { message: what }).toBe(kind);
      expect(await pf.call('layoutHash', 'working'), what).toBe(draftHash);
    };
    for (let round = 1; round <= 20; round++) {
      await inspectAndCheck(() => page.getByTestId('active-inspect').click(), 'active', `round ${round}: Active`);
      for (let i = 0; i < candidateCount; i++) {
        await inspectAndCheck(() => candidates.nth(i).getByRole('button', { name: 'Inspect' }).click(), 'candidate', `round ${round}: candidate ${i + 1}`);
      }
      for (let i = 0; i < variantCount; i++) {
        await inspectAndCheck(() => variants.nth(i).getByTestId('variant-inspect').click(), 'variant', `round ${round}: variant ${i + 1}`);
      }
    }
    // Nothing was an edit: no undo step, and the draft is still the draft.
    expect(await pf.call('history')).toEqual(history);
    await page.getByTestId('state-bar-back').click();
    expect(await pf.call('layoutHash', 'shown')).toBe(draftHash);
  });

  test.describe('every edit path is refused while a candidate is inspected, with the hint', () => {
    test('drag: a pad onto another, and a Sound from the Sounds panel onto a pad', async ({ page, pf }) => {
      const draftHash = await activeVariantsDraftAndCandidates(page, pf);
      const { candidateIds } = await pf.call('status');
      const candidateHash = await pf.call('layoutHash', { kind: 'candidate', id: candidateIds[0]! });
      const shown = await gridSounds(page);
      const occupied = Object.keys(shown)[0]!;
      const empty = ['7,7', '7,6', '6,7', '6,6', '7,5'].find(k => !shown[k])!;
      const history = await pf.call('history');

      await dragPad(page, occupied, empty);
      await expectHint(page);
      // The row's own padding, left of its colour swatch (the name starts a rename).
      const row = page.getByTestId('sound-row').first();
      const from = (await row.boundingBox())!;
      const to = await visiblePadPoint(page, empty);
      await page.mouse.move(from.x + 3, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 9, from.y + from.height / 2 + 6, { steps: 3 });
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.mouse.up();

      expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
      expect(await pf.call('layoutHash', { kind: 'candidate', id: candidateIds[0]! })).toBe(candidateHash);
      expect(await gridSounds(page)).toEqual(shown);
      expect(await pf.call('history')).toEqual(history);
    });

    test('the pad menu does not open', async ({ page, pf }) => {
      const draftHash = await activeVariantsDraftAndCandidates(page, pf);
      const occupied = Object.keys(await gridSounds(page))[0]!;
      await page.getByTestId(`pad-${occupied.replace(',', '-')}`).click({ button: 'right' });
      await expectHint(page);
      await expect(page.getByTestId('pad-menu')).toHaveCount(0);
      expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
    });

    test('click-to-place: an armed Sound is not placed', async ({ page, pf }) => {
      const draftHash = await activeVariantsDraftAndCandidates(page, pf);
      const shown = await gridSounds(page);
      const empty = ['7,7', '7,6', '6,7', '6,6', '7,5'].find(k => !shown[k])!;
      const history = await pf.call('history');
      // A click on the row's own padding arms it (a click on its name would rename it).
      await page.getByTestId('sound-row').first().click({ position: { x: 3, y: 10 } });
      expect((await pf.call('status')).armedStreamId).not.toBeNull();
      await page.getByTestId(`pad-${empty.replace(',', '-')}`).click();
      await expectHint(page);
      expect(await gridSounds(page)).toEqual(shown);
      expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
      expect(await pf.call('history')).toEqual(history);
    });

    test('Delete: the selected pad keeps its Sound', async ({ page, pf }) => {
      const draftHash = await activeVariantsDraftAndCandidates(page, pf);
      const shown = await gridSounds(page);
      const occupied = Object.keys(shown)[0]!;
      const history = await pf.call('history');
      await page.getByTestId(`pad-${occupied.replace(',', '-')}`).click();
      expect((await pf.call('status')).selectedPadKey).toBe(occupied);
      await page.keyboard.press('Delete');
      await expectHint(page);
      expect(await gridSounds(page)).toEqual(shown);
      expect(await pf.call('layoutHash', 'working')).toBe(draftHash);
      expect(await pf.call('history')).toEqual(history);
    });
  });
});
