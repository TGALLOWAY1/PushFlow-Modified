/**
 * Phase 5: Event explainer tests.
 *
 * Validates that explainEvent, explainTransition, and identifyHardMoments
 * produce correct canonical factor mappings, human-readable explanations,
 * and difficulty rankings.
 */

import { describe, it, expect } from 'vitest';
import { type FingerAssignment, type DifficultyBreakdown, type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { type Transition, type TransitionMetrics } from '../../../src/engine/evaluation/transitionAnalyzer';
import { type AnalyzedMoment } from '../../../src/engine/evaluation/eventMetrics';
import {
  explainEvent,
  explainTransition,
  identifyHardMoments,
} from '../../../src/engine/analysis/eventExplainer';

// ============================================================================
// Factories
// ============================================================================

function makeAssignment(overrides: Partial<FingerAssignment>): FingerAssignment {
  return {
    noteNumber: 36,
    startTime: 0.0,
    assignedHand: 'right',
    finger: 'index',
    cost: 0.5,
    difficulty: 'Easy',
    row: 0,
    col: 0,
    ...overrides,
  };
}

function makeBreakdown(overrides?: Partial<DifficultyBreakdown>): DifficultyBreakdown {
  return {
    movement: 0,
    stretch: 0,
    drift: 0,
    bounce: 0,
    fatigue: 0,
    crossover: 0,
    total: 0,
    ...overrides,
  };
}

function makeMoment(
  timestamp: number,
  assignments: FingerAssignment[],
  metricsOverrides?: Partial<{ compositeDifficultyScore: number; polyphony: number }>,
): AnalyzedMoment {
  const pads = assignments
    .filter(a => a.row !== undefined && a.col !== undefined)
    .map(a => `${a.row},${a.col}`);

  return {
    timestamp,
    eventIndex: 0,
    assignments,
    pads,
    metrics: {
      polyphony: metricsOverrides?.polyphony ?? assignments.length,
      anatomicalStretchScore: 0,
      compositeDifficultyScore: metricsOverrides?.compositeDifficultyScore ?? 0.3,
      averageCost: 0.5,
      maxCost: 1.0,
    },
  };
}

function makeTransition(
  fromMoment: AnalyzedMoment,
  toMoment: AnalyzedMoment,
  metricsOverrides?: Partial<TransitionMetrics>,
): Transition {
  return {
    fromIndex: 0,
    toIndex: 1,
    fromMoment,
    toMoment,
    metrics: {
      timeDeltaMs: (toMoment.timestamp - fromMoment.timestamp) * 1000,
      gridDistance: 2,
      handSwitch: false,
      fingerChange: true,
      speedPressure: 0.3,
      anatomicalStretchScore: 0.1,
      compositeDifficultyScore: 0.3,
      ...metricsOverrides,
    },
  };
}

function makePlan(assignments: FingerAssignment[]): ExecutionPlanResult {
  const avgMetrics: DifficultyBreakdown = {
    movement: 1.0, stretch: 0.5, drift: 0.2, bounce: 0.1, fatigue: 0.05, crossover: 0.1, total: 2.0,
  };

  return {
    score: 2.0,
    unplayableCount: 0,
    hardCount: 0,
    fingerAssignments: assignments,
    fingerUsageStats: {},
    fatigueMap: {},
    averageDrift: 0.1,
    averageMetrics: avgMetrics,
  };
}

// ============================================================================
// Tests: explainEvent
// ============================================================================

describe('explainEvent', () => {
  it('should map legacy breakdown fields to canonical factors', () => {
    const assignment = makeAssignment({
      cost: 2.5,
      difficulty: 'Hard',
      costBreakdown: makeBreakdown({
        movement: 1.5,
        stretch: 0.8,
        drift: 0.2,
        total: 2.5,
      }),
    });

    const explanation = explainEvent(assignment, 0);

    expect(explanation.eventIndex).toBe(0);
    expect(explanation.noteNumber).toBe(36);
    expect(explanation.canonicalFactors.length).toBeGreaterThan(0);

    // movement -> transition
    const transitionFactor = explanation.canonicalFactors.find(f => f.factor === 'transition');
    expect(transitionFactor).toBeDefined();
    expect(transitionFactor!.value).toBeCloseTo(1.5);

    // stretch -> gripNaturalness
    const gripFactor = explanation.canonicalFactors.find(f => f.factor === 'gripNaturalness');
    expect(gripFactor).toBeDefined();
    expect(gripFactor!.value).toBeGreaterThan(0);
  });

  it('should identify dominant factor as highest-value canonical factor', () => {
    const assignment = makeAssignment({
      cost: 3.0,
      difficulty: 'Hard',
      costBreakdown: makeBreakdown({
        movement: 0.5,
        stretch: 2.0,
        total: 3.0,
      }),
    });

    const explanation = explainEvent(assignment, 0);

    // stretch (2.0) maps to gripNaturalness and is highest
    expect(explanation.dominantFactor).toBe('gripNaturalness');
  });

  it('should handle unplayable events', () => {
    const assignment = makeAssignment({
      assignedHand: 'Unplayable',
      finger: null,
      cost: 0,
      difficulty: 'Unplayable',
    });

    const explanation = explainEvent(assignment, 5);

    expect(explanation.difficulty).toBe('Unplayable');
    expect(explanation.explanation).toContain('unplayable');
  });

  it('should produce simple explanation for easy events', () => {
    const assignment = makeAssignment({
      cost: 0.2,
      difficulty: 'Easy',
    });

    const explanation = explainEvent(assignment, 0);

    expect(explanation.difficulty).toBe('Easy');
    expect(explanation.explanation).toContain('easy');
  });

  it('should handle missing costBreakdown gracefully', () => {
    const assignment = makeAssignment({
      cost: 1.0,
      difficulty: 'Medium',
    });
    // No costBreakdown set

    const explanation = explainEvent(assignment, 0);

    expect(explanation.canonicalFactors).toHaveLength(0);
    expect(explanation.dominantFactor).toBe('unknown');
  });

  it('should sort canonical factors by value descending', () => {
    const assignment = makeAssignment({
      cost: 3.0,
      difficulty: 'Hard',
      costBreakdown: makeBreakdown({
        movement: 0.5,
        stretch: 2.0,
        bounce: 1.0,
        total: 3.5,
      }),
    });

    const explanation = explainEvent(assignment, 0);

    // Sorted descending by value
    for (let i = 1; i < explanation.canonicalFactors.length; i++) {
      expect(explanation.canonicalFactors[i].value)
        .toBeLessThanOrEqual(explanation.canonicalFactors[i - 1].value);
    }
  });

  it('should map bounce to alternation factor', () => {
    const assignment = makeAssignment({
      cost: 1.5,
      difficulty: 'Medium',
      costBreakdown: makeBreakdown({
        bounce: 1.2,
        total: 1.5,
      }),
    });

    const explanation = explainEvent(assignment, 0);

    const alternation = explanation.canonicalFactors.find(f => f.factor === 'alternation');
    expect(alternation).toBeDefined();
    expect(alternation!.value).toBeCloseTo(1.2);
    expect(alternation!.label).toContain('alternation');
  });

  it('should map crossover to handBalance factor', () => {
    const assignment = makeAssignment({
      cost: 0.8,
      difficulty: 'Medium',
      costBreakdown: makeBreakdown({
        crossover: 0.7,
        total: 0.8,
      }),
    });

    const explanation = explainEvent(assignment, 0);

    const handBalance = explanation.canonicalFactors.find(f => f.factor === 'handBalance');
    expect(handBalance).toBeDefined();
    expect(handBalance!.value).toBeCloseTo(0.7);
  });
});

// ============================================================================
// Tests: explainTransition
// ============================================================================

describe('explainTransition', () => {
  it('should identify easy transitions', () => {
    const from = makeMoment(0.0, [makeAssignment({ startTime: 0.0 })]);
    const to = makeMoment(1.0, [makeAssignment({ startTime: 1.0 })]);
    const transition = makeTransition(from, to, { compositeDifficultyScore: 0.1 });

    const explanation = explainTransition(transition);

    expect(explanation.explanation).toContain('easy');
    expect(explanation.compositeDifficulty).toBeLessThan(0.2);
  });

  it('should identify hard transitions with contributors', () => {
    const from = makeMoment(0.0, [makeAssignment({ startTime: 0.0 })]);
    const to = makeMoment(0.1, [makeAssignment({ startTime: 0.1 })]);
    const transition = makeTransition(from, to, {
      compositeDifficultyScore: 0.8,
      speedPressure: 0.9,
      gridDistance: 5,
      handSwitch: true,
    });

    const explanation = explainTransition(transition);

    expect(explanation.compositeDifficulty).toBeGreaterThan(0.5);
    expect(explanation.contributors).toContain('high speed pressure');
    expect(explanation.contributors).toContain('large hand movement');
    expect(explanation.contributors).toContain('hand switch');
  });

  it('should include time and distance metrics', () => {
    const from = makeMoment(1.0, [makeAssignment({ startTime: 1.0 })]);
    const to = makeMoment(1.5, [makeAssignment({ startTime: 1.5 })]);
    const transition = makeTransition(from, to);

    const explanation = explainTransition(transition);

    expect(explanation.fromTime).toBeCloseTo(1.0);
    expect(explanation.toTime).toBeCloseTo(1.5);
    expect(explanation.timeDeltaMs).toBeCloseTo(500);
    expect(explanation.gridDistance).toBe(2);
  });

  it('should detect finger stretch as contributor', () => {
    const from = makeMoment(0.0, [makeAssignment({ startTime: 0.0 })]);
    const to = makeMoment(0.5, [makeAssignment({ startTime: 0.5 })]);
    const transition = makeTransition(from, to, {
      compositeDifficultyScore: 0.6,
      anatomicalStretchScore: 0.8,
    });

    const explanation = explainTransition(transition);

    expect(explanation.contributors).toContain('finger stretch');
  });

  it('should label moderate transitions correctly', () => {
    const from = makeMoment(0.0, [makeAssignment({ startTime: 0.0 })]);
    const to = makeMoment(0.5, [makeAssignment({ startTime: 0.5 })]);
    const transition = makeTransition(from, to, { compositeDifficultyScore: 0.5 });

    const explanation = explainTransition(transition);

    expect(explanation.explanation).toContain('moderately hard');
  });
});

// ============================================================================
// Tests: identifyHardMoments
// ============================================================================

describe('identifyHardMoments', () => {
  it('should return empty array for plan with no assignments', () => {
    const plan = makePlan([]);
    const reports = identifyHardMoments(plan);
    expect(reports).toHaveLength(0);
  });

  it('should identify hard moments and rank by difficulty', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({
        noteNumber: 36, startTime: 0.0, cost: 0.2, difficulty: 'Easy',
        costBreakdown: makeBreakdown({ movement: 0.1, total: 0.2 }),
      }),
      makeAssignment({
        noteNumber: 38, startTime: 0.5, cost: 3.0, difficulty: 'Hard',
        costBreakdown: makeBreakdown({ movement: 2.0, stretch: 1.0, total: 3.0 }),
      }),
      makeAssignment({
        noteNumber: 42, startTime: 1.0, cost: 1.0, difficulty: 'Medium',
        costBreakdown: makeBreakdown({ movement: 0.5, bounce: 0.5, total: 1.0 }),
      }),
    ];

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan, 3);

    expect(reports.length).toBeGreaterThan(0);

    // Reports should be sorted by difficulty descending
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i].momentDifficulty).toBeLessThanOrEqual(reports[i - 1].momentDifficulty);
    }
  });

  it('should include event explanations with canonical factors', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({
        noteNumber: 36, startTime: 0.0, cost: 2.5, difficulty: 'Hard',
        costBreakdown: makeBreakdown({ movement: 1.5, stretch: 1.0, total: 2.5 }),
      }),
    ];

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan, 1);

    expect(reports.length).toBe(1);
    expect(reports[0].events.length).toBe(1);
    expect(reports[0].events[0].canonicalFactors.length).toBeGreaterThan(0);
    expect(reports[0].events[0].dominantFactor).toBeTruthy();
  });

  it('should include summary text for each moment', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({
        noteNumber: 36, startTime: 0.0, cost: 3.0, difficulty: 'Hard',
        costBreakdown: makeBreakdown({ movement: 2.0, total: 3.0 }),
      }),
      makeAssignment({
        noteNumber: 38, startTime: 0.5, cost: 0.2, difficulty: 'Easy',
        costBreakdown: makeBreakdown({ movement: 0.1, total: 0.2 }),
      }),
    ];

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan, 2);

    for (const report of reports) {
      expect(report.summary).toBeTruthy();
      expect(typeof report.summary).toBe('string');
    }
  });

  it('should respect topK parameter', () => {
    const assignments: FingerAssignment[] = [];
    for (let i = 0; i < 10; i++) {
      assignments.push(makeAssignment({
        noteNumber: 36 + i,
        startTime: i * 0.5,
        cost: Math.random() * 3,
        difficulty: 'Medium',
        costBreakdown: makeBreakdown({ movement: Math.random(), total: Math.random() * 3 }),
      }));
    }

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan, 3);

    expect(reports.length).toBeLessThanOrEqual(3);
  });

  it('should handle simultaneous events (chords)', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({
        noteNumber: 36, startTime: 0.0, cost: 1.5, difficulty: 'Medium',
        row: 0, col: 0,
        costBreakdown: makeBreakdown({ stretch: 1.0, total: 1.5 }),
      }),
      makeAssignment({
        noteNumber: 38, startTime: 0.0, cost: 2.0, difficulty: 'Hard',
        row: 2, col: 4,
        costBreakdown: makeBreakdown({ stretch: 1.5, total: 2.0 }),
      }),
    ];

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan, 1);

    // Both events at same time should be in same moment
    expect(reports.length).toBe(1);
    expect(reports[0].events.length).toBe(2);
  });

  it('should default topK to 5', () => {
    const assignments: FingerAssignment[] = [];
    for (let i = 0; i < 20; i++) {
      assignments.push(makeAssignment({
        noteNumber: 36 + (i % 12),
        startTime: i * 0.5,
        cost: 1.0 + Math.random(),
        difficulty: 'Medium',
        costBreakdown: makeBreakdown({ movement: 0.5, total: 1.0 }),
      }));
    }

    const plan = makePlan(assignments);
    const reports = identifyHardMoments(plan);

    expect(reports.length).toBeLessThanOrEqual(5);
  });
});
