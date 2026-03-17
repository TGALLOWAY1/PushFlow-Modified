/**
 * Temporal Evaluator Types.
 *
 * Types for the dedicated multi-moment temporal constraint validation harness.
 * Calls evaluatePerformance(), evaluateTransition(), and validateAssignment()
 * directly — no solver involvement.
 */

import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type ConstraintRuleName } from '../../engine/prior/biomechanicalModel';
import {
  type CostDimensions,
  type PerformanceCostBreakdown,
  type TransitionCostBreakdown,
  type EventCostBreakdown,
  type AssignmentValidationResult,
} from '../../types/costBreakdown';

// ============================================================================
// Scenario Definition
// ============================================================================

/**
 * A saved temporal test scenario.
 *
 * Each scenario provides a fixed layout, finger assignment, and ordered
 * moment sequence that demonstrates a specific temporal constraint
 * violation (or valid state).
 */
export interface TemporalScenario {
  /** Unique scenario ID (e.g., 'T1'). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Explanation of what this scenario demonstrates. */
  description: string;
  /** Which constraint rules this scenario tests. */
  constraintIds: ConstraintRuleName[];
  /** Ordered array of performance moments (the temporal sequence). */
  moments: PerformanceMoment[];
  /** Layout with pad-to-voice mapping. */
  layout: Layout;
  /** Pre-built finger assignment. */
  padFingerAssignment: PadFingerAssignment;
  /** Expected initial status on load. */
  expectedInitialStatus: 'valid' | 'degraded' | 'violation';
  /** Optional: which transition index first fails. */
  expectedFirstFailureIndex?: number;
  /** Optional: expected status after a documented fix. */
  expectedStatusAfterKnownMove?: 'valid' | 'degraded' | 'violation';
  /** Optional: explain why this scenario exists. */
  notesForWhyThisScenarioExists?: string;
  /** Optional hint for how to fix or break the scenario. */
  fixHint?: string;
}

// ============================================================================
// Evidence
// ============================================================================

/**
 * Structured evidence for a temporal constraint violation.
 */
export interface TemporalConstraintEvidence {
  /** Which constraint rule was violated. */
  constraintId: string;
  /** Hard = infeasible, soft = degraded but feasible. */
  severity: 'hard' | 'soft';
  /** Human-readable explanation. */
  message: string;
  /** Transition index (between moments). */
  transitionIndex?: number;
  /** Moment index. */
  momentIndex?: number;
  /** Pad keys involved. */
  pads?: string[];
  /** MIDI note numbers involved. */
  notes?: number[];
  /** Finger names involved. */
  fingers?: string[];
  /** Hand involved. */
  hand?: 'left' | 'right';
  /** Measured value (e.g., speed, distance). */
  measuredValue?: number;
  /** Threshold that was exceeded. */
  threshold?: number;
  /** Feasibility tier context. */
  tier?: 'strict' | 'relaxed' | 'fallback' | 'invalid';
  /** Additional debug data. */
  debug?: Record<string, unknown>;
}

// ============================================================================
// Transition Status
// ============================================================================

export type TransitionStatus = 'valid' | 'degraded' | 'violation';

export interface TransitionResult {
  /** Index of this transition (between moment i and i+1). */
  transitionIndex: number;
  /** Status of this transition. */
  status: TransitionStatus;
  /** Cost breakdown from evaluateTransition. */
  costBreakdown: TransitionCostBreakdown;
  /** Evidence for any violations. */
  evidence: TemporalConstraintEvidence[];
}

// ============================================================================
// Full Evaluation Result
// ============================================================================

export type OverallStatus = 'valid' | 'degraded' | 'violation';
export type FeasibilityTier = 'strict' | 'relaxed' | 'fallback' | 'invalid';

export interface TemporalEvaluationResult {
  /** Overall status: valid, degraded, or violation. */
  overallStatus: OverallStatus;
  /** Overall feasibility tier. */
  feasibilityTier: FeasibilityTier;
  /** Index of the first failing transition (-1 if none). */
  firstFailingTransitionIndex: number;
  /** Index of the first failing moment (-1 if none). */
  firstFailingMomentIndex: number;
  /** Aggregate cost dimensions. */
  dimensions: CostDimensions;
  /** Full performance cost breakdown. */
  performanceCost: PerformanceCostBreakdown;
  /** Per-transition results. */
  transitionResults: TransitionResult[];
  /** Per-event cost breakdowns. */
  eventCosts: EventCostBreakdown[];
  /** Assignment validation result. */
  assignmentValidation: AssignmentValidationResult;
  /** All evidence items. */
  evidence: TemporalConstraintEvidence[];
}

// ============================================================================
// Page State
// ============================================================================

export interface TemporalEvaluatorState {
  /** Currently selected scenario ID. */
  selectedScenarioId: string;
  /** Current layout (may be edited by user). */
  layout: Layout;
  /** Current finger assignment (may be edited by user). */
  padFingerAssignment: PadFingerAssignment;
  /** Current moment sequence (padIds updated when layout changes). */
  moments: PerformanceMoment[];
  /** Currently selected moment index for inspection. */
  selectedMomentIndex: number;
  /** Latest evaluation result. */
  result: TemporalEvaluationResult | null;
  /** Whether the state has been edited from the original scenario. */
  isDirty: boolean;
}
