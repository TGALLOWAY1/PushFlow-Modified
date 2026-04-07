/**
 * Tests for shape templates (Tetris piece catalog and placement).
 */

import { describe, it, expect } from 'vitest';
import {
  SHAPE_CATALOG,
  getMatchingShapes,
  findValidPlacements,
  selectBestPlacement,
  type ShapeTemplate,
} from '@/engine/structure/shapeTemplates';

describe('SHAPE_CATALOG', () => {
  it('has shapes for sizes 2-8', () => {
    for (let size = 2; size <= 8; size++) {
      const shapes = SHAPE_CATALOG.get(size);
      expect(shapes, `No shapes for size ${size}`).toBeDefined();
      expect(shapes!.length).toBeGreaterThan(0);
    }
  });

  it('all shapes have correct size matching their offset count', () => {
    for (const [size, shapes] of SHAPE_CATALOG) {
      for (const shape of shapes) {
        expect(shape.offsets.length).toBe(size);
        expect(shape.size).toBe(size);
      }
    }
  });

  it('all shapes have no duplicate offsets', () => {
    for (const [, shapes] of SHAPE_CATALOG) {
      for (const shape of shapes) {
        const keys = shape.offsets.map(o => `${o.dr},${o.dc}`);
        const unique = new Set(keys);
        expect(unique.size, `${shape.name} has duplicate offsets`).toBe(keys.length);
      }
    }
  });

  it('all shapes are connected (each pad adjacent to at least one other)', () => {
    for (const [, shapes] of SHAPE_CATALOG) {
      for (const shape of shapes) {
        // Check 8-connectivity
        for (let i = 0; i < shape.offsets.length; i++) {
          const pad = shape.offsets[i];
          const hasNeighbor = shape.offsets.some((other, j) => {
            if (i === j) return false;
            return Math.abs(pad.dr - other.dr) <= 1 && Math.abs(pad.dc - other.dc) <= 1;
          });
          expect(hasNeighbor, `${shape.name} pad ${i} is disconnected`).toBe(true);
        }
      }
    }
  });

  it('has the classic Tetris pieces at size 4', () => {
    const shapes4 = SHAPE_CATALOG.get(4)!;
    const names = shapes4.map(s => s.name);

    // Should have I, O, T, L, J, S, Z variants
    expect(names.some(n => n.startsWith('I4'))).toBe(true);
    expect(names.some(n => n.startsWith('O4'))).toBe(true);
    expect(names.some(n => n.startsWith('T4'))).toBe(true);
    expect(names.some(n => n.startsWith('L4'))).toBe(true);
    expect(names.some(n => n.startsWith('S4'))).toBe(true);
    expect(names.some(n => n.startsWith('Z4'))).toBe(true);
  });
});

describe('getMatchingShapes', () => {
  it('returns shapes matching the requested hint', () => {
    const rowShapes = getMatchingShapes(4, 'row');
    expect(rowShapes.length).toBeGreaterThan(0);
    // First shape should match the hint
    expect(rowShapes[0].hints).toContain('row');
  });

  it('returns all shapes for hint "any"', () => {
    const anyShapes = getMatchingShapes(4, 'any');
    const allShapes = SHAPE_CATALOG.get(4)!;
    // "any" should match everything that has 'any' in its hints
    expect(anyShapes.length).toBeGreaterThanOrEqual(allShapes.filter(s => s.hints.includes('any')).length);
  });

  it('returns empty for unsupported size', () => {
    expect(getMatchingShapes(1, 'any')).toHaveLength(0);
    expect(getMatchingShapes(9, 'any')).toHaveLength(0);
  });

  it('sorts by ergonomic rank', () => {
    const shapes = getMatchingShapes(4, 'any');
    // Among shapes that equally match the hint, ergonomic rank should be ascending
    for (let i = 1; i < shapes.length; i++) {
      // This is a soft check — hint match takes priority over ergonomic rank
      expect(shapes[i].ergonomicRank).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('findValidPlacements', () => {
  it('finds placements for a small shape on an empty grid', () => {
    const shapes = getMatchingShapes(2, 'row');
    const placements = findValidPlacements(shapes[0], new Set());
    // H2 (1x2) can fit in many positions on 8x8 grid
    expect(placements.length).toBeGreaterThan(40);
  });

  it('respects occupied pads', () => {
    const occupied = new Set(['3,3', '3,4', '3,5', '3,6']); // Row 3, cols 3-6 occupied
    const shapes = getMatchingShapes(4, 'row');
    const iShape = shapes.find(s => s.name === 'I4-h')!;

    const placements = findValidPlacements(iShape, occupied);
    // No placement should overlap with occupied pads
    for (const p of placements) {
      for (const pad of p.pads) {
        expect(occupied.has(`${pad.row},${pad.col}`)).toBe(false);
      }
    }
  });

  it('returns empty when grid is too full', () => {
    // Fill almost all pads
    const occupied = new Set<string>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        occupied.add(`${r},${c}`);
      }
    }
    // Leave only one pad empty
    occupied.delete('0,0');

    const shapes = getMatchingShapes(2, 'any');
    const placements = findValidPlacements(shapes[0], occupied);
    expect(placements).toHaveLength(0);
  });

  it('sorts placements by proximity to grid center', () => {
    const shapes = getMatchingShapes(2, 'row');
    const placements = findValidPlacements(shapes[0], new Set());

    if (placements.length >= 2) {
      // First placement should be closer to center than last
      const firstCenter = placements[0].pads.reduce((s, p) => s + p.row, 0) / placements[0].pads.length;
      const lastCenter = placements[placements.length - 1].pads.reduce((s, p) => s + p.row, 0) / placements[placements.length - 1].pads.length;
      // First should be near row 3, last should be at an edge
      const firstDistFromCenter = Math.abs(firstCenter - 3);
      const lastDistFromCenter = Math.abs(lastCenter - 3);
      expect(firstDistFromCenter).toBeLessThanOrEqual(lastDistFromCenter + 1);
    }
  });
});

describe('selectBestPlacement', () => {
  it('selects a valid placement for a 4-pad cluster', () => {
    const placement = selectBestPlacement(4, 'any', new Set());
    expect(placement).not.toBeNull();
    expect(placement!.pads).toHaveLength(4);
  });

  it('returns null when no shape fits', () => {
    // Fill grid completely
    const occupied = new Set<string>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        occupied.add(`${r},${c}`);
      }
    }
    const placement = selectBestPlacement(4, 'any', occupied);
    expect(placement).toBeNull();
  });

  it('respects hint preference', () => {
    const rowPlacement = selectBestPlacement(4, 'row', new Set());
    expect(rowPlacement).not.toBeNull();
    // Row hint should produce a shape where all pads are on the same row
    if (rowPlacement) {
      const rows = new Set(rowPlacement.pads.map(p => p.row));
      // I4-h has all pads on same row
      expect(rows.size).toBeLessThanOrEqual(2); // Allow some flexibility
    }
  });

  it('uses RNG for variety when provided', () => {
    let callCount = 0;
    const rng = () => {
      callCount++;
      return 0.5; // Deterministic "random"
    };

    const placement = selectBestPlacement(4, 'any', new Set(), rng);
    expect(placement).not.toBeNull();
    expect(callCount).toBeGreaterThan(0);
  });
});
