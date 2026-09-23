/**
 * Canonical Cost Breakdown Types.
 *
 * These types define the structured output of cost evaluation.
 * All consumers (optimizer, event analysis, grid editor, comparison tools)
 * should use these types instead of ad-hoc breakdowns.
 *
 * The canonical cost vector has 5 named dimensions. Each is a raw cost
 * (lower = better, 0 = no cost).
 */

import { type FingerType, type HandSide } from './fingerModel';
import { type FeasibilityVerdict } from './diagnostics';
import { type HandPose } from './performance';
import { type PadFingerAssignment } from './executionPlan';
import { type ConstraintTier } from '../engine/prior/feasibility';
import { type CostToggles } from './costToggles';

// ============================================================================
// Canonical Cost Dimensions
// ============================================================================

/**
 * CostDimensions: The canonical 5-dimension cost vector.
 *
 * Every evaluation output includes this. The names match the engine's
 * actual computations — no misleading aliases.
 */
export interface CostDimensions {
  /** Grip quality: attractor + perFingerHome + fingerDominance. */
  poseNaturalness: number;
  /** Fitts's Law movement penalty between consecutive moments. */
  transitionCost: number;
  /** Hard penalty for relaxed/fallback grips (0 for strict tier). */
  constraintPenalty: number;
  /** Same-finger rapid repetition penalty. */
  alternation: number;
  /** Left/right hand distribution imbalance. */
  handBalance: number;
  /** Sum of all dimensions. */
  total: number;
}

/**
 * Sub-breakdown of poseNaturalness into its three components.
 */
export interface PoseNaturalnessDetail {
  /** Spring force pulling hands toward resting pose centroid. */
  attractor: number;
  /** Per-finger distance from neutral home positions. */
  perFingerHome: number;
  /** Anatomical finger preference cost (weaker fingers cost more). */
  fingerDominance: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Creates a zero-valued CostDimensions. */
export function createZeroCostDimensions(): CostDimensions {
  return {
    poseNaturalness: 0,
    transitionCost: 0,
    constraintPenalty: 0,
    alternation: 0,
    handBalance: 0,
    total: 0,
  };
}

/** Sum two CostDimensions. */
export function sumCostDimensions(a: CostDimensions, b: CostDimensions): CostDimensions {
  return {
    poseNaturalness: a.poseNaturalness + b.poseNaturalness,
    transitionCost: a.transitionCost + b.transitionCost,
    constraintPenalty: a.constraintPenalty + b.constraintPenalty,
    alternation: a.alternation + b.alternation,
    handBalance: a.handBalance + b.handBalance,
    total: a.total + b.total,
  };
}

/** Compute the arithmetic mean of a list of CostDimensions. */
export function averageCostDimensions(list: CostDimensions[]): CostDimensions {
  if (list.length === 0) return createZeroCostDimensions();
  const sum = list.reduce(sumCostDimensions, createZeroCostDimensions());
  const n = list.length;
  return {
    poseNaturalness: sum.poseNaturalness / n,
    transitionCost: sum.transitionCost / n,
    constraintPenalty: sum.constraintPenalty / n,
    alternation: sum.alternation / n,
    handBalance: sum.handBalance / n,
    total: sum.total / n,
  };
}

/** Compute total from dimension values. */
export function computeTotal(d: Omit<CostDimensions, 'total'>): number {
  return d.poseNaturalness + d.transitionCost + d.constraintPenalty + d.alternation + d.handBalance;
}

// ============================================================================
// Event Cost Breakdown
// ============================================================================

/** Per-note assignment detail within a moment. */
export interface NoteEvaluationDetail {
  noteNumber: number;
  voiceId?: string;
  padKey: string;
  hand: HandSide;
  finger: FingerType;
}

/**
 * EventCostBreakdown: Structured cost output for a single performance moment.
 */
export interface EventCostBreakdown {
  /** Index of this moment in the performance timeline. */
  momentIndex: number;
  /** Absolute start time in seconds. */
  timestamp: number;
  /** The 5-dimension cost vector for this moment. */
  dimensions: CostDimensions;
  /** Sub-breakdown of poseNaturalness. */
  poseDetail: PoseNaturalnessDetail;
  /** Which feasibility tier was used for the grip. */
  feasibilityTier: ConstraintTier;
  /**
   * Named, countable reasons this moment is hard or impossible.
   *
   * These are kept separate so the UI can distinguish a physical impossibility
   * (one finger asked to hit two pads at once, or a note with no pad at all)
   * from a break of the hand-separation rule (a hand outside its zone).
   * Reporting them as one undifferentiated number is what made earlier
   * verdicts untrustworthy.
   */
  violations: {
    /** Notes in this moment whose finger is already busy on another pad. */
    collisions: number;
    /** Pads played by a hand outside its zone — the hand-separation rule broken. */
    zoneReaches: number;
    /** Hands whose simultaneous grip fails the strict geometry rules. */
    gripViolations: number;
    /** Notes in this moment that resolve to no pad in the layout. */
    unmapped: number;
  };
  /** Per-note assignments within this moment. */
  noteAssignments: NoteEvaluationDetail[];
  /** Debug info (only when includeDebug is true). */
  debug?: {
    handPoses: { left?: HandPose; right?: HandPose };
  };
}

// ============================================================================
// Transition Cost Breakdown
// ============================================================================

/**
 * TransitionCostBreakdown: Structured cost output for a transition between
 * two consecutive moments.
 */
export interface TransitionCostBreakdown {
  fromMomentIndex: number;
  toMomentIndex: number;
  fromTimestamp: number;
  toTimestamp: number;
  timeDeltaMs: number;
  /** The 5-dimension cost vector for this transition. */
  dimensions: CostDimensions;
  /**
   * True when a hand would have to move faster than physiologically possible.
   *
   * Asked as an explicit question rather than inferred from an infinite cost, so
   * that every cost stays finite and comparable while genuine impossibility is
   * still reported.
   */
  exceedsSpeedLimit: boolean;
  /** Movement-specific metrics. */
  movement: {
    gridDistance: number;
    speedPressure: number;
    handSwitch: boolean;
    fingerChange: boolean;
  };
  /** Debug info (only when includeDebug is true). */
  debug?: {
    fromHandPoses: { left?: HandPose; right?: HandPose };
    toHandPoses: { left?: HandPose; right?: HandPose };
    rawFittsLawCost: number;
  };
}

// ============================================================================
// Performance Cost Breakdown
// ============================================================================

/** Aggregate metrics across all moments. */
export interface AggregateMetrics {
  averageDimensions: CostDimensions;
  peakDimensions: CostDimensions;
  peakMomentIndex: number;
  hardMomentCount: number;
  infeasibleMomentCount: number;
  momentCount: number;
  transitionCount: number;
}

/**
 * PerformanceCostBreakdown: Full structured cost output for an entire
 * performance sequence.
 *
 * This is the primary output of evaluatePerformance().
 */
export interface PerformanceCostBreakdown {
  /**
   * Total cost across all moments and transitions.
   *
   * This is a raw SUM, so it grows with how much music the project contains —
   * the same two-pad pattern totals ~0.2 over 4 moments and ~12 over 256. Use it
   * for internal ranking within one performance only. Anything shown to the user,
   * or compared across passages of different lengths, must use `costPerMoment`.
   */
  total: number;
  /**
   * Length-independent cost: `total` divided by the number of moments.
   *
   * This is the figure that is meaningful to a person — it does not get worse
   * simply because the piece is longer, and it is comparable between sections.
   */
  costPerMoment: number;
  /** Aggregated cost dimensions. */
  dimensions: CostDimensions;
  /** Per-moment cost breakdowns. */
  eventCosts: EventCostBreakdown[];
  /** Per-transition cost breakdowns. */
  transitionCosts: TransitionCostBreakdown[];
  /** Summary aggregate metrics. */
  aggregateMetrics: AggregateMetrics;
  /** Feasibility verdict for the entire performance. */
  feasibility: FeasibilityVerdict;
  /** Echo back the assignment that was evaluated. */
  padFingerAssignment: PadFingerAssignment;
  /** Which cost toggles were active during this evaluation. */
  costTogglesUsed?: CostToggles;
}

// ============================================================================
// Layout Comparison
// ============================================================================

/**
 * LayoutComparisonResult: Structured comparison of two layout+assignment pairs.
 */
export interface LayoutComparisonResult {
  costA: PerformanceCostBreakdown;
  costB: PerformanceCostBreakdown;
  /** Per-dimension delta (B minus A). Negative = B is better. */
  dimensionDeltas: CostDimensions;
  overallDelta: number;
  winner: 'A' | 'B' | 'tie';
  perMomentDeltas: {
    momentIndex: number;
    deltaTotal: number;
    winnerThisMoment: 'A' | 'B' | 'tie';
  }[];
  layoutChanges: {
    padKey: string;
    voiceA?: string;
    voiceB?: string;
  }[];
  assignmentChanges: {
    padKey: string;
    fingerA?: { hand: HandSide; finger: FingerType };
    fingerB?: { hand: HandSide; finger: FingerType };
  }[];
}

// ============================================================================
// Assignment Validation
// ============================================================================

export type AssignmentIssueType =
  | 'ownership_conflict'
  | 'infeasible_grip'
  | 'unmapped_note'
  | 'hand_zone_violation';

export interface AssignmentIssue {
  type: AssignmentIssueType;
  padKey?: string;
  momentIndex?: number;
  message: string;
}

/**
 * AssignmentValidationResult: Validates that a PadFingerAssignment is
 * internally consistent and biomechanically feasible.
 */
export interface AssignmentValidationResult {
  valid: boolean;
  issues: AssignmentIssue[];
}
