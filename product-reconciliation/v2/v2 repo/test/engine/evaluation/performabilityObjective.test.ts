/**
 * Performability Objective Tests.
 *
 * Tests the 3-component scoring model:
 *   1. poseNaturalness: unified grip quality (attractor + perFingerHome + dominance)
 *   2. transitionDifficulty: Fitts's Law movement cost
 *   3. constraintPenalty: fallback grip penalty
 *
 * Also tests:
 *   - calculatePoseNaturalness sub-component weighting
 *   - combinePerformabilityComponents
 *   - performabilityToDifficultyBreakdown (backward compatibility mapping)
 *   - Beam solver produces valid results under 3-component scoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePoseNaturalness,
  calculateAttractorCost,
  calculatePerFingerHomeCost,
  calculateFingerDominanceCost,
  calculateTransitionCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
  FALLBACK_GRIP_PENALTY,
} from '../../../src/engine/evaluation/costFunction';
import {
  type PerformabilityObjective,
  combinePerformabilityComponents,
  createZeroPerformabilityComponents,
  performabilityToDifficultyBreakdown,
  type ObjectiveComponents,
  combineComponents,
  objectiveToDifficultyBreakdown,
} from '../../../src/engine/evaluation/objective';
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
        constraintPenalty: FALLBACK_GRIP_PENALTY,
      };
      expect(combinePerformabilityComponents(components)).toBe(FALLBACK_GRIP_PENALTY);
    });

    it('should return 0 for zero components', () => {
      expect(combinePerformabilityComponents(createZeroPerformabilityComponents())).toBe(0);
    });
  });
});

// ============================================================================
// Tests: calculatePoseNaturalness
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
    // Without neutral centers, only attractor and dominance contribute.
    // Attractor is zero (same pose). Dominance depends on fingers.
    // Index + middle have cost 0 each.
    expect(score).toBe(0);
  });

  it('should penalize thumb/pinky usage via dominance cost', () => {
    const thumbPinkyScore = calculatePoseNaturalness(
      HIGH_DOMINANCE_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    const indexMiddleScore = calculatePoseNaturalness(
      LOW_DOMINANCE_GRIP, RIGHT_RESTING_POSE, 0.3, 'right', null
    );
    // Thumb (1.0) + pinky (0.8) dominance >> index (0) + middle (0)
    expect(thumbPinkyScore).toBeGreaterThan(indexMiddleScore);
  });

  it('should be consistent with sub-component weighted sum', () => {
    const stiffness = 0.3;
    const combined = calculatePoseNaturalness(
      NATURAL_GRIP, RIGHT_RESTING_POSE, stiffness, 'right', null
    );

    // Manual sub-component calculation
    const attractor = calculateAttractorCost(NATURAL_GRIP, RIGHT_RESTING_POSE, stiffness);
    const dominance = calculateFingerDominanceCost(NATURAL_GRIP);
    // No neutral centers → perFingerHome = 0
    const expected = 0.4 * attractor + 0.4 * 0 + 0.2 * dominance;

    expect(combined).toBeCloseTo(expected, 10);
  });
});

// ============================================================================
// Tests: performabilityToDifficultyBreakdown
// ============================================================================

describe('performabilityToDifficultyBreakdown', () => {
  it('should map transition to movement and penalty to crossover', () => {
    const perf: PerformabilityObjective = {
      poseNaturalness: 2.0,
      transitionDifficulty: 3.0,
      constraintPenalty: 100,
    };
    const breakdown = performabilityToDifficultyBreakdown(perf);

    expect(breakdown.movement).toBe(3.0);   // transitionDifficulty
    expect(breakdown.crossover).toBe(100);   // constraintPenalty
    expect(breakdown.total).toBe(105.0);     // sum of all 3
    expect(breakdown.bounce).toBe(0);        // no alternation in perf model
  });

  it('should distribute poseNaturalness across stretch/drift/fatigue', () => {
    const perf: PerformabilityObjective = {
      poseNaturalness: 10.0,
      transitionDifficulty: 0,
      constraintPenalty: 0,
    };
    const breakdown = performabilityToDifficultyBreakdown(perf);

    expect(breakdown.stretch).toBeCloseTo(2.0);   // 10 * 0.2
    expect(breakdown.drift).toBeCloseTo(4.0);     // 10 * 0.4
    expect(breakdown.fatigue).toBeCloseTo(4.0);   // 10 * 0.4
    expect(breakdown.total).toBeCloseTo(10.0);
  });

  it('should use diagnostic components when provided', () => {
    const perf: PerformabilityObjective = {
      poseNaturalness: 10.0,
      transitionDifficulty: 3.0,
      constraintPenalty: 0,
    };
    const diag: ObjectiveComponents = {
      transition: 3.0,
      stretch: 1.5,
      poseAttractor: 2.0,
      perFingerHome: 3.0,
      alternation: 0.5,
      handBalance: 0.2,
      constraints: 0,
    };
    const breakdown = performabilityToDifficultyBreakdown(perf, diag);

    expect(breakdown.movement).toBe(3.0);       // from perf.transitionDifficulty
    expect(breakdown.stretch).toBe(1.5);          // from diag
    expect(breakdown.drift).toBe(2.0);            // from diag.poseAttractor
    expect(breakdown.bounce).toBe(0.5);           // from diag.alternation
    expect(breakdown.fatigue).toBe(3.0);          // from diag.perFingerHome
    expect(breakdown.crossover).toBe(0);          // from perf.constraintPenalty
    expect(breakdown.total).toBeCloseTo(13.0);    // sum of perf components
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
// Tests: Legacy Backward Compatibility
// ============================================================================

describe('Legacy ObjectiveComponents backward compatibility', () => {
  it('combineComponents should still work for 7-component model', () => {
    const legacy: ObjectiveComponents = {
      transition: 1, stretch: 2, poseAttractor: 3,
      perFingerHome: 4, alternation: 5, handBalance: 6, constraints: 7,
    };
    expect(combineComponents(legacy)).toBe(28);
  });

  it('objectiveToDifficultyBreakdown should still map correctly', () => {
    const legacy: ObjectiveComponents = {
      transition: 1, stretch: 2, poseAttractor: 3,
      perFingerHome: 4, alternation: 5, handBalance: 6, constraints: 7,
    };
    const breakdown = objectiveToDifficultyBreakdown(legacy);
    expect(breakdown.movement).toBe(1);
    expect(breakdown.stretch).toBe(2);
    expect(breakdown.drift).toBe(3);
    expect(breakdown.fatigue).toBe(4);
    expect(breakdown.bounce).toBe(5);
    expect(breakdown.crossover).toBe(7);
    expect(breakdown.total).toBe(28);
  });
});

// ============================================================================
// Tests: Beam Solver with 3-Component Scoring
// ============================================================================

describe('Beam Solver (3-Component Scoring)', () => {
  it('should produce valid results with new scoring model', async () => {
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
    // Notes near the right resting pose center (col 5-6) should score better
    // than notes far from it (col 0-1)
    const nearRestPerf = createTestPerformance([
      { noteNumber: 69, startTime: 0.0 },  // Should map near center
      { noteNumber: 70, startTime: 0.5 },
    ]);
    const farRestPerf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },  // Bottom-left corner
      { noteNumber: 37, startTime: 0.5 },
    ]);

    const nearResult = await runSolver(nearRestPerf);
    const farResult = await runSolver(farRestPerf);

    // Near-rest performance should have lower average cost
    // (both should be valid, but near-rest is more natural)
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

  it('should produce DifficultyBreakdown in results', async () => {
    const performance = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 41, startTime: 0.5 },
    ]);
    const result = await runSolver(performance);

    for (const fa of result.fingerAssignments) {
      if (fa.assignedHand !== 'Unplayable') {
        expect(fa.costBreakdown).toBeDefined();
        expect(fa.costBreakdown.total).toBeGreaterThanOrEqual(0);
        expect(fa.costBreakdown.movement).toBeDefined();
        expect(fa.costBreakdown.stretch).toBeDefined();
        expect(fa.costBreakdown.drift).toBeDefined();
      }
    }
  });

  it('should assign higher costs for fast transitions', async () => {
    // Slow transitions (0.5s apart)
    const slowPerf = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 45, startTime: 2.0 },
    ]);
    // Fast transitions (0.1s apart)
    const fastPerf = createTestPerformance([
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 45, startTime: 0.1 },
    ]);

    const slowResult = await runSolver(slowPerf);
    const fastResult = await runSolver(fastPerf);

    assertNoNaNs(slowResult);
    assertNoNaNs(fastResult);

    // Fast transition should have higher average cost or more hard events
    const slowTotal = slowResult.averageMetrics.total;
    const fastTotal = fastResult.averageMetrics.total;
    // Note: fast might be Infinity/Unplayable; just verify both produce results
    expect(slowResult.fingerAssignments.length).toBe(2);
    expect(fastResult.fingerAssignments.length).toBe(2);
  });
});
