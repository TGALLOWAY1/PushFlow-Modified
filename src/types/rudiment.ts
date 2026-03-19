/**
 * Rudiment Generation Types.
 *
 * Data model for the Generate Rudiment feature in the loop editor.
 * Rudiments are template-based quantized patterns with pad assignments,
 * finger assignments, and complexity scoring.
 */

import { type PadCoord } from './padGrid';
import { type FingerType, type HandSide } from './fingerModel';
import { type LoopCellKey } from './loopEditor';

// ============================================================================
// Rudiment Templates
// ============================================================================

/** Available rudiment template identifiers. */
export type RudimentType =
  | 'single_stroke_roll'
  | 'double_stroke_roll'
  | 'paradiddle'
  | 'flam_accent'
  | 'six_stroke_roll'
  | 'basic_groove';

/** Human-readable labels for rudiment types. */
export const RUDIMENT_LABELS: Record<RudimentType, string> = {
  single_stroke_roll: 'Single Stroke Roll',
  double_stroke_roll: 'Double Stroke Roll',
  paradiddle: 'Paradiddle',
  flam_accent: 'Flam Accent',
  six_stroke_roll: 'Six Stroke Roll',
  basic_groove: 'Basic Groove',
};

/** Short descriptions for rudiment types. */
export const RUDIMENT_DESCRIPTIONS: Record<RudimentType, string> = {
  single_stroke_roll: 'Alternating R-L strokes on two surfaces',
  double_stroke_roll: 'R-R-L-L paired strokes',
  paradiddle: 'R-L-R-R / L-R-L-L sticking pattern',
  flam_accent: 'Grace notes with primary hits across surfaces',
  six_stroke_roll: 'R-L-L-R-R-L accent pattern',
  basic_groove: 'Full kit groove with kick, snare, and hats',
};

/** All rudiment types in display order. */
export const ALL_RUDIMENT_TYPES: RudimentType[] = [
  'single_stroke_roll',
  'double_stroke_roll',
  'paradiddle',
  'six_stroke_roll',
  'flam_accent',
  'basic_groove',
];

// ============================================================================
// Pad Assignment
// ============================================================================

/** Per-lane pad assignment on the 8x8 grid. */
export interface LanePadAssignment {
  laneId: string;
  laneName: string;
  pad: PadCoord;
  preferredHand: 'left' | 'right' | 'shared';
}

// ============================================================================
// Finger Assignment
// ============================================================================

/** Per-event finger assignment for a loop event. */
export interface RudimentFingerAssignment {
  cellKey: LoopCellKey;
  laneId: string;
  stepIndex: number;
  hand: HandSide;
  finger: FingerType;
  pad: PadCoord;
  cost: number;
}

// ============================================================================
// Complexity
// ============================================================================

/** Complexity label thresholds. */
export type ComplexityLabel = 'Simple' | 'Moderate' | 'Complex' | 'Advanced';

/** Complexity breakdown for a rudiment pattern. */
export interface RudimentComplexity {
  /** Overall complexity score 0-100. */
  score: number;
  /** Event density: events per step. */
  density: number;
  /** Number of distinct lanes active. */
  laneCount: number;
  /** Number of steps with simultaneous events. */
  simultaneousHits: number;
  /** Maximum events per second at current BPM. */
  peakEventsPerSecond: number;
  /** Human-readable label. */
  label: ComplexityLabel;
}

// ============================================================================
// Rudiment Result
// ============================================================================

/** Complete rudiment generation result, stored on LoopState. */
export interface RudimentResult {
  rudimentType: RudimentType;
  padAssignments: LanePadAssignment[];
  fingerAssignments: RudimentFingerAssignment[];
  complexity: RudimentComplexity;
}
