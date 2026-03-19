/**
 * V1 Objective Function.
 *
 * Single scoring model — the 3-component PerformabilityObjective:
 *   poseNaturalness (= handShapeDeviation + fingerPreference)
 *   transitionDifficulty (Fitts's Law)
 *   constraintPenalty (always 0 in V1 — constraints are binary)
 *
 * V1 changes (Phase 8):
 * - Removed ObjectiveComponents (7-term legacy diagnostic model)
 * - Removed LegacyObjectiveComponents type alias
 * - Removed ObjectiveResult interface
 * - Removed all objectiveTo* and performabilityTo* conversion functions
 * - Beam solver now tracks V1CostBreakdown directly on assignments
 *
 * Ported from Version1/src/engine/objective.ts, then simplified.
 */

import {
  type V1CostBreakdown,
  type V1DiagnosticFactors,
  type DiagnosticFactors,
} from '../../types/diagnostics';

// ============================================================================
// Performability Objective (3-Component Beam Scoring Model)
// ============================================================================

/**
 * 3-component performability scoring model.
 *
 * Used for beam search step cost computation:
 *   1. How natural is this grip?    → poseNaturalness (= handShapeDeviation + fingerPreference)
 *   2. How hard is the transition?  → transitionDifficulty (Fitts's Law)
 *   3. Constraint penalty            → constraintPenalty (always 0 in V1)
 *
 * Used for beam search scoring. V1CostBreakdown is used for diagnostics.
 */
export interface PerformabilityObjective {
  /** Combined grip quality: handShapeDeviation + fingerPreference. */
  poseNaturalness: number;
  /** Fitts's Law transition cost: distance + speed penalty. Infinity if too fast. */
  transitionDifficulty: number;
  /** Always 0 in V1 (constraints are binary pass/fail, not penalized). */
  constraintPenalty: number;
}

// ============================================================================
// Performability Factory + Combination
// ============================================================================

export function createZeroPerformabilityComponents(): PerformabilityObjective {
  return {
    poseNaturalness: 0,
    transitionDifficulty: 0,
    constraintPenalty: 0,
  };
}

/**
 * Combines performability components into a single scalar.
 * Used for beam search scoring and candidate ranking.
 */
export function combinePerformabilityComponents(components: PerformabilityObjective): number {
  return (
    components.poseNaturalness +
    components.transitionDifficulty +
    components.constraintPenalty
  );
}

// ============================================================================
// V1 Cost Breakdown Utilities
// ============================================================================

/**
 * Maps a V1CostBreakdown to legacy DifficultyBreakdown format.
 *
 * Provides backward compatibility for ExecutionPlanResult.averageMetrics
 * and FingerAssignment.costBreakdown which still use the DifficultyBreakdown
 * shape (movement/stretch/drift/bounce/fatigue/crossover).
 *
 * Field mapping:
 *   movement   ← transitionCost
 *   stretch    ← fingerPreference
 *   drift      ← handShapeDeviation
 *   bounce     ← 0 (alternation removed from V1)
 *   fatigue    ← 0 (no per-finger home tracking in V1)
 *   crossover  ← constraintPenalty
 */
export function v1CostBreakdownToDifficultyBreakdown(v1: V1CostBreakdown): {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
} {
  return {
    movement: v1.transitionCost,
    stretch: v1.fingerPreference,
    drift: v1.handShapeDeviation,
    bounce: 0,
    fatigue: 0,
    crossover: v1.constraintPenalty,
    total: v1.total,
  };
}

/**
 * Maps a V1CostBreakdown to legacy DiagnosticFactors.
 *
 * Provides backward compatibility for DiagnosticsPayload.factors.
 * Maps V1 fields to the existing 5-factor schema.
 *
 * Field mapping:
 *   transition       ← transitionCost
 *   gripNaturalness  ← fingerPreference + handShapeDeviation
 *   alternation      ← 0 (removed from V1)
 *   handBalance      ← handBalance
 *   constraintPenalty ← constraintPenalty
 */
export function v1CostBreakdownToCanonicalFactors(v1: V1CostBreakdown): DiagnosticFactors {
  const transition = v1.transitionCost;
  const gripNaturalness = v1.fingerPreference + v1.handShapeDeviation;
  const handBalance = v1.handBalance;
  const constraintPenalty = v1.constraintPenalty;
  return {
    transition,
    gripNaturalness,
    alternation: 0,
    handBalance,
    constraintPenalty,
    total: transition + gripNaturalness + handBalance + constraintPenalty,
  };
}

/**
 * Maps a V1CostBreakdown to V1DiagnosticFactors.
 */
export function v1CostBreakdownToV1Factors(v1: V1CostBreakdown): V1DiagnosticFactors {
  return {
    fingerPreference: v1.fingerPreference,
    handShapeDeviation: v1.handShapeDeviation,
    transitionCost: v1.transitionCost,
    handBalance: v1.handBalance,
    total: v1.fingerPreference + v1.handShapeDeviation + v1.transitionCost + v1.handBalance,
  };
}
