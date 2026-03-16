/**
 * Hand zone definitions and violation scoring.
 *
 * Defines the canonical left/right hand zones on the 8x8 Push 3 grid.
 * These are soft constraints: playing outside your zone is penalized,
 * not forbidden.
 */

import { type PadCoord } from '../../types/padGrid';
import { type HandZone } from '../../types/ergonomicPrior';

/**
 * Default hand zones for the 8x8 Push 3 grid.
 *
 * Left hand: columns 0-3 (left half)
 * Right hand: columns 4-7 (right half)
 * Columns 3-4 are the "shared" overlap zone.
 */
export function getDefaultHandZones(): { left: HandZone; right: HandZone } {
  return {
    left: { hand: 'left', colStart: 0, colEnd: 3 },
    right: { hand: 'right', colStart: 4, colEnd: 7 },
  };
}

/**
 * Determine which hand a pad position prefers.
 *
 * Columns 0-2: left
 * Columns 3-4: shared (either hand)
 * Columns 5-7: right
 */
export function getPreferredHand(
  pad: PadCoord
): 'left' | 'right' | 'shared' {
  if (pad.col <= 2) return 'left';
  if (pad.col >= 5) return 'right';
  return 'shared';
}

/**
 * Compute a zone violation penalty for using a specific hand at a pad position.
 *
 * Returns 0 if the pad is within the hand's preferred zone.
 * Returns a penalty proportional to how far outside the zone the pad is.
 *
 * @param pad - The pad position
 * @param hand - Which hand is being used
 * @returns Penalty value (0 = no violation, higher = worse violation)
 */
export function zoneViolationScore(
  pad: PadCoord,
  hand: 'left' | 'right'
): number {
  const zones = getDefaultHandZones();
  const zone = hand === 'left' ? zones.left : zones.right;

  if (pad.col >= zone.colStart && pad.col <= zone.colEnd) {
    return 0; // Within zone
  }

  // Distance from nearest zone boundary
  const distanceFromZone = pad.col < zone.colStart
    ? zone.colStart - pad.col
    : pad.col - zone.colEnd;

  return distanceFromZone;
}
