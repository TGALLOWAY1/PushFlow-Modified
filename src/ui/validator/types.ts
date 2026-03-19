/**
 * Atomic Constraint Validator Types.
 *
 * Types for the dedicated single-moment constraint validation harness.
 * This validator calls evaluateEvent() and validateAssignment() directly —
 * no solver involvement.
 */

import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type ConstraintRuleName, type GripRejection } from '../../engine/prior/biomechanicalModel';
import { type ConstraintTier } from '../../engine/prior/feasibility';
import {
  type CostDimensions,
  type EventCostBreakdown,
  type AssignmentValidationResult,
  type PoseNaturalnessDetail,
} from '../../types/costBreakdown';

// ============================================================================
// Scenario Definition
// ============================================================================

/**
 * A single pre-built validator scenario.
 *
 * Each scenario provides a fixed layout, finger assignment, and moment
 * that demonstrates a specific constraint violation (or valid state).
 */
export interface ValidatorScenario {
  /** Unique scenario ID (e.g., 'V1', 'V2'). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Explanation of what this scenario demonstrates. */
  description: string;
  /** Which biomechanical rules this scenario tests. */
  constraintIds: ConstraintRuleName[];
  /** Single moment with all notes occurring simultaneously. */
  moment: PerformanceMoment;
  /** Layout with pad-to-voice mapping. */
  layout: Layout;
  /** Pre-built finger assignment (may demonstrate a violation). */
  padFingerAssignment: PadFingerAssignment;
  /** Whether the scenario should be valid or violating on load. */
  expectedInitialStatus: 'valid' | 'violation';
  /** Optional hint for how to fix or break the scenario by dragging. */
  fixHint?: string;
}

// ============================================================================
// Evidence
// ============================================================================

/**
 * Structured evidence for a specific constraint violation.
 *
 * Every violation produces one or more evidence items with enough detail
 * to understand exactly what failed and why.
 */
export interface ConstraintViolationEvidence {
  /** Which constraint rule was violated. */
  constraintId: ConstraintRuleName | 'unmapped_note' | 'ownership_conflict' | 'missing_assignment';
  /** Hard = infeasible, soft = degraded but feasible. */
  severity: 'hard' | 'soft';
  /** Human-readable explanation. */
  message: string;
  /** Pad keys involved. */
  pads?: string[];
  /** MIDI note numbers involved. */
  notes?: number[];
  /** Finger names involved. */
  fingers?: string[];
  /** Hand involved. */
  hand?: 'left' | 'right';
  /** Measured value (e.g., distance between fingers). */
  measuredValue?: number;
  /** Threshold that was exceeded. */
  threshold?: number;
  /** Feasibility tier context. */
  tier?: ConstraintTier;
  /** Additional debug data. */
  debug?: Record<string, unknown>;
}

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Complete validation result assembled by the validator engine.
 */
export interface ValidatorResult {
  /** Overall status: valid or violation. */
  status: 'valid' | 'violation';
  /** Feasibility tier from evaluateEvent ('strict' in V1). */
  feasibilityTier: ConstraintTier;
  /** Full 5-dimension cost vector. */
  dimensions: CostDimensions;
  /** Pose sub-breakdown (attractor, perFingerHome, fingerDominance). */
  poseDetail: PoseNaturalnessDetail;
  /** Full EventCostBreakdown from evaluateEvent. */
  eventBreakdown: EventCostBreakdown | null;
  /** validateAssignment result. */
  assignmentValidation: AssignmentValidationResult;
  /** Extracted violation evidence. */
  evidence: ConstraintViolationEvidence[];
  /** Raw grip rejections from feasibility diagnostic mode. */
  gripRejections: GripRejection[];
}

// ============================================================================
// Page State
// ============================================================================

/**
 * Mutable state for the validator page.
 */
export interface ValidatorState {
  /** Currently selected scenario ID. */
  selectedScenarioId: string;
  /** Current layout (may be edited by user). */
  layout: Layout;
  /** Current finger assignment (may be edited by user). */
  padFingerAssignment: PadFingerAssignment;
  /** Current moment (padIds updated when layout changes). */
  moment: PerformanceMoment;
  /** Latest validation result (null before first evaluation). */
  result: ValidatorResult | null;
}
