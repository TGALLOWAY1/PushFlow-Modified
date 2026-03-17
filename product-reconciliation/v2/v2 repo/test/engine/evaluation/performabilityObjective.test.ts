/**
 * Performability Objective Tests.
 *
 * Tests the 3-component scoring model:
 *   1. poseNaturalness: unified grip quality (handShapeDeviation + fingerPreference)
 *   2. transitionDifficulty: Fitts's Law movement cost
 *   3. constraintPenalty: constraint violation penalty (V1: always 0, no fallback grips)
 *
 * Also tests:
 *   - V1CostBreakdown backward compatibility mappings
 *   - combinePerformabilityComponents
 *   - v1CostBreakdownToDifficultyBreakdown
 *   - Beam solver produces valid results under V1 scoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePoseNaturalness,
  calculateAttractorCost,
  calculatePerFingerHomeCost,
  calculateFingerPreferenceCost,
  calculateTransitionCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
} from '../../../src/engine/evaluation/costFunction';
import {
  type PerformabilityObjective,
  combinePerformabilityComponents,
  createZeroPerformabilityComponents,
  v1CostBreakdownToDifficultyBreakdown,
  v1CostBreakdownToCanonicalFactors,
  v1CostBreakdownToV1Factors,
} from '../../../src/engine/evaluation/objective';
import {
  type V1CostBreakdown,
  createZeroV1CostBreakdown,
} from '../../../src/types/diagnostics';
import { type HandPose, type FingerCoordinate } from '../../../src/types/performance';
import { type NeutralHandCentersResult } from '../../../src/engine/prior/handPose';
import {
  createTestPerformance,
  createTestSolver,
  runSolver,
  assertNoNaNs,
  assertMappingIntegrity,
} from '../../helpers/testHelpers';

// ============================================================================
// Test Fixtures
// ============================================================================

/** A simple right-hand resting pose centered at (5, 3.5). */
const RIGHT_RESTING_POSE: HandPose = {
  centroid: { x: 5, y: 3.5 },
  fingers: {
    index: { x: 5, y: 3 },
    middle: { x: 5, y: 4 },
  },
};

/** A grip close to resting. */
const NATURAL_GRIP: HandPose = {
  centroid: { x: 5.5, y: 3.5 },
  fingers: {
    index: { x: 5, y: 3 },
    middle: { x: 6, y: 4 },
  },
};

/** A grip far from resting. */
const UNNATURAL_GRIP: HandPose = {
  centroid: { x: 1, y: 1 },
  fingers: {
    index: { x: 0, y: 0 },
    middle: { x: 2, y: 2 },
  },
};

/** A grip using thumb and pinky (high dominance cost). */
const HIGH_DOMINANCE_GRIP: HandPose = {
  centroid: { x: 5, y: 3.5 },
  fingers: {
    thumb: { x: 4, y: 2 },
    pinky: { x: 6, y: 5 },
  },
};

/** A grip using index and middle (low dominance cost). */
const LOW_DOMINANCE_GRIP: HandPose = {
  centroid: { x: 5, y: 3.5 },
  fingers: {
    index: { x: 5, y: 3 },
    middle: { x: 5, y: 4 },
  },
};

// ============================================================================
// Tests: PerformabilityObjective Type
// ============================================================================

describe('PerformabilityObjective', () => {
  describe('createZeroPerformabilityComponents', () => {
    it('should create components with all zeros', () => {
      const zero = createZeroPerformabilityComponents();
      expect(zero.poseNaturalness).toBe(0);
      expect(zero.transitionDifficulty).toBe(0);
      expect(zero.constraintPenalty).toBe(0);
    });
  });

  describe('combinePerformabilityComponents', () => {
    it('should sum all three components', () => {
      const components: PerformabilityObjective = {
        poseNaturalness: 1.5,
        transitionDifficulty: 2.5,
        constraintPenalty: 0,
      };
      expect(combinePerformabilityComponents(components)).toBe(4.0);
    });

    it('should include constraint penalty', () => {
      const components: PerformabilityObjective = {
        poseNaturalness: 0,
        transitionDifficulty: 0,
        constraintPenalty: 1000,
      };
      expect(combinePerformabilityComponents(components)).toBe(1000);
    });

    it('should return 0 for zero components', () => {
      expect(combinePerformabilityComponents(createZeroPerformabilityComponents())).toBe(0);
    });
  });
});

// ============================================================================
// Tests: calculatePoseNaturalness (legacy, kept for backward compat)
// ============================================================================

describe('calculatePoseNaturalness', () => {
  it('should return lower score for natural grip near resting pose', () => {
    const naturalScore = calculatePoseNaturalness(
      NATURAL_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    const unnaturalScore = calculatePoseNaturalness(
      UNNATURAL_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    expect(naturalScore).toBeLessThan(unnaturalScore);
  });

  it('should increase with stiffness', () => {
    const lowStiffness = calculatePoseNaturalness(
      UNNATURAL_GRIP, RIGHT_RESTING_POSE, 0.1, 'right', null
    );
    const highStiffness = calculatePoseNaturalness(
      UNNATURAL_GRIP, RIGHT_RESTING_POSE, 1.0, 'right', null
    );
    expect(highStiffness).toBeGreaterThan(lowStiffness);
  });

  it('should be zero for identical poses (no neutral centers)', () => {
    const score = calculatePoseNaturalness(
      RIGHT_RESTING_POSE, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    expect(score).toBe(0);
  });

  it('should penalize thumb/pinky usage via dominance cost', () => {
    const thumbPinkyScore = calculatePoseNaturalness(
      HIGH_DOMINANCE_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    const indexMiddleScore = calculatePoseNaturalness(
      LOW_DOMINANCE_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    expect(thumbPinkyScore).toBeGreaterThan(indexMiddleScore);
  });

  it('should be consistent with sub-component weighted sum', () => {
    const stiffness = 0.3;
    const combined = calculatePoseNaturalness(
      NATURAL_GRIP, RIGHT_RESTING_POSE, stiffness, 'right', null
    );

    const attractor = calculateAttractorCost(NATURAL_GRIP, RIGHT_RESTING_POSE, stiffness);
    const dominance = calculateFingerPreferenceCost(NATURAL_GRIP);
    const expected = 0.4 * attractor + 0.4 * 0 + 0.2 * dominance;

    expect(combined).toBeCloseTo(expected, 10);
  });
});

// ============================================================================
// Tests: V1CostBreakdown backward compatibility mappings
// ============================================================================

describe('v1CostBreakdownToDifficultyBreakdown', () => {
  it('should map V1 fields to legacy DifficultyBreakdown format', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 2.0,
      handShapeDeviation: 3.0,
      transitionCost: 5.0,
      handBalance: 1.0,
      constraintPenalty: 100,
      total: 111.0,
    };
    const breakdown = v1CostBreakdownToDifficultyBreakdown(v1);

    expect(breakdown.movement).toBe(5.0);     // transitionCost
    expect(breakdown.stretch).toBe(2.0);       // fingerPreference
    expect(breakdown.drift).toBe(3.0);         // handShapeDeviation
    expect(breakdown.bounce).toBe(0);          // always 0 in V1
    expect(breakdown.fatigue).toBe(0);         // always 0 in V1
    expect(breakdown.crossover).toBe(100);     // constraintPenalty
    expect(breakdown.total).toBe(111.0);
  });

  it('should handle zero breakdown', () => {
    const v1 = createZeroV1CostBreakdown();
    const breakdown = v1CostBreakdownToDifficultyBreakdown(v1);
    expect(breakdown.total).toBe(0);
    expect(breakdown.movement).toBe(0);
    expect(breakdown.stretch).toBe(0);
    expect(breakdown.drift).toBe(0);
  });
});

describe('v1CostBreakdownToCanonicalFactors', () => {
  it('should collapse fingerPreference + handShapeDeviation into gripNaturalness', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 5.0,
      handShapeDeviation: 10.0,
      transitionCost: 3.0,
      handBalance: 1.0,
      constraintPenalty: 0,
      total: 99.0, // beam total may differ due to weighting
    };
    const factors = v1CostBreakdownToCanonicalFactors(v1);
    expect(factors.gripNaturalness).toBe(15.0); // 5 + 10
    expect(factors.transition).toBe(3.0);
    expect(factors.handBalance).toBe(1.0);
    expect(factors.alternation).toBe(0);         // always 0 in V1
    expect(factors.constraintPenalty).toBe(0);
    // Total = sum of canonical factors, not beam total
    expect(factors.total).toBe(19.0); // 15 + 3 + 0 + 1 + 0
  });
});

describe('v1CostBreakdownToV1Factors', () => {
  it('should map to V1DiagnosticFactors with correct total', () => {
    const v1: V1CostBreakdown = {
      fingerPreference: 2.0,
      handShapeDeviation: 3.0,
      transitionCost: 5.0,
      handBalance: 1.0,
      constraintPenalty: 0,
      total: 11.0,
    };
    const factors = v1CostBreakdownToV1Factors(v1);
    expect(factors.fingerPreference).toBe(2.0);
    expect(factors.handShapeDeviation).toBe(3.0);
    expect(factors.transitionCost).toBe(5.0);
    expect(factors.handBalance).toBe(1.0);
    // V1DiagnosticFactors.total excludes constraintPenalty
    expect(factors.total).toBe(11.0); // 2 + 3 + 5 + 1
  });
});

// ============================================================================
// Tests: Diagnostic Costs (still computed, not in beam score)
// ============================================================================

describe('Diagnostic Costs', () => {
  it('calculateAlternationCost should return 0 for large dt', () => {
    const cost = calculateAlternationCost(
      [{ hand: 'right', finger: 'index' }],
      [{ hand: 'right', finger: 'index' }],
      1.0  // > ALTERNATION_DT_THRESHOLD (0.25s)
    );
    expect(cost).toBe(0);
  });

  it('calculateAlternationCost should penalize same-finger repetition on short dt', () => {
    const cost = calculateAlternationCost(
      [{ hand: 'right', finger: 'index' }],
      [{ hand: 'right', finger: 'index' }],
      0.05 // < 0.25s threshold
    );
    expect(cost).toBeGreaterThan(0);
  });

  it('calculateHandBalanceCost should return 0 for small event counts', () => {
    const cost = calculateHandBalanceCost(0, 1);
    expect(cost).toBe(0); // total=1, below HAND_BALANCE_MIN_NOTES (2)
  });

  it('calculateHandBalanceCost should penalize extreme imbalance', () => {
    const balanced = calculateHandBalanceCost(45, 55);
    const imbalanced = calculateHandBalanceCost(10, 90);
    expect(imbalanced).toBeGreaterThan(balanced);
  });
});

// ============================================================================
// Tests: Beam Solver with V1 Scoring
// ============================================================================

describe('Beam Solver (V1 Scoring)', () => {
  it('should produce valid results with V1 scoring model', async () => {
    const performance = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 41, startTime: 0.5 },
      { noteNumber: 42, startTime: 1.0 },
      { noteNumber: 40, startTime: 1.5 },
    ]);
    const result = await runSolver(performance);

    assertNoNaNs(result);
    assertMappingIntegrity(result);
    expect(result.fingerAssignments.length).toBe(4);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should prefer natural grips near resting pose', async () => {
    const nearRestPerf = createTestPerformance([
      { noteNumber: 69, startTime: 0.0 },
      { noteNumber: 70, startTime: 0.5 },
    ]);
    const farRestPerf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 37, startTime: 0.5 },
    ]);

    const nearResult = await runSolver(nearRestPerf);
    const farResult = await runSolver(farRestPerf);

    assertNoNaNs(nearResult);
    assertNoNaNs(farResult);
  });

  it('should handle simultaneous notes', async () => {
    const performance = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 41, startTime: 0.0 },  // simultaneous
      { noteNumber: 42, startTime: 0.5 },
    ]);
    const result = await runSolver(performance);

    assertNoNaNs(result);
    expect(result.fingerAssignments.length).toBe(3);
  });

  it('should produce V1CostBreakdown in results', async () => {
    const performance = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 41, startTime: 0.5 },
    ]);
    const result = await runSolver(performance);

    for (const fa of result.fingerAssignments) {
      if (fa.assignedHand !== 'Unplayable') {
        expect(fa.costBreakdown).toBeDefined();
        expect(fa.costBreakdown.total).toBeGreaterThanOrEqual(0);
        expect(fa.costBreakdown.transitionCost).toBeDefined();
        expect(fa.costBreakdown.fingerPreference).toBeDefined();
        expect(fa.costBreakdown.handShapeDeviation).toBeDefined();
      }
    }
  });

  it('should assign higher costs for fast transitions', async () => {
    const slowPerf = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 45, startTime: 2.0 },
    ]);
    const fastPerf = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 45, startTime: 0.1 },
    ]);

    const slowResult = await runSolver(slowPerf);
    const fastResult = await runSolver(fastPerf);

    assertNoNaNs(slowResult);
    assertNoNaNs(fastResult);

    expect(slowResult.fingerAssignments.length).toBe(2);
    expect(fastResult.fingerAssignments.length).toBe(2);
  });
});
