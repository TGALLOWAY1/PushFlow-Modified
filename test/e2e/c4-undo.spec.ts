/**
 * C4 · Undo is unreliable: analysis fills the history (T02).
 *
 * Register root cause: EPHEMERAL_ACTIONS (projectState.ts) omits
 * SET_ANALYSIS_RESULT, SET_CANDIDATES and APPLY_GENERATION_TO_LAYOUT, so
 * analysis results become undo steps, while SUGGEST_STARTING_LAYOUT is marked
 * ephemeral and never recorded. useUndoRedo snapshots the whole ProjectState,
 * so Undo also rewinds candidates, trace and the transport.
 *
 * All cases flip in S1a.1. Until S1a.2 removes Generate's auto-apply, the
 * Generate case reads "one Undo reverts the auto-applied candidate as a single
 * step and keeps the candidate list and trace"; S1a.2 changes it to "undoes the
 * previous user edit".
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import {
  openTestMidi1,
  placeSounds,
  waitForAnalysis,
  chooseMethod,
  generateAndWait,
  shownPads,
  saveAndReload,
} from './project';
import type { Page } from '@playwright/test';

async function clickUndo(page: Page) {
  const undo = page.getByTitle('Undo (Ctrl+Z)');
  await expect(undo).toBeEnabled();
  await undo.click();
}

test.describe('C4 · undo', () => {
  test('placing 3 Sounds, letting analysis settle, then 3 Undos empties the grid', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C4: analysis results are undo steps, so 3 Undos only rewind analysis (flips in S1a.1)');
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['3,3', '3,4', '4,3']);
    await waitForAnalysis(pf);
    for (let i = 0; i < 3; i++) await clickUndo(page);
    expect({ pads: await shownPads(pf), sounds: (await pf.call('state')).soundStreams.length }).toEqual({ pads: {}, sounds: 7 });
  });

  test('one Undo after Suggest restores the pre-Suggest grid', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C4: SUGGEST_STARTING_LAYOUT is ephemeral, so it is never recorded (flips in S1a.1)');
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['0,0']);
    await waitForAnalysis(pf);
    const before = await shownPads(pf);
    // The action the Analysis panel's "Suggest a starting layout" button dispatches
    // (the button itself is offered only on an empty grid).
    await pf.call('dispatch', { type: 'SUGGEST_STARTING_LAYOUT' });
    expect(Object.keys(await shownPads(pf))).toHaveLength(7);
    await waitForAnalysis(pf);
    await clickUndo(page);
    expect(await shownPads(pf)).toEqual(before);
  });

  test('one Undo after Generate reverts the applied candidate and keeps the candidates and trace', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C4: SET_CANDIDATES and the analysis result are undo steps, so one Undo does not reach the pre-Generate draft (flips in S1a.1)');
    test.setTimeout(120_000);
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['0,0', '0,1', '1,0', '0,7', '1,7', '0,6', '7,3']);
    await waitForAnalysis(pf);
    const draft = await shownPads(pf);
    await chooseMethod(page, 'Greedy');
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Natural Pose' });
    await generateAndWait(page, pf);
    const after = await pf.call('state');
    const candidateIds = after.candidates.map(c => c.id);
    // Today generateFull clears the trace and never sets it (see Follow-ups in
    // UI_ROADMAP_PROGRESS.md), so this compares an empty trace until S3.4.
    await clickUndo(page);
    const undone = await pf.call('state');
    expect({
      pads: await shownPads(pf),
      candidates: undone.candidates.map(c => c.id),
      trace: undone.moveHistory?.length ?? 0,
    }).toEqual({ pads: draft, candidates: candidateIds, trace: after.moveHistory?.length ?? 0 });
  });

  test('Undo during playback keeps playing from the current time', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C4: Undo restores a whole-state snapshot, including isPlaying and currentTime (flips in S1a.1)');
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['3,3', '3,4']);
    await waitForAnalysis(pf);
    await page.getByTestId('transport-play').click();
    await expect.poll(async () => (await pf.call('status')).currentTime).toBeGreaterThan(0.5);
    const before = (await pf.call('status')).currentTime;
    await clickUndo(page);
    const s = await pf.call('status');
    expect({ isPlaying: s.isPlaying, notRewound: s.currentTime >= before }).toEqual({ isPlaying: true, notRewound: true });
  });

  test('a reopened project starts with an empty history', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C4: loading and analysing a project records undo steps (flips in S1a.1)');
    await openTestMidi1(page, pf);
    await placeSounds(pf, ['3,3', '3,4']);
    await waitForAnalysis(pf);
    await saveAndReload(page, pf);
    await waitForAnalysis(pf);
    expect(await pf.call('history')).toEqual({ undo: 0, redo: 0 });
  });
});
