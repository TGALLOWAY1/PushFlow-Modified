/**
 * Tests for temporal sound clustering.
 *
 * Verifies that the pre-optimization temporal clustering correctly
 * identifies groups of sounds that play in tight sequence.
 */

import { describe, it, expect } from 'vitest';
import { type PerformanceEvent } from '@/types/performanceEvent';
import {
  detectTemporalClusters,
  computeTemporalAffinities,
} from '@/engine/structure/temporalClustering';

// ============================================================================
// Helpers
// ============================================================================

function makeEvent(
  voiceId: string,
  noteNumber: number,
  startTime: number,
): PerformanceEvent {
  return { voiceId, noteNumber, startTime, velocity: 100 };
}

/**
 * Create a repeating sequence of voices at regular intervals.
 * E.g., repeatingSequence(['a','b','c','d'], [60,61,62,63], 0.1, 4)
 * produces a→b→c→d→a→b→c→d→a→b→c→d→a→b→c→d at 0.1s intervals.
 */
function repeatingSequence(
  voiceIds: string[],
  noteNumbers: number[],
  interval: number,
  repeats: number,
): PerformanceEvent[] {
  const events: PerformanceEvent[] = [];
  for (let r = 0; r < repeats; r++) {
    for (let i = 0; i < voiceIds.length; i++) {
      events.push(makeEvent(
        voiceIds[i],
        noteNumbers[i],
        (r * voiceIds.length + i) * interval,
      ));
    }
  }
  return events;
}

// ============================================================================
// Tests
// ============================================================================

describe('computeTemporalAffinities', () => {
  it('detects high affinity between rapidly alternating sounds', () => {
    // A→B→A→B→A→B pattern (fast alternation)
    const events = repeatingSequence(['a', 'b'], [60, 61], 0.05, 10);
    const affinities = computeTemporalAffinities(events);

    expect(affinities.length).toBeGreaterThanOrEqual(1);
    const pair = affinities.find(
      a => (a.voiceA === 'a' && a.voiceB === 'b') || (a.voiceA === 'b' && a.voiceB === 'a'),
    );
    expect(pair).toBeDefined();
    expect(pair!.directionality).toBe('bidirectional');
    expect(pair!.affinity).toBeGreaterThan(5); // High affinity for tight alternation
  });

  it('detects directional affinity for one-way sequences', () => {
    // A always followed by B with a long gap before next A
    // So A→B is frequent but B→A involves a long gap (another A comes much later)
    // Use only A→B pairs with no B→A transitions by adding a third voice C in between
    const events: PerformanceEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(makeEvent('a', 60, i * 1.0));
      events.push(makeEvent('b', 61, i * 1.0 + 0.1));
      events.push(makeEvent('c', 62, i * 1.0 + 0.5)); // C breaks B→A direct transition
    }
    const affinities = computeTemporalAffinities(events);

    const pair = affinities.find(
      a => (a.voiceA === 'a' && a.voiceB === 'b') || (a.voiceA === 'b' && a.voiceB === 'a'),
    );
    expect(pair).toBeDefined();
    // With C intervening, B→A transitions don't occur, so this should be directional
    expect(pair!.directionality).not.toBe('bidirectional');
  });

  it('returns empty for single-event performance', () => {
    const events = [makeEvent('a', 60, 0)];
    const affinities = computeTemporalAffinities(events);
    expect(affinities).toHaveLength(0);
  });

  it('assigns higher affinity to tighter timing', () => {
    // Pair X with tight timing (0.05s)
    const tightEvents = repeatingSequence(['x1', 'x2'], [60, 61], 0.05, 8);
    // Pair Y with loose timing (0.5s)
    const looseEvents = repeatingSequence(['y1', 'y2'], [62, 63], 0.5, 8);
    // Offset loose events so they don't interleave
    const offset = tightEvents[tightEvents.length - 1].startTime + 2;
    for (const e of looseEvents) e.startTime += offset;

    const events = [...tightEvents, ...looseEvents].sort((a, b) => a.startTime - b.startTime);
    const affinities = computeTemporalAffinities(events);

    const tightPair = affinities.find(
      a => (a.voiceA === 'x1' && a.voiceB === 'x2') || (a.voiceA === 'x2' && a.voiceB === 'x1'),
    );
    const loosePair = affinities.find(
      a => (a.voiceA === 'y1' && a.voiceB === 'y2') || (a.voiceA === 'y2' && a.voiceB === 'y1'),
    );

    expect(tightPair).toBeDefined();
    expect(loosePair).toBeDefined();
    expect(tightPair!.affinity).toBeGreaterThan(loosePair!.affinity);
  });
});

describe('detectTemporalClusters', () => {
  it('clusters a repeating 4-note sequence into one cluster', () => {
    // The vocal chop scenario: A→B→C→D repeated 8 times at 100ms intervals
    const events = repeatingSequence(
      ['chop1', 'chop2', 'chop3', 'chop4'],
      [60, 61, 62, 63],
      0.1,
      8,
    );

    const result = detectTemporalClusters(events);

    // Should find at least one cluster containing all 4 sounds
    expect(result.clusters.length).toBeGreaterThanOrEqual(1);

    const bigCluster = result.clusters.find(c => c.soundIds.length >= 3);
    expect(bigCluster).toBeDefined();

    // All 4 voices should be in the same cluster or in overlapping clusters
    const clusteredVoices = new Set(result.clusters.flatMap(c => c.soundIds));
    expect(clusteredVoices.has('chop1')).toBe(true);
    expect(clusteredVoices.has('chop2')).toBe(true);
    expect(clusteredVoices.has('chop3')).toBe(true);
    expect(clusteredVoices.has('chop4')).toBe(true);
  });

  it('separates unrelated sounds into different clusters', () => {
    // Group A: tight sequence at 50ms intervals
    const groupA = repeatingSequence(['a1', 'a2', 'a3'], [60, 61, 62], 0.05, 10);

    // Group B: tight sequence at 50ms intervals, starting much later
    const groupB = repeatingSequence(['b1', 'b2', 'b3'], [70, 71, 72], 0.05, 10);
    const offset = groupA[groupA.length - 1].startTime + 5; // Big gap
    for (const e of groupB) e.startTime += offset;

    // Isolated sound with no close neighbors
    const isolated = [makeEvent('lonely', 80, offset + 20)];

    const events = [...groupA, ...groupB, ...isolated].sort((a, b) => a.startTime - b.startTime);
    const result = detectTemporalClusters(events);

    // 'lonely' should be unclustered
    expect(result.unclusteredVoiceIds).toContain('lonely');

    // Group A and Group B should be in separate clusters
    const clusterForA1 = result.clusters.find(c => c.soundIds.includes('a1'));
    const clusterForB1 = result.clusters.find(c => c.soundIds.includes('b1'));

    if (clusterForA1 && clusterForB1) {
      expect(clusterForA1.id).not.toBe(clusterForB1.id);
    }
  });

  it('detects alternation pattern as a cluster', () => {
    // Fast A↔B alternation (drum roll / hi-hat pattern)
    const events = repeatingSequence(['hi', 'lo'], [60, 61], 0.04, 20);
    const result = detectTemporalClusters(events);

    const cluster = result.clusters.find(
      c => c.soundIds.includes('hi') && c.soundIds.includes('lo'),
    );
    expect(cluster).toBeDefined();
    expect(cluster!.reason).toBe('alternation');
  });

  it('respects MAX_CLUSTER_SIZE', () => {
    // 10 voices in a rapid sequence — should not all merge into one cluster
    const voices = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const notes = Array.from({ length: 10 }, (_, i) => 60 + i);
    const events = repeatingSequence(voices, notes, 0.05, 6);
    const result = detectTemporalClusters(events);

    for (const cluster of result.clusters) {
      expect(cluster.soundIds.length).toBeLessThanOrEqual(8);
    }
  });

  it('assigns shape hints based on cluster properties', () => {
    const events = repeatingSequence(
      ['a', 'b', 'c', 'd'],
      [60, 61, 62, 63],
      0.08,
      10,
    );
    const result = detectTemporalClusters(events);

    for (const cluster of result.clusters) {
      expect(['row', 'column', 'block', 'any']).toContain(cluster.shapeHint);
    }
  });

  it('orders cluster members by temporal flow', () => {
    // A starts first, then B, then C, then D
    const events = repeatingSequence(
      ['first', 'second', 'third', 'fourth'],
      [60, 61, 62, 63],
      0.08,
      10,
    );
    const result = detectTemporalClusters(events);

    const cluster = result.clusters.find(c => c.soundIds.length >= 3);
    if (cluster) {
      // First onset of first member should be before first onset of last member
      const firstIdx = cluster.soundIds.indexOf('first');
      const lastIdx = cluster.soundIds.indexOf('fourth');
      if (firstIdx >= 0 && lastIdx >= 0) {
        expect(firstIdx).toBeLessThan(lastIdx);
      }
    }
  });

  it('provides confidence scores between 0 and 1', () => {
    const events = repeatingSequence(['a', 'b', 'c'], [60, 61, 62], 0.05, 10);
    const result = detectTemporalClusters(events);

    for (const cluster of result.clusters) {
      expect(cluster.confidence).toBeGreaterThanOrEqual(0);
      expect(cluster.confidence).toBeLessThanOrEqual(1);
    }
  });
});
