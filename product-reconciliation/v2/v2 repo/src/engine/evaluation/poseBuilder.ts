/**
 * Pose Builder: Constructs HandPose objects from a PadFingerAssignment.
 *
 * This is the critical bridge that allows cost evaluation without the beam solver.
 * Given a PadFingerAssignment (pad -> {hand, finger}) and a set of active pads
 * for a moment, it constructs the HandPose needed by the cost functions.
 */

import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { type PadCoord, parsePadKey } from '../../types/padGrid';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type ConstraintTier } from '../prior/feasibility';
import {
  FINGER_PAIR_MAX_SPAN_STRICT,
  MAX_FINGER_SPAN_STRICT,
  pairKey,
} from '../prior/biomechanicalModel';

// ============================================================================
// Pose Construction
// ============================================================================

/** Result of building hand poses for a moment. */
export interface MomentPoseResult {
  left: HandPose | null;
  right: HandPose | null;
  /** The feasibility tier: strict if all assignments are within strict span, etc. */
  tier: ConstraintTier;
  /** Pads that could not be resolved from the assignment. */
  unmappedPads: string[];
}

/**
 * Builds HandPose objects for a given moment from a PadFingerAssignment.
 *
 * For each active pad in this moment, looks up the finger assignment,
 * then constructs left/right HandPose with finger coordinates and centroid.
 *
 * @param activePadKeys - Pad keys ("row,col") that are active in this moment
 * @param assignment - The stable pad-to-finger ownership map
 * @returns Left and right HandPose, feasibility tier, and any unmapped pads
 */
export function buildMomentPoses(
  activePadKeys: string[],
  assignment: PadFingerAssignment,
): MomentPoseResult {
  const leftFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  const rightFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  const unmappedPads: string[] = [];

  for (const padKey of activePadKeys) {
    const owner = assignment[padKey];
    if (!owner) {
      unmappedPads.push(padKey);
      continue;
    }

    const coord = parsePadKey(padKey);
    if (!coord) {
      unmappedPads.push(padKey);
      continue;
    }

    const fingerCoord: FingerCoordinate = { x: coord.col, y: coord.row };

    if (owner.hand === 'left') {
      leftFingers[owner.finger] = fingerCoord;
    } else {
      rightFingers[owner.finger] = fingerCoord;
    }
  }

  const left = Object.keys(leftFingers).length > 0
    ? buildHandPose(leftFingers)
    : null;

  const right = Object.keys(rightFingers).length > 0
    ? buildHandPose(rightFingers)
    : null;

  const tier = classifyGripTier(leftFingers, rightFingers);

  return { left, right, tier, unmappedPads };
}

/**
 * Constructs a HandPose from finger positions.
 * Computes centroid as the average of all finger coordinates.
 */
function buildHandPose(
  fingers: Partial<Record<FingerType, FingerCoordinate>>
): HandPose {
  const coords = Object.values(fingers);
  if (coords.length === 0) {
    return { centroid: { x: 3.5, y: 3.5 }, fingers };
  }
  const centroid: FingerCoordinate = {
    x: coords.reduce((s, c) => s + c.x, 0) / coords.length,
    y: coords.reduce((s, c) => s + c.y, 0) / coords.length,
  };
  return { centroid, fingers };
}

/**
 * Determines the constraint tier for the given finger positions.
 * V1 Cost Model (D-01): Only strict tier exists. Returns 'strict' if all
 * finger pairs pass strict span limits, 'fallback' otherwise.
 */
function classifyGripTier(
  leftFingers: Partial<Record<FingerType, FingerCoordinate>>,
  rightFingers: Partial<Record<FingerType, FingerCoordinate>>,
): ConstraintTier {
  const strictOk = checkSpan(leftFingers, FINGER_PAIR_MAX_SPAN_STRICT)
    && checkSpan(rightFingers, FINGER_PAIR_MAX_SPAN_STRICT);
  return strictOk ? 'strict' : 'fallback';
}

function checkSpan(
  fingers: Partial<Record<FingerType, FingerCoordinate>>,
  pairMaxSpan: Record<string, number>,
): boolean {
  const entries = Object.entries(fingers) as [FingerType, FingerCoordinate][];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const key = pairKey(entries[i][0], entries[j][0]);
      const max = pairMaxSpan[key] ?? MAX_FINGER_SPAN_STRICT;
      const dx = entries[i][1].x - entries[j][1].x;
      const dy = entries[i][1].y - entries[j][1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > max) return false;
    }
  }
  return true;
}

/**
 * Gets the hand side for a given pad from the assignment.
 * Returns null if the pad is not in the assignment.
 */
export function getHandForPad(
  padKey: string,
  assignment: PadFingerAssignment,
): HandSide | null {
  const owner = assignment[padKey];
  return owner?.hand ?? null;
}
