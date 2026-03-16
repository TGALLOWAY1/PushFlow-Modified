/**
 * Canonical Objective Function.
 *
 * Two objective models:
 *
 *   1. PerformabilityObjective (primary, 3-component):
 *      poseNaturalness | transitionDifficulty | constraintPenalty
 *
 *   2. ObjectiveComponents (legacy, 7-component, for diagnostic display):
 *      transition | stretch | poseAttractor | perFingerHome | alternation | handBalance | constraints
 *
 * The beam search scores by PerformabilityObjective (3 terms).
 * The UI displays ObjectiveComponents (7 terms) for rich diagnostic breakdown.
 *
 * Ported from Version1/src/engine/objective.ts.
 */

// ============================================================================
// Performability Objective (3-Component Primary Model)
// ============================================================================

/**
 * 3-component performability scoring model.
 *
 * Answers three questions for each assignment:
 *   1. How natural is this grip?    → poseNaturalness
 *   2. How hard is the transition?  → transitionDifficulty
 *   3. Is this a fallback grip?     → constraintPenalty
 *
 * Used for beam search scoring and candidate comparison.
 * Legacy ObjectiveComponents is still computed alongside for diagnostic display.
 */
export interface PerformabilityObjective {
  /** Combined pose quality: attractor (0.4) + per-finger home (0.4) + dominance (0.2). */
  poseNaturalness: number;
  /** Fitts's Law transition cost: distance + speed penalty. Infinity if too fast. */
  transitionDifficulty: number;
  /** Hard penalty for Tier 3 fallback grips (1000). Zero for strict/relaxed grips. */
  constraintPenalty: number;
}

// ============================================================================
// Legacy Objective Components (7-Component Diagnostic Model)
// ============================================================================

/**
 * 7-component objective for diagnostic display.
 * @deprecated For primary scoring, use PerformabilityObjective.
 */
export interface ObjectiveComponents {
  transition: number;
  stretch: number;
  poseAttractor: number;
  perFingerHome: number;
  alternation: number;
  handBalance: number;
  constraints: number;
}

/** @deprecated Use PerformabilityObjective for primary scoring. */
export type LegacyObjectiveComponents = ObjectiveComponents;

export interface ObjectiveResult {
  valid: boolean;
  total: number;
  components: ObjectiveComponents;
  invalidReason?: string;
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
// Legacy Factory + Combination
// ============================================================================

export function createZeroComponents(): ObjectiveComponents {
  return {
    transition: 0,
    stretch: 0,
    poseAttractor: 0,
    perFingerHome: 0,
    alternation: 0,
    handBalance: 0,
    constraints: 0,
  };
}

/**
 * Combines legacy component values into a single scalar total.
 * @deprecated For primary scoring, use combinePerformabilityComponents.
 */
export function combineComponents(components: ObjectiveComponents): number {
  return (
    components.transition +
    components.stretch +
    components.poseAttractor +
    components.perFingerHome +
    components.alternation +
    components.handBalance +
    components.constraints
  );
}

// ============================================================================
// Mapping to DifficultyBreakdown (for ExecutionPlanResult compatibility)
// ============================================================================

/**
 * Maps legacy ObjectiveComponents to DifficultyBreakdown format.
 *   movement ← transition, stretch ← stretch, drift ← poseAttractor,
 *   bounce ← alternation, fatigue ← perFingerHome, crossover ← constraints.
 */
export function objectiveToDifficultyBreakdown(components: ObjectiveComponents): {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
} {
  const total = combineComponents(components);
  return {
    movement: components.transition,
    stretch: components.stretch,
    drift: components.poseAttractor,
    bounce: components.alternation,
    fatigue: components.perFingerHome,
    crossover: components.constraints,
    total,
  };
}

/**
 * Maps PerformabilityObjective to DifficultyBreakdown for UI backward compatibility.
 *
 * When diagnosticComponents are available, uses them for the richer sub-breakdown.
 * Otherwise, distributes poseNaturalness proportionally across legacy fields.
 */
export function performabilityToDifficultyBreakdown(
  components: PerformabilityObjective,
  diagnosticComponents?: ObjectiveComponents
): {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
} {
  const total = combinePerformabilityComponents(components);

  if (diagnosticComponents) {
    // Use diagnostic data for richer sub-breakdown
    return {
      movement: components.transitionDifficulty,
      stretch: diagnosticComponents.stretch,
      drift: diagnosticComponents.poseAttractor,
      bounce: diagnosticComponents.alternation,
      fatigue: diagnosticComponents.perFingerHome,
      crossover: components.constraintPenalty,
      total,
    };
  }

  // Approximate: distribute poseNaturalness across legacy fields
  const pose = components.poseNaturalness;
  return {
    movement: components.transitionDifficulty,
    stretch: pose * 0.2,   // finger dominance portion
    drift: pose * 0.4,     // centroid attractor portion
    bounce: 0,             // alternation (diagnostic only)
    fatigue: pose * 0.4,   // per-finger home portion
    crossover: components.constraintPenalty,
    total,
  };
}
