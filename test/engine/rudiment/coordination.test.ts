/**
 * Coordination Tests.
 *
 * Tests for two-hand coordination: anchor alignment, interlock,
 * burst protection, and collision pressure handling.
 */

import { describe, it, expect } from 'vitest';
import {
  coordinateHands,
  anchorAlignmentScore,
  interlockScore,
  collisionPressureScore,
  independenceScore,
} from '../../../src/engine/rudiment/coordination';
import {
  type PatternEvent,
  type HandSequence,
  DEFAULT_GENERATOR_CONFIG,
} from '../../../src/types/patternCandidate';
import { type MotifSeed } from '../../../src/engine/rudiment/motifLibrary';
import { createSeededRng } from '../../../src/utils/seededRng';

/** Create a simple PatternEvent. */
function evt(bar: number, slot: number, sound_class: string = 'snare'): PatternEvent {
  return {
    bar,
    slot,
    sub_offset: 0,
    sound_class,
    role: 'backbone',
    accent: slot === 0,
    duration_class: 'normal',
    motif_id: 'test',
    transform_history: [],
  };
}

/** Create a simple MotifSeed for the companion. */
function makeCompanionSeed(): MotifSeed {
  return {
    motif_id: 'companion_test',
    motif_family: 'ostinato',
    role_profile: 'timekeeping',
    density_target: 0.5,
    syncopation_target: 0.0,
    phrase_suitability: 'high',
    anchor_slots: [0, 4],
    events: [
      evt(0, 0, 'closed_hat'),
      evt(0, 2, 'closed_hat'),
      evt(0, 4, 'closed_hat'),
      evt(0, 6, 'closed_hat'),
    ],
  };
}

describe('Coordination', () => {
  describe('anchorAlignmentScore', () => {
    it('should return 1 when all anchors are matched', () => {
      const primary = [evt(0, 0), evt(1, 0)];
      const companion = [evt(0, 0, 'hat'), evt(1, 0, 'hat')];
      expect(anchorAlignmentScore(primary, companion, 2)).toBe(1);
    });

    it('should return 0 when no anchors are matched', () => {
      const primary = [evt(0, 0), evt(1, 0)];
      const companion = [evt(0, 3, 'hat'), evt(1, 5, 'hat')];
      expect(anchorAlignmentScore(primary, companion, 2)).toBe(0);
    });

    it('should return partial score for partial match', () => {
      const primary = [evt(0, 0), evt(1, 0)];
      const companion = [evt(0, 0, 'hat'), evt(1, 3, 'hat')];
      expect(anchorAlignmentScore(primary, companion, 2)).toBe(0.5);
    });
  });

  describe('interlockScore', () => {
    it('should return 1 when no positions overlap', () => {
      const primary = [evt(0, 0), evt(0, 2)];
      const companion = [evt(0, 1), evt(0, 3)];
      expect(interlockScore(primary, companion)).toBe(1);
    });

    it('should return 0 when all positions overlap', () => {
      const events = [evt(0, 0), evt(0, 2)];
      expect(interlockScore(events, [...events])).toBe(0);
    });
  });

  describe('collisionPressureScore', () => {
    it('should return 1 (no collisions) when streams are interleaved', () => {
      const primary = [evt(0, 0), evt(0, 4)];
      const companion = [evt(0, 2), evt(0, 6)];
      expect(collisionPressureScore(primary, companion)).toBe(1);
    });

    it('should return less than 1 when collisions exist', () => {
      const primary = [evt(0, 0), evt(0, 2)];
      const companion = [evt(0, 0), evt(0, 3)]; // Collision at slot 0
      expect(collisionPressureScore(primary, companion)).toBeLessThan(1);
    });
  });

  describe('independenceScore', () => {
    it('should return 1 for fully independent patterns', () => {
      const primary = [evt(0, 0), evt(0, 2)];
      const companion = [evt(0, 1), evt(0, 3)];
      expect(independenceScore(primary, companion)).toBe(1);
    });

    it('should return 0 for mirrored patterns', () => {
      const events = [evt(0, 0), evt(0, 2)];
      expect(independenceScore(events, [...events])).toBe(0);
    });
  });

  describe('coordinateHands', () => {
    it('should produce two hand sequences', () => {
      const primary: HandSequence = {
        hand: 'left',
        role_profile: 'steady_pulse',
        motif_family: 'alternating',
        events: [evt(0, 0), evt(0, 2), evt(0, 4), evt(0, 6)],
      };
      const rng = createSeededRng(42);
      const config = { ...DEFAULT_GENERATOR_CONFIG, bars: 2 as const };

      const result = coordinateHands(primary, makeCompanionSeed(), 2, config, rng);

      expect(result.left.hand).toBe('left');
      expect(result.right.hand).toBe('right');
      expect(result.left.events.length).toBeGreaterThan(0);
      expect(result.right.events.length).toBeGreaterThan(0);
    });

    it('should reduce collision pressure compared to raw overlap', () => {
      // Create a primary with events on every even slot
      const primaryEvents: PatternEvent[] = [];
      for (let b = 0; b < 2; b++) {
        for (let s = 0; s < 8; s += 2) {
          primaryEvents.push(evt(b, s));
        }
      }
      const primary: HandSequence = {
        hand: 'left',
        role_profile: 'steady_pulse',
        motif_family: 'alternating',
        events: primaryEvents,
      };

      const rng = createSeededRng(42);
      const config = { ...DEFAULT_GENERATOR_CONFIG, bars: 2 as const };

      const result = coordinateHands(primary, makeCompanionSeed(), 2, config, rng);

      // After coordination, collision pressure should be low
      expect(result.scores.collisionPressure).toBeLessThanOrEqual(0.5);
    });

    it('should return coordination scores', () => {
      const primary: HandSequence = {
        hand: 'left',
        role_profile: 'test',
        motif_family: 'test',
        events: [evt(0, 0), evt(0, 4)],
      };
      const rng = createSeededRng(42);
      const config = { ...DEFAULT_GENERATOR_CONFIG, bars: 2 as const };

      const result = coordinateHands(primary, makeCompanionSeed(), 2, config, rng);

      expect(result.scores).toHaveProperty('anchorAlignment');
      expect(result.scores).toHaveProperty('interlock');
      expect(result.scores).toHaveProperty('collisionPressure');
      expect(result.scores).toHaveProperty('independence');
      expect(result.scores).toHaveProperty('phraseCoherence');
    });
  });
});
