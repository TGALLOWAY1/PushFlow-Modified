/**
 * Preset Transform Functions.
 *
 * Handles relative↔absolute coordinate conversion, mirror transform,
 * and placement validation for ComposerPresets.
 */

import { type PadCoord, isValidPad, padKey, GRID_ROWS, GRID_COLS } from '../../types/padGrid';
import { type PresetPad, type PresetBoundingBox, type ComposerPreset } from '../../types/composerPreset';
import { type HandSide } from '../../types/fingerModel';
import { isZoneValid } from '../surface/handZone';

// ============================================================================
// Relative ↔ Absolute Conversion
// ============================================================================

/** Convert a relative preset pad position to absolute grid coordinates. */
export function toAbsolute(
  pad: PresetPad,
  anchorRow: number,
  anchorCol: number,
): PadCoord {
  return {
    row: anchorRow + pad.position.rowOffset,
    col: anchorCol + pad.position.colOffset,
  };
}

/** Convert all preset pads to absolute grid coordinates. */
export function allToAbsolute(
  pads: PresetPad[],
  anchorRow: number,
  anchorCol: number,
): PadCoord[] {
  return pads.map(pad => toAbsolute(pad, anchorRow, anchorCol));
}

/** Convert absolute grid coordinates back to relative, given an anchor. */
export function toRelative(
  coord: PadCoord,
  anchorRow: number,
  anchorCol: number,
): { rowOffset: number; colOffset: number } {
  return {
    rowOffset: coord.row - anchorRow,
    colOffset: coord.col - anchorCol,
  };
}

// ============================================================================
// Placement Validation
// ============================================================================

export interface PlacementValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Validate whether a preset can be placed at the given anchor position.
 *
 * Checks:
 * 1. All pads are within the 8×8 grid bounds
 * 2. All pads satisfy hand zone constraints
 * 3. No pads collide with occupied positions (if provided)
 */
export function validatePlacement(
  pads: PresetPad[],
  anchorRow: number,
  anchorCol: number,
  occupiedPads?: Set<string>,
): PlacementValidationResult {
  const reasons: string[] = [];

  for (const pad of pads) {
    const abs = toAbsolute(pad, anchorRow, anchorCol);

    // Grid bounds check
    if (!isValidPad(abs)) {
      reasons.push(
        `Pad at (${abs.row}, ${abs.col}) is outside the 8×8 grid`
      );
    }

    // Hand zone check (only if within grid)
    if (isValidPad(abs) && !isZoneValid(abs, pad.hand)) {
      reasons.push(
        `Pad at (${abs.row}, ${abs.col}) is outside the ${pad.hand} hand zone`
      );
    }

    // Collision check
    if (occupiedPads && isValidPad(abs)) {
      const key = padKey(abs.row, abs.col);
      if (occupiedPads.has(key)) {
        reasons.push(
          `Pad at (${abs.row}, ${abs.col}) collides with an occupied position`
        );
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Check if a placement is valid (quick boolean check).
 */
export function isPlacementValid(
  pads: PresetPad[],
  anchorRow: number,
  anchorCol: number,
  occupiedPads?: Set<string>,
): boolean {
  return validatePlacement(pads, anchorRow, anchorCol, occupiedPads).valid;
}

/**
 * Get the set of pad keys that would be occupied by a placement.
 */
export function getPlacementPadKeys(
  pads: PresetPad[],
  anchorRow: number,
  anchorCol: number,
): string[] {
  return pads
    .map(pad => toAbsolute(pad, anchorRow, anchorCol))
    .filter(isValidPad)
    .map(coord => padKey(coord.row, coord.col));
}

// ============================================================================
// Mirror Transform
// ============================================================================

/** Swap hand side. */
function flipHand(hand: HandSide): HandSide {
  return hand === 'left' ? 'right' : 'left';
}

/**
 * Mirror a preset's pads horizontally.
 *
 * - Flips colOffset: `colOffset → (boundingBox.cols - 1 - colOffset)`
 * - Swaps hand: left ↔ right
 * - Keeps finger type unchanged (thumb stays thumb, etc.)
 * - rowOffset is preserved (no vertical flip)
 */
export function mirrorPads(
  pads: PresetPad[],
  boundingBox: PresetBoundingBox,
): PresetPad[] {
  return pads.map(pad => ({
    ...pad,
    position: {
      rowOffset: pad.position.rowOffset,
      colOffset: boundingBox.cols - 1 - pad.position.colOffset,
    },
    hand: flipHand(pad.hand),
  }));
}

/**
 * Create a mirrored copy of a ComposerPreset.
 *
 * The original preset is unchanged.
 * Handedness flips: left ↔ right, both stays both.
 */
export function mirrorPreset(preset: ComposerPreset): ComposerPreset {
  const mirroredPads = mirrorPads(preset.pads, preset.boundingBox);
  const mirroredHandedness = preset.handedness === 'left' ? 'right'
    : preset.handedness === 'right' ? 'left'
    : 'both';

  return {
    ...preset,
    pads: mirroredPads,
    handedness: mirroredHandedness,
    // boundingBox dimensions don't change — just the pad positions within it
  };
}

// ============================================================================
// Anchor Calculation
// ============================================================================

/**
 * Find all valid anchor positions for a preset on the grid.
 * Useful for showing valid drop zones during drag.
 */
export function findValidAnchors(
  pads: PresetPad[],
  occupiedPads?: Set<string>,
): PadCoord[] {
  const valid: PadCoord[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isPlacementValid(pads, row, col, occupiedPads)) {
        valid.push({ row, col });
      }
    }
  }
  return valid;
}

/**
 * Snap a cursor grid position to the nearest valid anchor.
 * Returns null if no valid anchor exists.
 */
export function snapToNearestValidAnchor(
  cursorRow: number,
  cursorCol: number,
  pads: PresetPad[],
  occupiedPads?: Set<string>,
): PadCoord | null {
  // Try the cursor position first
  if (isPlacementValid(pads, cursorRow, cursorCol, occupiedPads)) {
    return { row: cursorRow, col: cursorCol };
  }

  // Search outward in expanding rings
  for (let radius = 1; radius <= Math.max(GRID_ROWS, GRID_COLS); radius++) {
    let best: PadCoord | null = null;
    let bestDist = Infinity;

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // Only check ring edge
        const r = cursorRow + dr;
        const c = cursorCol + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        if (isPlacementValid(pads, r, c, occupiedPads)) {
          const dist = Math.sqrt(dr * dr + dc * dc);
          if (dist < bestDist) {
            bestDist = dist;
            best = { row: r, col: c };
          }
        }
      }
    }
    if (best) return best;
  }

  return null;
}
