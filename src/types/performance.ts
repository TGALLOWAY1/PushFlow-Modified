/**
 * Performance and related configuration types.
 *
 * A Performance holds the event timeline that the engine must optimize.
 */

import { type PerformanceEvent } from './performanceEvent';
import { type FingerType } from './fingerModel';

/**
 * 2D position for finger/hand tracking.
 * Uses continuous coordinates for sub-pad precision in biomechanical modeling.
 */
export interface FingerCoordinate {
  /** X position (column-axis, 0 = left edge). */
  x: number;
  /** Y position (row-axis, 0 = bottom edge). */
  y: number;
}

/**
 * HandPose: Biomechanical state of a hand at a point in time.
 * Used by the beam solver to track hand positions during optimization.
 */
export interface HandPose {
  /** Center of the hand (palm centroid) for attractor calculations. */
  centroid: FingerCoordinate;
  /** Current finger positions. Partial allows unplaced fingers. */
  fingers: Partial<Record<FingerType, FingerCoordinate>>;
}

/**
 * RestingPose: The "home" position for both hands.
 * This neutral position attracts hands back when idle.
 */
export interface RestingPose {
  left: HandPose;
  right: HandPose;
}

/**
 * Performance: The ground truth musical data to be analyzed.
 * Events MUST be sorted by startTime ascending.
 */
export interface Performance {
  events: PerformanceEvent[];
  tempo?: number;
  name?: string;
}

/**
 * InstrumentConfig: Configuration for the 8x8 Push 3 pad grid.
 * Defines the voice-to-pad mapping window for 64-pad drum mode.
 */
export interface InstrumentConfig {
  id: string;
  name: string;
  rows: 8;
  cols: 8;
  /** MIDI note number at pad [0,0] (bottom-left). Typically 36 (C1). */
  bottomLeftNote: number;
  layoutMode?: 'drum_64';
}
