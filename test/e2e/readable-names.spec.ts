/**
 * S2.2b · Readable references (T20, T23), P2-8 and P2-12.
 *
 * Compare, the Library and the verdict name Sounds, never their ids ("lane_…"),
 * and Compare's diff counts unique Sounds and unique pads, so "Sounds moved" is
 * at most the Sound count (the C7 case read "11 voices moved" with 7 Sounds).
 */

import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { generateAndWait, newProject, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

const FOUR_BARS = fileURLToPath(new URL('../fixtures/midi/four-bars-120.mid', import.meta.url));

/** Raw ids in a piece of visible text: "lane_…", or any current Sound or voice id. */
function rawIds(text: string, ids: string[]): string[] {
  const found = ids.filter(id => text.includes(id));
  if (/lane_/.test(text)) found.push('lane_');
  return found;
}

async function allIds(pf: PfHandle): Promise<string[]> {
  const s = await pf.call('state');
  const layout = s.workingLayout ?? s.activeLayout;
  return [...new Set([...s.soundStreams.map(x => x.id), ...Object.values(layout.padToVoice).map(v => v.id)])];
}

async function openCompareOfFirstTwo(page: Page) {
  const rows = page.getByTestId('candidate-row');
  await rows.nth(0).getByTitle('Select for comparison').click();
  await rows.nth(1).getByTitle('Select for comparison').click();
  await page.getByTitle(/^Compare \d+ selected layouts$/).click();
  await expect(page.getByTestId('compare-dialog')).toBeVisible();
}

test.describe('S2.2b · readable names and counts', () => {
  test('verdict, Compare and Library text name Sounds, never ids; Compare counts unique Sounds and pads (P2-8, P2-12)', async ({ page, pf }) => {
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);
    const ids = await allIds(pf);
    expect(ids.length).toBeGreaterThanOrEqual(7);

    // The verdict, and the whole analysis panel around it.
    const verdict = await page.getByTestId('verdict-badge').first().innerText();
    expect(verdict).toMatch(/events?|notes?/);
    expect(rawIds(verdict, ids)).toEqual([]);
    expect(rawIds(await page.locator('body').innerText(), ids), 'workspace text').toEqual([]);

    // Compare two candidates. (From here on, read status(), not state(): a deep
    // copy of every candidate's trace is slow to hand to the test.)
    await generateAndWait(page, pf);
    expect((await pf.call('status')).candidateIds.length).toBeGreaterThanOrEqual(2);
    await openCompareOfFirstTwo(page);
    const dialog = page.getByTestId('compare-dialog');
    expect(rawIds(await dialog.innerText(), ids), 'Compare text').toEqual([]);

    const summary = (await page.getByTestId('compare-diff-summary').innerText()).trim();
    const m = /(\d+) Sounds? moved \((\d+) pads? changed\)/.exec(summary);
    if (m) {
      const soundCount = (await pf.call('status')).soundCount;
      expect(Number(m[1]), summary).toBeLessThanOrEqual(soundCount);
      expect(Number(m[2]), summary).toBeLessThanOrEqual(64);
    } else {
      expect(summary).toContain('No Sounds moved');
    }

    // The Library card for this project.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /Library/ }).first().click();
    await page.waitForURL(url => !url.pathname.includes('/project/'));
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
    await expect(page.getByText('7 sounds').first()).toBeVisible();
    expect(rawIds(await page.locator('body').innerText(), ids), 'Library text').toEqual([]);
  });

  test('positions read bar.beat.sixteenth, the loop reads bars, Speed shows its BPM, empty pads are blank (T43)', async ({ page, pf }) => {
    await newProject(page, pf);
    await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(FOUR_BARS);
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(3);

    await expect(page.getByTestId('transport-position')).toHaveText('1.1.1');
    const speeds = await page.getByTestId('transport-speed').locator('option').allTextContents();
    expect(speeds).toContain('0.75x · 90 BPM');
    expect(speeds).toContain('1x · 120 BPM');

    // Bars 3–4 of a 4-bar clip at 120 BPM: 4 s to 8 s.
    await pf.call('dispatch', { type: 'SET_LOOP_REGION', payload: { start: 4, end: 8 } });
    await page.getByTestId('transport-loop').click();
    await expect(page.getByTestId('timeline-loop-label')).toHaveText('Bars 3–4');
    await expect(page.getByTestId('transport-loop')).toHaveAttribute('title', /Loop Bars 3–4/);

    // Nothing placed: every pad is blank (no "0,0" coordinates), and its name says where it is.
    await expect(page.getByTestId('pad-0-0')).toHaveText('');
    await expect(page.getByTestId('pad-3-3')).toHaveAttribute('aria-label', 'Row 4, column 4, empty');
  });
});
