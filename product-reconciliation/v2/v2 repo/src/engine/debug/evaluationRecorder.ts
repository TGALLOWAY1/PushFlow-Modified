/**
 * Part 1 — Optimization Evaluation Recorder.
 *
 * Extracts structured OptimizationEvaluationRecord[] from a completed
 * ExecutionPlanResult. Captures all cost signals used in scoring for
 * post-hoc debugging and analysis.
 *
 * This does NOT modify the optimization engine — it reads the existing
 * FingerAssignment[] output and reconstructs the full cost breakdown
 * using the same cost functions the beam solver uses.
 */

import { type ExecutionPlanResult, type FingerAssignment } from '../../types/executionPlan';
import { gridDistance } from '../../types/padGrid';
import { FINGER_DOMINANCE_COST } from '../prior/biomechanicalModel';
import { zoneViolationScore } from '../surface/handZone';
import { type OptimizationEvaluationRecord, type EventCostBreakdown } from './types';

/**
 * Extracts OptimizationEvaluationRecord[] from a completed execution plan.
 *
 * Reconstructs the full per-event cost breakdown from the FingerAssignment data
 * and the biomechanical model constants. This gives developers a complete view
 * of why each decision was made.
 */
export function extractEvaluationRecords(
  result: ExecutionPlanResult,
): OptimizationEvaluationRecord[] {
  const records: OptimizationEvaluationRecord[] = [];
  const assignments = result.fingerAssignments;

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const prev: FingerAssignment | null = i > 0 ? assignments[i - 1] : null;

    const pad: [number, number] = [a.row ?? 0, a.col ?? 0];
    const previousPad: [number, number] | null =
      prev && prev.row !== undefined && prev.col !== undefined
        ? [prev.row, prev.col]
        : null;

    const timeDelta = prev ? Math.max(a.startTime - prev.startTime, 0) : 0;

    const movementDistance = previousPad
      ? gridDistance(
          { row: previousPad[0], col: previousPad[1] },
          { row: pad[0], col: pad[1] },
        )
      : 0;

    // Reconstruct cost breakdown from existing DifficultyBreakdown + model constants
    const costs = reconstructCostBreakdown(a, prev, timeDelta, movementDistance);
    const totalCost = a.cost !== Infinity ? a.cost : 9999;

    records.push({
      eventIndex: a.eventIndex ?? i,
      timestamp: a.startTime,
      pad,
      hand: a.assignedHand,
      finger: a.finger,
      previousPad,
      previousFinger: prev?.finger ?? null,
      previousHand: prev?.assignedHand ?? null,
      noteNumber: a.noteNumber,
      difficulty: a.difficulty,
      costs,
      totalCost,
      timeDelta,
      movementDistance,
    });
  }

  return records;
}

/**
 * Reconstructs the cost breakdown for a single event.
 *
 * Uses the existing costBreakdown from the FingerAssignment (populated by
 * the beam solver) and enriches it with additional component signals from
 * the biomechanical model.
 */
function reconstructCostBreakdown(
  assignment: FingerAssignment,
  _prev: FingerAssignment | null,
  timeDelta: number,
  movementDistance: number,
): EventCostBreakdown {
  const breakdown = assignment.costBreakdown;

  // Travel cost from the existing breakdown
  const travel = breakdown?.movement ?? 0;

  // Speed component: approximate from movement and time
  const transitionSpeed = timeDelta > 0.001 ? movementDistance / timeDelta : 0;

  // Pose cost from the existing breakdown (drift + fatigue combined)
  const pose = (breakdown?.drift ?? 0) + (breakdown?.fatigue ?? 0);

  // Zone violation: compute from pad position and assigned hand
  let zoneViolation = 0;
  if (
    assignment.assignedHand !== 'Unplayable' &&
    assignment.row !== undefined &&
    assignment.col !== undefined
  ) {
    zoneViolation = zoneViolationScore(
      { row: assignment.row, col: assignment.col },
      assignment.assignedHand,
    );
  }

  // Finger dominance penalty
  const fingerPenalty = assignment.finger
    ? (FINGER_DOMINANCE_COST[assignment.finger] ?? 0)
    : 0;

  // Repetition penalty (same-finger rapid repetition)
  const repetitionPenalty = breakdown?.bounce ?? 0;

  // Collision penalty: not tracked separately in current breakdown, default 0
  const collisionPenalty = 0;

  // Feasibility penalty from constraint violations
  const feasibilityPenalty = breakdown?.crossover ?? 0;

  return {
    travel,
    transitionSpeed,
    pose,
    zoneViolation,
    fingerPenalty,
    repetitionPenalty,
    collisionPenalty,
    feasibilityPenalty,
  };
}
