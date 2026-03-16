/**
 * Ergonomic prior types.
 *
 * These define the biomechanical constraints and tendencies
 * that ground optimization in human performance reality.
 */

import { type PadCoord } from './padGrid';

/**
 * FingerId: Identifies a specific finger on a specific hand.
 * Format: "L_THUMB", "R_INDEX", etc.
 */
export type FingerId =
  | 'L_THUMB' | 'L_INDEX' | 'L_MIDDLE' | 'L_RING' | 'L_PINKY'
  | 'R_THUMB' | 'R_INDEX' | 'R_MIDDLE' | 'R_RING' | 'R_PINKY';

/** All finger IDs in canonical order. */
export const ALL_FINGER_IDS: FingerId[] = [
  'L_THUMB', 'L_INDEX', 'L_MIDDLE', 'L_RING', 'L_PINKY',
  'R_THUMB', 'R_INDEX', 'R_MIDDLE', 'R_RING', 'R_PINKY',
];

/**
 * NaturalHandPose: Canonical comfortable hand/finger geometry prior.
 *
 * Defines where each finger naturally rests on the 8x8 grid.
 * This is a core modeling primitive, not an optional decoration.
 */
export interface NaturalHandPose {
  version: 1;
  name: string;
  /** Position index (0 = default/Pose0). */
  positionIndex: number;
  /** Finger to pad assignment. Null = finger not placed. */
  fingerToPad: Record<FingerId, PadCoord | null>;
  /** Maximum upward shift rows before going out of bounds. */
  maxUpShiftRows: number;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/**
 * HandZone: Preferred region for a hand on the grid.
 * Soft constraint - violations are penalized, not forbidden.
 */
export interface HandZone {
  hand: 'left' | 'right';
  /** Inclusive column range. */
  colStart: number;
  colEnd: number;
  /** Optional row range (defaults to full grid). */
  rowStart?: number;
  rowEnd?: number;
}
