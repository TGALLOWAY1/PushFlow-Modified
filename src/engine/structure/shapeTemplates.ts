/**
 * Shape Templates for Temporal Cluster Placement.
 *
 * Provides a catalog of connected shapes (like Tetris pieces) that can be
 * placed on the 8x8 Push grid. Each shape is a set of relative offsets
 * from an anchor point.
 *
 * Design principles:
 * - All shapes are connected (every pad is orthogonally adjacent to at least one other)
 * - Shapes are ergonomically biased: prefer horizontal and compact arrangements
 * - Rotations are included as separate entries (hand ergonomics differ by orientation)
 * - Shapes up to size 8 are supported (max cluster size)
 *
 * The temporal seed generator picks shapes from this catalog based on:
 * - Cluster size (must match exactly)
 * - Shape hint from temporal analysis (row, column, block, any)
 * - Grid fit (must fit on the 8x8 grid at the chosen anchor)
 */

import { type PadCoord, GRID_ROWS, GRID_COLS, isValidPad } from '../../types/padGrid';

// ============================================================================
// Types
// ============================================================================

/** A relative offset from the shape's anchor point. */
export interface ShapeOffset {
  dr: number; // row delta
  dc: number; // col delta
}

/** A named shape template with metadata. */
export interface ShapeTemplate {
  /** Human-readable name (e.g., "I-horizontal", "L-right"). */
  name: string;
  /** Number of pads in this shape. */
  size: number;
  /** Relative offsets from anchor. First offset is always {0, 0}. */
  offsets: ShapeOffset[];
  /** Which shape hints this template satisfies. */
  hints: Array<'row' | 'column' | 'block' | 'any'>;
  /** Ergonomic preference (lower = more comfortable). */
  ergonomicRank: number;
}

/** A concrete placement: a shape anchored at a specific grid position. */
export interface ShapePlacement {
  /** Template used. */
  template: ShapeTemplate;
  /** Anchor position on the grid. */
  anchor: PadCoord;
  /** Resolved absolute pad coordinates. */
  pads: PadCoord[];
}

// ============================================================================
// Shape Catalog
// ============================================================================

// --- Size 2 ---
const SHAPES_2: ShapeTemplate[] = [
  {
    name: 'H2', size: 2,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }],
    hints: ['row', 'any'], ergonomicRank: 1,
  },
  {
    name: 'V2', size: 2,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }],
    hints: ['column', 'any'], ergonomicRank: 2,
  },
  {
    name: 'D2-up', size: 2,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 1 }],
    hints: ['any'], ergonomicRank: 3,
  },
  {
    name: 'D2-down', size: 2,
    offsets: [{ dr: 0, dc: 0 }, { dr: -1, dc: 1 }],
    hints: ['any'], ergonomicRank: 3,
  },
];

// --- Size 3 ---
const SHAPES_3: ShapeTemplate[] = [
  // Straight pieces
  {
    name: 'I3-h', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }],
    hints: ['row', 'any'], ergonomicRank: 1,
  },
  {
    name: 'I3-v', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 2, dc: 0 }],
    hints: ['column', 'any'], ergonomicRank: 3,
  },
  // L-shapes
  {
    name: 'L3-br', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'L3-bl', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'L3-tr', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'L3-tl', size: 3,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 1, dc: -1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
];

// --- Size 4 (classic Tetris pieces) ---
const SHAPES_4: ShapeTemplate[] = [
  // I-piece
  {
    name: 'I4-h', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 }],
    hints: ['row', 'any'], ergonomicRank: 1,
  },
  {
    name: 'I4-v', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 2, dc: 0 }, { dr: 3, dc: 0 }],
    hints: ['column'], ergonomicRank: 4,
  },
  // O-piece (square)
  {
    name: 'O4', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 1,
  },
  // T-piece
  {
    name: 'T4-up', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'T4-down', size: 4,
    offsets: [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'T4-left', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 2, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  {
    name: 'T4-right', size: 4,
    offsets: [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  // L-piece
  {
    name: 'L4-1', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 2, dc: 0 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  {
    name: 'L4-2', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 1, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'L4-3', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 1 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  {
    name: 'L4-4', size: 4,
    offsets: [{ dr: 0, dc: 2 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  // J-piece (mirror of L)
  {
    name: 'J4-1', size: 4,
    offsets: [{ dr: 0, dc: 1 }, { dr: 1, dc: 1 }, { dr: 2, dc: 0 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  {
    name: 'J4-2', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'J4-3', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 2, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  {
    name: 'J4-4', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  // S-piece
  {
    name: 'S4-h', size: 4,
    offsets: [{ dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'S4-v', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
  // Z-piece
  {
    name: 'Z4-h', size: 4,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  {
    name: 'Z4-v', size: 4,
    offsets: [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 2, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 3,
  },
];

// --- Size 5 (pentominoes — selected ergonomic subset) ---
const SHAPES_5: ShapeTemplate[] = [
  // Straight
  {
    name: 'I5-h', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 }, { dr: 0, dc: 4 }],
    hints: ['row'], ergonomicRank: 2,
  },
  // Plus
  {
    name: 'Plus5', size: 5,
    offsets: [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }, { dr: 2, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  // P-piece (2x3 minus corner)
  {
    name: 'P5-1', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 2, dc: 0 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  // U-piece
  {
    name: 'U5', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 2 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
  // L5 (long L)
  {
    name: 'L5-h', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 }, { dr: 1, dc: 0 }],
    hints: ['row', 'any'], ergonomicRank: 2,
  },
  // T5
  {
    name: 'T5', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 }, { dr: 1, dc: 1 }],
    hints: ['row', 'any'], ergonomicRank: 2,
  },
  // 2x3 block minus one
  {
    name: 'Block5', size: 5,
    offsets: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }],
    hints: ['block', 'any'], ergonomicRank: 1,
  },
];

// --- Size 6-8 (compact blocks, ergonomic only) ---
const SHAPES_6: ShapeTemplate[] = [
  // 2x3 block
  {
    name: 'Block2x3', size: 6,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 },
    ],
    hints: ['block', 'row', 'any'], ergonomicRank: 1,
  },
  // 3x2 block
  {
    name: 'Block3x2', size: 6,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
      { dr: 2, dc: 0 }, { dr: 2, dc: 1 },
    ],
    hints: ['block', 'column', 'any'], ergonomicRank: 2,
  },
  // 1x6 row
  {
    name: 'I6-h', size: 6,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 },
      { dr: 0, dc: 3 }, { dr: 0, dc: 4 }, { dr: 0, dc: 5 },
    ],
    hints: ['row'], ergonomicRank: 3,
  },
  // L-shape 6
  {
    name: 'L6', size: 6,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
    ],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
];

const SHAPES_7: ShapeTemplate[] = [
  // 2x4 minus one
  {
    name: 'Block7a', size: 7,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 },
    ],
    hints: ['block', 'any'], ergonomicRank: 1,
  },
  // 3x3 minus 2
  {
    name: 'Block7b', size: 7,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 },
      { dr: 2, dc: 0 },
    ],
    hints: ['block', 'any'], ergonomicRank: 2,
  },
];

const SHAPES_8: ShapeTemplate[] = [
  // 2x4 block
  {
    name: 'Block2x4', size: 8,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: 2 }, { dr: 1, dc: 3 },
    ],
    hints: ['block', 'row', 'any'], ergonomicRank: 1,
  },
  // 4x2 block
  {
    name: 'Block4x2', size: 8,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 },
      { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
      { dr: 2, dc: 0 }, { dr: 2, dc: 1 },
      { dr: 3, dc: 0 }, { dr: 3, dc: 1 },
    ],
    hints: ['block', 'column', 'any'], ergonomicRank: 2,
  },
  // 1x8 row
  {
    name: 'I8-h', size: 8,
    offsets: [
      { dr: 0, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 },
      { dr: 0, dc: 4 }, { dr: 0, dc: 5 }, { dr: 0, dc: 6 }, { dr: 0, dc: 7 },
    ],
    hints: ['row'], ergonomicRank: 3,
  },
];

/** Complete shape catalog indexed by size. */
export const SHAPE_CATALOG: ReadonlyMap<number, readonly ShapeTemplate[]> = new Map([
  [2, SHAPES_2],
  [3, SHAPES_3],
  [4, SHAPES_4],
  [5, SHAPES_5],
  [6, SHAPES_6],
  [7, SHAPES_7],
  [8, SHAPES_8],
]);

// ============================================================================
// Shape fitting
// ============================================================================

/**
 * Get all shapes that match a given cluster size and hint.
 * Returns shapes sorted by ergonomic rank (best first).
 */
export function getMatchingShapes(
  size: number,
  hint: 'row' | 'column' | 'block' | 'any',
): ShapeTemplate[] {
  const sizeShapes = SHAPE_CATALOG.get(size);
  if (!sizeShapes) return [];

  const matching = sizeShapes.filter(s =>
    hint === 'any' || s.hints.includes(hint) || s.hints.includes('any')
  );

  // Sort by ergonomic rank, with hint-matching shapes first
  return [...matching].sort((a, b) => {
    const aHintMatch = a.hints.includes(hint) ? 0 : 1;
    const bHintMatch = b.hints.includes(hint) ? 0 : 1;
    if (aHintMatch !== bHintMatch) return aHintMatch - bHintMatch;
    return a.ergonomicRank - b.ergonomicRank;
  });
}

/**
 * Find all valid placements of a shape on the grid that don't overlap
 * with already-occupied pads.
 *
 * @param template Shape to place
 * @param occupiedPads Set of "row,col" strings for occupied pads
 * @returns All valid placements, sorted by ergonomic preference (center of grid)
 */
export function findValidPlacements(
  template: ShapeTemplate,
  occupiedPads: Set<string>,
): ShapePlacement[] {
  const placements: ShapePlacement[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const anchor: PadCoord = { row, col };
      const pads: PadCoord[] = [];
      let valid = true;

      for (const offset of template.offsets) {
        const pad: PadCoord = { row: row + offset.dr, col: col + offset.dc };
        if (!isValidPad(pad)) { valid = false; break; }
        const key = `${pad.row},${pad.col}`;
        if (occupiedPads.has(key)) { valid = false; break; }
        pads.push(pad);
      }

      if (valid) {
        placements.push({ template, anchor, pads });
      }
    }
  }

  // Sort by distance from ergonomic center (row 3, col 3.5)
  const CENTER_ROW = 3;
  const CENTER_COL = 3.5;

  placements.sort((a, b) => {
    const aCenterRow = a.pads.reduce((s, p) => s + p.row, 0) / a.pads.length;
    const aCenterCol = a.pads.reduce((s, p) => s + p.col, 0) / a.pads.length;
    const bCenterRow = b.pads.reduce((s, p) => s + p.row, 0) / b.pads.length;
    const bCenterCol = b.pads.reduce((s, p) => s + p.col, 0) / b.pads.length;

    const aDist = Math.abs(aCenterRow - CENTER_ROW) + Math.abs(aCenterCol - CENTER_COL);
    const bDist = Math.abs(bCenterRow - CENTER_ROW) + Math.abs(bCenterCol - CENTER_COL);
    return aDist - bDist;
  });

  return placements;
}

/**
 * Select the best shape and placement for a cluster.
 *
 * Tries shapes in order of ergonomic preference, returns the first one
 * that has at least one valid placement on the grid.
 *
 * @param size Cluster size
 * @param hint Shape preference from temporal analysis
 * @param occupiedPads Currently occupied pads
 * @param rng Optional RNG for adding variety among top placements
 * @returns Best placement, or null if no shape fits
 */
export function selectBestPlacement(
  size: number,
  hint: 'row' | 'column' | 'block' | 'any',
  occupiedPads: Set<string>,
  rng?: () => number,
): ShapePlacement | null {
  const shapes = getMatchingShapes(size, hint);

  for (const shape of shapes) {
    const placements = findValidPlacements(shape, occupiedPads);
    if (placements.length === 0) continue;

    // Pick from top 3 placements for variety (if RNG provided)
    if (rng && placements.length > 1) {
      const topK = Math.min(3, placements.length);
      const idx = Math.floor(rng() * topK);
      return placements[idx];
    }

    return placements[0];
  }

  return null;
}
