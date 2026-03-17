/**
 * Hand zone definitions and validation.
 *
 * Defines the canonical left/right hand zones on the 8x8 Push 3 grid.
 * V1 Cost Model (D-02): Zones are hard constraints — a hand cannot play
 * outside its valid zone. The shared zone (cols 3-4) is valid for either hand.
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
 * V1 Hard zone constraint (D-02).
 *
 * Left hand: columns 0–4 valid.
 * Right hand: columns 3–7 valid.
 * Columns 3–4 are the shared zone (valid for either hand).
 *
 * @returns true if the hand can play at this pad position
 */
export function isZoneValid(
  pad: PadCoord,
  hand: 'left' | 'right'
): boolean {
  if (hand === 'left') return pad.col <= 4;
  return pad.col >= 3; // right hand
}

/**
 * Check if all pads in a group are valid for the given hand.
 */
export function allPadsInZone(
  pads: PadCoord[],
  hand: 'left' | 'right'
): boolean {
  return pads.every(pad => isZoneValid(pad, hand));
}

/**
 * Compute a zone violation penalty for using a specific hand at a pad position.
 *
 * @deprecated V1 (D-02): Zones are now hard constraints — use isZoneValid() instead.
 * Kept for backward compatibility during transition.
 */
export function zoneViolationScore(
  pad: PadCoord,
  hand: 'left' | 'right'
): number {
  return isZoneValid(pad, hand) ? 0 : 1;
}
