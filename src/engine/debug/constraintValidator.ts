/**
 * Part 4 — Constraint Violation Validator.
 *
 * validateExecutionPlan(plan) checks for:
 *   - Impossible reach (finger movement exceeds physical limits)
 *   - Simultaneous finger collision (two events on same finger at same time)
 *   - Tempo-infeasible movement (hand speed exceeds maximum)
 *   - Zone violations (hand used far outside preferred zone)
 *   - Span exceeded (finger pair distance exceeds anatomical limit)
 *   - Speed exceeded (transition faster than MAX_HAND_SPEED)
 */

import { type ExecutionPlanResult, type FingerAssignment } from '../../types/executionPlan';
import { gridDistance } from '../../types/padGrid';
import { MOMENT_EPSILON } from '../../types/performanceEvent';
import {
  MAX_REACH_GRID_UNITS,
  MAX_HAND_SPEED,
} from '../prior/biomechanicalModel';
import { zoneViolationScore } from '../surface/handZone';
import { type ConstraintViolation } from './types';
import { validatePadOwnershipConsistency } from '../structure/momentBuilder';

/** Time epsilon for detecting simultaneous events. Uses canonical MOMENT_EPSILON. */
const SIMULTANEOUS_EPSILON = MOMENT_EPSILON;

/** Minimum zone violation distance to flag. */
const ZONE_VIOLATION_THRESHOLD = 1;

/**
 * Validates an execution plan and returns all detected constraint violations.
 */
export function validateExecutionPlan(
  plan: ExecutionPlanResult,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const assignments = plan.fingerAssignments;

  violations.push(...detectImpossibleReach(assignments));
  violations.push(...detectSimultaneousCollision(assignments));
  violations.push(...detectTempoInfeasible(assignments));
  violations.push(...detectZoneViolations(assignments));
  violations.push(...detectSpeedExceeded(assignments));
  violations.push(...detectPadOwnershipViolations(assignments));

  // Sort by event index
  violations.sort((a, b) => a.eventIndex - b.eventIndex);

  return violations;
}

// ============================================================================
// Impossible Reach Detection
// ============================================================================

/**
 * Detects events where a finger must move farther than the physical
 * maximum reach distance between consecutive events on the same hand.
 */
function detectImpossibleReach(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (let i = 1; i < assignments.length; i++) {
    const prev = assignments[i - 1];
    const curr = assignments[i];

    // Only check sequential events on the same hand
    if (
      prev.assignedHand === 'Unplayable' ||
      curr.assignedHand === 'Unplayable' ||
      prev.assignedHand !== curr.assignedHand
    ) continue;

    // Skip simultaneous events
    if (Math.abs(curr.startTime - prev.startTime) <= SIMULTANEOUS_EPSILON) continue;

    if (
      prev.row === undefined || prev.col === undefined ||
      curr.row === undefined || curr.col === undefined
    ) continue;

    const distance = gridDistance(
      { row: prev.row, col: prev.col },
      { row: curr.row, col: curr.col },
    );

    if (distance > MAX_REACH_GRID_UNITS) {
      violations.push({
        eventIndex: curr.eventIndex ?? i,
        constraintName: 'impossible_reach',
        explanation: `${curr.assignedHand} hand must move ${distance.toFixed(1)} grid units (max: ${MAX_REACH_GRID_UNITS}) from [${prev.row},${prev.col}] to [${curr.row},${curr.col}]`,
        actual: distance,
        limit: MAX_REACH_GRID_UNITS,
        type: 'hard',
      });
    }
  }

  return violations;
}

// ============================================================================
// Simultaneous Finger Collision Detection
// ============================================================================

/**
 * Detects cases where the same finger on the same hand is assigned to
 * two different pads at the same timestamp — physically impossible.
 */
function detectSimultaneousCollision(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  // Group events by timestamp
  const groups = new Map<number, FingerAssignment[]>();
  for (const a of assignments) {
    const key = Math.round(a.startTime * 1000); // ms resolution
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Check for same hand+finger on different pads
    const seen = new Map<string, FingerAssignment>();
    for (const a of group) {
      if (a.assignedHand === 'Unplayable' || !a.finger) continue;

      const key = `${a.assignedHand}:${a.finger}`;
      const existing = seen.get(key);

      if (existing) {
        // Same finger used for two different pads simultaneously
        if (
          existing.row !== a.row || existing.col !== a.col
        ) {
          violations.push({
            eventIndex: a.eventIndex ?? 0,
            constraintName: 'simultaneous_collision',
            explanation: `${a.assignedHand} ${a.finger} assigned to both [${existing.row},${existing.col}] and [${a.row},${a.col}] at time ${a.startTime.toFixed(3)}s`,
            actual: 2,
            limit: 1,
            type: 'hard',
          });
        }
      } else {
        seen.set(key, a);
      }
    }
  }

  return violations;
}

// ============================================================================
// Tempo-Infeasible Movement Detection
// ============================================================================

/**
 * Detects transitions where the required hand movement speed exceeds
 * the maximum physiological speed.
 */
function detectTempoInfeasible(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (let i = 1; i < assignments.length; i++) {
    const prev = assignments[i - 1];
    const curr = assignments[i];

    if (
      prev.assignedHand === 'Unplayable' ||
      curr.assignedHand === 'Unplayable' ||
      prev.assignedHand !== curr.assignedHand
    ) continue;

    const dt = curr.startTime - prev.startTime;
    if (dt <= SIMULTANEOUS_EPSILON) continue;

    if (
      prev.row === undefined || prev.col === undefined ||
      curr.row === undefined || curr.col === undefined
    ) continue;

    const distance = gridDistance(
      { row: prev.row, col: prev.col },
      { row: curr.row, col: curr.col },
    );

    if (distance === 0) continue;

    const speed = distance / dt;

    if (speed > MAX_HAND_SPEED) {
      violations.push({
        eventIndex: curr.eventIndex ?? i,
        constraintName: 'speed_exceeded',
        explanation: `${curr.assignedHand} hand speed ${speed.toFixed(1)} units/s exceeds max ${MAX_HAND_SPEED} (${distance.toFixed(1)} units in ${(dt * 1000).toFixed(0)}ms)`,
        actual: speed,
        limit: MAX_HAND_SPEED,
        type: 'hard',
      });
    }
  }

  return violations;
}

// ============================================================================
// Zone Violation Detection
// ============================================================================

/**
 * Detects events where a hand is used significantly outside its
 * preferred zone.
 */
function detectZoneViolations(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (a.assignedHand === 'Unplayable') continue;
    if (a.row === undefined || a.col === undefined) continue;

    const violation = zoneViolationScore(
      { row: a.row, col: a.col },
      a.assignedHand,
    );

    if (violation >= ZONE_VIOLATION_THRESHOLD) {
      violations.push({
        eventIndex: a.eventIndex ?? i,
        constraintName: 'zone_violation',
        explanation: `${a.assignedHand} hand used at [${a.row},${a.col}] — ${violation} columns outside preferred zone`,
        actual: violation,
        limit: ZONE_VIOLATION_THRESHOLD,
        type: 'soft',
      });
    }
  }

  return violations;
}

// ============================================================================
// Speed Exceeded Detection (Fitts's Law Violation)
// ============================================================================

/**
 * Detects events where the transition cost is Infinity, indicating
 * the speed exceeds the physiological maximum.
 */
function detectSpeedExceeded(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (a.cost === Infinity) {
      violations.push({
        eventIndex: a.eventIndex ?? i,
        constraintName: 'tempo_infeasible',
        explanation: `Event ${a.eventIndex ?? i} has Infinity cost — transition speed exceeds physiological maximum`,
        actual: Infinity,
        limit: MAX_HAND_SPEED,
        type: 'hard',
      });
    }
  }

  return violations;
}

// ============================================================================
// Pad Ownership Consistency Detection (Invariant B)
// ============================================================================

/**
 * Detects pad-to-finger ownership violations: the same pad assigned to
 * different fingers at different points in the performance.
 *
 * Invariant B: each pad maps to exactly one finger within a solution.
 */
function detectPadOwnershipViolations(
  assignments: FingerAssignment[],
): ConstraintViolation[] {
  const { violations } = validatePadOwnershipConsistency(assignments);

  return violations.map(v => ({
    eventIndex: 0,
    constraintName: 'pad_ownership_inconsistency',
    explanation: `Pad ${v.padKey} assigned to ${v.fingers.map(f => `${f.hand}-${f.finger}`).join(' and ')} at different times`,
    actual: v.fingers.length,
    limit: 1,
    type: 'hard' as const,
  }));
}
