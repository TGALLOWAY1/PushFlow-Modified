/**
 * The one finger notation (S4.2, T42).
 *
 * A finger is written as its hand's letter and its number: L1 (left thumb) to
 * R5 (right little finger). Every surface that names a finger (the grid, the
 * timeline pills, Compare, the Sounds panel's chips, the inspectors, the
 * Events list) uses these helpers, and puts the finger's name in its tooltip.
 * Hands are coloured with the --hand-left and --hand-right tokens, always
 * beside the letter, so colour is never the only cue.
 */

import { type FingerType, type HandSide } from '../types/fingerModel';

export const FINGER_NUMBER: Record<FingerType, string> = {
  thumb: '1',
  index: '2',
  middle: '3',
  ring: '4',
  pinky: '5',
};

const FINGER_NAME: Record<FingerType, string> = {
  thumb: 'thumb',
  index: 'index finger',
  middle: 'middle finger',
  ring: 'ring finger',
  pinky: 'little finger',
};

function isHand(hand: unknown): hand is HandSide {
  return hand === 'left' || hand === 'right';
}

function isFinger(finger: unknown): finger is FingerType {
  return typeof finger === 'string' && finger in FINGER_NUMBER;
}

/** "L2"; "" when the hand or the finger isn't known (an unplayable or unassigned note). */
export function fingerLabel(hand: unknown, finger: unknown): string {
  if (!isHand(hand) || !isFinger(finger)) return '';
  return `${hand === 'left' ? 'L' : 'R'}${FINGER_NUMBER[finger]}`;
}

/** "Left index finger", for tooltips; "" when the hand or the finger isn't known. */
export function fingerName(hand: unknown, finger: unknown): string {
  if (!isHand(hand) || !isFinger(finger)) return '';
  return `${hand === 'left' ? 'Left' : 'Right'} ${FINGER_NAME[finger]}`;
}

/** "Index finger": a finger's name without its hand. */
export function fingerOnlyName(finger: FingerType): string {
  const name = FINGER_NAME[finger];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The hand's colour token, or null for a note no hand plays. */
export function handColor(hand: unknown): string | null {
  return hand === 'left' ? 'var(--hand-left)' : hand === 'right' ? 'var(--hand-right)' : null;
}

/** "Left hand" or "Right hand". */
export function handName(hand: HandSide): string {
  return hand === 'left' ? 'Left hand' : 'Right hand';
}

/** A note's finger: its label, name and hand, or null when no hand plays it. */
export interface NoteFinger {
  hand: HandSide;
  finger: FingerType;
  label: string;
  name: string;
}

export function noteFinger(note: { assignedHand?: unknown; finger?: unknown }): NoteFinger | null {
  const { assignedHand: hand, finger } = note;
  if (!isHand(hand) || !isFinger(finger)) return null;
  return { hand, finger, label: fingerLabel(hand, finger), name: fingerName(hand, finger) };
}
