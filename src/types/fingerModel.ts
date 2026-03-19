/**
 * Finger and hand model types.
 *
 * These are the canonical finger/hand types used throughout the engine.
 */

import { type PadCoord } from './padGrid';

/** The five fingers of a hand. */
export type FingerType = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

/** Which hand: left or right. */
export type HandSide = 'left' | 'right';

/** All finger types in anatomical order (thumb to pinky). */
export const ALL_FINGERS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/** Number of fingers per hand. */
export const FINGERS_PER_HAND = 5;

/**
 * FingerState: Current state of a single finger.
 */
export interface FingerState {
  /** Current grid position, or null if finger is not placed. */
  currentGridPos: PadCoord | null;
  /** Fatigue level (0.0 = no fatigue, higher = more fatigued). */
  fatigueLevel: number;
}

/**
 * HandState: Current state of a hand (all five fingers).
 */
export interface HandState {
  fingers: Record<FingerType, FingerState>;
  centerOfGravity: PadCoord | null;
  spanWidth: number;
}
