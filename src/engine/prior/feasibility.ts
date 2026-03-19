/**
 * Geometric feasibility checks for the biomechanical hand model.
 *
 * Implements hard physical constraints that must be satisfied, plus
 * Constraint Logic Programming (CLP) based grip generation for the
 * Beam Search solver. Uses strict-only constraints: a grip is either
 * feasible (passes all checks) or infeasible (rejected outright).
 *
 * V1 Cost Model (D-01): Tiered feasibility removed. No relaxed or
 * fallback grips. An empty result means the event is infeasible.
 *
 * Ported from Version1/src/engine/feasibility.ts with canonical terminology.
 */

import { type PadCoord, gridDistance } from '../../types/padGrid';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type FingerCoordinate, type HandPose } from '../../types/performance';
import { type FingerState, type HandState } from '../../types/fingerModel';
import { type EngineConstants, DEFAULT_ENGINE_CONSTANTS } from '../../types/engineConfig';
import {
  MAX_HAND_SPAN,
  MAX_REACH_GRID_UNITS,
  MAX_FINGER_SPAN_STRICT,
  FINGER_PAIR_MAX_SPAN_STRICT,
  THUMB_DELTA,
  FINGER_ORDER,
  pairKey,
  type GripRejection,
} from './biomechanicalModel';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Constraint tier for grip generation.
 * V1 Cost Model (D-01): Only 'strict' is used. Kept as a type for backward
 * compatibility during the transition; will be collapsed to boolean in C2.
 */
export type ConstraintTier = 'strict' | 'relaxed' | 'fallback';

/** Grip result with metadata. */
export interface GripResult {
  /** The hand pose/grip. */
  pose: HandPose;
  /** Always 'strict' in V1 — relaxed/fallback tiers removed. */
  tier: ConstraintTier;
  /** Always false in V1 — fallback grips removed. */
  isFallback: boolean;
}

/** Reachability level for a grid cell from an anchor position. */
export type ReachabilityLevel = 'green' | 'yellow' | 'gray';

/** Finger assignment for a chord. */
export interface ChordFingerAssignment {
  finger: FingerType;
  pos: PadCoord;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Converts a PadCoord to a FingerCoordinate. x=col, y=row. */
function padToFingerCoordinate(pad: PadCoord): FingerCoordinate {
  return { x: pad.col, y: pad.row };
}

/** Euclidean distance between two FingerCoordinates. */
function fingerDistance(a: FingerCoordinate, b: FingerCoordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// Basic Feasibility Checks
// ============================================================================

/**
 * Checks if the distance from wrist to target position is within the maximum hand span.
 */
export function isSpanValid(
  wristPosition: PadCoord | null,
  targetPosition: PadCoord
): boolean {
  if (wristPosition === null) return true;
  return gridDistance(wristPosition, targetPosition) <= MAX_HAND_SPAN;
}

/**
 * Checks if finger ordering is valid based on hand orientation.
 * For RH: thumb left/bottom of pinky. For LH: thumb right/bottom of pinky.
 */
export function isFingerOrderingValid(
  hand: 'left' | 'right',
  thumbPos: PadCoord | null,
  pinkyPos: PadCoord | null
): boolean {
  if (thumbPos === null || pinkyPos === null) return true;
  if (hand === 'right') {
    return thumbPos.col < pinkyPos.col || thumbPos.row < pinkyPos.row;
  } else {
    return thumbPos.col > pinkyPos.col || thumbPos.row < pinkyPos.row;
  }
}

/**
 * Checks if two fingers are occupying the same grid cell (collision).
 */
export function isCollision(
  pos1: PadCoord | null,
  pos2: PadCoord | null
): boolean {
  if (pos1 === null || pos2 === null) return false;
  return pos1.row === pos2.row && pos1.col === pos2.col;
}

/**
 * Checks if a finger position collides with any other active finger in a hand.
 */
export function hasFingerCollision(
  fingerId: number,
  fingerPos: PadCoord,
  allFingers: Record<number, { pos: PadCoord | null; fatigue: number }>
): boolean {
  for (const fid of [1, 2, 3, 4, 5]) {
    if (fid === fingerId) continue;
    if (isCollision(fingerPos, allFingers[fid].pos)) return true;
  }
  return false;
}

/**
 * Maps all 64 grid cells to their reachability level from an anchor position.
 */
export function getReachabilityMap(
  anchorPos: PadCoord,
  _anchorFinger: number,
  _targetFinger: number
): Record<string, ReachabilityLevel> {
  const map: Record<string, ReachabilityLevel> = {};
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const key = `${row},${col}`;
      const distance = gridDistance(anchorPos, { row, col });
      if (distance <= 3.0) {
        map[key] = 'green';
      } else if (distance <= MAX_REACH_GRID_UNITS) {
        map[key] = 'yellow';
      } else {
        map[key] = 'gray';
      }
    }
  }
  return map;
}

/**
 * Checks if a reach from start to end position is possible for a given finger.
 */
export function isReachPossible(
  start: PadCoord,
  end: PadCoord,
  _finger: FingerType,
  constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS
): boolean {
  return gridDistance(start, end) <= constants.maxReach;
}

/**
 * Checks if a new finger assignment violates geometric finger ordering constraints.
 */
export function isValidFingerOrder(
  handState: HandState,
  newAssignment: { finger: FingerType; pos: PadCoord },
  handSide: HandSide
): boolean {
  const { finger: newFinger, pos: newPos } = newAssignment;

  const tempFingers: Record<FingerType, FingerState> = {
    ...handState.fingers,
    [newFinger]: { currentGridPos: newPos, fatigueLevel: handState.fingers[newFinger].fatigueLevel },
  };

  const thumbPos = tempFingers.thumb.currentGridPos;
  const indexPos = tempFingers.index.currentGridPos;
  const middlePos = tempFingers.middle.currentGridPos;
  const pinkyPos = tempFingers.pinky.currentGridPos;

  // Rule 1: Thumb and Pinky ordering
  if (thumbPos && pinkyPos) {
    if (handSide === 'right') {
      if (thumbPos.col >= pinkyPos.col && thumbPos.row >= pinkyPos.row) return false;
    } else {
      if (thumbPos.col <= pinkyPos.col && thumbPos.row >= pinkyPos.row) return false;
    }
  }

  // Rule 2: Index should not cross over pinky
  if (indexPos && pinkyPos) {
    if (handSide === 'right') {
      if (indexPos.col < pinkyPos.col) return false;
    } else {
      if (indexPos.col > pinkyPos.col) return false;
    }
  }

  // Rule 3: Thumb should not cross above middle finger
  if (thumbPos && middlePos) {
    if (thumbPos.row > middlePos.row) return false;
  }

  // Rule 4: Finger sequence ordering
  const fingerSequence: FingerType[] = handSide === 'right'
    ? ['index', 'middle', 'ring', 'pinky']
    : ['pinky', 'ring', 'middle', 'index'];

  for (let i = 0; i < fingerSequence.length - 1; i++) {
    const pos1 = tempFingers[fingerSequence[i]].currentGridPos;
    const pos2 = tempFingers[fingerSequence[i + 1]].currentGridPos;
    if (pos1 && pos2) {
      if (handSide === 'right') {
        if (pos1.col >= pos2.col) return false;
      } else {
        if (pos1.col <= pos2.col) return false;
      }
    }
  }

  return true;
}

// ============================================================================
// Chord Feasibility
// ============================================================================

/**
 * Checks chord feasibility and returns valid finger combinations.
 */
export function checkChordFeasibility(
  notes: PadCoord[],
  handSide: HandSide,
  constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS
): ChordFingerAssignment[][] {
  if (notes.length === 0 || notes.length > 5) return [];

  const allFingers: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const validCombinations: ChordFingerAssignment[][] = [];

  function generateAssignments(
    remainingNotes: PadCoord[],
    remainingFingers: FingerType[],
    currentAssignment: ChordFingerAssignment[]
  ): void {
    if (remainingNotes.length === 0) {
      if (isChordAssignmentValid(currentAssignment, handSide, constants)) {
        validCombinations.push([...currentAssignment]);
      }
      return;
    }

    for (let i = 0; i < remainingFingers.length; i++) {
      const finger = remainingFingers[i];
      const note = remainingNotes[0];
      const newAssignment: ChordFingerAssignment[] = [
        ...currentAssignment,
        { finger, pos: note },
      ];
      generateAssignments(
        remainingNotes.slice(1),
        [...remainingFingers.slice(0, i), ...remainingFingers.slice(i + 1)],
        newAssignment
      );
    }
  }

  generateAssignments(notes, allFingers, []);
  return validCombinations;
}

/**
 * Helper: checks if a chord assignment is valid.
 */
function isChordAssignmentValid(
  assignment: ChordFingerAssignment[],
  handSide: HandSide,
  constants: EngineConstants
): boolean {
  // Check 1: No overlapping fingers
  const positions = new Set<string>();
  for (const { pos } of assignment) {
    const posKey = `${pos.row},${pos.col}`;
    if (positions.has(posKey)) return false;
    positions.add(posKey);
  }

  // Check 2: Span within limits
  const thumbAssignment = assignment.find(a => a.finger === 'thumb');
  const pinkyAssignment = assignment.find(a => a.finger === 'pinky');
  if (thumbAssignment && pinkyAssignment) {
    const spanDistance = gridDistance(thumbAssignment.pos, pinkyAssignment.pos);
    if (spanDistance > constants.maxSpan) return false;
  }

  // Check 3: Finger ordering
  const tempHandState: HandState = {
    fingers: {
      thumb: { currentGridPos: null, fatigueLevel: 0 },
      index: { currentGridPos: null, fatigueLevel: 0 },
      middle: { currentGridPos: null, fatigueLevel: 0 },
      ring: { currentGridPos: null, fatigueLevel: 0 },
      pinky: { currentGridPos: null, fatigueLevel: 0 },
    },
    centerOfGravity: null,
    spanWidth: 0,
  };

  for (const { finger, pos } of assignment) {
    tempHandState.fingers[finger].currentGridPos = pos;
  }

  for (const { finger, pos } of assignment) {
    if (!isValidFingerOrder(tempHandState, { finger, pos }, handSide)) return false;
  }

  return true;
}

// ============================================================================
// Span & Topology Constraints (for CLP grip generation)
// ============================================================================

/**
 * Checks if the span constraint is satisfied.
 * Each pair of fingers is checked against its per-pair maximum distance.
 * Falls back to MAX_FINGER_SPAN_STRICT for any unlisted pair.
 */
function satisfiesSpanConstraint(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  pairMaxSpan: Record<string, number> = FINGER_PAIR_MAX_SPAN_STRICT
): boolean {
  const entries = Object.entries(fingerPositions) as [FingerType, FingerCoordinate][];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const key = pairKey(entries[i][0], entries[j][0]);
      const max = pairMaxSpan[key] ?? MAX_FINGER_SPAN_STRICT;
      if (fingerDistance(entries[i][1], entries[j][1]) > max) return false;
    }
  }
  return true;
}

/**
 * Checks topological constraint for LEFT hand.
 * Left hand ordering (left-to-right on grid): pinky <= ring <= middle <= index <= thumb + delta
 */
function satisfiesLeftHandTopology(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  thumbDelta: number = THUMB_DELTA,
  allowOverlap: boolean = false
): boolean {
  const xPositions: { finger: FingerType; x: number }[] = [];
  for (const finger of FINGER_ORDER) {
    const pos = fingerPositions[finger];
    if (pos !== undefined) xPositions.push({ finger, x: pos.x });
  }

  for (let i = 0; i < xPositions.length - 1; i++) {
    const current = xPositions[i];
    const next = xPositions[i + 1];
    const currentOrderIndex = FINGER_ORDER.indexOf(current.finger);
    const nextOrderIndex = FINGER_ORDER.indexOf(next.finger);

    if (currentOrderIndex < nextOrderIndex) {
      const delta = next.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (current.x > next.x + delta) return false;
    } else {
      const delta = current.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (next.x > current.x + delta) return false;
    }
  }

  return true;
}

/**
 * Checks topological constraint for RIGHT hand.
 * Right hand ordering: thumb - delta <= index <= middle <= ring <= pinky
 */
function satisfiesRightHandTopology(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  thumbDelta: number = THUMB_DELTA,
  allowOverlap: boolean = false
): boolean {
  const xPositions: { finger: FingerType; x: number }[] = [];
  for (const finger of FINGER_ORDER) {
    const pos = fingerPositions[finger];
    if (pos !== undefined) xPositions.push({ finger, x: pos.x });
  }

  for (let i = 0; i < xPositions.length - 1; i++) {
    const current = xPositions[i];
    const next = xPositions[i + 1];
    const currentOrderIndex = FINGER_ORDER.indexOf(current.finger);
    const nextOrderIndex = FINGER_ORDER.indexOf(next.finger);

    if (currentOrderIndex < nextOrderIndex) {
      const delta = next.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (current.x < next.x - delta) return false;
    } else {
      const delta = current.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (next.x < current.x - delta) return false;
    }
  }

  return true;
}

/**
 * Calculates the centroid of a set of finger positions.
 */
function calculateCentroid(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>
): FingerCoordinate {
  const positions = Object.values(fingerPositions);
  if (positions.length === 0) return { x: 3.5, y: 3.5 };
  const sumX = positions.reduce((sum, pos) => sum + pos.x, 0);
  const sumY = positions.reduce((sum, pos) => sum + pos.y, 0);
  return { x: sumX / positions.length, y: sumY / positions.length };
}

// ============================================================================
// CLP Grip Generation (Strict Only)
// ============================================================================

/** Options for diagnostic mode in grip generation. */
export interface GripDiagnosticOptions {
  /** When true, collect rejection reasons instead of silently discarding. */
  enabled: boolean;
  /** Populated with rejections when enabled. */
  rejections: GripRejection[];
}

/**
 * Internal function to generate grips with configurable constraints.
 *
 * When diagnostics.enabled is true, rejected grips are captured with their
 * GripRejection[] instead of silently discarded. This powers the
 * feasibility inspector UI.
 */
function generateGripsWithConstraints(
  activePads: PadCoord[],
  hand: HandSide,
  pairMaxSpan: Record<string, number>,
  thumbDelta: number,
  allowOverlap: boolean,
  diagnostics?: GripDiagnosticOptions
): HandPose[] {
  if (activePads.length === 0 || activePads.length > 5) return [];

  const validGrips: HandPose[] = [];
  const availableFingers: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const padCoords = activePads.map(padToFingerCoordinate);

  function generatePermutations(
    padIndex: number,
    remainingFingers: FingerType[],
    currentAssignment: Partial<Record<FingerType, FingerCoordinate>>
  ): void {
    if (padIndex === padCoords.length) {
      // Final span check
      if (!satisfiesSpanConstraint(currentAssignment, pairMaxSpan)) {
        if (diagnostics?.enabled) {
          collectSpanRejections(currentAssignment, pairMaxSpan, diagnostics.rejections);
        }
        return;
      }
      const topologyValid = hand === 'left'
        ? satisfiesLeftHandTopology(currentAssignment, thumbDelta, allowOverlap)
        : satisfiesRightHandTopology(currentAssignment, thumbDelta, allowOverlap);
      if (!topologyValid) {
        if (diagnostics?.enabled) {
          collectTopologyRejections(currentAssignment, hand, thumbDelta, diagnostics.rejections);
        }
        return;
      }

      validGrips.push({
        centroid: calculateCentroid(currentAssignment),
        fingers: { ...currentAssignment },
      });
      return;
    }

    const currentPadCoord = padCoords[padIndex];
    for (let i = 0; i < remainingFingers.length; i++) {
      const finger = remainingFingers[i];
      const newAssignment: Partial<Record<FingerType, FingerCoordinate>> = {
        ...currentAssignment,
        [finger]: currentPadCoord,
      };

      // Early pruning: check per-pair span incrementally
      let valid = true;
      for (const [existingFinger, existingPos] of Object.entries(currentAssignment) as [FingerType, FingerCoordinate][]) {
        const key = pairKey(finger, existingFinger);
        const max = pairMaxSpan[key] ?? MAX_FINGER_SPAN_STRICT;
        const dist = fingerDistance(existingPos, currentPadCoord);
        if (dist > max) {
          if (diagnostics?.enabled) {
            diagnostics.rejections.push({
              fingerA: finger,
              fingerB: existingFinger,
              rule: 'span',
              actual: dist,
              limit: max,
            });
          }
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      generatePermutations(
        padIndex + 1,
        [...remainingFingers.slice(0, i), ...remainingFingers.slice(i + 1)],
        newAssignment
      );
    }
  }

  generatePermutations(0, availableFingers, {});
  return validGrips;
}

/**
 * Collects span-violation rejections for diagnostic output.
 */
function collectSpanRejections(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  pairMaxSpan: Record<string, number>,
  rejections: GripRejection[]
): void {
  const entries = Object.entries(fingerPositions) as [FingerType, FingerCoordinate][];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const key = pairKey(entries[i][0], entries[j][0]);
      const max = pairMaxSpan[key] ?? MAX_FINGER_SPAN_STRICT;
      const dist = fingerDistance(entries[i][1], entries[j][1]);
      if (dist > max) {
        rejections.push({
          fingerA: entries[i][0],
          fingerB: entries[j][0],
          rule: 'span',
          actual: dist,
          limit: max,
        });
      }
    }
  }
}

/**
 * Collects topology-violation rejections for diagnostic output.
 */
function collectTopologyRejections(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  hand: HandSide,
  thumbDelta: number,
  rejections: GripRejection[]
): void {
  const entries = Object.entries(fingerPositions) as [FingerType, FingerCoordinate][];

  // Check finger ordering violations
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [fA, posA] = entries[i];
      const [fB, posB] = entries[j];
      const orderA = FINGER_ORDER.indexOf(fA);
      const orderB = FINGER_ORDER.indexOf(fB);
      if (orderA < 0 || orderB < 0) continue;

      // Check thumb delta
      if ((fA === 'thumb' || fB === 'thumb') && fA !== fB) {
        const thumbPos = fA === 'thumb' ? posA : posB;
        const otherPos = fA === 'thumb' ? posB : posA;
        const otherFinger = fA === 'thumb' ? fB : fA;
        if (thumbPos.y > otherPos.y + thumbDelta) {
          rejections.push({
            fingerA: 'thumb',
            fingerB: otherFinger,
            rule: 'thumbDelta',
            actual: thumbPos.y - otherPos.y,
            limit: thumbDelta,
          });
        }
      }

      // Check ordering (crossover)
      if (fA !== 'thumb' && fB !== 'thumb') {
        if (hand === 'right') {
          if (orderA < orderB && posA.x > posB.x) {
            rejections.push({ fingerA: fA, fingerB: fB, rule: 'ordering', actual: posA.x - posB.x, limit: 0 });
          }
        } else {
          if (orderA < orderB && posA.x < posB.x) {
            rejections.push({ fingerA: fA, fingerB: fB, rule: 'ordering', actual: posB.x - posA.x, limit: 0 });
          }
        }
      }
    }
  }
}

/**
 * Generates all valid hand grips for a given set of active pads.
 *
 * V1 Cost Model (D-01): Strict-only constraints. Returns empty array when
 * no valid grip exists (= infeasible event). No relaxed or fallback tiers.
 *
 * @param activePads - Pads that need to be pressed
 * @param hand - Which hand
 * @returns Array of valid HandPose objects (empty = infeasible)
 */
export function generateValidGrips(
  activePads: PadCoord[],
  hand: HandSide,
  diagnostics?: GripDiagnosticOptions
): HandPose[] {
  if (activePads.length === 0) return [];

  return generateGripsWithConstraints(
    activePads, hand, FINGER_PAIR_MAX_SPAN_STRICT, THUMB_DELTA, false, diagnostics
  );
}

/**
 * Generates valid grips with GripResult metadata.
 *
 * V1 Cost Model (D-01): All returned grips are strict tier.
 * Returns empty array when no valid grip exists (= infeasible event).
 */
export function generateValidGripsWithTier(
  activePads: PadCoord[],
  hand: HandSide,
  diagnostics?: GripDiagnosticOptions
): GripResult[] {
  if (activePads.length === 0) return [];

  const grips = generateGripsWithConstraints(
    activePads, hand, FINGER_PAIR_MAX_SPAN_STRICT, THUMB_DELTA, false, diagnostics
  );
  return grips.map(pose => ({ pose, tier: 'strict' as ConstraintTier, isFallback: false }));
}

/**
 * Generates valid grips from PadCoord positions (convenience wrapper).
 */
export function generateValidGripsFromPositions(
  positions: PadCoord[],
  hand: HandSide
): HandPose[] {
  return generateValidGrips(positions, hand);
}
