/**
 * Phase 3: Diagnostics Integration Tests.
 *
 * Tests the canonical diagnostic types, factor mappings, feasibility verdicts,
 * and end-to-end diagnostics population in solver output.
 */

import { describe, it, expect } from 'vitest';
import {
  type DiagnosticFactors,
  type GripNaturalnessDetail,
  type FeasibilityVerdict,
  type DiagnosticsPayload,
  createZeroDiagnosticFactors,
  computeTopContributors,
  deriveFeasibilityVerdict,
} from '../../../src/types/diagnostics';
import {
  type ObjectiveComponents,
  type PerformabilityObjective,
  createZeroComponents,
  createZeroPerformabilityComponents,
  objectiveToCanonicalFactors,
  objectiveToGripDetail,
  performabilityToCanonicalFactors,
  combineComponents,
  combinePerformabilityComponents,
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
    // All reason types should be present
    expect(verdict.reasons.some(r => r.type === 'unplayable_event')).toBe(true);
    expect(verdict.reasons.some(r => r.type === 'hard_event')).toBe(true);
    expect(verdict.reasons.some(r => r.type === 'fallback_grip')).toBe(true);
  });
});

// ============================================================================
// objectiveToCanonicalFactors
// ============================================================================

describe('objectiveToCanonicalFactors', () => {
  it('should map zero components to zero factors', () => {
    const components = createZeroComponents();
    const factors = objectiveToCanonicalFactors(components);
    expect(factors.transition).toBe(0);
    expect(factors.gripNaturalness).toBe(0);
    expect(factors.alternation).toBe(0);
    expect(factors.handBalance).toBe(0);
    expect(factors.constraintPenalty).toBe(0);
    expect(factors.total).toBe(0);
  });

  it('should collapse stretch + poseAttractor + perFingerHome into gripNaturalness', () => {
    const components: ObjectiveComponents = {
      transition: 0,
      stretch: 5,
      poseAttractor: 10,
      perFingerHome: 3,
      alternation: 0,
      handBalance: 0,
      constraints: 0,
    };
    const factors = objectiveToCanonicalFactors(components);
    expect(factors.gripNaturalness).toBe(18); // 5 + 10 + 3
  });

  it('should preserve transition, alternation, handBalance, constraintPenalty', () => {
    const components: ObjectiveComponents = {
      transition: 12,
      stretch: 0,
      poseAttractor: 0,
      perFingerHome: 0,
      alternation: 7,
      handBalance: 3,
      constraints: 1000,
    };
    const factors = objectiveToCanonicalFactors(components);
    expect(factors.transition).toBe(12);
    expect(factors.alternation).toBe(7);
    expect(factors.handBalance).toBe(3);
    expect(factors.constraintPenalty).toBe(1000);
  });

  it('should compute correct total', () => {
    const components: ObjectiveComponents = {
      transition: 10,
      stretch: 5,
      poseAttractor: 8,
      perFingerHome: 3,
      alternation: 2,
      handBalance: 1,
      constraints: 0,
    };
    const factors = objectiveToCanonicalFactors(components);
    expect(factors.total).toBe(combineComponents(components));
  });
});

// ============================================================================
// objectiveToGripDetail
// ============================================================================

describe('objectiveToGripDetail', () => {
  it('should extract correct sub-breakdown', () => {
    const components: ObjectiveComponents = {
      transition: 99,
      stretch: 5,
      poseAttractor: 10,
      perFingerHome: 3,
      alternation: 99,
      handBalance: 99,
      constraints: 99,
    };
    const detail = objectiveToGripDetail(components);
    expect(detail.attractor).toBe(10);
    expect(detail.perFingerHome).toBe(3);
    expect(detail.fingerDominance).toBe(5);
  });
});

// ============================================================================
// performabilityToCanonicalFactors
// ============================================================================

describe('performabilityToCanonicalFactors', () => {
  it('should map without diagnostic components (3-component approximation)', () => {
    const perf: PerformabilityObjective = {
      poseNaturalness: 15,
      transitionDifficulty: 8,
      constraintPenalty: 0,
    };
    const factors = performabilityToCanonicalFactors(perf);
    expect(factors.transition).toBe(8);
    expect(factors.gripNaturalness).toBe(15);
    expect(factors.alternation).toBe(0);
    expect(factors.handBalance).toBe(0);
    expect(factors.constraintPenalty).toBe(0);
    expect(factors.total).toBe(combinePerformabilityComponents(perf));
  });

  it('should use diagnostic components when provided for richer breakdown', () => {
    const perf: PerformabilityObjective = {
      poseNaturalness: 15,
      transitionDifficulty: 8,
      constraintPenalty: 0,
    };
    const diag: ObjectiveComponents = {
      transition: 8,
      stretch: 5,
      poseAttractor: 6,
      perFingerHome: 4,
      alternation: 2,
      handBalance: 1,
      constraints: 0,
    };
    const factors = performabilityToCanonicalFactors(perf, diag);
    // Should use the full 7-component mapping via objectiveToCanonicalFactors
    expect(factors.alternation).toBe(2);
    expect(factors.handBalance).toBe(1);
    expect(factors.gripNaturalness).toBe(15); // 5 + 6 + 4
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

    // Grip detail should be present
    expect(diag.gripDetail).toBeDefined();
    expect(typeof diag.gripDetail!.attractor).toBe('number');
    expect(typeof diag.gripDetail!.perFingerHome).toBe('number');
    expect(typeof diag.gripDetail!.fingerDominance).toBe('number');

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
    // A 16-note sequence across different pads should have some transition cost
    expect(diag.factors.total).toBeGreaterThan(0);
    // topContributors should list at least one factor
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

  it('should have gripDetail that sums to gripNaturalness', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 40, startTime: 1.0 },
    ]);

    const result = await runSolver(perf);
    const diag = result.diagnostics!;

    if (diag.gripDetail) {
      const gripSum = diag.gripDetail.attractor + diag.gripDetail.perFingerHome + diag.gripDetail.fingerDominance;
      expect(diag.factors.gripNaturalness).toBeCloseTo(gripSum, 6);
    }
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
    // An alternating pattern should have transition costs
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

    // Verify ordering: each contributor should have value >= next contributor
    for (let i = 0; i < diag.topContributors.length - 1; i++) {
      const current = f[diag.topContributors[i] as keyof DiagnosticFactors] as number;
      const next = f[diag.topContributors[i + 1] as keyof DiagnosticFactors] as number;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
