/**
 * Cost calculators for the Performability Engine.
 *
 * Primary scoring model (V1 PerformabilityObjective):
 *   - calculateHandShapeDeviation: translation-invariant grip quality (D-05, D-20)
 *   - calculateFingerPreferenceCost: anatomical finger preference
 *   - calculateTransitionCost: Fitts's Law movement difficulty
 *
 * Active scoring costs (included in beam score with configurable weights):
 *   - calculateAlternationCost: same-finger repetition penalty
 *   - calculateHandBalanceCost: left/right distribution penalty
 *
 * Deprecated (kept for backward compat but not used in V1 beam scoring):
 *   - calculatePoseNaturalness: legacy 3-component unified score
 *   - calculateAttractorCost: centroid distance from resting position
 *   - calculatePerFingerHomeCost: per-finger neutral pad distance
 */

import { type FingerType } from '../../types/fingerModel';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { type NeutralHandCentersResult, type NeutralPadPositions } from '../prior/handPose';
import {
  MAX_HAND_SPEED,
  SPEED_COST_WEIGHT,
  PER_FINGER_MOVEMENT_WEIGHT,
  MAX_FINGER_JUMP_WEIGHT,
  ALTERNATION_DT_THRESHOLD,
  ALTERNATION_PENALTY,
  HAND_BALANCE_TARGET_LEFT,
  HAND_BALANCE_WEIGHT,
  HAND_BALANCE_MIN_NOTES,
  FINGER_PREFERENCE_COST,
} from '../prior/biomechanicalModel';

// Re-export constants for backward compatibility (consumers import from costFunction)
export {
  MAX_HAND_SPEED,
  SPEED_COST_WEIGHT,
  PER_FINGER_MOVEMENT_WEIGHT,
  MAX_FINGER_JUMP_WEIGHT,
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
// Hand Shape Deviation (V1 Primary — Translation-Invariant, D-05, D-20)
// ============================================================================

/** Finger keys for left and right hands. */
const LEFT_FINGER_KEYS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_KEY_MAP: Record<FingerType, number> = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };

/**
 * Compute pairwise finger distances from a grip's finger coordinates.
 * Returns a Map keyed by "fingerA-fingerB" (sorted alphabetically) → distance.
 */
function computePairwiseDistances(
  fingers: Partial<Record<FingerType, FingerCoordinate>>
): Map<string, number> {
  const result = new Map<string, number>();
  const entries = Object.entries(fingers) as [FingerType, FingerCoordinate][];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [fA, cA] = entries[i];
      const [fB, cB] = entries[j];
      const key = fA < fB ? `${fA}-${fB}` : `${fB}-${fA}`;
      result.set(key, fingerCoordinateDistance(cA, cB));
    }
  }
  return result;
}

/**
 * Build natural pairwise finger distances from NeutralPadPositions for a given hand.
 * Returns a Map keyed by "fingerA-fingerB" → distance.
 */
export function buildNaturalPairwiseDistances(
  neutralPads: NeutralPadPositions,
  hand: 'left' | 'right'
): Map<string, number> {
  const prefix = hand === 'left' ? 'L' : 'R';
  const coords: Partial<Record<FingerType, FingerCoordinate>> = {};
  for (const finger of LEFT_FINGER_KEYS) {
    const key = `${prefix}${FINGER_KEY_MAP[finger]}`;
    const pad = neutralPads[key];
    if (pad) {
      coords[finger] = { x: pad.col, y: pad.row };
    }
  }
  return computePairwiseDistances(coords);
}

/**
 * Translation-invariant hand shape deviation (D-05, D-20).
 *
 * Compares the pairwise finger distances in the current grip against
 * the natural hand shape's pairwise distances. Cost = sum of squared
 * differences for all finger pairs present in the grip.
 *
 * This is translation-invariant: the same grip shape at different grid
 * positions produces the same cost. Only shape distortion is penalized.
 *
 * @param grip - Current hand pose
 * @param naturalDistances - Precomputed natural pairwise distances (from buildNaturalPairwiseDistances)
 * @returns Non-negative cost (0 = natural shape)
 */
export function calculateHandShapeDeviation(
  grip: HandPose,
  naturalDistances: Map<string, number>
): number {
  const gripDistances = computePairwiseDistances(grip.fingers);
  let cost = 0;

  for (const [pairKey, gripDist] of gripDistances) {
    const naturalDist = naturalDistances.get(pairKey);
    if (naturalDist !== undefined) {
      const diff = gripDist - naturalDist;
      cost += diff * diff;
    } else {
      // No natural reference for this pair — penalize by squared grip distance
      // (any shape is worse than no data)
      cost += gripDist * gripDist;
    }
  }

  return cost;
}

// ============================================================================
// Pose Naturalness (Legacy — 3-Component Model, kept for backward compat)
// ============================================================================

/**
 * @deprecated V1 (D-05): Replaced by calculateHandShapeDeviation + calculateFingerPreferenceCost.
 * Kept for backward compatibility with legacy ObjectiveComponents consumers.
 *
 * Unified pose naturalness score (3 sub-components):
 *   1. Centroid distance from resting pose (weight 0.4) — via calculateAttractorCost
 *   2. Per-finger distance from neutral pads (weight 0.4) — via calculatePerFingerHomeCost
 *   3. Finger preference penalty (weight 0.2) — via calculateFingerPreferenceCost
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
  const dominanceCost = calculateFingerPreferenceCost(grip);

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
 *
 * @deprecated V1 (D-15): No longer included in beam score. Kept for
 * display components and backward compatibility. The solver does not
 * use this to influence beam ranking.
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
 * Sub-component of poseNaturalness in legacy calculatePoseNaturalness (weight 0.2).
 * In V1, this is tracked as V1CostBreakdown.fingerPreference.
 */
export function calculateFingerPreferenceCost(grip: HandPose): number {
  let cost = 0;
  for (const finger of Object.keys(grip.fingers) as FingerType[]) {
    cost += FINGER_PREFERENCE_COST[finger] ?? 0;
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
 * Transition cost (Fitts's Law): movement distance + speed penalty + per-finger movement.
 * Returns Infinity if speed exceeds MAX_HAND_SPEED.
 *
 * The per-finger component tracks how far each individual finger moves between
 * poses. This catches cases where a single finger jumps across the grid while
 * the hand centroid barely moves (e.g., index finger hopping 6 pads while the
 * other 3 fingers stay put — centroid moves only ~1.5 units).
 *
 * This is the transitionDifficulty term in the PerformabilityObjective.
 */
export function calculateTransitionCost(
  prev: HandPose,
  curr: HandPose,
  timeDelta: number
): number {
  if (timeDelta <= MIN_TIME_DELTA) return 0;

  // Centroid-based cost (original Fitts's Law component)
  const centroidDistance = fingerCoordinateDistance(prev.centroid, curr.centroid);
  const speed = centroidDistance > 0 ? centroidDistance / timeDelta : 0;
  if (speed > MAX_HAND_SPEED) return Infinity;
  const centroidCost = centroidDistance + speed * SPEED_COST_WEIGHT;

  // Per-finger movement cost: sum distance each shared finger travels
  let perFingerTotal = 0;
  let maxFingerJump = 0;
  let sharedFingerCount = 0;

  for (const [finger, currCoord] of Object.entries(curr.fingers) as [FingerType, FingerCoordinate][]) {
    const prevCoord = prev.fingers[finger];
    if (prevCoord) {
      const dist = fingerCoordinateDistance(prevCoord, currCoord);
      perFingerTotal += dist;
      if (dist > maxFingerJump) maxFingerJump = dist;
      sharedFingerCount++;
    }
  }

  const perFingerCost = sharedFingerCount > 0
    ? (perFingerTotal / sharedFingerCount) * PER_FINGER_MOVEMENT_WEIGHT
      + maxFingerJump * MAX_FINGER_JUMP_WEIGHT
    : 0;

  // If both centroid and per-finger show zero movement, cost is 0
  if (centroidCost === 0 && perFingerCost === 0) return 0;

  return centroidCost + perFingerCost;
}
