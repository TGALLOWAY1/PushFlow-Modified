/**
 * Rhythm Resolvers Tests.
 *
 * Covers Bjorklund's algorithm, all rhythm spec types, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { bjorklund, resolveRhythm } from '../../../src/engine/pattern/rhythmResolvers';

// ============================================================================
// Bjorklund's Algorithm
// ============================================================================

describe('bjorklund', () => {
  it('distributes 3 hits across 8 steps', () => {
    const result = bjorklund(3, 8);
    expect(result).toEqual([true, false, false, true, false, false, true, false]);
  });

  it('distributes 5 hits across 8 steps', () => {
    const result = bjorklund(5, 8);
    expect(result).toEqual([true, false, true, true, false, true, true, false]);
  });

  it('distributes 4 hits across 16 steps (every 4th)', () => {
    const result = bjorklund(4, 16);
    expect(result).toEqual([
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
    ]);
  });

  it('distributes 7 hits across 12 steps', () => {
    const result = bjorklund(7, 12);
    expect(result.filter(Boolean).length).toBe(7);
    expect(result.length).toBe(12);
  });

  it('handles 0 hits → all false', () => {
    expect(bjorklund(0, 8)).toEqual(new Array(8).fill(false));
  });

  it('handles hits >= steps → all true', () => {
    expect(bjorklund(8, 8)).toEqual(new Array(8).fill(true));
    expect(bjorklund(10, 5)).toEqual(new Array(5).fill(true));
  });

  it('handles 0 steps → empty', () => {
    expect(bjorklund(3, 0)).toEqual([]);
  });

  it('handles 1 hit across many steps', () => {
    const result = bjorklund(1, 8);
    expect(result.filter(Boolean).length).toBe(1);
    expect(result[0]).toBe(true);
  });

  it('handles steps-1 hits (almost full)', () => {
    const result = bjorklund(7, 8);
    expect(result.filter(Boolean).length).toBe(7);
    expect(result.filter(v => !v).length).toBe(1);
  });
});

// ============================================================================
// Euclidean Rhythm
// ============================================================================

describe('resolveRhythm - euclidean', () => {
  it('generates E(3,8) pattern tiled to 16 steps', () => {
    const result = resolveRhythm(
      { type: 'euclidean', hits: 3, steps: 8, rotation: 0 },
      16, 16,
    );
    expect(result.length).toBe(16);
    // First 8 should match bjorklund(3,8), second 8 should repeat
    const firstHalf = result.slice(0, 8);
    const secondHalf = result.slice(8, 16);
    expect(firstHalf).toEqual(secondHalf);
    expect(firstHalf.filter(Boolean).length).toBe(3);
  });

  it('applies rotation', () => {
    const noRot = resolveRhythm(
      { type: 'euclidean', hits: 3, steps: 8, rotation: 0 },
      8, 8,
    );
    const rot1 = resolveRhythm(
      { type: 'euclidean', hits: 3, steps: 8, rotation: 1 },
      8, 8,
    );
    // Rotation shifts the pattern
    expect(noRot).not.toEqual(rot1);
    // Same number of hits
    expect(noRot.filter(Boolean).length).toBe(rot1.filter(Boolean).length);
  });

  it('tiles short patterns to fill totalSteps', () => {
    const result = resolveRhythm(
      { type: 'euclidean', hits: 2, steps: 4, rotation: 0 },
      32, 16,
    );
    expect(result.length).toBe(32);
    expect(result.filter(Boolean).length).toBe(16); // 2 hits per 4 steps × 8 tiles
  });
});

// ============================================================================
// Grid Rhythm
// ============================================================================

describe('resolveRhythm - grid', () => {
  it('tiles explicit pattern', () => {
    const result = resolveRhythm(
      { type: 'grid', pattern: [true, false, true] },
      9, 9,
    );
    expect(result).toEqual([true, false, true, true, false, true, true, false, true]);
  });

  it('handles empty pattern → all false', () => {
    const result = resolveRhythm(
      { type: 'grid', pattern: [] },
      8, 8,
    );
    expect(result).toEqual(new Array(8).fill(false));
  });

  it('truncates pattern longer than totalSteps', () => {
    const result = resolveRhythm(
      { type: 'grid', pattern: [true, true, true, true, true] },
      3, 3,
    );
    expect(result).toEqual([true, true, true]);
  });
});

// ============================================================================
// Interval Rhythm
// ============================================================================

describe('resolveRhythm - interval', () => {
  it('places hit every N steps', () => {
    const result = resolveRhythm(
      { type: 'interval', interval: 4, offset: 0 },
      16, 16,
    );
    expect(result.filter(Boolean).length).toBe(4);
    expect(result[0]).toBe(true);
    expect(result[4]).toBe(true);
    expect(result[8]).toBe(true);
    expect(result[12]).toBe(true);
  });

  it('respects offset', () => {
    const result = resolveRhythm(
      { type: 'interval', interval: 4, offset: 1 },
      16, 16,
    );
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(true);
    expect(result[5]).toBe(true);
  });

  it('handles interval <= 0 → all false', () => {
    const result = resolveRhythm(
      { type: 'interval', interval: 0, offset: 0 },
      8, 8,
    );
    expect(result).toEqual(new Array(8).fill(false));
  });

  it('handles interval 1 → every step', () => {
    const result = resolveRhythm(
      { type: 'interval', interval: 1, offset: 0 },
      8, 8,
    );
    expect(result).toEqual(new Array(8).fill(true));
  });
});

// ============================================================================
// Sticking Rhythm
// ============================================================================

describe('resolveRhythm - sticking', () => {
  it('filters R side from R-L pattern', () => {
    const result = resolveRhythm(
      { type: 'sticking', pattern: ['R', 'L'], side: 'R' },
      8, 8,
    );
    // R on even steps, L on odd steps → R side gets evens
    expect(result).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('filters L side from R-L pattern', () => {
    const result = resolveRhythm(
      { type: 'sticking', pattern: ['R', 'L'], side: 'L' },
      8, 8,
    );
    expect(result).toEqual([false, true, false, true, false, true, false, true]);
  });

  it('handles paradiddle sticking', () => {
    const sticking: ('R' | 'L')[] = ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'];
    const rSide = resolveRhythm(
      { type: 'sticking', pattern: sticking, side: 'R' },
      8, 8,
    );
    const lSide = resolveRhythm(
      { type: 'sticking', pattern: sticking, side: 'L' },
      8, 8,
    );
    // R and L should be complementary
    for (let i = 0; i < 8; i++) {
      expect(rSide[i]).not.toBe(lSide[i]);
    }
    // R at indices 0, 2, 3, 5
    expect(rSide).toEqual([true, false, true, true, false, true, false, false]);
  });

  it('tiles sticking pattern beyond its length', () => {
    const result = resolveRhythm(
      { type: 'sticking', pattern: ['R', 'L', 'R', 'R'], side: 'R' },
      16, 16,
    );
    expect(result.length).toBe(16);
    // Pattern repeats: RLRR RLRR RLRR RLRR
    expect(result.slice(0, 4)).toEqual(result.slice(4, 8));
    expect(result.filter(Boolean).length).toBe(12); // 3 R per 4 steps × 4 tiles
  });

  it('handles empty pattern → all false', () => {
    const result = resolveRhythm(
      { type: 'sticking', pattern: [], side: 'R' },
      8, 8,
    );
    expect(result).toEqual(new Array(8).fill(false));
  });
});
