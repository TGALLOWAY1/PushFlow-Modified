/**
 * S3.3 · Unfinished, not failed (T25), criterion P3-6, and explicit fill-in
 * (T37, decision Q4).
 *
 * Only placed Sounds are scored: a layout with 3 of 7 Sounds placed reads
 * "Unfinished · 3 of 7 Sounds placed", never Infeasible (its placed notes all
 * play) and never Feasible, whichever event is selected. The unplaced Sounds
 * are listed with drag handles, and their notes stay in the timeline, drawn as
 * outlines. "Place remaining 4 Sounds" proposes one candidate, shown
 * read-only, and writes nothing; "Use as my draft" applies it in one click, as
 * one undo step. On an empty grid Generate reads "Generate layouts from
 * scratch".
 */

import { test, expect } from './fixtures';
import { openTestMidi1, placeSounds, selectMoment, waitForAnalysis } from './project';

const THREE_PADS = ['3,3', '3,4', '4,5'];

test.describe('S3.3 · Unfinished, not failed (P3-6), and Place remaining (T37)', () => {
  test('3 of 7 placed reads "Unfinished · 3 of 7 Sounds placed", never Infeasible or Feasible; unplaced notes stay in the timeline, outlined', async ({ page, pf }) => {
    test.setTimeout(90_000);
    await openTestMidi1(page, pf);
    // Nothing placed: Generate proposes whole layouts, and says so.
    await expect(page.getByRole('button', { name: 'Generate layouts from scratch' })).toBeVisible();

    const placed = await placeSounds(pf, THREE_PADS);
    await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeVisible();
    await waitForAnalysis(pf);

    // The Layout Summary (Layouts tab): the verdict and what is left to place.
    const badge = page.getByTestId('verdict-badge').first();
    await expect(badge).toHaveAttribute('data-level', 'unfinished');
    await expect(badge.getByTestId('verdict-headline')).toHaveText('Unfinished · 3 of 7 Sounds placed');
    await expect(badge).toContainText(/Scoring covers the \d+ notes you can play so far/);
    await expect(badge.getByTestId('verdict-scope')).toContainText('4 not placed yet');
    const state = await pf.call('state');
    const unplaced = state.soundStreams.filter(s => !placed.includes(s.id));
    const unplacedList = page.getByTestId('unplaced-sound');
    await expect(unplacedList).toHaveText(unplaced.map(s => new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
    for (const item of await unplacedList.all()) await expect(item).toHaveAttribute('draggable', 'true');
    // Nothing placed was judged unplayable.
    expect(state.analysisResult!.executionPlan.fingerAssignments.some(a => a.assignedHand === 'Unplayable')).toBe(false);

    // The timeline keeps every unplaced note, drawn as an outline (invariant 4).
    const outlined = page.locator('[data-placement="unplaced"]');
    await expect(outlined).toHaveCount(unplaced.reduce((n, s) => n + s.events.length, 0));
    const style = await outlined.first().evaluate(el => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: cs.borderTopStyle };
    });
    expect(style).toEqual({ background: 'rgba(0, 0, 0, 0)', border: 'solid' });

    // Whichever event is selected, the layout verdict stays Unfinished.
    await page.getByRole('button', { name: 'Costs', exact: true }).click();
    await expect(page.getByTestId('verdict-badge').first()).toHaveAttribute('data-level', 'unfinished');
    const levels = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await selectMoment(page, i);
      await page.getByRole('button', { name: 'Costs', exact: true }).click();
      await expect(page.getByTestId('selected-event-card')).toBeVisible();
      for (const b of await page.getByTestId('verdict-badge').all()) levels.add((await b.getAttribute('data-level'))!);
    }
    expect([...levels].filter(l => l === 'infeasible' || l === 'feasible')).toEqual([]);
  });

  test('"Place remaining 4 Sounds" proposes one candidate and writes nothing; "Use as my draft" applies it in one click, one undo step', async ({ page, pf }) => {
    test.setTimeout(90_000);
    await openTestMidi1(page, pf);
    const placed = await placeSounds(pf, THREE_PADS);
    await waitForAnalysis(pf);
    const draft = await pf.call('layoutHash', 'working');
    const undoBefore = (await pf.call('history')).undo;
    // The Sounds panel says how many are left, too.
    await expect(page.getByTestId('sounds-place-remaining')).toContainText('4');

    await page.getByTestId('place-remaining').click();
    await expect.poll(async () => (await pf.call('status')).candidateIds.length).toBe(1);
    const [id] = (await pf.call('status')).candidateIds;
    // Shown read-only like Generate's candidate A; the draft and the history are untouched.
    await expect(page.getByTestId('state-bar')).toHaveAttribute('data-role', 'candidate');
    expect(await pf.call('inspected')).toEqual({ kind: 'candidate', id, readOnly: true });
    expect(await pf.call('layoutHash', 'working')).toBe(draft);
    expect((await pf.call('history')).undo).toBe(undoBefore);
    const row = page.locator(`[data-testid="candidate-row"][data-candidate-id="${id}"]`);
    await expect(row).toContainText('Remaining placed');
    await expect(page.getByTestId('candidate-run-title').first()).toContainText('Place remaining');

    // Use as my draft: it keeps every placed Sound, so it applies at once.
    await page.getByTestId('state-bar-use').click();
    await expect(page.getByTestId('use-as-draft-popover')).toHaveCount(0);
    await expect.poll(async () => (await pf.call('history')).undo).toBe(undoBefore + 1);
    const s = await pf.call('state');
    const pads = s.workingLayout!.padToVoice;
    expect(new Set(Object.values(pads).map(v => v.id)).size).toBe(7);
    THREE_PADS.forEach((padKey, i) => expect(pads[padKey]?.id, `Sound ${i + 1} stays on ${padKey}`).toBe(placed[i]));
    await waitForAnalysis(pf);
    await expect(page.getByTestId('verdict-badge').first()).not.toHaveAttribute('data-level', 'unfinished');
    await expect(page.getByTestId('unplaced-sounds')).toHaveCount(0);

    // One Undo brings the 3-of-7 draft back.
    await pf.call('undo');
    await expect.poll(() => pf.call('layoutHash', 'working')).toBe(draft);
  });
});
