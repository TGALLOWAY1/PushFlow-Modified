/**
 * Phase 5: Baseline-aware compare tests.
 *
 * Validates that compareWithDiagnostics and the three workflow-specific
 * compare functions produce correct per-factor deltas, feasibility changes,
 * layout diversity info, and human-readable summaries.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type ExecutionPlanResult, type DifficultyBreakdown } from '../../../src/types/executionPlan';
import { type DiagnosticsPayload, type DiagnosticFactors } from '../../../src/types/diagnostics';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import {
  compareWithDiagnostics,
  compareWorkingVsActive,
  compareCandidateVsActive,
  compareCandidateVsCandidate,
} from '../../../src/engine/analysis/baselineCompare';

// ============================================================================
// Factories
// ============================================================================

function makeVoice(id: string, name: string, midi: number): Voice {
  return {
    id,
    name,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: midi,
    color: '#000',
  };
}

const v1 = makeVoice('v1', 'Kick', 36);
const v2 = makeVoice('v2', 'Snare', 38);
const v3 = makeVoice('v3', 'HiHat', 42);

function makeLayout(id: string, padToVoice: Record<string, Voice>, role?: string): Layout {
  return {
    id,
    name: `Layout ${id}`,
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: (role ?? 'active') as 'active' | 'working' | 'saved',
  };
}

function makeDiagnostics(overrides?: Partial<DiagnosticFactors>): DiagnosticsPayload {
  const factors: DiagnosticFactors = {
    transition: 2.0,
    gripNaturalness: 1.5,
    alternation: 0.5,
    handBalance: 0.3,
    constraintPenalty: 0.0,
    total: 4.3,
    ...overrides,
  };

  return {
    feasibility: {
      level: 'feasible',
      summary: 'All events are playable',
      reasons: [],
    },
    factors,
    topContributors: ['transition', 'gripNaturalness'],
  };
}

function makePlan(score: number, diagnostics?: DiagnosticsPayload): ExecutionPlanResult {
  const avgMetrics: DifficultyBreakdown = {
    movement: 1.0, stretch: 0.5, drift: 0.2, bounce: 0.1, fatigue: 0.05, crossover: 0.1, total: score,
  };

  return {
    score,
    unplayableCount: 0,
    hardCount: 0,
    fingerAssignments: [],
    fingerUsageStats: {},
    fatigueMap: {},
    averageDrift: 0.1,
    averageMetrics: avgMetrics,
    diagnostics,
  };
}

function makeCandidate(
  id: string,
  layout: Layout,
  plan: ExecutionPlanResult,
  strategy: string,
): CandidateSolution {
  return {
    id,
    layout,
    executionPlan: plan,
    difficultyAnalysis: {
      overallScore: plan.score,
      passages: [],
      bindingConstraints: [],
    },
    tradeoffProfile: {
      playability: 0.8,
      compactness: 0.7,
      handBalance: 0.6,
      transitionEfficiency: 0.7,
      learnability: 0.8,
      robustness: 0.7,
    },
    metadata: { strategy, seed: 42 },
  };
}

// ============================================================================
// Tests: compareWithDiagnostics
// ============================================================================

describe('compareWithDiagnostics', () => {
  it('should compute per-factor deltas between two plans', () => {
    const layoutA = makeLayout('a', { '0,0': v1, '0,2': v2 });
    const layoutB = makeLayout('b', { '0,0': v1, '0,2': v2 });

    const diagA = makeDiagnostics({ transition: 3.0, gripNaturalness: 1.0, total: 5.0 });
    const diagB = makeDiagnostics({ transition: 2.0, gripNaturalness: 2.0, total: 5.0 });

    const planA = makePlan(5.0, diagA);
    const planB = makePlan(5.0, diagB);

    const result = compareWithDiagnostics(
      layoutA, planA, layoutB, planB,
      'working-vs-active', 'Active', 'Working',
    );

    expect(result.mode).toBe('working-vs-active');
    expect(result.labelA).toBe('Active');
    expect(result.labelB).toBe('Working');
    expect(result.factorDeltas).toHaveLength(5);

    // Transition: B (2.0) is lower than A (3.0), delta = -1.0, B wins
    const transitionDelta = result.factorDeltas.find(f => f.factor === 'transition');
    expect(transitionDelta).toBeDefined();
    expect(transitionDelta!.deltaValue).toBeCloseTo(-1.0);
    expect(transitionDelta!.winner).toBe('B');

    // gripNaturalness: B (2.0) > A (1.0), delta = +1.0, A wins
    const gripDelta = result.factorDeltas.find(f => f.factor === 'gripNaturalness');
    expect(gripDelta).toBeDefined();
    expect(gripDelta!.deltaValue).toBeCloseTo(1.0);
    expect(gripDelta!.winner).toBe('A');
  });

  it('should mark tie when deltas are near zero', () => {
    const layout = makeLayout('a', { '0,0': v1 });
    const diag = makeDiagnostics({ transition: 2.0, total: 4.0 });
    const plan = makePlan(4.0, diag);

    const result = compareWithDiagnostics(
      layout, plan, layout, plan,
      'working-vs-active', 'A', 'B',
    );

    for (const fd of result.factorDeltas) {
      expect(fd.winner).toBe('tie');
      expect(fd.deltaValue).toBeCloseTo(0);
    }
    expect(result.overallWinner).toBe('tie');
  });

  it('should detect layout diversity when voices move', () => {
    const layoutA = makeLayout('a', { '0,0': v1, '0,2': v2, '2,4': v3 });
    const layoutB = makeLayout('b', { '0,0': v1, '4,6': v2, '6,2': v3 }); // v2 and v3 moved

    const diag = makeDiagnostics();
    const planA = makePlan(4.0, diag);
    const planB = makePlan(3.5, diag);

    const result = compareWithDiagnostics(
      layoutA, planA, layoutB, planB,
      'candidate-vs-active', 'Active', 'Candidate',
    );

    expect(result.layoutChanges.voicesMoved).toBeGreaterThan(0);
    expect(result.layoutChanges.totalVoices).toBeGreaterThan(0);
    expect(result.layoutChanges.diversityLevel).toBeDefined();
  });

  it('should detect feasibility change', () => {
    const layout = makeLayout('a', { '0,0': v1 });

    const diagFeasible = makeDiagnostics();
    const diagDegraded: DiagnosticsPayload = {
      ...makeDiagnostics(),
      feasibility: {
        level: 'degraded',
        summary: 'Degraded playability',
        reasons: [{ type: 'hard_event', message: '3 hard events', eventCount: 3 }],
      },
    };

    const planA = makePlan(4.0, diagFeasible);
    const planB = makePlan(5.0, diagDegraded);

    const result = compareWithDiagnostics(
      layout, planA, layout, planB,
      'working-vs-active', 'Active', 'Working',
    );

    expect(result.feasibility.changed).toBe(true);
    expect(result.feasibility.levelA).toBe('feasible');
    expect(result.feasibility.levelB).toBe('degraded');
  });

  it('should include summary text', () => {
    const layout = makeLayout('a', { '0,0': v1, '0,2': v2 });
    const diagA = makeDiagnostics({ transition: 3.0, total: 5.0 });
    const diagB = makeDiagnostics({ transition: 1.0, total: 3.0 });

    const planA = makePlan(5.0, diagA);
    const planB = makePlan(3.0, diagB);

    const result = compareWithDiagnostics(
      layout, planA, layout, planB,
      'working-vs-active', 'Active', 'Working',
    );

    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(10);
  });

  it('should handle plans without diagnostics gracefully', () => {
    const layout = makeLayout('a', { '0,0': v1 });
    const planA = makePlan(5.0); // no diagnostics
    const planB = makePlan(3.0); // no diagnostics

    const result = compareWithDiagnostics(
      layout, planA, layout, planB,
      'working-vs-active', 'A', 'B',
    );

    expect(result.factorDeltas).toHaveLength(0);
    expect(result.totalDelta).toBeCloseTo(-2.0);
    expect(result.overallWinner).toBe('B');
  });
});

// ============================================================================
// Tests: Workflow-specific compare functions
// ============================================================================

describe('compareWorkingVsActive', () => {
  it('should label sides correctly', () => {
    const layout = makeLayout('a', { '0,0': v1 });
    const diag = makeDiagnostics();
    const plan = makePlan(4.0, diag);

    const result = compareWorkingVsActive(layout, plan, layout, plan);

    expect(result.mode).toBe('working-vs-active');
    expect(result.labelA).toBe('Active Layout');
    expect(result.labelB).toBe('Working Layout');
  });

  it('should show Working as winner when it has lower cost', () => {
    const layout = makeLayout('a', { '0,0': v1 });
    const diagActive = makeDiagnostics({ total: 6.0 });
    const diagWorking = makeDiagnostics({ total: 3.0 });

    const activePlan = makePlan(6.0, diagActive);
    const workingPlan = makePlan(3.0, diagWorking);

    const result = compareWorkingVsActive(layout, activePlan, layout, workingPlan);

    expect(result.overallWinner).toBe('B'); // B = Working
    expect(result.totalDelta).toBeLessThan(0); // negative = B is better
  });
});

describe('compareCandidateVsActive', () => {
  it('should label sides with candidate strategy', () => {
    const activeLayout = makeLayout('active', { '0,0': v1, '0,2': v2 });
    const candidateLayout = makeLayout('cand', { '0,0': v1, '4,6': v2 });

    const diag = makeDiagnostics();
    const activePlan = makePlan(5.0, diag);
    const candidatePlan = makePlan(3.5, diag);

    const candidate = makeCandidate('c1', candidateLayout, candidatePlan, 'annealing');

    const result = compareCandidateVsActive(activeLayout, activePlan, candidate);

    expect(result.mode).toBe('candidate-vs-active');
    expect(result.labelA).toBe('Active Layout');
    expect(result.labelB).toContain('annealing');
  });
});

describe('compareCandidateVsCandidate', () => {
  it('should compare two candidates directly', () => {
    const layoutA = makeLayout('la', { '0,0': v1, '0,2': v2 });
    const layoutB = makeLayout('lb', { '2,4': v1, '4,6': v2 });

    const diagA = makeDiagnostics({ transition: 3.0, total: 5.0 });
    const diagB = makeDiagnostics({ transition: 1.5, total: 3.5 });

    const planA = makePlan(5.0, diagA);
    const planB = makePlan(3.5, diagB);

    const candA = makeCandidate('c1', layoutA, planA, 'annealing');
    const candB = makeCandidate('c2', layoutB, planB, 'beam');

    const result = compareCandidateVsCandidate(candA, candB);

    expect(result.mode).toBe('candidate-vs-candidate');
    expect(result.labelA).toContain('annealing');
    expect(result.labelB).toContain('beam');
    expect(result.overallWinner).toBe('B'); // B has lower total
  });

  it('should show tie when candidates are equal', () => {
    const layout = makeLayout('l', { '0,0': v1 });
    const diag = makeDiagnostics();
    const plan = makePlan(4.0, diag);

    const candA = makeCandidate('c1', layout, plan, 'baseline');
    const candB = makeCandidate('c2', layout, plan, 'baseline');

    const result = compareCandidateVsCandidate(candA, candB);

    expect(result.overallWinner).toBe('tie');
  });
});
