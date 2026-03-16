/**
 * Pad Assignment for Rudiments and Patterns.
 *
 * Assigns each lane to a sensible pad on the 8x8 Push 3 grid,
 * using Pose0 anchor positions for ergonomic placement.
 *
 * Supports:
 * - Legacy RudimentType-based assignment (2/3/4 lane templates)
 * - 'auto' assignment: category-based placement for arbitrary patterns
 */

import { type LoopLane } from '../../types/loopEditor';
import { type RudimentType, type LanePadAssignment } from '../../types/rudiment';
import { type PadCoord } from '../../types/padGrid';
import { type SurfaceCategory, SURFACE_DEFAULTS } from '../../types/patternRecipe';
import { getPreferredHand } from '../surface/handZone';

// ============================================================================
// Pose0 Pad Positions (from naturalHandPose.ts BUILT_IN_POSE0_CELLS)
// ============================================================================

/** Deterministic pad positions for common drum roles, anchored to Pose0 fingers. */
const ROLE_PAD_MAP: Record<string, PadCoord> = {
  Kick:         { row: 0, col: 3 },  // L_THUMB
  Snare:        { row: 3, col: 3 },  // L_INDEX
  'Closed Hat': { row: 4, col: 7 },  // R_PINKY
  'Open Hat':   { row: 4, col: 6 },  // R_RING
  'Tom 1':      { row: 3, col: 4 },  // R_INDEX
  'Tom 2':      { row: 4, col: 5 },  // R_MIDDLE
  Rim:          { row: 4, col: 2 },  // L_MIDDLE
  Crash:        { row: 4, col: 1 },  // L_RING
};

/**
 * For 2-lane rudiments (e.g., single/double stroke roll, six stroke roll),
 * use L_INDEX and R_INDEX positions for natural left-right alternation.
 */
const TWO_LANE_PADS: [PadCoord, PadCoord] = [
  { row: 3, col: 3 },  // L_INDEX — left surface
  { row: 3, col: 4 },  // R_INDEX — right surface
];

/**
 * For 3-lane rudiments (e.g., paradiddle, flam accent),
 * use L_INDEX, R_INDEX, and an additional pad.
 */
const THREE_LANE_PADS: [PadCoord, PadCoord, PadCoord] = [
  { row: 3, col: 3 },  // L_INDEX — primary left
  { row: 3, col: 4 },  // R_INDEX — primary right
  { row: 4, col: 5 },  // R_MIDDLE — secondary right
];

// Category-based pad zones for 'auto' assignment
const BASS_PADS: PadCoord[] = [
  { row: 0, col: 3 }, { row: 0, col: 4 },  // Thumb zone center
  { row: 1, col: 3 }, { row: 1, col: 4 },  // Above thumb zone
];

const MELODIC_PADS: PadCoord[] = [
  { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
  { row: 1, col: 2 }, { row: 1, col: 5 },
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Assign each lane to a pad on the 8x8 grid.
 *
 * @param lanes         The lanes to assign pads to
 * @param rudimentType  Legacy rudiment type OR 'auto' for category-based assignment
 */
export function assignLanesToPads(
  lanes: LoopLane[],
  rudimentType: RudimentType | 'auto',
): LanePadAssignment[] {
  if (rudimentType === 'auto') {
    return assignAuto(lanes);
  }

  const usedPads = new Set<string>();

  if (rudimentType === 'basic_groove') {
    // Full kit: use role-based mapping
    return lanes.map(lane => {
      const pad = ROLE_PAD_MAP[lane.name] ?? findOpenPad(usedPads);
      usedPads.add(`${pad.row},${pad.col}`);
      return {
        laneId: lane.id,
        laneName: lane.name,
        pad,
        preferredHand: getPreferredHand(pad),
      };
    });
  }

  // Template-based assignment for 2 and 3 lane rudiments
  const padSet = lanes.length === 2 ? TWO_LANE_PADS : THREE_LANE_PADS;

  return lanes.map((lane, i) => {
    const pad = i < padSet.length
      ? padSet[i]
      : findOpenPad(usedPads);
    usedPads.add(`${pad.row},${pad.col}`);
    return {
      laneId: lane.id,
      laneName: lane.name,
      pad,
      preferredHand: getPreferredHand(pad),
    };
  });
}

// ============================================================================
// Auto Assignment (Category-Based)
// ============================================================================

/**
 * Category-aware pad assignment for arbitrary patterns.
 *
 * Strategy:
 * - Percussion lanes: use ROLE_PAD_MAP if recognized, else center-outward
 * - Bass lanes: place near thumb positions (rows 0-1)
 * - Melodic lanes: spread across mid rows (2-3)
 * - Textural/custom: fill remaining pads center-outward
 */
function assignAuto(lanes: LoopLane[]): LanePadAssignment[] {
  const usedPads = new Set<string>();
  const assignments: LanePadAssignment[] = [];

  for (const lane of lanes) {
    const category = inferCategory(lane.name);
    let pad: PadCoord;

    switch (category) {
      case 'percussion':
        // Try role map first, then center-outward
        pad = ROLE_PAD_MAP[lane.name] && !usedPads.has(padKey(ROLE_PAD_MAP[lane.name]))
          ? ROLE_PAD_MAP[lane.name]
          : findOpenPadFromPool(PERCUSSION_PREFERRED_ROWS, usedPads);
        break;

      case 'bass':
        pad = findOpenPadFromPool(BASS_PADS, usedPads);
        break;

      case 'melodic':
        pad = findOpenPadFromPool(MELODIC_PADS, usedPads);
        break;

      default:
        pad = findOpenPad(usedPads);
        break;
    }

    usedPads.add(padKey(pad));
    assignments.push({
      laneId: lane.id,
      laneName: lane.name,
      pad,
      preferredHand: getPreferredHand(pad),
    });
  }

  return assignments;
}

/** Preferred rows for percussion in auto mode. */
const PERCUSSION_PREFERRED_ROWS: PadCoord[] = (() => {
  const pads: PadCoord[] = [];
  for (const row of [3, 4, 2, 5]) {
    for (const col of [3, 4, 2, 5, 1, 6, 0, 7]) {
      pads.push({ row, col });
    }
  }
  return pads;
})();

/** Infer surface category from lane name by matching SURFACE_DEFAULTS. */
function inferCategory(laneName: string): SurfaceCategory {
  const normalized = laneName.toLowerCase().replace(/\s+/g, '_');

  for (const [role, info] of Object.entries(SURFACE_DEFAULTS)) {
    if (info.name.toLowerCase().replace(/\s+/g, '_') === normalized || role === normalized) {
      return info.category;
    }
  }

  return 'custom';
}

function findOpenPadFromPool(pool: PadCoord[], usedPads: Set<string>): PadCoord {
  for (const pad of pool) {
    if (!usedPads.has(padKey(pad))) {
      return pad;
    }
  }
  // Fallback to general center-outward search
  return findOpenPad(usedPads);
}

// ============================================================================
// Helpers
// ============================================================================

function padKey(pad: PadCoord): string {
  return `${pad.row},${pad.col}`;
}

/** Find an open pad position that hasn't been assigned yet. */
function findOpenPad(usedPads: Set<string>): PadCoord {
  // Walk through center rows first, then outward
  const preferredRows = [3, 4, 2, 5, 1, 6, 0, 7];
  const preferredCols = [3, 4, 2, 5, 1, 6, 0, 7];
  for (const row of preferredRows) {
    for (const col of preferredCols) {
      const key = `${row},${col}`;
      if (!usedPads.has(key)) {
        return { row, col };
      }
    }
  }
  return { row: 0, col: 0 }; // Should never reach here with ≤8 lanes
}
