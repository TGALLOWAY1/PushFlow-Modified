/**
 * Nightly: TEST MIDI 1 through Annealing "Thorough" (optimizationMode 'deep'),
 * exactly as useAutoAnalysis.generateFull runs it. Too slow for every PR (the
 * UI critique measured about 33 minutes in the browser), so nightly.yml runs it
 * via `npm run test:nightly` and reports the duration in the job summary.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { type CandidateSolution } from '../../src/types/candidateSolution';
import { countHandUsage } from '../helpers/testHelpers';
import { suggestedTestMidi1, generateBeamAnnealingAsApp } from '../helpers/testMidi1';
import { reportDuration } from './reportDuration';

describe('TEST MIDI 1 · annealing Thorough (deep)', () => {
  let candidates: CandidateSolution[];

  beforeAll(async () => {
    const state = await suggestedTestMidi1();
    const start = performance.now();
    candidates = await generateBeamAnnealingAsApp(state, 'deep');
    reportDuration('Deep annealing, TEST MIDI 1 (3 candidates)', performance.now() - start);
  });

  it('every candidate has 0 unplayable events in strict mode', () => {
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      const usage = countHandUsage(candidate.executionPlan);
      expect({ strategy: candidate.metadata.strategy, unplayable: usage.unplayable })
        .toEqual({ strategy: candidate.metadata.strategy, unplayable: 0 });
      expect(candidate.executionPlan.constraintRelaxation?.mode).toBe('strict');
    }
  });
});
