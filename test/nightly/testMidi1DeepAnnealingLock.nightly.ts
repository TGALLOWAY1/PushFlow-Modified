/**
 * Nightly: the [7,0] lock case for Annealing "Thorough" (deep). A separate file
 * so it runs in parallel with the unlocked deep run. Generation, the duration
 * report and the basic checks run as normal code, so a crash, timeout or empty
 * result fails the job; only the lock assertion is expected to fail.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { type CandidateSolution } from '../../src/types/candidateSolution';
import { countHandUsage } from '../helpers/testHelpers';
import { LOCK_PAD, suggestedTestMidi1, lockBusiestSoundAt7_0, generateBeamAnnealingAsApp } from '../helpers/testMidi1';
import { reportDuration } from './reportDuration';

describe('TEST MIDI 1 · annealing Thorough (deep) with a Sound locked at [7,0]', () => {
  let candidates: CandidateSolution[];
  let lockedId: string;

  beforeAll(async () => {
    const locked = lockBusiestSoundAt7_0(await suggestedTestMidi1());
    lockedId = locked.lockedId;
    const start = performance.now();
    candidates = await generateBeamAnnealingAsApp(locked.state, 'deep');
    reportDuration('Deep annealing with a lock, TEST MIDI 1 (3 candidates)', performance.now() - start);
  });

  it('produces candidates with 0 unplayable events', () => {
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(countHandUsage(candidate.executionPlan).unplayable).toBe(0);
    }
  });

  // Expected to fail until S1a.3 (C3 / T11): generateCandidates re-seeds every
  // candidate from the natural hand pose and returns placementLocks {}.
  it.fails('holds in every candidate (fails until S1a.3)', () => {
    for (const candidate of candidates) {
      expect(candidate.layout.padToVoice[LOCK_PAD]?.id).toBe(lockedId);
      expect(candidate.layout.placementLocks).toEqual({ [lockedId]: LOCK_PAD });
    }
  });
});
