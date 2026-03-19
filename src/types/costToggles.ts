/**
 * Cost Toggles.
 *
 * Controls which cost families are active during evaluation and optimization.
 * Each toggle corresponds to a dimension in CostDimensions.
 *
 * When a toggle is disabled:
 * - The dimension still gets computed internally (for diagnostic visibility)
 * - But its contribution to the total is zeroed out
 * - Optimizers treat the disabled dimension as having zero weight
 *
 * Hard feasibility constraints (constraintPenalty) are special:
 * disabling them is an explicit experimental choice. The UI should
 * make this visually distinct so users understand they are ignoring
 * hard rules.
 */

/**
 * CostToggles: Per-dimension on/off switches for cost evaluation.
 *
 * Maps 1:1 to CostDimensions field names.
 */
export interface CostToggles {
  /** Static: grip quality (attractor + perFingerHome + fingerDominance). */
  poseNaturalness: boolean;
  /** Temporal: Fitts's Law movement penalty between moments. */
  transitionCost: boolean;
  /** Hard: penalty for relaxed/fallback grips. Disabling = experimental mode. */
  constraintPenalty: boolean;
  /** Temporal: same-finger rapid repetition penalty. */
  alternation: boolean;
  /** Static: left/right hand distribution imbalance. */
  handBalance: boolean;
}

/** All cost families enabled (default for normal operation). */
export const ALL_COSTS_ENABLED: CostToggles = {
  poseNaturalness: true,
  transitionCost: true,
  constraintPenalty: true,
  alternation: true,
  handBalance: true,
};

/** All cost families disabled (useful for testing). */
export const ALL_COSTS_DISABLED: CostToggles = {
  poseNaturalness: false,
  transitionCost: false,
  constraintPenalty: false,
  alternation: false,
  handBalance: false,
};

/** Apply toggles to a cost dimensions object, zeroing disabled dimensions. */
export function applyToggles(
  dimensions: { poseNaturalness: number; transitionCost: number; constraintPenalty: number; alternation: number; handBalance: number; total: number },
  toggles: CostToggles,
): { poseNaturalness: number; transitionCost: number; constraintPenalty: number; alternation: number; handBalance: number; total: number } {
  const poseNaturalness = toggles.poseNaturalness ? dimensions.poseNaturalness : 0;
  const transitionCost = toggles.transitionCost ? dimensions.transitionCost : 0;
  const constraintPenalty = toggles.constraintPenalty ? dimensions.constraintPenalty : 0;
  const alternation = toggles.alternation ? dimensions.alternation : 0;
  const handBalance = toggles.handBalance ? dimensions.handBalance : 0;
  return {
    poseNaturalness,
    transitionCost,
    constraintPenalty,
    alternation,
    handBalance,
    total: poseNaturalness + transitionCost + constraintPenalty + alternation + handBalance,
  };
}

/** Check if any hard constraint toggles are disabled (experimental mode). */
export function isExperimentalMode(toggles: CostToggles): boolean {
  return !toggles.constraintPenalty;
}

/** Human-readable labels for each toggle. */
export const TOGGLE_LABELS: Record<keyof CostToggles, string> = {
  poseNaturalness: 'Grip Quality',
  transitionCost: 'Movement Cost',
  constraintPenalty: 'Hard Constraints',
  alternation: 'Finger Repetition',
  handBalance: 'Hand Balance',
};

/** Category grouping: static vs temporal. */
export const TOGGLE_CATEGORIES: Record<keyof CostToggles, 'static' | 'temporal' | 'hard'> = {
  poseNaturalness: 'static',
  transitionCost: 'temporal',
  constraintPenalty: 'hard',
  alternation: 'temporal',
  handBalance: 'static',
};
