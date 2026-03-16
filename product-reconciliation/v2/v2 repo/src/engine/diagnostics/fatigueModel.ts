/**
 * Fatigue Model (Diagnostic Only).
 *
 * Tracks per-finger fatigue accumulation and decay.
 * This is a diagnostic metric — computed for display in the analysis panel
 * but NOT used in the primary beam search score.
 *
 * Moved from ergonomicConstants.ts during the performability-first refactor.
 */

// ============================================================================
// Constants
// ============================================================================

/** Fatigue added per finger use. */
export const FATIGUE_ACCUMULATION_RATE = 0.1;

/** Fatigue decay per second of rest. */
export const FATIGUE_DECAY_RATE = 0.05;

/** Maximum fatigue level. */
export const MAX_FATIGUE = 5.0;

// ============================================================================
// Functions
// ============================================================================

/**
 * Calculates fatigue decay based on time elapsed.
 */
export function decayFatigue(currentFatigue: number, timeDelta: number): number {
  if (timeDelta <= 0) return currentFatigue;
  const decay = FATIGUE_DECAY_RATE * timeDelta;
  return Math.max(0, currentFatigue - decay);
}

/**
 * Accumulates fatigue when a finger is used.
 */
export function accumulateFatigue(currentFatigue: number): number {
  return Math.min(MAX_FATIGUE, currentFatigue + FATIGUE_ACCUMULATION_RATE);
}
