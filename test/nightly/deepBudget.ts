import { expect } from 'vitest';
import { type CandidateSolution } from '../../src/types/candidateSolution';
import { DEEP_ANNEALING_CONFIG } from '../../src/types/engineConfig';

/** Thorough builds three candidates, each annealed under DEEP_ANNEALING_CONFIG's budgets. */
export const DEEP_CANDIDATES = 3;

/**
 * What a Thorough run may take beyond its search budgets (S3.4, P3-8). Each
 * candidate also seeds its layout, runs an initial and a final beam evaluation
 * (the final one at width 50) and is scored; each restart can overrun its share
 * of the time by at most one iteration. Locally that came to about 1 s for the
 * whole run; 30 s leaves room for a loaded CI runner.
 */
export const OVERHEAD_ALLOWANCE_MS = 30_000;

/** The whole run's budget: every candidate's time budget plus the allowance. */
export const DEEP_RUN_BUDGET_MS = DEEP_CANDIDATES * DEEP_ANNEALING_CONFIG.timeBudgetMs! + OVERHEAD_ALLOWANCE_MS;

/** Every candidate ran under Thorough's budgets and says why it stopped. */
export function expectBudgetRecorded(candidates: CandidateSolution[]): void {
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect(['completed', 'time_budget']).toContain(candidate.stopReason);
    expect(candidate.telemetry).toMatchObject({
      iterationBudget: DEEP_ANNEALING_CONFIG.iterationBudget,
      timeBudgetMs: DEEP_ANNEALING_CONFIG.timeBudgetMs,
      iterationsPlanned: DEEP_ANNEALING_CONFIG.iterationBudget,
    });
    expect(candidate.telemetry!.iterationsCompleted).toBeLessThanOrEqual(DEEP_ANNEALING_CONFIG.iterationBudget!);
    expect(candidate.annealingTrace!.length).toBe(candidate.telemetry!.iterationsCompleted);
    // Every restart started, whatever the clock did.
    expect(new Set(candidate.annealingTrace!.map(s => s.restartIndex)).size).toBe(DEEP_ANNEALING_CONFIG.restartCount + 1);
  }
}

/** "3 candidates: completed 2, time_budget 1 · 2,900–3,200 iterations" for the job summary. */
export function describeStops(candidates: CandidateSolution[]): string {
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c.stopReason ?? 'unknown', (counts.get(c.stopReason ?? 'unknown') ?? 0) + 1);
  const iterations = candidates.map(c => c.telemetry?.iterationsCompleted ?? 0);
  return `${candidates.length} candidates: ${[...counts].map(([k, n]) => `${k} ${n}`).join(', ')} · ${Math.min(...iterations)}–${Math.max(...iterations)} iterations`;
}
