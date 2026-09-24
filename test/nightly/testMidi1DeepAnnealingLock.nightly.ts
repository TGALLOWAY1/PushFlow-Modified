/**
 * Nightly: the [7,0] lock case for Annealing "Thorough" (deep). A separate file
 * so it runs in parallel with the unlocked deep run. A crash, timeout or empty
 * result fails the job, and so does a candidate that moved the locked Sound.
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

  // S1a.3 (C3 / T11): the seed pre-places the locked Sound, every mutation
  // leaves locked pads alone, and a violating candidate would be dropped.
  it('holds in every candidate', () => {
    for (const candidate of candidates) {
      expect(candidate.layout.padToVoice[LOCK_PAD]?.id).toBe(lockedId);
      expect(candidate.layout.placementLocks).toEqual({ [lockedId]: LOCK_PAD });
    }
  });
});
