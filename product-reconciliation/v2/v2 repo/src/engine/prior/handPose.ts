/**
 * Hand Pose Configuration.
 *
 * Defines the neutral hand pose based on the user's natural Push 3 resting position.
 * Resolves finger positions to actual pad coordinates, computes hand centroids,
 * and builds RestingPose objects for solver attractor calculations.
 *
 * Ported from Version1/src/engine/handPose.ts with canonical terminology.
 */

import { type InstrumentConfig, type RestingPose, type HandPose, type FingerCoordinate } from '../../types/performance';
import { type Layout } from '../../types/layout';
import { padKey } from '../../types/padGrid';
import { type FingerType } from '../../types/fingerModel';
import { type NaturalHandPose } from '../../types/ergonomicPrior';
import {
  fingerIdToEngineKey,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  poseHasAssignments,
} from './naturalHandPose';

// ============================================================================
// Note Name ↔ MIDI Conversion
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a note name string (e.g., "D#-2", "G-1", "C0") to a MIDI note number.
 * MIDI note 0 = C-2, MIDI note 60 = C3.
 *
 * @param noteName - Note name string (e.g., "D#-2", "G-1", "C0")
 * @returns MIDI note number (0-127), or null if invalid
 */
function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;

  const notePart = match[1];
  const octave = parseInt(match[2], 10);
  const noteIndex = NOTE_NAMES.indexOf(notePart);
  if (noteIndex === -1) return null;

  const midiNote = (octave + 2) * 12 + noteIndex;
  if (midiNote < 0 || midiNote > 127) return null;
  return midiNote;
}

/**
 * Converts a MIDI note number to a note name string.
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name in format "C0", "D#2", etc.
 */
export function midiToNoteName(midiNote: number): string {
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2;
  return `${note}${octave}`;
}

// ============================================================================
// Neutral Finger Pose
// ============================================================================

/**
 * Neutral finger pose in musical note space.
 * Represents where a finger naturally rests in terms of MIDI note number.
 */
export interface NeutralFingerPose {
  /** Note name in format "D#-2", "G-1", "C0", etc. */
  noteName: string;
  /** MIDI note number (0-127) */
  noteNumber: number;
  /** Pad identifier "row,col" once mapped to layout (optional). */
  padId?: string;
}

/**
 * Neutral hand pose for all fingers.
 * Keys are engine finger identifiers: "L1", "L2", ..., "R5"
 */
export type NeutralHandPoseRecord = Record<string, NeutralFingerPose>;

// ============================================================================
// Default Neutral Hand Pose
// ============================================================================

/**
 * Default neutral hand pose for Push 3 in musical note space.
 *
 * Left Hand:  L1 (Thumb): D#-2, L2 (Index): G-1, L3 (Middle): D0, L4 (Ring): C#0, L5 (Pinky): C0
 * Right Hand: R1 (Thumb): E-2,  R2 (Index): G#-1, R3 (Middle): F0, R4 (Ring): F#0, R5 (Pinky): G0
 */
export const DEFAULT_HAND_POSE: NeutralHandPoseRecord = {
  L1: { noteName: 'D#-2', noteNumber: noteNameToMidi('D#-2')! },
  L2: { noteName: 'G-1', noteNumber: noteNameToMidi('G-1')! },
  L3: { noteName: 'D0', noteNumber: noteNameToMidi('D0')! },
  L4: { noteName: 'C#0', noteNumber: noteNameToMidi('C#0')! },
  L5: { noteName: 'C0', noteNumber: noteNameToMidi('C0')! },
  R1: { noteName: 'E-2', noteNumber: noteNameToMidi('E-2')! },
  R2: { noteName: 'G#-1', noteNumber: noteNameToMidi('G#-1')! },
  R3: { noteName: 'F0', noteNumber: noteNameToMidi('F0')! },
  R4: { noteName: 'F#0', noteNumber: noteNameToMidi('F#0')! },
  R5: { noteName: 'G0', noteNumber: noteNameToMidi('G0')! },
};

// ============================================================================
// Neutral Pad Position Types
// ============================================================================

/**
 * Neutral pad position for a finger.
 * Represents where a finger naturally sits on the current grid layout.
 */
export interface NeutralPadPosition {
  /** Pad row (0-7, 0 is bottom). */
  row: number;
  /** Pad column (0-7, 0 is left). */
  col: number;
  /** Pad identifier in format "row,col". */
  padId: string;
  /** MIDI note number for this finger's neutral position. */
  noteNumber: number;
  /** Note name for this finger's neutral position. */
  noteName: string;
}

/**
 * Neutral pad positions for all fingers.
 * Keys are engine finger identifiers: "L1", "L2", ..., "R5".
 */
export type NeutralPadPositions = Record<string, NeutralPadPosition>;

// ============================================================================
// Pad Position Resolution
// ============================================================================

/**
 * Resolves note number to a grid position using the instrument config.
 * Returns [row, col] or null if the note is outside the 8x8 window.
 */
function noteToGrid(noteNumber: number, instrumentConfig: InstrumentConfig): [number, number] | null {
  const offset = noteNumber - instrumentConfig.bottomLeftNote;
  if (offset < 0 || offset >= 64) return null;
  const row = Math.floor(offset / instrumentConfig.cols);
  const col = offset % instrumentConfig.cols;
  if (row < 0 || row >= instrumentConfig.rows || col < 0 || col >= instrumentConfig.cols) return null;
  return [row, col];
}

/**
 * Gets the MIDI note number at a grid position.
 */
function getNoteForPosition(row: number, col: number, instrumentConfig: InstrumentConfig): number | null {
  const noteNumber = instrumentConfig.bottomLeftNote + row * instrumentConfig.cols + col;
  if (noteNumber < 0 || noteNumber > 127) return null;
  return noteNumber;
}

/**
 * Resolves the default neutral hand pose to pad positions for the current instrument config.
 *
 * If a note doesn't exist in the current 8x8 grid window, that finger is skipped.
 *
 * @param _layout - The current layout (unused but kept for API compatibility)
 * @param instrumentConfig - The instrument configuration
 * @returns Record of finger keys to pad positions
 */
export function resolveNeutralPadPositions(
  _layout: Layout,
  instrumentConfig: InstrumentConfig
): NeutralPadPositions {
  const result: NeutralPadPositions = {};

  for (const [fingerKey, pose] of Object.entries(DEFAULT_HAND_POSE)) {
    const padPosition = noteToGrid(pose.noteNumber, instrumentConfig);
    if (!padPosition) continue;

    const [row, col] = padPosition;
    result[fingerKey] = {
      row,
      col,
      padId: padKey(row, col),
      noteNumber: pose.noteNumber,
      noteName: pose.noteName,
    };
  }

  return result;
}

/**
 * Converts a Natural Hand Pose (Pose 0) to NeutralPadPositions format.
 *
 * This allows the solver to use user-defined finger positions instead of
 * the default musical-note-based positions.
 *
 * @param pose - The Natural Hand Pose configuration
 * @param offsetRow - Vertical offset to apply. If not provided, uses max safe offset.
 * @param instrumentConfig - Instrument configuration for deriving note numbers
 * @returns NeutralPadPositions or null if pose has no assignments
 */
export function getNeutralPadPositionsFromPose0(
  pose: NaturalHandPose,
  offsetRow?: number,
  instrumentConfig?: InstrumentConfig
): NeutralPadPositions | null {
  if (!poseHasAssignments(pose)) return null;

  const effectiveOffset = offsetRow ?? getMaxSafeOffset(pose, true);
  const padsWithOffset = getPose0PadsWithOffset(pose, effectiveOffset, true);
  const result: NeutralPadPositions = {};

  for (const { fingerId, row, col } of padsWithOffset) {
    const engineKey = fingerIdToEngineKey(fingerId);
    const pid = padKey(row, col);

    let noteNumber = 0;
    let noteName = '';
    if (instrumentConfig) {
      noteNumber = getNoteForPosition(row, col, instrumentConfig) ?? 0;
      noteName = midiToNoteName(noteNumber);
    }

    result[engineKey] = { row, col, padId: pid, noteNumber, noteName };
  }

  return result;
}

// ============================================================================
// Neutral Hand Centers
// ============================================================================

/**
 * Neutral hand centers derived from neutral pad positions.
 */
export interface NeutralHandCentersResult {
  leftCenter: { x: number; y: number } | null;
  rightCenter: { x: number; y: number } | null;
  neutralPads: NeutralPadPositions;
}

/**
 * Computes neutral hand centers from neutral pad positions.
 * Calculates the centroid for each hand by averaging all available finger positions.
 */
export function computeNeutralHandCenters(
  neutralPads: NeutralPadPositions
): NeutralHandCentersResult {
  const leftPads: NeutralPadPosition[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `L${i}`;
    if (neutralPads[key]) leftPads.push(neutralPads[key]);
  }

  const leftCenter = leftPads.length > 0
    ? {
        x: leftPads.reduce((sum, p) => sum + p.col, 0) / leftPads.length,
        y: leftPads.reduce((sum, p) => sum + p.row, 0) / leftPads.length,
      }
    : null;

  const rightPads: NeutralPadPosition[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `R${i}`;
    if (neutralPads[key]) rightPads.push(neutralPads[key]);
  }

  const rightCenter = rightPads.length > 0
    ? {
        x: rightPads.reduce((sum, p) => sum + p.col, 0) / rightPads.length,
        y: rightPads.reduce((sum, p) => sum + p.row, 0) / rightPads.length,
      }
    : null;

  return { leftCenter, rightCenter, neutralPads };
}

// ============================================================================
// RestingPose Construction
// ============================================================================

/** Engine key (L1..R5) to FingerType for building HandPose.fingers. */
const ENGINE_KEY_TO_FINGER: Record<string, FingerType> = {
  L1: 'thumb', L2: 'index', L3: 'middle', L4: 'ring', L5: 'pinky',
  R1: 'thumb', R2: 'index', R3: 'middle', R4: 'ring', R5: 'pinky',
};

/**
 * Builds a RestingPose from NeutralPadPositions.
 * Used so the attractor cost in the solver pulls toward the user's natural hand pose.
 *
 * @param neutralPads - Per-finger pad positions (L1..R5)
 * @returns RestingPose with left/right HandPose, or null if empty
 */
export function restingPoseFromNeutralPadPositions(
  neutralPads: NeutralPadPositions
): RestingPose | null {
  const leftFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  const rightFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  let leftSumX = 0, leftSumY = 0, leftCount = 0;
  let rightSumX = 0, rightSumY = 0, rightCount = 0;

  for (const [key, pos] of Object.entries(neutralPads)) {
    const finger = ENGINE_KEY_TO_FINGER[key];
    if (!finger) continue;
    const coord: FingerCoordinate = { x: pos.col, y: pos.row };
    if (key.startsWith('L')) {
      leftFingers[finger] = coord;
      leftSumX += pos.col; leftSumY += pos.row; leftCount++;
    } else {
      rightFingers[finger] = coord;
      rightSumX += pos.col; rightSumY += pos.row; rightCount++;
    }
  }

  const leftCenter: FingerCoordinate = leftCount > 0
    ? { x: leftSumX / leftCount, y: leftSumY / leftCount }
    : { x: 2, y: 2 };
  const rightCenter: FingerCoordinate = rightCount > 0
    ? { x: rightSumX / rightCount, y: rightSumY / rightCount }
    : { x: 5, y: 2 };

  const leftPose: HandPose = { centroid: leftCenter, fingers: leftFingers };
  const rightPose: HandPose = { centroid: rightCenter, fingers: rightFingers };

  return { left: leftPose, right: rightPose };
}

/**
 * Convenience function: resolves neutral pads and computes centers in one step.
 */
export function getNeutralHandCenters(
  layout: Layout,
  instrumentConfig: InstrumentConfig
): NeutralHandCentersResult {
  const neutralPads = resolveNeutralPadPositions(layout, instrumentConfig);
  return computeNeutralHandCenters(neutralPads);
}
