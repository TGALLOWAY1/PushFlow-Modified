/**
 * Natural Hand Pose utilities.
 *
 * Provides factory functions, validation, offset logic, and conversion helpers
 * for NaturalHandPose configurations.
 *
 * Ported from Version1/src/types/naturalHandPose.ts.
 * Types (FingerId, NaturalHandPose, ALL_FINGER_IDS) are in @/types/ergonomicPrior.
 */

import {
  type FingerId,
  type NaturalHandPose,
  ALL_FINGER_IDS,
} from '../../types/ergonomicPrior';
import { type PadCoord, padKey } from '../../types/padGrid';
import { type FingerType } from '../../types/fingerModel';

// ============================================================================
// Finger Priority Order (for seeding)
// ============================================================================

/** Finger priority order for seeding: index -> middle -> ring -> thumb -> pinky */
export const FINGER_PRIORITY_ORDER: readonly FingerId[] = [
  'L_INDEX', 'L_MIDDLE', 'L_RING', 'L_THUMB', 'L_PINKY',
  'R_INDEX', 'R_MIDDLE', 'R_RING', 'R_THUMB', 'R_PINKY',
] as const;

// ============================================================================
// Validation
// ============================================================================

export interface PoseValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a NaturalHandPose object.
 */
export function validateNaturalHandPose(pose: NaturalHandPose): PoseValidationResult {
  if (!pose || typeof pose !== 'object') {
    return { valid: false, error: 'Pose must be an object' };
  }

  if (pose.version !== 1) {
    return { valid: false, error: `Unsupported pose version: ${pose.version}` };
  }

  if (!pose.fingerToPad || typeof pose.fingerToPad !== 'object') {
    return { valid: false, error: 'fingerToPad must be an object' };
  }

  const occupiedPads = new Map<string, FingerId>();

  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) continue;

    if (typeof pad !== 'object') {
      return { valid: false, error: `${fingerId}: pad must be an object or null` };
    }

    const { row, col } = pad;
    if (typeof row !== 'number' || typeof col !== 'number') {
      return { valid: false, error: `${fingerId}: row and col must be numbers` };
    }

    if (row < 0 || row > 7) {
      return { valid: false, error: `${fingerId}: row ${row} is out of range [0, 7]` };
    }

    if (col < 0 || col > 7) {
      return { valid: false, error: `${fingerId}: col ${col} is out of range [0, 7]` };
    }

    const key = padKey(row, col);
    const existingFinger = occupiedPads.get(key);
    if (existingFinger) {
      return {
        valid: false,
        error: `Duplicate pad at (${row}, ${col}): both ${existingFinger} and ${fingerId} assigned`,
      };
    }
    occupiedPads.set(key, fingerId);
  }

  return { valid: true };
}

// ============================================================================
// Default Pose Factory
// ============================================================================

/** Built-in default Pose 0 positions. */
const BUILT_IN_POSE0_CELLS: Record<FingerId, PadCoord> = {
  L_THUMB: { row: 0, col: 3 },
  L_INDEX: { row: 3, col: 3 },
  L_MIDDLE: { row: 4, col: 2 },
  L_RING: { row: 4, col: 1 },
  L_PINKY: { row: 4, col: 0 },
  R_THUMB: { row: 0, col: 4 },
  R_INDEX: { row: 3, col: 4 },
  R_MIDDLE: { row: 4, col: 5 },
  R_RING: { row: 4, col: 6 },
  R_PINKY: { row: 4, col: 7 },
};

/** Creates an empty Pose 0 (all fingers unassigned). */
export function createEmptyPose0(): NaturalHandPose {
  const fingerToPad: Record<FingerId, PadCoord | null> = {
    L_THUMB: null, L_INDEX: null, L_MIDDLE: null, L_RING: null, L_PINKY: null,
    R_THUMB: null, R_INDEX: null, R_MIDDLE: null, R_RING: null, R_PINKY: null,
  };
  return {
    version: 1,
    name: 'Empty Pose',
    positionIndex: 0,
    fingerToPad,
    maxUpShiftRows: 4,
    updatedAt: new Date().toISOString(),
  };
}

/** Creates the built-in default Pose 0. */
export function createDefaultPose0(): NaturalHandPose {
  return {
    version: 1,
    name: 'Natural Hand Pose',
    positionIndex: 0,
    fingerToPad: { ...BUILT_IN_POSE0_CELLS },
    maxUpShiftRows: 4,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Normalization
// ============================================================================

/** Normalizes a pose so that the minimum row becomes 0. */
export function normalizePose0(pose: NaturalHandPose): NaturalHandPose {
  let minRow = Infinity;
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad !== null && pad !== undefined) {
      minRow = Math.min(minRow, pad.row);
    }
  }

  if (minRow === Infinity) {
    return { ...pose, updatedAt: new Date().toISOString() };
  }

  const normalizedFingerToPad = {} as Record<FingerId, PadCoord | null>;
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) {
      normalizedFingerToPad[fingerId] = null;
    } else {
      normalizedFingerToPad[fingerId] = { row: pad.row - minRow, col: pad.col };
    }
  }

  return { ...pose, fingerToPad: normalizedFingerToPad, updatedAt: new Date().toISOString() };
}

// ============================================================================
// Offset Application
// ============================================================================

export interface PoseWithOffsetEntry {
  fingerId: FingerId;
  row: number;
  col: number;
}

/** Gets pads from Pose 0 with a vertical offset applied. */
export function getPose0PadsWithOffset(
  pose: NaturalHandPose,
  offsetRow: number,
  clamp: boolean = false
): PoseWithOffsetEntry[] {
  const result: PoseWithOffsetEntry[] = [];
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) continue;

    let row = pad.row + offsetRow;
    if (clamp) row = Math.max(0, Math.min(7, row));

    result.push({ fingerId, row, col: pad.col });
  }
  return result;
}

/** Checks if a given offset keeps all assigned fingers on-grid. */
export function isOffsetSafe(pose: NaturalHandPose, offsetRow: number): boolean {
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) continue;
    const row = pad.row + offsetRow;
    if (row < 0 || row > 7) return false;
  }
  return true;
}

/** Gets the maximum safe offset that keeps all fingers on-grid. */
export function getMaxSafeOffset(pose: NaturalHandPose, preferPositive: boolean = true): number {
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad !== null && pad !== undefined) {
      minRow = Math.min(minRow, pad.row);
      maxRow = Math.max(maxRow, pad.row);
    }
  }

  if (minRow === Infinity) return 0;

  const minSafeOffset = -minRow;
  const maxSafeOffset = 7 - maxRow;
  const clampedMin = Math.max(-4, minSafeOffset);
  const clampedMax = Math.min(4, maxSafeOffset);

  return preferPositive ? Math.min(4, clampedMax) : (Math.max(-4, clampedMin) || 0);
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/** Converts a FingerId to hand and FingerType. */
export function fingerIdToHandAndFingerType(fingerId: FingerId): {
  hand: 'left' | 'right';
  finger: FingerType;
} {
  const isLeft = fingerId.startsWith('L_');
  const fingerPart = fingerId.split('_')[1].toLowerCase() as FingerType;
  return { hand: isLeft ? 'left' : 'right', finger: fingerPart };
}

/** Converts a FingerId to engine key ("L1".."R5"). */
export function fingerIdToEngineKey(fingerId: FingerId): string {
  const fingerMap: Record<string, number> = {
    THUMB: 1, INDEX: 2, MIDDLE: 3, RING: 4, PINKY: 5,
  };
  const hand = fingerId.startsWith('L_') ? 'L' : 'R';
  const fingerPart = fingerId.split('_')[1];
  return `${hand}${fingerMap[fingerPart]}`;
}

/** Converts engine key ("L1".."R5") to FingerId. */
export function engineKeyToFingerId(key: string): FingerId | null {
  const match = key.match(/^([LR])(\d)$/);
  if (!match) return null;
  const [, hand, numStr] = match;
  const num = parseInt(numStr, 10);
  const fingerNames: Record<number, string> = { 1: 'THUMB', 2: 'INDEX', 3: 'MIDDLE', 4: 'RING', 5: 'PINKY' };
  const fingerName = fingerNames[num];
  if (!fingerName) return null;
  return `${hand}_${fingerName}` as FingerId;
}

/** Checks if a pose has any finger assignments. */
export function poseHasAssignments(pose: NaturalHandPose): boolean {
  for (const fingerId of ALL_FINGER_IDS) {
    if (pose.fingerToPad[fingerId] !== null && pose.fingerToPad[fingerId] !== undefined) {
      return true;
    }
  }
  return false;
}
