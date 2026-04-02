/**
 * Canonical Biomechanical Model.
 *
 * Single source of truth for all hand anatomy rules, physical constants,
 * and constraint parameters. Every other module imports from here —
 * no biomechanical constant should be defined elsewhere.
 *
 * Categories:
 *   Hard Constraints  — reject a candidate outright (infeasible)
 *   Soft Costs        — scored, not rejected (performability)
 *   Diagnostics       — computed for display, not used in beam score
 *
 * See docs/biomechanical-model.md for full reference.
 */

import { type PadCoord } from '../../types/padGrid';
import { type FingerType } from '../../types/fingerModel';

// Re-export DEFAULT_HAND_POSE so consumers can import from one place.
export { DEFAULT_HAND_POSE } from './handPose';

// ============================================================================
// Euclidean Distance Utility
// ============================================================================

/**
 * Euclidean distance between two grid positions (PadCoord).
 * Canonical implementation — all other modules should use this.
 */
export function calculateGridDistance(a: PadCoord, b: PadCoord): number {
  const dr = a.row - b.row;
  const dc = a.col - b.col;
  return Math.sqrt(dr * dr + dc * dc);
}

// ============================================================================
// Hand Model Interface
// ============================================================================

/**
 * HandModel: Encapsulates all biomechanical parameters for a single hand.
 * Currently uses a single DEFAULT_HAND_MODEL; future work could allow
 * per-user calibration.
 */
export interface HandModel {
  /** Maximum distance a single hand can span (thumb-to-pinky envelope). */
  maxHandSpan: number;
  /** Maximum reach distance per finger movement (grid units). */
  maxReach: number;
  /** Maximum hand movement speed (grid units per second). */
  maxSpeed: number;
  /** Per-finger-pair maximum span. */
  pairSpanStrict: Record<string, number>;
  /** Thumb delta — max vertical offset from index. */
  thumbDelta: number;
  /** Finger ordering for constraint checking (pinky → thumb). */
  fingerOrder: FingerType[];
  /** Per-finger preference cost (discourages weak fingers). */
  fingerPreferenceCost: Record<FingerType, number>;
  /** Fallback span limit for unlisted finger pairs. */
  fallbackPairSpan: number;
}

// ============================================================================
// Hard Constraint Constants
// ============================================================================

// -- Span Constraints --

/** Maximum Euclidean distance for any unlisted finger pair (fallback). */
export const MAX_FINGER_SPAN_STRICT = 5.5;

/**
 * Canonical pair key: sort two FingerTypes alphabetically, join with ','.
 * Ensures symmetric lookup (index,middle === middle,index).
 */
export function pairKey(a: FingerType, b: FingerType): string {
  return [a, b].sort().join(',');
}

/**
 * Per-pair maximum Euclidean span (grid units) — Tier 1 (Strict).
 * Values reflect anatomical finger spread limits on the Push 3 grid.
 *
 * Anatomical justification:
 * - Adjacent fingers (index-middle, middle-ring): ~2.0 units moderate spread
 * - Pinky-ring: 1.5 units, anatomically linked tendons = least independent spread
 * - One-apart pairs: 2.0–2.5 units depending on connective tissue
 * - Two-apart (index-pinky): 4.0 units, significant stretch
 * - Thumb pairs: higher values due to thumb's independent range of motion
 */
export const FINGER_PAIR_MAX_SPAN_STRICT: Record<string, number> = {
  'index,middle':  2.0,
  'middle,ring':   2.0,
  'pinky,ring':    1.5,
  'index,ring':    2.0,
  'middle,pinky':  2.5,
  'index,pinky':   4.0,
  'index,thumb':   3.5,
  'middle,thumb':  4.5,
  'ring,thumb':    5.5,
  'pinky,thumb':   5.5,  // Matches MAX_HAND_SPAN; previous 7.0 allowed anatomically impossible vertical spans
};

// -- Thumb Constraints --

/**
 * Maximum vertical offset of thumb relative to index finger (strict).
 * Enforces "thumbs below other fingers" — natural vertical arrangement.
 */
export const THUMB_DELTA = 1.0;

// -- Physical Envelope --

/** Maximum distance a single hand can span comfortably (grid units). */
export const MAX_HAND_SPAN = 5.5;

/** Maximum reach distance in grid units (per finger movement). */
export const MAX_REACH_GRID_UNITS = 5.0;

/**
 * Maximum hand movement speed (grid units per second).
 * Movements exceeding this speed are physically impossible → Infinity cost.
 */
export const MAX_SPEED_UNITS_PER_SEC = 12.0;

// -- Finger Ordering --

/**
 * Ordered list of fingers for constraint checking.
 * Order: pinky (0) → ring (1) → middle (2) → index (3) → thumb (4)
 *
 * Used by topology checks:
 * - Left hand (L→R on grid): pinky ≤ ring ≤ middle ≤ index ≤ thumb + delta
 * - Right hand (L→R on grid): thumb − delta ≤ index ≤ middle ≤ ring ≤ pinky
 */
export const FINGER_ORDER: FingerType[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

// ============================================================================
// Soft Cost Constants
// ============================================================================

/**
 * Per-finger-type selection cost.
 * Higher values discourage the solver from choosing that finger.
 * Index and middle are preferred for percussion; thumb and pinky are discouraged.
 */
export const FINGER_PREFERENCE_COST: Record<FingerType, number> = {
  index:  0.0,   // Preferred — no penalty
  middle: 0.0,   // Preferred — no penalty
  ring:   1.0,   // Slightly suboptimal
  pinky:  3.0,   // Discouraged
  thumb:  5.0,   // Very discouraged for percussion
};

/** Maximum physiological hand movement speed in grid units per second. */
export const MAX_HAND_SPEED = 12.0;

/** Weight factor for speed component in transition cost (Fitts's Law). */
export const SPEED_COST_WEIGHT = 0.5;

/**
 * Weight for average per-finger movement in transition cost.
 * Captures individual finger travel that centroid distance misses.
 * E.g., index jumping 6 pads while the hand centroid barely moves.
 */
export const PER_FINGER_MOVEMENT_WEIGHT = 1.0;

/**
 * Extra penalty weight for the worst-case single finger jump.
 * Discourages layouts where one finger does all the traveling.
 */
export const MAX_FINGER_JUMP_WEIGHT = 0.8;

// V1 Cost Model (D-01): RELAXED_GRIP_PENALTY and FALLBACK_GRIP_PENALTY removed.
// Grips are either feasible (strict tier) or rejected outright.

/** If a chord spread is wider than this, it gets a penalty. */
export const CHORD_PENALTY_THRESHOLD = 3.0;

// -- Alternation --

/** Time threshold below which same-finger repetition is penalized. */
export const ALTERNATION_DT_THRESHOLD = 0.25;

/** Base penalty for same-finger repetition on short dt. */
export const ALTERNATION_PENALTY = 1.5;

// -- Hand Balance --

/** Target left-hand share for right-handed bias (0.45 = 55% right). */
export const HAND_BALANCE_TARGET_LEFT = 0.45;

/** Weight for quadratic hand-balance penalty. */
export const HAND_BALANCE_WEIGHT = 2.0;

/** Minimum total notes before applying hand balance penalty. */
export const HAND_BALANCE_MIN_NOTES = 2;

// -- Activation --

/** Activation cost when a finger is first placed (no prior position). */
export const ACTIVATION_COST = 5.0;

// ============================================================================
// Named Constraint Rules
// ============================================================================

/**
 * Named constraint rules — each encodes a specific biomechanical invariant.
 * Used by diagnostic mode to report which rule rejected a grip.
 */
export type ConstraintRuleName =
  | 'span'           // Per-pair span exceeds limit
  | 'ordering'       // Finger ordering violation (crossover)
  | 'collision'      // Two fingers on same pad
  | 'thumbDelta'     // Thumb too far above other fingers
  | 'topology'       // Left/right hand topology violation
  | 'reachability'   // Finger outside reach given hand anchor
  | 'speed'          // Transition too fast (exceeds MAX_HAND_SPEED)
  | 'zone'           // Hand in wrong zone (left hand in right territory)
  | 'outwardRotation'; // Outer finger below inner finger requires unnatural hand rotation

/**
 * GripRejection: Diagnostic data for why a grip was rejected.
 * Collected when feasibility functions run in diagnostic mode.
 */
export interface GripRejection {
  /** Which finger(s) caused the violation. */
  fingerA: FingerType;
  fingerB: FingerType;
  /** Which constraint rule was violated. */
  rule: ConstraintRuleName;
  /** Actual measured value (e.g., distance between fingers). */
  actual: number;
  /** Maximum allowed value for this constraint. */
  limit: number;
}

// ============================================================================
// Default Hand Model
// ============================================================================

/**
 * Default hand model for Push 3 surface.
 * Encapsulates all biomechanical parameters in a single object.
 */
export const DEFAULT_HAND_MODEL: HandModel = {
  maxHandSpan: MAX_HAND_SPAN,
  maxReach: MAX_REACH_GRID_UNITS,
  maxSpeed: MAX_SPEED_UNITS_PER_SEC,
  pairSpanStrict: FINGER_PAIR_MAX_SPAN_STRICT,
  thumbDelta: THUMB_DELTA,
  fingerOrder: FINGER_ORDER,
  fingerPreferenceCost: FINGER_PREFERENCE_COST,
  fallbackPairSpan: MAX_FINGER_SPAN_STRICT,
};
