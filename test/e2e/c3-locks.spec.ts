/**
 * C3 · Beam and Annealing ignore and delete placement locks (T11).
 *
 * Register root cause: Beam and Annealing runs never receive the placement
 * locks (useAutoAnalysis.ts), and generateCandidates re-seeds every candidate
 * from the natural hand pose rather than the current grid, returning
 * placementLocks {}. Manual drags ignore locks too.
 *
 * Runs greedy (one strategy, to keep it short), beam and annealing Quick; deep
 * annealing runs nightly (test/nightly). All expected-fail cases flip in S1a.3.
 */

import { test, expect, EXPECTED_FAIL } from './fixtures';
import { openTestMidi1, placeSounds, chooseMethod, generateAndWait, shownPads, dragPad } from './project';
import type { Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

/** The C3 probe's user placement: a compact block in the bottom rows. */
const USER_PADS = ['7,0', '7,1', '7,2', '6,0', '6,1', '6,2', '7,3'];
const LOCK_PAD = '7,0';

/** Places the Sounds and locks the one on [7,0]. Returns the locked Sound's id. */
async function placeAndLock(page: Page, pf: PfHandle): Promise<string> {
  await openTestMidi1(page, pf);
  const [lockedId] = await placeSounds(pf, USER_PADS);
  // Set up through the reducer: the pad menu itself is broken (C1).
  await pf.call('dispatch', { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: lockedId, padKey: LOCK_PAD } });
  const s = await pf.call('state');
  expect((s.workingLayout ?? s.activeLayout).placementLocks).toEqual({ [lockedId]: LOCK_PAD });
  return lockedId;
}

async function expectLockHeldInEveryCandidate(pf: PfHandle, lockedId: string) {
  const { candidates } = await pf.call('state');
  expect(candidates.length).toBeGreaterThan(0);
  const summary = candidates.map(c => ({
    strategy: c.metadata.strategy,
    soundAt7_0: c.layout.padToVoice[LOCK_PAD]?.id ?? null,
    locks: c.layout.placementLocks,
    unplayable: c.executionPlan.unplayableCount,
  }));
  expect(summary).toEqual(candidates.map(c => ({
    strategy: c.metadata.strategy,
    soundAt7_0: lockedId,
    locks: { [lockedId]: LOCK_PAD },
    unplayable: 0,
  })));
}

test.describe('C3 · placement locks', () => {
  test('greedy: a lock at [7,0] holds in every candidate', async ({ page, pf }) => {
    test.setTimeout(240_000);
    const lockedId = await placeAndLock(page, pf);
    await chooseMethod(page, 'Greedy');
    await page.getByTitle('Layout seeding strategy').selectOption({ label: 'Natural Pose' });
    await generateAndWait(page, pf, 200_000);
    await expectLockHeldInEveryCandidate(pf, lockedId);
  });

  test('beam: a lock at [7,0] holds in every candidate', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C3: beam candidates are re-seeded from the hand pose and drop the lock (flips in S1a.3)');
    const lockedId = await placeAndLock(page, pf);
    await chooseMethod(page, 'Beam');
    await generateAndWait(page, pf);
    await expectLockHeldInEveryCandidate(pf, lockedId);
  });

  test('annealing Quick: a lock at [7,0] holds in every candidate', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C3: annealing Quick runs the same re-seeding path and drops the lock (flips in S1a.3)');
    const lockedId = await placeAndLock(page, pf);
    await chooseMethod(page, 'Annealing');
    await page.getByTitle('Intensity').selectOption({ label: 'Quick' });
    await generateAndWait(page, pf);
    await expectLockHeldInEveryCandidate(pf, lockedId);
  });

  test('dragging another pad onto the locked pad is refused', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C3: pad drops ignore placement locks (flips in S1a.3)');
    const lockedId = await placeAndLock(page, pf);
    await dragPad(page, '7,1', '7,0');
    expect((await shownPads(pf))[LOCK_PAD]).toBe(lockedId);
  });

  test('dragging the locked Sound off its pad is refused', async ({ page, pf }) => {
    test.fail(EXPECTED_FAIL, 'C3: a locked pad can be dragged out (flips in S1a.3)');
    const lockedId = await placeAndLock(page, pf);
    await dragPad(page, '7,0', '4,4');
    const pads = await shownPads(pf);
    expect({ at7_0: pads[LOCK_PAD], at4_4: pads['4,4'] ?? null }).toEqual({ at7_0: lockedId, at4_4: null });
  });
});
