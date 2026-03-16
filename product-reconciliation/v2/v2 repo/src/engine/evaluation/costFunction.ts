/**
 * Cost calculators for the Performability Engine.
 *
 * Primary scoring model (3-component PerformabilityObjective):
 *   - calculatePoseNaturalness: unified grip quality score
 *   - calculateTransitionCost: Fitts's Law movement difficulty
 *
 * Active scoring costs (included in beam score with configurable weights):
 *   - calculateAlternationCost: same-finger repetition penalty
 *   - calculateHandBalanceCost: left/right distribution penalty
 *
 * Sub-components of poseNaturalness (available individually):
 *   - calculateAttractorCost: centroid distance from resting
 *   - calculatePerFingerHomeCost: per-finger neutral pad distance
 *   - calculateFingerDominanceCost: anatomical finger preference
 *
 * Legacy functions moved to diagnostics/legacyCosts.ts (re-exported here).
 */

import { type FingerType } from '../../types/fingerModel';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { type NeutralHandCentersResult } from '../prior/handPose';
import {
  MAX_HAND_SPEED,
  SPEED_COST_WEIGHT,
  ALTERNATION_DT_THRESHOLD,
  ALTERNATION_PENALTY,
  HAND_BALANCE_TARGET_LEFT,
  HAND_BALANCE_WEIGHT,
  HAND_BALANCE_MIN_NOTES,
  FINGER_DOMINANCE_COST,
} from '../prior/biomechanicalModel';

// Re-export constants for backward compatibility (consumers import from costFunction)
export {
  MAX_HAND_SPEED,
  SPEED_COST_WEIGHT,
  ALTERNATION_DT_THRESHOLD,
  ALTERNATION_PENALTY,
  HAND_BALANCE_TARGET_LEFT,
  HAND_BALANCE_WEIGHT,
  HAND_BALANCE_MIN_NOTES,
};


/** Minimum time delta to prevent division by zero. */
const MIN_TIME_DELTA = 0.001;

// ============================================================================
// Helpers
// ============================================================================

/** Euclidean distance between two FingerCoordinates. */
function fingerCoordinateDistance(a: FingerCoordinate, b: FingerCoordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// Pose Naturalness (Primary — 3-Component Model)
// ============================================================================

/**
 * Unified pose naturalness score.
 *
 * Merges three sub-components into a single "how natural is this grip?" score:
 *   1. Centroid distance from resting pose (weight 0.4) — via calculateAttractorCost
 *   2. Per-finger distance from neutral pads (weight 0.4) — via calculatePerFingerHomeCost
 *   3. Finger dominance penalty (weight 0.2) — via calculateFingerDominanceCost
 *
 * This is the primary pose quality term in the PerformabilityObjective.
 */
export function calculatePoseNaturalness(
  grip: HandPose,
  restingPose: HandPose,
  stiffness: number,
  handSide: 'left' | 'right',
  neutralHandCenters: NeutralHandCentersResult | null,
): number {
  // Sub-component 1: Attractor cost (centroid distance from resting)
  const attractorCost = calculateAttractorCost(grip, restingPose, stiffness);

  // Sub-component 2: Per-finger home cost
  const perFingerHomeCost = neutralHandCenters
    ? calculatePerFingerHomeCost(grip, handSide, neutralHandCenters, 0.8)
    : 0;

  // Sub-component 3: Finger dominance cost
  const dominanceCost = calculateFingerDominanceCost(grip);

  // Weighted combination
  return (
    0.4 * attractorCost +
    0.4 * perFingerHomeCost +
    0.2 * dominanceCost
  );
}

// ============================================================================
// Alternation Cost
// ============================================================================

/**
 * Alternation penalty: penalizes same-finger repetition on short dt.
 * Included in beam score (weighted by ALTERNATION_BEAM_WEIGHT) to prevent
 * irrational same-finger rapid repetition on fast passages.
 */
export function calculateAlternationCost(
  prevAssignments: Array<{ hand: 'left' | 'right'; finger: FingerType }>,
  currentAssignments: Array<{ hand: 'left' | 'right'; finger: FingerType }>,
  dt: number
): number {
  if (prevAssignments.length === 0 || dt >= ALTERNATION_DT_THRESHOLD) return 0;
  const prevSet = new Set(prevAssignments.map(a => `${a.hand}:${a.finger}`));
  let penalty = 0;
  for (const curr of currentAssignments) {
    if (prevSet.has(`${curr.hand}:${curr.finger}`)) {
      const recencyFactor = 1 - dt / ALTERNATION_DT_THRESHOLD;
      penalty += ALTERNATION_PENALTY * recencyFactor;
    }
  }
  return penalty;
}

// ============================================================================
// Hand Balance Cost
// ============================================================================

/**
 * Hand balance penalty: quadratic penalty when leftShare deviates from target.
 * Included in beam score (weighted by HAND_BALANCE_BEAM_WEIGHT) to prevent
 * extreme single-hand dominance.
 */
export function calculateHandBalanceCost(
  leftCount: number,
  rightCount: number
): number {
  const total = leftCount + rightCount;
  if (total < HAND_BALANCE_MIN_NOTES) return 0;
  const leftShare = leftCount / total;
  const deviation = leftShare - HAND_BALANCE_TARGET_LEFT;
  return HAND_BALANCE_WEIGHT * deviation * deviation;
}

// ============================================================================
// Finger Dominance Cost (Sub-component of Pose Naturalness)
// ============================================================================

/**
 * Penalises use of anatomically suboptimal fingers (thumb, pinky).
 * Sums per-finger cost for all fingers assigned in this grip.
 *
 * Sub-component of calculatePoseNaturalness (weight 0.2).
 * Also available individually for legacy ObjectiveComponents display.
 */
export function calculateFingerDominanceCost(grip: HandPose): number {
  let cost = 0;
  for (const finger of Object.keys(grip.fingers) as FingerType[]) {
    cost += FINGER_DOMINANCE_COST[finger] ?? 0;
  }
  return cost;
}

// ============================================================================
// Attractor Cost (Sub-component of Pose Naturalness)
// ============================================================================

/**
 * Attractor cost: spring model pulling hand back to resting pose.
 * Cost = distance(centroid, resting.centroid) * stiffness
 *
 * Sub-component of calculatePoseNaturalness (weight 0.4).
 * Also available individually for legacy ObjectiveComponents display.
 */
export function calculateAttractorCost(
  current: HandPose,
  resting: HandPose,
  stiffness: number
): number {
  return fingerCoordinateDistance(current.centroid, resting.centroid) * stiffness;
}

// ============================================================================
// Per-Finger Home Cost (Sub-component of Pose Naturalness)
// ============================================================================

/**
 * Per-finger home cost: penalizes each finger's distance from its neutral pad.
 *
 * Sub-component of calculatePoseNaturalness (weight 0.4).
 * Also available individually for legacy ObjectiveComponents display.
 */
export function calculatePerFingerHomeCost(
  pose: HandPose,
  handSide: 'left' | 'right',
  neutralHandCenters: NeutralHandCentersResult,
  weight: number = 0.8
): number {
  let total = 0;
  const prefix = handSide === 'left' ? 'L' : 'R';
  const fingerNums: Record<FingerType, number> = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };

  for (const [finger, coord] of Object.entries(pose.fingers) as [FingerType, FingerCoordinate][]) {
    const key = `${prefix}${fingerNums[finger]}`;
    const neutral = neutralHandCenters.neutralPads[key];
    if (!neutral) continue;
    total += fingerCoordinateDistance(coord, { x: neutral.col, y: neutral.row }) * weight;
  }

  return total;
}

// ============================================================================
// Transition Cost (Primary — Unchanged)
// ============================================================================

/**
 * Transition cost (Fitts's Law): movement distance + speed penalty.
 * Returns Infinity if speed exceeds MAX_HAND_SPEED.
 *
 * This is the transitionDifficulty term in the PerformabilityObjective.
 */
export function calculateTransitionCost(
  prev: HandPose,
  curr: HandPose,
  timeDelta: number
): number {
  if (timeDelta <= MIN_TIME_DELTA) return 0;
  const distance = fingerCoordinateDistance(prev.centroid, curr.centroid);
  if (distance === 0) return 0;
  const speed = distance / timeDelta;
  if (speed > MAX_HAND_SPEED) return Infinity;
  return distance + speed * SPEED_COST_WEIGHT;
}
