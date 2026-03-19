/**
 * Legacy Cost Functions (Diagnostic Only).
 *
 * Functions demoted from the primary scoring model in Phase 2.
 * These are either:
 *   - HandState-based (dead code path, replaced by HandPose-based scoring)
 *   - Replaced by calculatePoseNaturalness() which folds them into one term
 *   - Dead code (finger bounce / note history)
 *
 * Kept for backward compatibility and potential diagnostic display.
 * Not used in the primary beam search scoring.
 */

import { type FingerType, type HandState } from '../../types/fingerModel';
import { type PadCoord, gridDistance } from '../../types/padGrid';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { type EngineConstants, DEFAULT_ENGINE_CONSTANTS } from '../../types/engineConfig';
import { type NeutralHandCentersResult, type NeutralPadPositions } from '../prior/handPose';
import { ACTIVATION_COST } from '../prior/biomechanicalModel';

// ============================================================================
// Private Helpers (duplicated from costFunction.ts to avoid circular imports)
// ============================================================================

/** Maps FingerType to engine key ("L1"...) for neutral pad lookup. */
function fingerTypeToKey(finger: FingerType, hand: 'left' | 'right'): string {
  const handPrefix = hand === 'left' ? 'L' : 'R';
  const fingerNum: Record<FingerType, number> = {
    thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5,
  };
  return `${handPrefix}${fingerNum[finger]}`;
}

/** Euclidean distance between two FingerCoordinates. */
function fingerCoordinateDistance(a: FingerCoordinate, b: FingerCoordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Comfortable spread between two fingers based on neutral pad positions. */
function getComfortableSpread(
  fingerA: FingerType,
  fingerB: FingerType,
  hand: 'left' | 'right',
  neutralPads: NeutralPadPositions,
  defaultSpread: number = 2.0,
  slack: number = 0.5
): number {
  const keyA = fingerTypeToKey(fingerA, hand);
  const keyB = fingerTypeToKey(fingerB, hand);
  const padA = neutralPads[keyA];
  const padB = neutralPads[keyB];
  if (!padA || !padB) return defaultSpread;
  const baseDist = gridDistance(
    { row: padA.row, col: padA.col },
    { row: padB.row, col: padB.col }
  );
  return baseDist + slack;
}

// ============================================================================
// HandState Center / Span Helpers
// ============================================================================

function calculateCenterOfGravity(handState: HandState): PadCoord | null {
  const placed: PadCoord[] = [];
  for (const ft of ['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]) {
    const pos = handState.fingers[ft].currentGridPos;
    if (pos !== null) placed.push(pos);
  }
  if (placed.length === 0) return null;
  return {
    row: placed.reduce((s, p) => s + p.row, 0) / placed.length,
    col: placed.reduce((s, p) => s + p.col, 0) / placed.length,
  };
}

function calculateSpanWidth(handState: HandState): number {
  const thumb = handState.fingers.thumb.currentGridPos;
  const pinky = handState.fingers.pinky.currentGridPos;
  if (!thumb || !pinky) return 0;
  return gridDistance(thumb, pinky);
}

// ============================================================================
// Movement Cost (HandState-based) — DEAD PATH
// ============================================================================

/**
 * @deprecated HandState-based movement cost. Not used in beam search.
 * Replaced by calculateTransitionCost (HandPose-based, Fitts's Law).
 */
export function calculateMovementCost(
  from: PadCoord | null,
  to: PadCoord,
  finger: FingerType,
  _constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS,
  neutralHandCenters?: NeutralHandCentersResult | null,
  hand?: 'left' | 'right',
  neutralBiasWeight: number = 0.1
): number {
  if (from === null) return ACTIVATION_COST;

  const distance = gridDistance(from, to);
  let movementCost = distance;

  if (neutralHandCenters && hand) {
    const fingerKey = fingerTypeToKey(finger, hand);
    const neutralPad = neutralHandCenters.neutralPads[fingerKey];
    if (neutralPad) {
      const neutralDistance = gridDistance(to, { row: neutralPad.row, col: neutralPad.col });
      movementCost += neutralBiasWeight * neutralDistance;
    }
  }

  return movementCost;
}

// ============================================================================
// Stretch Penalty (HandState-based) — NOW HARD CONSTRAINT
// ============================================================================

/**
 * @deprecated Stretch is now enforced as a hard constraint in feasibility.ts.
 * This was the soft-penalty version for the HandState code path.
 */
export function calculateStretchPenalty(
  handState: HandState,
  newPos: PadCoord,
  finger: FingerType,
  handSide: 'left' | 'right',
  constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS,
  neutralHandCenters?: NeutralHandCentersResult | null
): number {
  const tempHandState: HandState = {
    ...handState,
    fingers: {
      ...handState.fingers,
      [finger]: { currentGridPos: newPos, fatigueLevel: handState.fingers[finger].fatigueLevel },
    },
  };
  const newSpan = calculateSpanWidth(tempHandState);

  let comfortableSpan: number;
  if (neutralHandCenters) {
    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    let maxComfortable = 0;
    for (let i = 0; i < fingerTypes.length; i++) {
      for (let j = i + 1; j < fingerTypes.length; j++) {
        const spread = getComfortableSpread(fingerTypes[i], fingerTypes[j], handSide, neutralHandCenters.neutralPads);
        maxComfortable = Math.max(maxComfortable, spread);
      }
    }
    comfortableSpan = maxComfortable > 0 ? maxComfortable : constants.idealReach;
  } else {
    comfortableSpan = constants.idealReach;
  }

  if (newSpan <= comfortableSpan) return 0;

  const excessSpan = newSpan - comfortableSpan;
  const maxExcess = constants.maxSpan - comfortableSpan;
  const normalizedExcess = maxExcess > 0 ? Math.min(excessSpan / maxExcess, 1.0) : 1.0;
  return Math.pow(normalizedExcess, 2) * 10;
}

// ============================================================================
// Drift Penalty — DIAGNOSTIC ONLY
// ============================================================================

/**
 * @deprecated Drift is now a diagnostic metric, not part of primary scoring.
 */
export function calculateDriftPenalty(
  handState: HandState,
  handSide: 'left' | 'right',
  _constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS,
  neutralHandCenters?: NeutralHandCentersResult | null,
  homePos?: PadCoord,
  driftMultiplier: number = 0.5
): number {
  const cog = calculateCenterOfGravity(handState);
  if (cog === null) return 0;

  let targetPos: PadCoord | null = null;
  if (neutralHandCenters) {
    const nc = handSide === 'left' ? neutralHandCenters.leftCenter : neutralHandCenters.rightCenter;
    if (nc) targetPos = { row: nc.y, col: nc.x };
  }
  if (!targetPos && homePos) targetPos = homePos;
  if (!targetPos) return 0;

  return gridDistance(cog, targetPos) * driftMultiplier;
}

// ============================================================================
// Crossover Cost — NOW HARD CONSTRAINT
// ============================================================================

/**
 * @deprecated Crossover is now a hard constraint in feasibility.ts (topology checks).
 */
export function calculateCrossoverCost(
  handState: HandState,
  newPos: PadCoord,
  finger: FingerType,
  handSide: 'left' | 'right',
  constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS
): number {
  let penalty = 0;
  const tempFingers = {
    ...handState.fingers,
    [finger]: { currentGridPos: newPos, fatigueLevel: handState.fingers[finger].fatigueLevel },
  };

  const thumb = tempFingers.thumb.currentGridPos;
  const index = tempFingers.index.currentGridPos;
  const middle = tempFingers.middle.currentGridPos;
  const pinky = tempFingers.pinky.currentGridPos;

  if (thumb && pinky) {
    if (handSide === 'right') {
      if (thumb.col >= pinky.col && thumb.row >= pinky.row) penalty += constants.crossoverPenaltyWeight * 2;
    } else {
      if (thumb.col <= pinky.col && thumb.row >= pinky.row) penalty += constants.crossoverPenaltyWeight * 2;
    }
  }

  if (index && pinky) {
    if (handSide === 'right' && index.col < pinky.col) penalty += constants.crossoverPenaltyWeight;
    if (handSide === 'left' && index.col > pinky.col) penalty += constants.crossoverPenaltyWeight;
  }

  if (thumb && middle && thumb.row > middle.row) penalty += constants.crossoverPenaltyWeight;

  const seq: FingerType[] = handSide === 'right'
    ? ['index', 'middle', 'ring', 'pinky']
    : ['pinky', 'ring', 'middle', 'index'];

  for (let i = 0; i < seq.length - 1; i++) {
    const p1 = tempFingers[seq[i]].currentGridPos;
    const p2 = tempFingers[seq[i + 1]].currentGridPos;
    if (p1 && p2) {
      if (handSide === 'right' && p1.col >= p2.col) penalty += constants.crossoverPenaltyWeight;
      if (handSide === 'left' && p1.col <= p2.col) penalty += constants.crossoverPenaltyWeight;
    }
  }

  return penalty;
}

// ============================================================================
// Note History (Finger Bounce / Stickiness) — DEAD CODE
// ============================================================================

interface NoteFingerHistory {
  [noteNumber: number]: { finger: FingerType; timestamp: number };
}

let noteHistory: NoteFingerHistory = {};

/** @deprecated Dead code — not used in beam search scoring. */
export function clearNoteHistory(): void { noteHistory = {}; }

/** @deprecated Dead code — not used in beam search scoring. */
export function recordNoteAssignment(noteNumber: number, finger: FingerType, timestamp: number): void {
  noteHistory[noteNumber] = { finger, timestamp };
}

/**
 * @deprecated Dead code — not used in beam search scoring.
 * Finger bounce penalty: encourages same finger for same note.
 */
export function getFingerBouncePenalty(
  noteNumber: number,
  assignedFinger: FingerType,
  currentTime: number,
  recencyWindow: number = 5.0
): number {
  const h = noteHistory[noteNumber];
  if (!h) return 0;
  if (h.finger === assignedFinger) return 0;
  const elapsed = currentTime - h.timestamp;
  if (elapsed > recencyWindow) return 0;
  return 2.0 * (1.0 - elapsed / recencyWindow);
}

// ============================================================================
// Grip Stretch Cost (HandPose-based) — REPLACED
// ============================================================================

/**
 * @deprecated Replaced by calculatePoseNaturalness() which folds stretch,
 * attractor, and dominance into a unified pose quality score.
 */
export function calculateGripStretchCost(
  pose: HandPose,
  handSide: 'left' | 'right',
  idealSpan: number = 2.0,
  maxSpan: number = 5.5,
  neutralHandCenters?: NeutralHandCentersResult | null
): number {
  const entries = Object.entries(pose.fingers) as [FingerType, FingerCoordinate][];
  if (entries.length < 2) return 0;

  let maxDistance = 0;
  let maxPair: [FingerType, FingerType] | null = null;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const d = fingerCoordinateDistance(entries[i][1], entries[j][1]);
      if (d > maxDistance) { maxDistance = d; maxPair = [entries[i][0], entries[j][0]]; }
    }
  }

  let comfortableSpan = idealSpan;
  if (neutralHandCenters && maxPair) {
    comfortableSpan = getComfortableSpread(maxPair[0], maxPair[1], handSide, neutralHandCenters.neutralPads, idealSpan);
  }

  if (maxDistance <= comfortableSpan) return 0;
  const excessSpan = maxDistance - comfortableSpan;
  const maxExcess = maxSpan - comfortableSpan;
  const normalizedExcess = maxExcess > 0 ? Math.min(excessSpan / maxExcess, 1.0) : 1.0;
  return Math.pow(normalizedExcess, 2) * 10;
}

// ============================================================================
// Total Grip Cost — REPLACED
// ============================================================================

/**
 * @deprecated Replaced by 3-component PerformabilityObjective.
 */
export function calculateTotalGripCost(
  prev: HandPose,
  curr: HandPose,
  resting: HandPose,
  timeDelta: number,
  stiffness: number
): number {
  const MIN_TIME_DELTA = 0.001;
  const MAX_HAND_SPEED = 12.0;
  const SPEED_COST_WEIGHT = 0.5;

  // Inline transition cost (avoid circular import)
  let transitionCost = 0;
  if (timeDelta > MIN_TIME_DELTA) {
    const distance = fingerCoordinateDistance(prev.centroid, curr.centroid);
    if (distance > 0) {
      const speed = distance / timeDelta;
      if (speed > MAX_HAND_SPEED) return Infinity;
      transitionCost = distance + speed * SPEED_COST_WEIGHT;
    }
  }

  // Inline attractor cost
  const attractorCost = fingerCoordinateDistance(curr.centroid, resting.centroid) * stiffness;
  const stretchCost = calculateGripStretchCost(curr, 'left');
  return transitionCost + attractorCost + stretchCost;
}

// ============================================================================
// HandState ↔ HandPose Conversion — UTILITY
// ============================================================================

/**
 * Converts a HandState to a HandPose for compatibility.
 * @deprecated HandState-based code path is no longer primary.
 */
export function handStateToHandPose(handState: HandState): HandPose {
  const fingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  for (const ft of ['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]) {
    const pos = handState.fingers[ft].currentGridPos;
    if (pos !== null) fingers[ft] = { x: pos.col, y: pos.row };
  }

  const vals = Object.values(fingers);
  let centroid: FingerCoordinate;
  if (vals.length > 0) {
    centroid = {
      x: vals.reduce((s, p) => s + p.x, 0) / vals.length,
      y: vals.reduce((s, p) => s + p.y, 0) / vals.length,
    };
  } else if (handState.centerOfGravity) {
    centroid = { x: handState.centerOfGravity.col, y: handState.centerOfGravity.row };
  } else {
    centroid = { x: 3.5, y: 3.5 };
  }

  return { centroid, fingers };
}
