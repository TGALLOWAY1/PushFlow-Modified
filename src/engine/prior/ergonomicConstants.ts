/**
 * Ergonomic constants — compatibility re-export layer.
 *
 * All biomechanical constants are now canonically defined in biomechanicalModel.ts.
 * Fatigue model is in engine/diagnostics/fatigueModel.ts.
 * This file re-exports for backward compatibility with existing imports.
 */

import { type PadCoord } from '../../types/padGrid';

/** GridPosition alias for compatibility with legacy code. */
export type GridPosition = PadCoord;

// Re-export physical constants from canonical source
export {
  MAX_HAND_SPAN,
  MAX_REACH_GRID_UNITS,
  MAX_SPEED_UNITS_PER_SEC,
  CHORD_PENALTY_THRESHOLD,
  calculateGridDistance,
} from './biomechanicalModel';

// Re-export fatigue model from diagnostics
export {
  FATIGUE_ACCUMULATION_RATE,
  FATIGUE_DECAY_RATE,
  MAX_FATIGUE,
  decayFatigue,
  accumulateFatigue,
} from '../diagnostics/fatigueModel';

// ============================================================================
// Legacy Exports (kept for backward compatibility)
// ============================================================================

/** Drift penalty multiplier (penalty per unit of wrist movement). @deprecated Diagnostic only. */
export const DRIFT_PENALTY_MULTIPLIER = 0.5;

/**
 * Finger weights indexed by numeric finger ID (1-5).
 * @deprecated Use FINGER_PREFERENCE_COST from biomechanicalModel.ts instead.
 */
export const FINGER_WEIGHTS: Record<number, number> = {
  1: 1.2, // Thumb - slightly heavier (less agile)
  2: 1.0, // Index - baseline
  3: 1.0, // Middle - baseline
  4: 1.1, // Ring - slightly heavier
  5: 1.3, // Pinky - heaviest
};
