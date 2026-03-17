/**
 * Phase 3 / Phase 8: Diagnostics Integration Tests.
 *
 * Tests the canonical diagnostic types, V1 factor mappings, feasibility verdicts,
 * and end-to-end diagnostics population in solver output.
 *
 * V1 changes (Phase 8):
 * - Replaced ObjectiveComponents tests with V1CostBreakdown mapping tests
 * - Removed objectiveToCanonicalFactors, objectiveToGripDetail, performabilityToCanonicalFactors tests
 * - Added v1CostBreakdownToCanonicalFactors, v1CostBreakdownToV1Factors tests
 * - Removed gripDetail assertions (no longer populated in V1)
 */

import { describe, it, expect } from 'vitest';
import {
  type DiagnosticFactors,
  type FeasibilityVerdict,
  type DiagnosticsPayload,
  type V1CostBreakdown,
  type V1DiagnosticFactors,
  createZeroDiagnosticFactors,
  createZeroV1CostBreakdown,
  createZeroV1DiagnosticFactors,
  computeTopContributors,
  computeV1TopContributors,
  deriveFeasibilityVerdict,
} from '../../../src/types/diagnostics';
import {
  type PerformabilityObjective,
  createZeroPerformabilityComponents,
  combinePerformabilityComponents,
  v1CostBreakdownToCanonicalFactors,
  v1CostBreakdownToV1Factors,
} from '../../../src/engine/evaluation/objective';
import {
  runSolver,
  createTestPerformance,
  createAlternatingPerformance,
  createRepeatedNotePerformance,
  beatsToSeconds,
} from '../../helpers/testHelpers';

// ============================================================================
// Factory Functions
// ============================================================================

describe('createZeroDiagnosticFactors', () => {
  it('should return all-zero factors', () => {
    const factors = createZeroDiagnosticFactors();
    expect(factors.transition).toBe(0);
    expect(factors.gripNaturalness).toBe(0);
    expect(factors.alternation).toBe(0);
    expect(factors.handBalance).toBe(0);
    expect(factors.constraintPenalty).toBe(0);
    expect(factors.total).toBe(0);
  });
});

describe('createZeroV1CostBreakdown', () => {
  it('should return all-zero V1 cost breakdown', () => {
    const breakdown = createZeroV1CostBreakdown();
    expect(breakdown.fingerPreference).toBe(0);
    expect(breakdown.handShapeDeviation).toBe(0);
    expect(breakdown.transitionCost).toBe(0);
    expect(breakdown.handBalance).toBe(0);
    expect(breakdown.constraintPenalty).toBe(0);
    expect(breakdown.total).toBe(0);
  });
});

describe('createZeroV1DiagnosticFactors', () => {
  it('should return all-zero V1 diagnostic factors', () => {
    const factors = createZeroV1DiagnosticFactors();
    expect(factors.fingerPreference).toBe(0);
    expect(factors.handShapeDeviation).toBe(0);
    expect(factors.transitionCost).toBe(0);
    expect(factors.handBalance).toBe(0);
    expect(factors.total).toBe(0);
  });
});

// ============================================================================
// computeTopContributors
// ============================================================================

describe('computeTopContributors', () => {
  it('should return empty array for zero factors', () => {
    const factors = createZeroDiagnosticFactors();
    expect(computeTopContributors(factors)).toEqual([]);
  });

  it('should return factors ordered by descending magnitude', () => {
    const factors: DiagnosticFactors = {
      transition: 10,
      gripNaturalness: 30,
      alternation: 5,
      handBalance: 0,
      constraintPenalty: 20,
      total: 65,
    };
    const result = computeTopContributors(factors);
    expect(result).toEqual(['gripNaturalness', 'constraintPenalty', 'transition', 'alternation']);
  });

  it('should exclude zero-valued factors', () => {
    const factors: DiagnosticFactors = {
      transition: 10,
      gripNaturalness: 0,
      alternation: 0,
      handBalance: 0,
      constraintPenalty: 5,
      total: 15,
    };
    const result = computeTopContributors(factors);
    expect(result).toEqual(['transition', 'constraintPenalty']);
    expect(result).not.toContain('gripNaturalness');
    expect(result).not.toContain('alternation');
    expect(result).not.toContain('handBalance');
  });
});

// ============================================================================
// computeV1TopContributors
// ============================================================================

describe('computeV1TopContributors', () => {
  it('should return empty array for zero factors', () => {
    const factors = createZeroV1DiagnosticFactors();
    expect(computeV1TopContributors(factors)).toEqual([]);
  });

  it('should return V1 factor names ordered by descending magnitude', () => {
    const factors: V1DiagnosticFactors = {
      fingerPreference: 5,
      handShapeDeviation: 20,
      transitionCost: 10,
      handBalance: 2,
      total: 37,
    };
    const result = computeV1TopContributors(factors);
    expect(result).toEqual(['handShapeDeviation', 'transitionCost', 'fingerPreference', 'handBalance']);
  });
});

// ============================================================================
// deriveFeasibilityVerdict
// ============================================================================

describe('deriveFeasibilityVerdict', () => {
  it('should return feasible for a clean layout', () => {
    const verdict = deriveFeasibilityVerdict(0, 0, 0, 0, 16);
    expect(verdict.level).toBe('feasible');
    expect(verdict.reasons).toHaveLength(0);
    expect(verdict.summary).toContain('16');
  });

  it('should return infeasible when events are unplayable', () => {
    const verdict = deriveFeasibilityVerdict(3, 0, 0, 0, 16);
    expect(verdict.level).toBe('infeasible');
    expect(verdict.reasons.some(r => r.type === 'unplayable_event')).toBe(true);
  });

  it('should return infeasible when notes are unmapped', () => {
    const verdict = deriveFeasibilityVerdict(0, 0, 2, 0, 16);
    expect(verdict.level).toBe('infeasible');
    expect(verdict.reasons.some(r => r.type === 'unmapped_note')).toBe(true);
  });

  it('should return degraded for fallback grips', () => {
    const verdict = deriveFeasibilityVerdict(0, 0, 0, 4, 16);
    expect(verdict.level).toBe('degraded');
    expect(verdict.reasons.some(r => r.type === 'fallback_grip')).toBe(true);
    expect(verdict.reasons[0].eventCount).toBe(4);
  });

  it('should return degraded for hard events', () => {
    const verdict = deriveFeasibilityVerdict(0, 5, 0, 0, 16);
    expect(verdict.level).toBe('degraded');
    expect(verdict.reasons.some(r => r.type === 'hard_event')).toBe(true);
  });

  it('should prioritize infeasible over degraded', () => {
    const verdict = deriveFeasibilityVerdict(1, 5, 0, 2, 16);
    expect(verdict.level).toBe('infeasible');
    expect(verdict.reasons.some(r => r.type === 'unplayable_event')).toBe(true);
    expect(verdict.reasons.some(r => r.type === 'hard_event')).toBe(true);
    expect(verdict.reasons.some(r => r.type === 'fallback_grip')).toBe(true);
  });
});

// ============================================================================
// v1CostBreakdownToCanonicalFactors
// ============================================================================

describe('v1CostBreakdownToCanonicalFactors', () => {
  it('should map zero breakdown to zero factors', () => {
    const v1 = createZeroV1CostBreakdown();
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    expect(factors.transition).toBe(0);
    expect(factors.gripNaturalness).toBe(0);
    expect(factors.alternation).toBe(0);
    expect(factors.handBalance).toBe(0);
    expect(factors.constraintPenalty).toBe(0);
    expect(factors.total).toBe(0);
  });

  it('should collapse fingerPreference + handShapeDeviation into gripNaturalness', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 5,
      handShapeDeviation: 10,
      transitionCost: 0,
      handBalance: 0,
      constraintPenalty: 0,
      total: 15,
    };
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    expect(factors.gripNaturalness).toBe(15); // 5 + 10
  });

  it('should preserve transition, handBalance, constraintPenalty', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 0,
      handShapeDeviation: 0,
      transitionCost: 12,
      handBalance: 3,
      constraintPenalty: 1000,
      total: 1015,
    };
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    expect(factors.transition).toBe(12);
    expect(factors.handBalance).toBe(3);
    expect(factors.constraintPenalty).toBe(1000);
  });

  it('should always set alternation to 0', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 5,
      handShapeDeviation: 3,
      transitionCost: 10,
      handBalance: 1,
      constraintPenalty: 0,
      total: 19,
    };
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    expect(factors.alternation).toBe(0);
  });

  it('should compute total as sum of canonical factors', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 5,
      handShapeDeviation: 8,
      transitionCost: 3,
      handBalance: 1,
      constraintPenalty: 0,
      total: 99, // beam total may differ due to weighting
    };
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    // Total = transition + gripNaturalness + alternation + handBalance + constraintPenalty
    expect(factors.total).toBe(3 + 13 + 0 + 1 + 0); // = 17
  });
});

// ============================================================================
// v1CostBreakdownToV1Factors
// ============================================================================

describe('v1CostBreakdownToV1Factors', () => {
  it('should extract V1 factor fields', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 2,
      handShapeDeviation: 3,
      transitionCost: 5,
      handBalance: 1,
      constraintPenalty: 0,
      total: 11,
    };
    const factors = v1CostBreakdownToV1Factors(v1);
    expect(factors.fingerPreference).toBe(2);
    expect(factors.handShapeDeviation).toBe(3);
    expect(factors.transitionCost).toBe(5);
    expect(factors.handBalance).toBe(1);
    // V1DiagnosticFactors.total = sum of 4 factors (no constraintPenalty)
    expect(factors.total).toBe(11);
  });
});

// ============================================================================
// End-to-end: Solver output includes diagnostics
// ============================================================================

describe('Solver diagnostics population', () => {
  it('should attach diagnostics to a simple solver result', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 40, startTime: 1.0 },
    ]);

    const result = await runSolver(perf);

    expect(result.diagnostics).toBeDefined();
    const diag = result.diagnostics!;

    // Feasibility should be present
    expect(diag.feasibility).toBeDefined();
    expect(diag.feasibility.level).toBe('feasible');
    expect(diag.feasibility.reasons).toHaveLength(0);

    // Factors should have canonical names
    expect(diag.factors).toBeDefined();
    expect(typeof diag.factors.transition).toBe('number');
    expect(typeof diag.factors.gripNaturalness).toBe('number');
    expect(typeof diag.factors.alternation).toBe('number');
    expect(typeof diag.factors.handBalance).toBe('number');
    expect(typeof diag.factors.constraintPenalty).toBe('number');
    expect(typeof diag.factors.total).toBe('number');

    // V1: gripDetail is no longer populated (single handShapeDeviation metric)
    // gripNaturalness = fingerPreference + handShapeDeviation

    // Top contributors should be an array of canonical factor names
    expect(Array.isArray(diag.topContributors)).toBe(true);
    const validNames = ['transition', 'gripNaturalness', 'alternation', 'handBalance', 'constraintPenalty'];
    for (const name of diag.topContributors) {
      expect(validNames).toContain(name);
    }
  });

  it('should report feasible for a playable sequence', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const result = await runSolver(perf);
    expect(result.diagnostics!.feasibility.level).toBe('feasible');
  });

  it('should have non-zero factors for a real sequence', async () => {
    const notes: Array<{ noteNumber: number; startTime: number }> = [];
    for (let i = 0; i < 16; i++) {
      notes.push({
        noteNumber: 36 + (i % 8),
        startTime: i * beatsToSeconds(0.5),
      });
    }

    const perf = createTestPerformance(notes, 'Multi-note sequence');
    const result = await runSolver(perf);

    const diag = result.diagnostics!;
    expect(diag.factors.total).toBeGreaterThan(0);
    expect(diag.topContributors.length).toBeGreaterThan(0);
  });

  it('should have consistent total across factors', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 40, startTime: 0.25 },
      { noteNumber: 44, startTime: 0.5 },
      { noteNumber: 38, startTime: 0.75 },
    ]);

    const result = await runSolver(perf);
    const f = result.diagnostics!.factors;

    // Total should equal the sum of all 5 canonical factors
    const expectedTotal = f.transition + f.gripNaturalness + f.alternation + f.handBalance + f.constraintPenalty;
    expect(f.total).toBeCloseTo(expectedTotal, 6);
  });

  it('should attach diagnostics to empty performance', async () => {
    const perf = createTestPerformance([]);
    const result = await runSolver(perf);

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.feasibility.level).toBe('feasible');
    expect(result.diagnostics!.factors.total).toBe(0);
    expect(result.diagnostics!.topContributors).toHaveLength(0);
  });

  it('should handle alternating pattern with diagnostics', async () => {
    const perf = createAlternatingPerformance(36, 42, 8, 0.25);
    const result = await runSolver(perf);

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.feasibility.level).toBe('feasible');
    expect(result.diagnostics!.factors.transition).toBeGreaterThanOrEqual(0);
  });

  it('should produce topContributors ordered by magnitude', async () => {
    const notes: Array<{ noteNumber: number; startTime: number }> = [];
    for (let i = 0; i < 16; i++) {
      notes.push({
        noteNumber: 36 + (i % 8),
        startTime: i * beatsToSeconds(0.5),
      });
    }

    const perf = createTestPerformance(notes);
    const result = await runSolver(perf);
    const diag = result.diagnostics!;
    const f = diag.factors;

    for (let i = 0; i < diag.topContributors.length - 1; i++) {
      const current = f[diag.topContributors[i] as keyof DiagnosticFactors] as number;
      const next = f[diag.topContributors[i + 1] as keyof DiagnosticFactors] as number;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
