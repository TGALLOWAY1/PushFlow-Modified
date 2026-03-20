/**
 * Preset Transform Tests.
 *
 * Tests for relative↔absolute conversion, mirror transform,
 * and placement validation.
 */

import { describe, it, expect } from 'vitest';
import {
  toAbsolute,
  allToAbsolute,
  toRelative,
  validatePlacement,
  isPlacementValid,
  getPlacementPadKeys,
  mirrorPads,
  mirrorPreset,
  findValidAnchors,
  snapToNearestValidAnchor,
} from '../../../src/engine/mapping/presetTransform';
import {
  type PresetPad,
  type ComposerPreset,
  computeBoundingBox,
  computeHandedness,
  isMirrorEligible,
} from '../../../src/types/composerPreset';

// ============================================================================
// Helpers
// ============================================================================

function makePad(
  rowOffset: number,
  colOffset: number,
  hand: 'left' | 'right' = 'left',
  finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' = 'index',
  laneId = 'lane-1',
): PresetPad {
  return {
    position: { rowOffset, colOffset },
    laneId,
    finger,
    hand,
  };
}

function makePreset(pads: PresetPad[]): ComposerPreset {
  const handedness = computeHandedness(pads);
  return {
    id: 'test',
    name: 'Test',
    createdAt: 0,
    updatedAt: 0,
    pads,
    config: { barCount: 4, subdivision: '1/8', bpm: 120, beatsPerBar: 4 },
    lanes: [],
    events: [],
    handedness,
    mirrorEligible: isMirrorEligible(handedness),
    boundingBox: computeBoundingBox(pads),
    tags: [],
  };
}

// ============================================================================
// Relative ↔ Absolute Conversion
// ============================================================================

describe('toAbsolute', () => {
  it('converts with zero anchor', () => {
    const pad = makePad(1, 2);
    expect(toAbsolute(pad, 0, 0)).toEqual({ row: 1, col: 2 });
  });

  it('converts with non-zero anchor', () => {
    const pad = makePad(1, 2);
    expect(toAbsolute(pad, 3, 4)).toEqual({ row: 4, col: 6 });
  });

  it('handles zero offset', () => {
    const pad = makePad(0, 0);
    expect(toAbsolute(pad, 5, 5)).toEqual({ row: 5, col: 5 });
  });
});

describe('allToAbsolute', () => {
  it('converts all pads', () => {
    const pads = [makePad(0, 0), makePad(1, 1)];
    const result = allToAbsolute(pads, 2, 3);
    expect(result).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 4 },
    ]);
  });
});

describe('toRelative', () => {
  it('converts back from absolute', () => {
    expect(toRelative({ row: 4, col: 6 }, 3, 4)).toEqual({
      rowOffset: 1,
      colOffset: 2,
    });
  });

  it('round-trips with toAbsolute', () => {
    const pad = makePad(2, 3);
    const abs = toAbsolute(pad, 1, 1);
    const rel = toRelative(abs, 1, 1);
    expect(rel).toEqual({ rowOffset: 2, colOffset: 3 });
  });
});

// ============================================================================
// Placement Validation
// ============================================================================

describe('validatePlacement', () => {
  it('accepts valid placement at origin', () => {
    const pads = [makePad(0, 0, 'left'), makePad(1, 1, 'left')];
    const result = validatePlacement(pads, 0, 0);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects out-of-bounds placement', () => {
    const pads = [makePad(0, 0, 'right'), makePad(0, 1, 'right')];
    const result = validatePlacement(pads, 7, 7); // (7,7) + (0,1) = (7,8) = out of bounds
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes('outside the 8×8 grid'))).toBe(true);
  });

  it('rejects hand zone violations', () => {
    // Left-hand pad placed at column 7 (right-only zone)
    const pads = [makePad(0, 0, 'left')];
    const result = validatePlacement(pads, 0, 7);
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('hand zone');
  });

  it('rejects collisions with occupied pads', () => {
    const pads = [makePad(0, 0, 'left')];
    const occupied = new Set(['2,2']);
    const result = validatePlacement(pads, 2, 2, occupied);
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('collides');
  });

  it('accepts placement near occupied pads without collision', () => {
    const pads = [makePad(0, 0, 'left')];
    const occupied = new Set(['2,3']);
    const result = validatePlacement(pads, 2, 2, occupied);
    expect(result.valid).toBe(true);
  });

  it('validates multi-pad preset with mixed hands', () => {
    const pads = [
      makePad(0, 0, 'left'),   // col 2 → left zone OK
      makePad(0, 4, 'right'),  // col 6 → right zone OK
    ];
    const result = validatePlacement(pads, 2, 2);
    expect(result.valid).toBe(true);
  });
});

describe('isPlacementValid', () => {
  it('returns boolean shorthand', () => {
    expect(isPlacementValid([makePad(0, 0, 'left')], 0, 0)).toBe(true);
    expect(isPlacementValid([makePad(0, 0, 'right')], 7, 7)).toBe(true);
    expect(isPlacementValid([makePad(0, 0, 'left')], 8, 0)).toBe(false);
  });
});

describe('getPlacementPadKeys', () => {
  it('returns pad keys for valid positions', () => {
    const pads = [makePad(0, 0), makePad(1, 2)];
    const keys = getPlacementPadKeys(pads, 1, 1);
    expect(keys).toContain('1,1');
    expect(keys).toContain('2,3');
    expect(keys).toHaveLength(2);
  });

  it('filters out invalid positions', () => {
    const pads = [makePad(0, 0), makePad(0, 1)];
    const keys = getPlacementPadKeys(pads, 7, 7);
    // (7,7) valid, (7,8) invalid
    expect(keys).toContain('7,7');
    expect(keys).toHaveLength(1);
  });
});

// ============================================================================
// Mirror Transform
// ============================================================================

describe('mirrorPads', () => {
  it('flips column offsets horizontally', () => {
    const pads = [makePad(0, 0, 'left'), makePad(0, 2, 'left')];
    const bbox = { rows: 1, cols: 3 };
    const mirrored = mirrorPads(pads, bbox);

    expect(mirrored[0].position.colOffset).toBe(2); // 3-1-0
    expect(mirrored[1].position.colOffset).toBe(0); // 3-1-2
  });

  it('preserves row offsets', () => {
    const pads = [makePad(0, 0, 'left'), makePad(2, 1, 'left')];
    const bbox = { rows: 3, cols: 2 };
    const mirrored = mirrorPads(pads, bbox);

    expect(mirrored[0].position.rowOffset).toBe(0);
    expect(mirrored[1].position.rowOffset).toBe(2);
  });

  it('swaps hand assignment', () => {
    const pads = [makePad(0, 0, 'left'), makePad(0, 1, 'right')];
    const bbox = { rows: 1, cols: 2 };
    const mirrored = mirrorPads(pads, bbox);

    expect(mirrored[0].hand).toBe('right');
    expect(mirrored[1].hand).toBe('left');
  });

  it('preserves finger type', () => {
    const pads = [
      makePad(0, 0, 'left', 'thumb'),
      makePad(0, 1, 'left', 'pinky'),
    ];
    const bbox = { rows: 1, cols: 2 };
    const mirrored = mirrorPads(pads, bbox);

    expect(mirrored[0].finger).toBe('thumb');
    expect(mirrored[1].finger).toBe('pinky');
  });

  it('preserves laneId', () => {
    const pads = [makePad(0, 0, 'left', 'index', 'my-lane')];
    const bbox = { rows: 1, cols: 1 };
    const mirrored = mirrorPads(pads, bbox);
    expect(mirrored[0].laneId).toBe('my-lane');
  });

  it('single pad at origin stays at origin', () => {
    const pads = [makePad(0, 0, 'left')];
    const bbox = { rows: 1, cols: 1 };
    const mirrored = mirrorPads(pads, bbox);
    expect(mirrored[0].position).toEqual({ rowOffset: 0, colOffset: 0 });
  });
});

describe('mirrorPreset', () => {
  it('flips handedness from left to right', () => {
    const preset = makePreset([makePad(0, 0, 'left'), makePad(1, 1, 'left')]);
    const mirrored = mirrorPreset(preset);
    expect(mirrored.handedness).toBe('right');
  });

  it('flips handedness from right to left', () => {
    const preset = makePreset([makePad(0, 0, 'right')]);
    const mirrored = mirrorPreset(preset);
    expect(mirrored.handedness).toBe('left');
  });

  it('keeps both as both', () => {
    const preset = makePreset([makePad(0, 0, 'left'), makePad(0, 1, 'right')]);
    const mirrored = mirrorPreset(preset);
    expect(mirrored.handedness).toBe('both');
  });

  it('does not mutate original preset', () => {
    const preset = makePreset([makePad(0, 0, 'left'), makePad(0, 2, 'left')]);
    const originalPads = JSON.parse(JSON.stringify(preset.pads));
    mirrorPreset(preset);
    expect(preset.pads).toEqual(originalPads);
  });

  it('preserves bounding box dimensions', () => {
    const preset = makePreset([makePad(0, 0, 'left'), makePad(2, 3, 'left')]);
    const mirrored = mirrorPreset(preset);
    expect(mirrored.boundingBox).toEqual(preset.boundingBox);
  });

  it('double mirror returns to original positions', () => {
    const preset = makePreset([
      makePad(0, 0, 'left', 'index'),
      makePad(1, 2, 'left', 'middle'),
      makePad(2, 1, 'left', 'ring'),
    ]);
    const doubleMirrored = mirrorPreset(mirrorPreset(preset));

    for (let i = 0; i < preset.pads.length; i++) {
      expect(doubleMirrored.pads[i].position).toEqual(preset.pads[i].position);
      expect(doubleMirrored.pads[i].hand).toBe(preset.pads[i].hand);
      expect(doubleMirrored.pads[i].finger).toBe(preset.pads[i].finger);
    }
  });
});

// ============================================================================
// Mirror + Placement Combined
// ============================================================================

describe('mirror + placement', () => {
  it('mirrored left-hand preset validates in right zone', () => {
    // Original: left-hand pads in columns 0-2
    const preset = makePreset([
      makePad(0, 0, 'left', 'index'),
      makePad(0, 1, 'left', 'middle'),
      makePad(0, 2, 'left', 'ring'),
    ]);

    const mirrored = mirrorPreset(preset);

    // All pads now right-hand, place at col 5 (right zone)
    const result = validatePlacement(mirrored.pads, 3, 5);
    expect(result.valid).toBe(true);
  });

  it('mirrored preset rejects placement in wrong zone', () => {
    // Original: left-hand pads
    const preset = makePreset([
      makePad(0, 0, 'left'),
      makePad(0, 1, 'left'),
    ]);
    const mirrored = mirrorPreset(preset);

    // Now right-hand, try to place at col 0 (left zone) — should fail
    const result = validatePlacement(mirrored.pads, 0, 0);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Find Valid Anchors
// ============================================================================

describe('findValidAnchors', () => {
  it('finds at least some valid positions for a small left-hand preset', () => {
    const pads = [makePad(0, 0, 'left')];
    const anchors = findValidAnchors(pads);
    expect(anchors.length).toBeGreaterThan(0);
    // Left hand valid in cols 0-4
    for (const anchor of anchors) {
      expect(anchor.col).toBeLessThanOrEqual(4);
    }
  });

  it('respects occupied pads', () => {
    const pads = [makePad(0, 0, 'left')];
    const occupied = new Set(['0,0', '0,1', '0,2', '0,3', '0,4']);
    const anchorsWithOccupied = findValidAnchors(pads, occupied);
    // Row 0 should have no valid left-hand anchors since all cols 0-4 are occupied
    const row0 = anchorsWithOccupied.filter(a => a.row === 0);
    expect(row0).toHaveLength(0);
  });
});

// ============================================================================
// Snap to Nearest Valid Anchor
// ============================================================================

describe('snapToNearestValidAnchor', () => {
  it('returns cursor position when valid', () => {
    const pads = [makePad(0, 0, 'left')];
    const result = snapToNearestValidAnchor(2, 2, pads);
    expect(result).toEqual({ row: 2, col: 2 });
  });

  it('snaps to nearest valid when cursor is invalid', () => {
    // Left-hand pad cannot be at col 7
    const pads = [makePad(0, 0, 'left')];
    const result = snapToNearestValidAnchor(0, 7, pads);
    expect(result).not.toBeNull();
    // Should snap to col 4 or closer valid position
    expect(result!.col).toBeLessThanOrEqual(4);
  });

  it('returns null when no valid position exists', () => {
    // A pad that spans the entire grid width — impossible to place
    const pads: PresetPad[] = [];
    for (let c = 0; c < 9; c++) {
      pads.push(makePad(0, c, 'left'));
    }
    const result = snapToNearestValidAnchor(0, 0, pads);
    expect(result).toBeNull();
  });
});
