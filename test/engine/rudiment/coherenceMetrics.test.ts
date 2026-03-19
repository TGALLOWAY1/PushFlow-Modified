/**
 * Coherence Metrics Tests.
 *
 * Tests for density, syncopation, independence, repetition,
 * phrase coherence, and collision pressure metrics.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDensity,
  computeSyncopationRatio,
  computeIndependenceScore,
  computeRepetitionScore,
  computePhraseCoherenceScore,
  computeCollisionPressureScore,
  computeAllMetrics,
} from '../../../src/engine/rudiment/coherenceMetrics';
import {
  type PatternCandidate,
  type PatternEvent,
  type HandSequence,
} from '../../../src/types/patternCandidate';

/** Create a simple PatternEvent. */
function evt(
  bar: number,
  slot: number,
  sound_class: string = 'snare',
  sub_offset: 0 | 1 = 0,
): PatternEvent {
  return {
    bar,
    slot,
    sub_offset,
    sound_class,
    role: 'backbone',
    accent: false,
    duration_class: 'normal',
    motif_id: 'test',
    transform_history: [],
  };
}

/** Build a minimal PatternCandidate for testing. */
function makeCandidate(
  leftEvents: PatternEvent[],
  rightEvents: PatternEvent[],
  bars: number = 2,
  phrasePlan: string[] = ['A', 'A_prime'],
): PatternCandidate {
  const left: HandSequence = {
    hand: 'left',
    role_profile: 'test',
    motif_family: 'test',
    events: leftEvents,
  };
  const right: HandSequence = {
    hand: 'right',
    role_profile: 'test',
    motif_family: 'test',
    events: rightEvents,
  };
  return {
    id: 'test-candidate',
    bars,
    grid_type: 'eighth_backbone_with_optional_sixteenth_insertions',
    phrase_plan: phrasePlan,
    left_hand: left,
    right_hand: right,
    metadata: {
      density: 0,
      syncopation_ratio: 0,
      independence_score: 0,
      repetition_score: 0,
      phrase_coherence_score: 0,
      collision_pressure_score: 0,
    },
  };
}

describe('Coherence Metrics', () => {
  describe('computeDensity', () => {
    it('should return 0 for empty candidate', () => {
      const c = makeCandidate([], []);
      expect(computeDensity(c)).toBe(0);
    });

    it('should compute correct density', () => {
      // 2 bars * 8 slots * 2 hands = 32 available slots
      // 4 events = 4/32 = 0.125
      const c = makeCandidate(
        [evt(0, 0), evt(0, 4)],
        [evt(0, 2), evt(0, 6)],
      );
      expect(computeDensity(c)).toBeCloseTo(4 / 32, 4);
    });

    it('should cap at 1.0', () => {
      // Fill every slot
      const left: PatternEvent[] = [];
      const right: PatternEvent[] = [];
      for (let b = 0; b < 2; b++) {
        for (let s = 0; s < 8; s++) {
          left.push(evt(b, s, 'snare'));
          right.push(evt(b, s, 'kick'));
        }
      }
      expect(computeDensity(makeCandidate(left, right))).toBeLessThanOrEqual(1);
    });
  });

  describe('computeSyncopationRatio', () => {
    it('should return 0 for on-beat only events', () => {
      const c = makeCandidate([evt(0, 0), evt(0, 2), evt(0, 4), evt(0, 6)], []);
      expect(computeSyncopationRatio(c)).toBe(0);
    });

    it('should return 1 for all off-beat events', () => {
      const c = makeCandidate([evt(0, 1), evt(0, 3), evt(0, 5), evt(0, 7)], []);
      expect(computeSyncopationRatio(c)).toBe(1);
    });

    it('should count sub_offset=1 as off-beat', () => {
      const c = makeCandidate([evt(0, 0, 'snare', 1)], []);
      expect(computeSyncopationRatio(c)).toBe(1);
    });

    it('should return 0 for empty candidate', () => {
      expect(computeSyncopationRatio(makeCandidate([], []))).toBe(0);
    });
  });

  describe('computeIndependenceScore', () => {
    it('should return 0 for fully mirrored streams', () => {
      const events = [evt(0, 0), evt(0, 2), evt(0, 4)];
      const c = makeCandidate(events, [...events]);
      expect(computeIndependenceScore(c)).toBe(0);
    });

    it('should return 1 for fully independent streams', () => {
      const left = [evt(0, 0), evt(0, 2)];
      const right = [evt(0, 1), evt(0, 3)];
      const c = makeCandidate(left, right);
      expect(computeIndependenceScore(c)).toBe(1);
    });

    it('should return partial score for partially overlapping streams', () => {
      const left = [evt(0, 0), evt(0, 2), evt(0, 4)];
      const right = [evt(0, 0), evt(0, 3), evt(0, 5)]; // 1 shared position
      const c = makeCandidate(left, right);
      const score = computeIndependenceScore(c);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should return 1 when both hands are empty', () => {
      expect(computeIndependenceScore(makeCandidate([], []))).toBe(1);
    });
  });

  describe('computeRepetitionScore', () => {
    it('should return 1 for identical bars', () => {
      const left = [evt(0, 0), evt(0, 4), evt(1, 0), evt(1, 4)];
      const c = makeCandidate(left, []);
      expect(computeRepetitionScore(c)).toBe(1);
    });

    it('should return low score for unrelated bars', () => {
      const left = [
        evt(0, 0, 'snare'),
        evt(0, 2, 'snare'),
        evt(1, 1, 'kick'),
        evt(1, 5, 'tom_1'),
      ];
      const c = makeCandidate(left, []);
      expect(computeRepetitionScore(c)).toBeLessThan(0.5);
    });

    it('should return 1 for single bar', () => {
      const c = makeCandidate([evt(0, 0)], [], 1, ['A']);
      expect(computeRepetitionScore(c)).toBe(1);
    });
  });

  describe('computePhraseCoherenceScore', () => {
    it('should return 1 for single bar', () => {
      const c = makeCandidate([evt(0, 0)], [], 1, ['A']);
      expect(computePhraseCoherenceScore(c)).toBe(1);
    });

    it('should score well when return bars match A bar', () => {
      // Bar 0 = A, bar 1 = A_return (similar events)
      const left = [evt(0, 0), evt(0, 4), evt(1, 0), evt(1, 4)];
      const c = makeCandidate(left, [], 2, ['A', 'A_return']);
      expect(computePhraseCoherenceScore(c)).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('computeCollisionPressureScore', () => {
    it('should return 0 when no collisions', () => {
      const left = [evt(0, 0), evt(0, 2)];
      const right = [evt(0, 1), evt(0, 3)];
      const c = makeCandidate(left, right);
      expect(computeCollisionPressureScore(c)).toBe(0);
    });

    it('should return positive when hands collide', () => {
      const left = [evt(0, 0), evt(0, 2)];
      const right = [evt(0, 0), evt(0, 3)]; // Collision at bar 0, slot 0
      const c = makeCandidate(left, right);
      expect(computeCollisionPressureScore(c)).toBeGreaterThan(0);
    });

    it('should return 0 when one hand is empty', () => {
      expect(computeCollisionPressureScore(makeCandidate([evt(0, 0)], []))).toBe(0);
    });
  });

  describe('computeAllMetrics', () => {
    it('should return all metric fields', () => {
      const c = makeCandidate(
        [evt(0, 0), evt(0, 4)],
        [evt(0, 1), evt(0, 5)],
      );
      const metrics = computeAllMetrics(c);
      expect(metrics).toHaveProperty('density');
      expect(metrics).toHaveProperty('syncopation_ratio');
      expect(metrics).toHaveProperty('independence_score');
      expect(metrics).toHaveProperty('repetition_score');
      expect(metrics).toHaveProperty('phrase_coherence_score');
      expect(metrics).toHaveProperty('collision_pressure_score');
    });
  });
});
