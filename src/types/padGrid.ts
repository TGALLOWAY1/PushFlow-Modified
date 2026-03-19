/**
 * Canonical Push 3 pad grid types and utilities.
 *
 * The Push 3 surface is an 8x8 grid of physical pads.
 * Row index increases bottom -> top (0 = bottom).
 * Column index increases left -> right (0 = left).
 */

/** Physical pad coordinate on the 8x8 Push 3 surface. */
export interface PadCoord {
  row: number;
  col: number;
}

/** Alias for PadCoord - used interchangeably. */
export type GridPosition = PadCoord;

/** Grid dimensions. */
export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const GRID_SIZE = GRID_ROWS * GRID_COLS; // 64 pads

/**
 * Create a pad key string from row and column.
 * Format: "row,col" (e.g., "0,0" for bottom-left pad).
 */
export function padKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Parse a pad key string back to coordinates.
 * Returns null if the key is malformed.
 */
export function parsePadKey(key: string): PadCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
}

/**
 * Euclidean distance between two pad positions.
 */
export function gridDistance(a: PadCoord, b: PadCoord): number {
  const dr = a.row - b.row;
  const dc = a.col - b.col;
  return Math.sqrt(dr * dr + dc * dc);
}

/**
 * Check if a pad coordinate is within the valid 8x8 grid.
 */
export function isValidPad(coord: PadCoord): boolean {
  return (
    coord.row >= 0 &&
    coord.row < GRID_ROWS &&
    coord.col >= 0 &&
    coord.col < GRID_COLS
  );
}
