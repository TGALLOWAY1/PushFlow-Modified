/**
 * Nightly: TEST MIDI 1 through Annealing "Thorough" (optimizationMode 'deep'),
 * exactly as useAutoAnalysis.generateFull runs it, and reports the duration in
 * the job summary.
 *
 * Since S3.4 (P3-8) Thorough runs under DEEP_ANNEALING_CONFIG's budgets: 3,200
 * iterations over its four runs and at most 2 minutes per candidate. Unbudgeted
 * it took about 50 minutes in CI; the run must now finish within its budget
 * (see deepBudget.ts) with 0 unplayable events.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { type CandidateSolution } from '../../src/types/candidateSolution';
import { countHandUsage } from '../helpers/testHelpers';
import { suggestedTestMidi1, generateBeamAnnealingAsApp } from '../helpers/testMidi1';
import { reportDuration } from './reportDuration';
import { DEEP_RUN_BUDGET_MS, expectBudgetRecorded, describeStops } from './deepBudget';

describe('TEST MIDI 1 · annealing Thorough (deep)', () => {
  let candidates: CandidateSolution[];
  let durationMs: number;

  beforeAll(async () => {
    const state = await suggestedTestMidi1();
    const start = performance.now();
    candidates = await generateBeamAnnealingAsApp(state, 'deep');
    durationMs = performance.now() - start;
    reportDuration(`Deep annealing, TEST MIDI 1 (${describeStops(candidates)})`, durationMs);
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

  it('P3-8: finishes within its time budget', () => {
    expect(durationMs).toBeLessThanOrEqual(DEEP_RUN_BUDGET_MS);
  });

  it('every candidate records the budgets and why it stopped', () => {
    expectBudgetRecorded(candidates);
  });
});
