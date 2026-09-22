/**
 * Pose Builder: Constructs HandPose objects from a PadFingerAssignment.
 *
 * This is the critical bridge that allows cost evaluation without the beam solver.
 * Given a PadFingerAssignment (pad -> {hand, finger}) and a set of active pads
 * for a moment, it constructs the HandPose needed by the cost functions.
 */

import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { parsePadKey } from '../../types/padGrid';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type ConstraintTier } from '../prior/feasibility';
import { isStrictGripValid } from '../prior/feasibility';
import { isZoneValid } from '../surface/handZone';

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
  /**
   * Number of pads in this moment whose assigned finger is already in use by
   * another pad of the same moment.
   *
   * One finger cannot strike two pads at the same instant, so this is a hard
   * physical impossibility — not an ergonomic preference. It is reported
   * separately from `zoneViolations` because the two deserve different verdicts.
   */
  collisions: number;
  /** Number of pads played by a hand reaching outside its comfortable zone. */
  zoneViolations: number;
  /** Number of hands whose simultaneous grip fails the strict geometry rules. */
  gripViolations: number;
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
  let collisions = 0;
  let zoneViolations = 0;

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
      if (leftFingers[owner.finger]) collisions++;
      if (!isZoneValid(coord, 'left')) zoneViolations++;
      leftFingers[owner.finger] = fingerCoord;
    } else {
      if (rightFingers[owner.finger]) collisions++;
      if (!isZoneValid(coord, 'right')) zoneViolations++;
      rightFingers[owner.finger] = fingerCoord;
    }
  }

  const left = Object.keys(leftFingers).length > 0
    ? buildHandPose(leftFingers)
    : null;

  const right = Object.keys(rightFingers).length > 0
    ? buildHandPose(rightFingers)
    : null;

  const gripViolations =
    (Object.keys(leftFingers).length > 0 && !isStrictGripValid(leftFingers, 'left') ? 1 : 0) +
    (Object.keys(rightFingers).length > 0 && !isStrictGripValid(rightFingers, 'right') ? 1 : 0);

  // Only physical impossibility downgrades the grip tier. A hand outside its
  // zone breaks the hand-separation rule, which is a different matter: it is
  // counted (`zoneViolations`), priced by the evaluator, and reported as a rule
  // relaxation in the feasibility verdict — not disguised as a fallback grip.
  const tier = collisions > 0
    ? 'fallback'
    : classifyGripTier(leftFingers, rightFingers);

  return { left, right, tier, unmappedPads, collisions, zoneViolations, gripViolations };
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
 * hand poses pass every strict CLP geometry rule, 'fallback' otherwise.
 */
function classifyGripTier(
  leftFingers: Partial<Record<FingerType, FingerCoordinate>>,
  rightFingers: Partial<Record<FingerType, FingerCoordinate>>,
): ConstraintTier {
  const strictOk = (Object.keys(leftFingers).length === 0 || isStrictGripValid(leftFingers, 'left'))
    && (Object.keys(rightFingers).length === 0 || isStrictGripValid(rightFingers, 'right'));
  return strictOk ? 'strict' : 'fallback';
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
