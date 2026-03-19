/**
 * Push 3 Surface Model: 8x8 grid math and adjacency utilities.
 *
 * This module provides utility functions for working with the
 * Push 3's 8x8 pad grid, complementing the core types in @/types/padGrid.
 */

import {
  type PadCoord,
  GRID_ROWS,
  GRID_COLS,
  isValidPad,
} from '../../types/padGrid';

/**
 * All 64 pad coordinates on the 8x8 grid.
 * Row 0 is bottom, Row 7 is top. Col 0 is left, Col 7 is right.
 */
export const ALL_PADS: PadCoord[] = (() => {
  const pads: PadCoord[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      pads.push({ row, col });
    }
  }
  return pads;
})();

/**
 * Get all valid adjacent pads (8-connected: orthogonal + diagonal).
 */
export function adjacentPads(coord: PadCoord): PadCoord[] {
  const neighbors: PadCoord[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const neighbor = { row: coord.row + dr, col: coord.col + dc };
      if (isValidPad(neighbor)) {
        neighbors.push(neighbor);
      }
    }
  }
  return neighbors;
}

/**
 * Manhattan distance between two pads.
 */
export function manhattanDistance(a: PadCoord, b: PadCoord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Get all pads in a rectangular region (inclusive).
 */
export function padRegion(
  topLeft: PadCoord,
  bottomRight: PadCoord
): PadCoord[] {
  const pads: PadCoord[] = [];
  const minRow = Math.min(topLeft.row, bottomRight.row);
  const maxRow = Math.max(topLeft.row, bottomRight.row);
  const minCol = Math.min(topLeft.col, bottomRight.col);
  const maxCol = Math.max(topLeft.col, bottomRight.col);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (isValidPad({ row, col })) {
        pads.push({ row, col });
      }
    }
  }
  return pads;
}

/**
 * Check if two pad coordinates are the same.
 */
export function samePad(a: PadCoord, b: PadCoord): boolean {
  return a.row === b.row && a.col === b.col;
}
