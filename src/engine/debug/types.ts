/**
 * Optimization Debugging Framework — Core Types.
 *
 * Data structures for deep introspection of optimization decisions,
 * cost breakdowns, constraint violations, and sanity checks.
 */

import { type FingerType } from '../../types/fingerModel';
import { type DifficultyLevel } from '../../types/executionPlan';

// ============================================================================
// Part 1 — Optimization Evaluation Record
// ============================================================================

/**
 * Per-event cost breakdown captured during optimization.
 * Maps to the actual cost components computed by the beam solver.
 */
export interface EventCostBreakdown {
  /** Fitts's Law movement cost (distance + speed). */
  travel: number;
  /** Speed component of transition cost. */
  transitionSpeed: number;
  /** Pose naturalness score (attractor + per-finger home + dominance). */
  pose: number;
  /** Zone violation penalty (hand used outside preferred zone). */
  zoneViolation: number;
  /** Finger dominance penalty (pinky/thumb discouraged). */
  fingerPenalty: number;
  /** Same-finger rapid repetition penalty. */
  repetitionPenalty: number;
  /** Simultaneous finger collision penalty. */
  collisionPenalty: number;
  /** Hard constraint penalty (fallback/relaxed grips). */
  feasibilityPenalty: number;
}

/**
 * Full evaluation record for a single event in the execution plan.
 * Captures all signals used in scoring decisions.
 */
export interface OptimizationEvaluationRecord {
  /** Index of this event in the performance sequence. */
  eventIndex: number;
  /** Absolute timestamp in seconds. */
  timestamp: number;
  /** Pad position [row, col]. */
  pad: [number, number];
  /** Which hand was assigned. */
  hand: 'left' | 'right' | 'Unplayable';
  /** Which finger was assigned (null if unplayable). */
  finger: FingerType | null;
  /** Previous pad position (null for first event). */
  previousPad: [number, number] | null;
  /** Previous finger used (null for first event). */
  previousFinger: FingerType | null;
  /** Previous hand used. */
  previousHand: 'left' | 'right' | 'Unplayable' | null;
  /** MIDI note number. */
  noteNumber: number;
  /** Difficulty classification. */
  difficulty: DifficultyLevel;
  /** Full cost breakdown. */
  costs: EventCostBreakdown;
  /** Total cost for this event. */
  totalCost: number;
  /** Time delta from previous event (seconds). */
  timeDelta: number;
  /** Euclidean distance from previous pad. */
  movementDistance: number;
}

// ============================================================================
// Part 2 — Candidate Report Types
// ============================================================================

/** Per-finger usage statistics as percentages. */
export interface FingerUsageBreakdown {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

/** Per-hand usage breakdown. */
export interface HandUsageBreakdown {
  left: number;
  right: number;
  unplayable: number;
}

/** Aggregated cost totals across all events. */
export interface CostTotals {
  travel: number;
  transitionSpeed: number;
  pose: number;
  zoneViolation: number;
  fingerPenalty: number;
  repetitionPenalty: number;
  collisionPenalty: number;
  feasibilityPenalty: number;
  total: number;
}

/** Summary of a constraint violation in the candidate report. */
export interface ConstraintViolationSummary {
  eventIndex: number;
  constraintName: string;
  explanation: string;
  severity: 'warning' | 'error';
}

/** Full candidate solution report. */
export interface CandidateReport {
  /** Candidate solution ID. */
  candidateId: string;
  /** Layout: pad key -> voice name mapping. */
  layoutSummary: Record<string, string>;
  /** Finger usage percentages (per hand). */
  fingerUsage: {
    left: FingerUsageBreakdown;
    right: FingerUsageBreakdown;
    combined: FingerUsageBreakdown;
  };
  /** Hand usage percentages. */
  handUsage: HandUsageBreakdown;
  /** Aggregated cost totals. */
  costTotals: CostTotals;
  /** Average costs per event. */
  costAverages: CostTotals;
  /** All constraint violations. */
  constraintViolations: ConstraintViolationSummary[];
  /** All evaluation records (sorted by event index). */
  evaluationRecords: OptimizationEvaluationRecord[];
  /** Total event count. */
  totalEvents: number;
  /** Strategy used to generate this candidate. */
  strategy: string;
  /** Generation timestamp. */
  generatedAt: string;
}

// ============================================================================
// Part 3 — Irrational Assignment Detection
// ============================================================================

/** Severity of an irrational assignment. */
export type IrrationalSeverity = 'suspicious' | 'likely_irrational' | 'definitely_irrational';

/** A detected irrational finger assignment. */
export interface IrrationalAssignment {
  /** Event index where the irrational assignment was detected. */
  eventIndex: number;
  /** The finger that was assigned. */
  assignedFinger: FingerType;
  /** Fingers that would have been better choices. */
  betterAlternatives: FingerType[];
  /** Rule name that flagged this. */
  ruleName: string;
  /** Human-readable explanation. */
  explanation: string;
  /** How confident we are this is irrational. */
  severity: IrrationalSeverity;
  /** Cost of the assigned finger. */
  assignedCost: number;
}

// ============================================================================
// Part 4 — Constraint Violation Types
// ============================================================================

/** A specific constraint violation detected in validation. */
export interface ConstraintViolation {
  /** Event index where the violation occurred. */
  eventIndex: number;
  /** Name of the violated constraint. */
  constraintName:
    | 'impossible_reach'
    | 'simultaneous_collision'
    | 'tempo_infeasible'
    | 'zone_violation'
    | 'finger_ordering'
    | 'span_exceeded'
    | 'speed_exceeded'
    | 'pad_ownership_inconsistency';
  /** Human-readable explanation. */
  explanation: string;
  /** Measured value that violated the constraint. */
  actual: number;
  /** Threshold/limit for the constraint. */
  limit: number;
  /** Whether this is a hard (reject) or soft (penalize) constraint. */
  type: 'hard' | 'soft';
}

// ============================================================================
// Part 5 — Visualization Data Structures
// ============================================================================

/** Single point in the event cost timeline. */
export interface EventCostTimelinePoint {
  eventIndex: number;
  timestamp: number;
  totalCost: number;
  travel: number;
  pose: number;
  fingerPenalty: number;
  zoneViolation: number;
  repetitionPenalty: number;
  feasibilityPenalty: number;
}

/** Single point in the finger usage timeline. */
export interface FingerUsageTimelinePoint {
  /** Time window start. */
  windowStart: number;
  /** Time window end. */
  windowEnd: number;
  /** Counts per finger in this window. */
  counts: Record<FingerType, number>;
}

/** Single point in the movement distance timeline. */
export interface MovementDistanceTimelinePoint {
  eventIndex: number;
  timestamp: number;
  distance: number;
  fromPad: [number, number];
  toPad: [number, number];
  hand: 'left' | 'right';
}

/** Zone violation event for visualization. */
export interface ZoneViolationEvent {
  eventIndex: number;
  timestamp: number;
  pad: [number, number];
  hand: 'left' | 'right';
  /** How far outside the preferred zone. */
  violationDistance: number;
}

/** Complete visualization dataset. */
export interface VisualizationData {
  eventCostTimeline: EventCostTimelinePoint[];
  fingerUsageTimeline: FingerUsageTimelinePoint[];
  movementDistanceTimeline: MovementDistanceTimelinePoint[];
  zoneViolationEvents: ZoneViolationEvent[];
}

// ============================================================================
// Part 8 — Sanity Check Types
// ============================================================================

/** Result of a single sanity check. */
export interface SanityCheckResult {
  /** Name of the check. */
  name: string;
  /** Whether the check passed. */
  passed: boolean;
  /** Measured value. */
  actual: number;
  /** Threshold for passing. */
  threshold: number;
  /** Human-readable message. */
  message: string;
  /** Severity if failed. */
  severity: 'info' | 'warning' | 'error';
}

/** Aggregate sanity check report. */
export interface SanityCheckReport {
  checks: SanityCheckResult[];
  allPassed: boolean;
  warnings: number;
  errors: number;
}
