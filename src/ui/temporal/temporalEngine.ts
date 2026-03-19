/**
 * Temporal Evaluator Engine.
 *
 * Connects the temporal evaluator UI to the canonical evaluator.
 * Calls evaluatePerformance(), evaluateTransition(), and validateAssignment()
 * directly — no solver dependency.
 *
 * Produces structured per-transition evidence, identifies the first failing
 * transition, and determines overall temporal feasibility.
 */

import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type InstrumentConfig, type RestingPose } from '../../types/performance';
import { createZeroCostDimensions } from '../../types/costBreakdown';
import {
  evaluatePerformance,
  validateAssignment,
} from '../../engine/evaluation/canonicalEvaluator';
import {
  resolveNeutralPadPositions,
  computeNeutralHandCenters,
} from '../../engine/prior/handPose';
import {
  MAX_HAND_SPEED,
  ALTERNATION_DT_THRESHOLD,
} from '../../engine/prior/biomechanicalModel';

import {
  type TemporalEvaluationResult,
  type TemporalConstraintEvidence,
  type TransitionResult,
  type TransitionStatus,
  type OverallStatus,
  type FeasibilityTier,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const TEMPORAL_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'temporal-evaluator',
  name: 'Push 3',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

const TEMPORAL_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 1, y: 1 },
      index: { x: 2, y: 2 },
      middle: { x: 3, y: 3 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 6, y: 1 },
      index: { x: 5, y: 2 },
      middle: { x: 4, y: 3 },
    },
  },
};

// Thresholds for classifying transition severity
const TRANSITION_COST_DEGRADED_THRESHOLD = 2.0;
const TRANSITION_COST_VIOLATION_THRESHOLD = 10.0;

/**
 * Build an EvaluationConfig for the temporal evaluator.
 */
export function buildTemporalEvaluationConfig(layout: Layout): EvaluationConfig {
  const neutralPads = resolveNeutralPadPositions(layout, TEMPORAL_INSTRUMENT_CONFIG);
  const neutralHandCenters = computeNeutralHandCenters(neutralPads);
  return {
    restingPose: TEMPORAL_RESTING_POSE,
    stiffness: 0.3,
    instrumentConfig: TEMPORAL_INSTRUMENT_CONFIG,
    neutralHandCenters,
  };
}

// ============================================================================
// Main Evaluation Entry Point
// ============================================================================

/**
 * Run full temporal evaluation on a layout + assignment + moment sequence.
 *
 * 1. Build EvaluationConfig
 * 2. validateAssignment (consistency checks)
 * 3. evaluatePerformance (full sequence evaluation)
 * 4. Extract per-transition evidence
 * 5. Identify first failing transition
 * 6. Assemble TemporalEvaluationResult
 */
export function runTemporalEvaluation(
  layout: Layout,
  padFingerAssignment: PadFingerAssignment,
  moments: PerformanceMoment[],
): TemporalEvaluationResult {
  if (moments.length === 0) {
    return emptyResult(padFingerAssignment);
  }

  const config = buildTemporalEvaluationConfig(layout);

  // 1. Validate assignment consistency
  const assignmentValidation = validateAssignment({
    layout,
    padFingerAssignment,
    moments,
    config,
  });

  // 2. Evaluate full performance
  const performanceCost = evaluatePerformance({
    moments,
    layout,
    padFingerAssignment,
    config,
    includeDebug: true,
  });

  // 3. Build per-transition results with evidence
  const transitionResults: TransitionResult[] = [];
  const allEvidence: TemporalConstraintEvidence[] = [];

  // Assignment evidence
  if (!assignmentValidation.valid) {
    for (const issue of assignmentValidation.issues) {
      allEvidence.push({
        constraintId: issue.type,
        severity: 'hard',
        message: issue.message,
        momentIndex: issue.momentIndex,
        pads: issue.padKey ? [issue.padKey] : undefined,
      });
    }
  }

  // Per-event evidence
  for (const eventCost of performanceCost.eventCosts) {
    if (eventCost.feasibilityTier === 'fallback') {
      allEvidence.push({
        constraintId: 'infeasible_grip',
        severity: 'hard',
        message: `Moment ${eventCost.momentIndex} requires a fallback grip (biomechanically strained)`,
        momentIndex: eventCost.momentIndex,
        tier: 'fallback',
      });
    }
  }

  // Per-transition evidence
  for (const tc of performanceCost.transitionCosts) {
    const evidence: TemporalConstraintEvidence[] = [];
    let status: TransitionStatus = 'valid';

    const { movement, dimensions, timeDeltaMs } = tc;
    const timeDeltaSec = timeDeltaMs / 1000;

    // Speed violation check
    if (timeDeltaSec > 0.001 && movement.gridDistance > 0) {
      const speed = movement.gridDistance / timeDeltaSec;
      if (speed > MAX_HAND_SPEED) {
        status = 'violation';
        evidence.push({
          constraintId: 'speed',
          severity: 'hard',
          message: `Transition ${tc.fromMomentIndex}→${tc.toMomentIndex}: speed ${speed.toFixed(1)} units/s exceeds max ${MAX_HAND_SPEED} (distance=${movement.gridDistance.toFixed(2)}, dt=${timeDeltaMs.toFixed(0)}ms)`,
          transitionIndex: tc.fromMomentIndex,
          measuredValue: speed,
          threshold: MAX_HAND_SPEED,
          tier: 'invalid',
          debug: {
            gridDistance: movement.gridDistance,
            timeDeltaMs,
            speedPressure: movement.speedPressure,
          },
        });
      }
    }

    // Infinite transition cost (hard violation)
    if (!isFinite(dimensions.transitionCost)) {
      status = 'violation';
      evidence.push({
        constraintId: 'transition_infeasible',
        severity: 'hard',
        message: `Transition ${tc.fromMomentIndex}→${tc.toMomentIndex}: transition cost is infinite (movement physically impossible)`,
        transitionIndex: tc.fromMomentIndex,
        tier: 'invalid',
      });
    } else if (dimensions.transitionCost > TRANSITION_COST_VIOLATION_THRESHOLD) {
      // Very high transition cost
      if (status === 'valid') status = 'violation';
      evidence.push({
        constraintId: 'transition_excessive',
        severity: 'hard',
        message: `Transition ${tc.fromMomentIndex}→${tc.toMomentIndex}: cost ${dimensions.transitionCost.toFixed(2)} exceeds violation threshold ${TRANSITION_COST_VIOLATION_THRESHOLD}`,
        transitionIndex: tc.fromMomentIndex,
        measuredValue: dimensions.transitionCost,
        threshold: TRANSITION_COST_VIOLATION_THRESHOLD,
      });
    } else if (dimensions.transitionCost > TRANSITION_COST_DEGRADED_THRESHOLD) {
      // Elevated transition cost
      if (status === 'valid') status = 'degraded';
      evidence.push({
        constraintId: 'transition_degraded',
        severity: 'soft',
        message: `Transition ${tc.fromMomentIndex}→${tc.toMomentIndex}: cost ${dimensions.transitionCost.toFixed(2)} is elevated (threshold ${TRANSITION_COST_DEGRADED_THRESHOLD})`,
        transitionIndex: tc.fromMomentIndex,
        measuredValue: dimensions.transitionCost,
        threshold: TRANSITION_COST_DEGRADED_THRESHOLD,
      });
    }

    // Alternation check (using time delta)
    if (timeDeltaSec < ALTERNATION_DT_THRESHOLD && movement.fingerChange) {
      // Check if same-finger is being reused rapidly
      if (!movement.fingerChange && timeDeltaSec < ALTERNATION_DT_THRESHOLD) {
        if (status === 'valid') status = 'degraded';
        evidence.push({
          constraintId: 'alternation',
          severity: 'soft',
          message: `Transition ${tc.fromMomentIndex}→${tc.toMomentIndex}: same-finger reuse within ${timeDeltaMs.toFixed(0)}ms (alternation threshold ${ALTERNATION_DT_THRESHOLD * 1000}ms)`,
          transitionIndex: tc.fromMomentIndex,
          measuredValue: timeDeltaSec,
          threshold: ALTERNATION_DT_THRESHOLD,
        });
      }
    }

    transitionResults.push({
      transitionIndex: tc.fromMomentIndex,
      status,
      costBreakdown: tc,
      evidence,
    });

    allEvidence.push(...evidence);
  }

  // 4. Determine overall status
  let firstFailingTransitionIndex = -1;
  let firstFailingMomentIndex = -1;

  for (const tr of transitionResults) {
    if (tr.status === 'violation' && firstFailingTransitionIndex === -1) {
      firstFailingTransitionIndex = tr.transitionIndex;
    }
  }

  for (let i = 0; i < performanceCost.eventCosts.length; i++) {
    const ec = performanceCost.eventCosts[i];
    if (ec.feasibilityTier === 'fallback' && firstFailingMomentIndex === -1) {
      firstFailingMomentIndex = i;
    }
  }

  const hasViolation = !assignmentValidation.valid
    || transitionResults.some(t => t.status === 'violation')
    || performanceCost.eventCosts.some(e => e.feasibilityTier === 'fallback');

  const hasDegraded = transitionResults.some(t => t.status === 'degraded');

  let overallStatus: OverallStatus;
  if (hasViolation) overallStatus = 'violation';
  else if (hasDegraded) overallStatus = 'degraded';
  else overallStatus = 'valid';

  // Feasibility tier
  let feasibilityTier: FeasibilityTier;
  if (hasViolation) feasibilityTier = 'invalid';
  else if (hasDegraded) feasibilityTier = 'relaxed';
  else feasibilityTier = 'strict';

  return {
    overallStatus,
    feasibilityTier,
    firstFailingTransitionIndex,
    firstFailingMomentIndex,
    dimensions: performanceCost.dimensions,
    performanceCost,
    transitionResults,
    eventCosts: performanceCost.eventCosts,
    assignmentValidation,
    evidence: allEvidence,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Update all moments' NoteInstance padIds to match the current layout.
 */
export function updateMomentsPadIds(
  moments: PerformanceMoment[],
  layout: Layout,
): PerformanceMoment[] {
  return moments.map(moment => ({
    ...moment,
    notes: moment.notes.map(note => {
      const newPadKey = findPadForSound(note.soundId, layout);
      return { ...note, padId: newPadKey ?? note.padId };
    }),
  }));
}

function findPadForSound(soundId: string, layout: Layout): string | null {
  for (const [pk, voice] of Object.entries(layout.padToVoice)) {
    if (voice.id === soundId) return pk;
  }
  return null;
}

function emptyResult(assignment: PadFingerAssignment): TemporalEvaluationResult {
  return {
    overallStatus: 'valid',
    feasibilityTier: 'strict',
    firstFailingTransitionIndex: -1,
    firstFailingMomentIndex: -1,
    dimensions: createZeroCostDimensions(),
    performanceCost: {
      total: 0,
      dimensions: createZeroCostDimensions(),
      eventCosts: [],
      transitionCosts: [],
      aggregateMetrics: {
        averageDimensions: createZeroCostDimensions(),
        peakDimensions: createZeroCostDimensions(),
        peakMomentIndex: 0,
        hardMomentCount: 0,
        infeasibleMomentCount: 0,
        momentCount: 0,
        transitionCount: 0,
      },
      feasibility: { level: 'feasible', summary: 'No events to evaluate', reasons: [] },
      padFingerAssignment: assignment,
    },
    transitionResults: [],
    eventCosts: [],
    assignmentValidation: { valid: true, issues: [] },
    evidence: [],
  };
}
