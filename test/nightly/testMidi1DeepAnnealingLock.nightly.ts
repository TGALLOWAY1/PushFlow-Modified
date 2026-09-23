/**
 * Nightly: the [7,0] lock case for Annealing "Thorough" (deep). A separate file
 * so it runs in parallel with the unlocked deep run.
 */

import { describe, it, expect } from 'vitest';
import { LOCK_PAD, suggestedTestMidi1, lockBusiestSoundAt7_0, generateBeamAnnealingAsApp } from '../helpers/testMidi1';
import { reportDuration } from './reportDuration';

describe('TEST MIDI 1 · annealing Thorough (deep) with a Sound locked at [7,0]', () => {
  // Expected to fail until S1a.3 (C3 / T11): generateCandidates re-seeds every
  // candidate from the natural hand pose and returns placementLocks {}.
  it.fails('holds in every candidate (fails until S1a.3)', async () => {
    const { state, lockedId } = lockBusiestSoundAt7_0(await suggestedTestMidi1());
    const start = performance.now();
    const candidates = await generateBeamAnnealingAsApp(state, 'deep');
    reportDuration('Deep annealing with a lock, TEST MIDI 1 (3 candidates)', performance.now() - start);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.layout.padToVoice[LOCK_PAD]?.id).toBe(lockedId);
      expect(candidate.layout.placementLocks).toEqual({ [lockedId]: LOCK_PAD });
    }
  });
});
