/**
 * Transform Isolation Tests.
 *
 * Verifies each transform:
 * - Preserves valid slot/sub_offset ranges
 * - Only subdivisionInsertion creates sub_offset=1
 * - Transform history tracking
 */

import { describe, it, expect } from 'vitest';
import {
  mirror,
  rotate,
  accentShift,
  subdivisionInsertion,
  densityLift,
  sparseReduction,
  callResponseSwap,
  applyTransform,
} from '../../../src/engine/rudiment/transforms';
import { type PatternEvent } from '../../../src/types/patternCandidate';
import { createSeededRng } from '../../../src/utils/seededRng';

/** Create a simple test event. */
function makeTestEvent(slot: number, accent: boolean = false): PatternEvent {
  return {
    bar: 0,
    slot,
    sub_offset: 0,
    sound_class: 'snare',
    role: accent ? 'accent' : 'backbone',
    accent,
    duration_class: 'normal',
    motif_id: 'test',
    transform_history: [],
  };
}

/** Create a basic test pattern: events on slots 0, 2, 4, 6. */
function makeTestPattern(): PatternEvent[] {
  return [
    makeTestEvent(0, true),
    makeTestEvent(2),
    makeTestEvent(4, true),
    makeTestEvent(6),
  ];
}

/** Assert all events have valid slot range. */
function assertValidSlots(events: PatternEvent[]) {
  for (const e of events) {
    expect(e.slot).toBeGreaterThanOrEqual(0);
    expect(e.slot).toBeLessThanOrEqual(7);
  }
}

/** Assert all events have valid sub_offset. */
function assertValidSubOffset(events: PatternEvent[]) {
  for (const e of events) {
    expect([0, 1]).toContain(e.sub_offset);
  }
}

describe('Transforms', () => {
  describe('mirror', () => {
    it('should reverse slot positions', () => {
      const input = makeTestPattern();
      const result = mirror(input);
      expect(result.map((e) => e.slot)).toEqual([7, 5, 3, 1]);
    });

    it('should preserve valid slot range', () => {
      assertValidSlots(mirror(makeTestPattern()));
    });

    it('should not create sub_offset=1', () => {
      const result = mirror(makeTestPattern());
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });

    it('should append transform name to history', () => {
      const result = mirror(makeTestPattern());
      for (const e of result) {
        expect(e.transform_history).toContain('mirror');
      }
    });
  });

  describe('rotate', () => {
    it('should shift slots forward by 1', () => {
      const input = [makeTestEvent(0), makeTestEvent(7)];
      const result = rotate(input, 1);
      expect(result[0].slot).toBe(1);
      expect(result[1].slot).toBe(0); // 7+1 = 8 % 8 = 0
    });

    it('should preserve valid slot range', () => {
      assertValidSlots(rotate(makeTestPattern(), 3));
    });

    it('should not create sub_offset=1', () => {
      const result = rotate(makeTestPattern());
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });

    it('should append transform name to history', () => {
      const result = rotate(makeTestPattern());
      for (const e of result) {
        expect(e.transform_history).toContain('rotate');
      }
    });
  });

  describe('accentShift', () => {
    it('should move accents to different events', () => {
      const input = makeTestPattern(); // accents on indices 0, 2
      const result = accentShift(input, 1);
      // Accents should have shifted
      expect(result[0].accent).toBe(false); // was accented
      expect(result[1].accent).toBe(true); // now accented
    });

    it('should preserve valid slot range', () => {
      assertValidSlots(accentShift(makeTestPattern()));
    });

    it('should not create sub_offset=1', () => {
      const result = accentShift(makeTestPattern());
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });
  });

  describe('subdivisionInsertion', () => {
    it('should be the only transform that creates sub_offset=1', () => {
      const rng = createSeededRng(42);
      const result = subdivisionInsertion(makeTestPattern(), rng, 1.0); // 100% probability
      const subOffsetOnes = result.filter((e) => e.sub_offset === 1);
      expect(subOffsetOnes.length).toBeGreaterThan(0);
    });

    it('should create ghost notes for insertions', () => {
      const rng = createSeededRng(42);
      const result = subdivisionInsertion(makeTestPattern(), rng, 1.0);
      const insertions = result.filter((e) => e.sub_offset === 1);
      for (const e of insertions) {
        expect(e.role).toBe('ghost');
        expect(e.accent).toBe(false);
        expect(e.duration_class).toBe('short');
      }
    });

    it('should preserve valid slot and sub_offset ranges', () => {
      const rng = createSeededRng(42);
      const result = subdivisionInsertion(makeTestPattern(), rng, 0.5);
      assertValidSlots(result);
      assertValidSubOffset(result);
    });

    it('should append transform name to history', () => {
      const rng = createSeededRng(42);
      const result = subdivisionInsertion(makeTestPattern(), rng, 1.0);
      const insertions = result.filter((e) => e.sub_offset === 1);
      for (const e of insertions) {
        expect(e.transform_history).toContain('subdivisionInsertion');
      }
    });
  });

  describe('densityLift', () => {
    it('should add events to empty slots', () => {
      const rng = createSeededRng(42);
      const input = [makeTestEvent(0), makeTestEvent(4)]; // Only 2 events
      const result = densityLift(input, rng);
      expect(result.length).toBeGreaterThanOrEqual(input.length);
    });

    it('should preserve valid slot range', () => {
      const rng = createSeededRng(42);
      assertValidSlots(densityLift(makeTestPattern(), rng));
    });

    it('should not create sub_offset=1', () => {
      const rng = createSeededRng(42);
      const result = densityLift(makeTestPattern(), rng);
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });
  });

  describe('sparseReduction', () => {
    it('should reduce event count', () => {
      const rng = createSeededRng(42);
      // Create a dense pattern
      const dense = Array.from({ length: 8 }, (_, i) => makeTestEvent(i));
      const result = sparseReduction(dense, rng);
      expect(result.length).toBeLessThanOrEqual(dense.length);
    });

    it('should keep accented events', () => {
      const rng = createSeededRng(42);
      const input = makeTestPattern();
      const result = sparseReduction(input, rng);
      const accentedSlots = result.filter((e) => e.accent).map((e) => e.slot);
      // Accented events at slots 0, 4 should be preserved
      expect(accentedSlots).toContain(0);
      expect(accentedSlots).toContain(4);
    });

    it('should preserve valid slot range', () => {
      const rng = createSeededRng(42);
      assertValidSlots(sparseReduction(makeTestPattern(), rng));
    });

    it('should not create sub_offset=1', () => {
      const rng = createSeededRng(42);
      const result = sparseReduction(makeTestPattern(), rng);
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });
  });

  describe('callResponseSwap', () => {
    it('should swap first and second half', () => {
      const input = [makeTestEvent(0), makeTestEvent(1), makeTestEvent(5)];
      const result = callResponseSwap(input);
      expect(result.map((e) => e.slot)).toEqual([4, 5, 1]);
    });

    it('should preserve valid slot range', () => {
      assertValidSlots(callResponseSwap(makeTestPattern()));
    });

    it('should not create sub_offset=1', () => {
      const result = callResponseSwap(makeTestPattern());
      expect(result.every((e) => e.sub_offset === 0)).toBe(true);
    });
  });

  describe('applyTransform', () => {
    it('should dispatch to the correct transform', () => {
      const rng = createSeededRng(42);
      const input = makeTestPattern();
      const mirrored = applyTransform('mirror', input, rng);
      expect(mirrored[0].slot).toBe(7); // First event was at slot 0, now 7
    });
  });

  describe('no other transform creates sub_offset=1', () => {
    const nonSubdivisionTransforms = [
      'mirror',
      'rotate',
      'accentShift',
      'densityLift',
      'sparseReduction',
      'callResponseSwap',
    ] as const;

    for (const name of nonSubdivisionTransforms) {
      it(`${name} should not create sub_offset=1`, () => {
        const rng = createSeededRng(42);
        const result = applyTransform(name, makeTestPattern(), rng);
        expect(result.every((e) => e.sub_offset === 0)).toBe(true);
      });
    }
  });
});
