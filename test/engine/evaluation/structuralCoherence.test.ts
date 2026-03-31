/**
 * Tests for structural coherence scoring.
 *
 * Validates that layouts with coherent group placement score higher
 * than scattered layouts, and that impossible layouts are not rewarded.
 */

import { describe, it, expect } from 'vitest';
import { scoreStructuralCoherence } from '@/engine/evaluation/structuralCoherence';
import { type Layout } from '@/types/layout';
import { type Voice } from '@/types/voice';
import {
  type StructuralGroupAnalysis,
  type StructuralGroup,
} from '@/engine/structure/structuralGroupDetection';

// ============================================================================
// Helpers
// ============================================================================

function makeVoice(id: string, noteNumber: number): Voice {
  return {
    id,
    name: `Sound ${noteNumber}`,
    sourceType: 'midi_track',
    sourceFile: '',
    originalMidiNote: noteNumber,
    color: '#888888',
  };
}

function makeLayout(placements: Array<[string, number, number, number]>): Layout {
  const padToVoice: Record<string, Voice> = {};
  for (const [voiceId, noteNumber, row, col] of placements) {
    padToVoice[`${row},${col}`] = makeVoice(voiceId, noteNumber);
  }
  return {
    id: 'test-layout',
    name: 'Test',
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'optimized' as const,
    role: 'working' as const,
  };
}

function makeGroupAnalysis(
  groups: StructuralGroup[],
  ungrouped: string[] = [],
): StructuralGroupAnalysis {
  // Auto-detect parallel group pairs (groups with same cardinality)
  const groupPairs = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (groups[i].voiceIds.length === groups[j].voiceIds.length) {
        groupPairs.push({
          groupA: groups[i].id,
          groupB: groups[j].id,
          parallelism: 0.8,
        });
      }
    }
  }
  return { groups, ungroupedVoiceIds: ungrouped, groupPairs };
}

// ============================================================================
// Tests
// ============================================================================

describe('scoreStructuralCoherence', () => {
  describe('perfect coherence', () => {
    it('should score high when parallel groups are in adjacent rows with same column order', () => {
      // Group A: voices 1A,2A,3A,4A in row 3
      // Group B: voices 1B,2B,3B,4B in row 4
      const layout = makeLayout([
        ['1A', 36, 3, 0],
        ['2A', 37, 3, 1],
        ['3A', 38, 3, 2],
        ['4A', 39, 3, 3],
        ['1B', 40, 4, 0],
        ['2B', 41, 4, 1],
        ['3B', 42, 4, 2],
        ['4B', 43, 4, 3],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['1A', '2A', '3A', '4A'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
        {
          id: 'sg-1',
          voiceIds: ['1B', '2B', '3B', '4B'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
      ];

      const analysis = makeGroupAnalysis(groups);
      const score = scoreStructuralCoherence(layout, analysis);

      expect(score.overall).toBeGreaterThan(0.7);
      expect(score.withinGroupCompactness).toBeGreaterThan(0.7);
      expect(score.withinGroupOrder).toBeGreaterThan(0.7);
      expect(score.betweenGroupParallelism).toBeGreaterThan(0.7);
    });
  });

  describe('scattered layout', () => {
    it('should score low when group members are scattered across the grid', () => {
      // Same groups, but voices scattered randomly
      const layout = makeLayout([
        ['1A', 36, 0, 0],
        ['2A', 37, 7, 7],
        ['3A', 38, 0, 7],
        ['4A', 39, 7, 0],
        ['1B', 40, 1, 3],
        ['2B', 41, 5, 1],
        ['3B', 42, 2, 6],
        ['4B', 43, 6, 4],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['1A', '2A', '3A', '4A'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
        {
          id: 'sg-1',
          voiceIds: ['1B', '2B', '3B', '4B'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
      ];

      const analysis = makeGroupAnalysis(groups);
      const score = scoreStructuralCoherence(layout, analysis);

      expect(score.overall).toBeLessThan(0.5);
      expect(score.withinGroupCompactness).toBeLessThan(0.3);
    });
  });

  describe('partial coherence', () => {
    it('should score moderately when one group is compact but the other is scattered', () => {
      const layout = makeLayout([
        // Group A: compact in row 3
        ['1A', 36, 3, 0],
        ['2A', 37, 3, 1],
        ['3A', 38, 3, 2],
        ['4A', 39, 3, 3],
        // Group B: scattered
        ['1B', 40, 0, 0],
        ['2B', 41, 7, 7],
        ['3B', 42, 0, 7],
        ['4B', 43, 7, 0],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['1A', '2A', '3A', '4A'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
        {
          id: 'sg-1',
          voiceIds: ['1B', '2B', '3B', '4B'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
      ];

      const analysis = makeGroupAnalysis(groups);
      const score = scoreStructuralCoherence(layout, analysis);

      // Should be between scattered and perfect
      expect(score.withinGroupCompactness).toBeGreaterThan(0.3);
      expect(score.withinGroupCompactness).toBeLessThan(0.9);
    });
  });

  describe('no groups', () => {
    it('should return neutral score when no groups are detected', () => {
      const layout = makeLayout([
        ['v1', 36, 3, 3],
        ['v2', 37, 3, 4],
      ]);

      const analysis: StructuralGroupAnalysis = {
        groups: [],
        ungroupedVoiceIds: ['v1', 'v2'],
        groupPairs: [],
      };

      const score = scoreStructuralCoherence(layout, analysis);

      expect(score.overall).toBe(0.5);
      expect(score.perGroupScores).toEqual([]);
    });
  });

  describe('order preservation', () => {
    it('should score higher when spatial order matches temporal order', () => {
      // Perfect order: temporal 1,2,3,4 → spatial left to right
      const orderedLayout = makeLayout([
        ['v1', 36, 3, 0],
        ['v2', 37, 3, 1],
        ['v3', 38, 3, 2],
        ['v4', 39, 3, 3],
      ]);

      // Reversed order: temporal 1,2,3,4 → spatial right to left
      const reversedLayout = makeLayout([
        ['v1', 36, 3, 3],
        ['v2', 37, 3, 2],
        ['v3', 38, 3, 1],
        ['v4', 39, 3, 0],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['v1', 'v2', 'v3', 'v4'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
      ];

      const analysis = makeGroupAnalysis(groups);

      const orderedScore = scoreStructuralCoherence(orderedLayout, analysis);
      const reversedScore = scoreStructuralCoherence(reversedLayout, analysis);

      // Ordered should score higher on order preservation
      expect(orderedScore.withinGroupOrder).toBeGreaterThan(reversedScore.withinGroupOrder);
    });
  });

  describe('per-group breakdowns', () => {
    it('should provide per-group and per-pair detail', () => {
      const layout = makeLayout([
        ['1A', 36, 3, 0],
        ['2A', 37, 3, 1],
        ['1B', 40, 4, 0],
        ['2B', 41, 4, 1],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['1A', '2A'],
          rhythmSignature: [1.0],
          eventCount: 4,
          confidence: 0.9,
        },
        {
          id: 'sg-1',
          voiceIds: ['1B', '2B'],
          rhythmSignature: [1.0],
          eventCount: 4,
          confidence: 0.9,
        },
      ];

      const analysis = makeGroupAnalysis(groups);
      const score = scoreStructuralCoherence(layout, analysis);

      expect(score.perGroupScores.length).toBe(2);
      expect(score.perGroupScores[0].groupId).toBe('sg-0');
      expect(score.perGroupScores[1].groupId).toBe('sg-1');

      expect(score.perPairScores.length).toBe(1);
      expect(score.perPairScores[0].groupAId).toBe('sg-0');
      expect(score.perPairScores[0].groupBId).toBe('sg-1');
    });
  });

  describe('score range', () => {
    it('should always produce scores in [0, 1] range', () => {
      const layout = makeLayout([
        ['v1', 36, 0, 0],
        ['v2', 37, 7, 7],
        ['v3', 38, 0, 7],
        ['v4', 39, 7, 0],
      ]);

      const groups: StructuralGroup[] = [
        {
          id: 'sg-0',
          voiceIds: ['v1', 'v2', 'v3', 'v4'],
          rhythmSignature: [1.0, 1.0, 1.0],
          eventCount: 8,
          confidence: 0.95,
        },
      ];

      const analysis = makeGroupAnalysis(groups);
      const score = scoreStructuralCoherence(layout, analysis);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
      expect(score.withinGroupCompactness).toBeGreaterThanOrEqual(0);
      expect(score.withinGroupCompactness).toBeLessThanOrEqual(1);
      expect(score.withinGroupOrder).toBeGreaterThanOrEqual(0);
      expect(score.withinGroupOrder).toBeLessThanOrEqual(1);
      expect(score.betweenGroupParallelism).toBeGreaterThanOrEqual(0);
      expect(score.betweenGroupParallelism).toBeLessThanOrEqual(1);
    });
  });
});
