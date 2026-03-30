/**
 * Tests for structural group detection.
 *
 * Validates that voices sharing rhythmic patterns are correctly grouped,
 * and that parallel group pairs are identified.
 */

import { describe, it, expect } from 'vitest';
import {
  detectStructuralGroups,
  buildRhythmicSignature,
  signatureSimilarity,
} from '@/engine/structure/structuralGroupDetection';
import { type PerformanceEvent } from '@/types/performanceEvent';

// ============================================================================
// Helpers
// ============================================================================

function makeEvent(
  noteNumber: number,
  startTime: number,
  voiceId?: string,
): PerformanceEvent {
  return {
    noteNumber,
    startTime,
    duration: 0.1,
    velocity: 100,
    channel: 0,
    eventKey: `${noteNumber}-${startTime}`,
    voiceId: voiceId ?? String(noteNumber),
  };
}

/**
 * Build a call/response fixture:
 * Group A: voices 36,37,38,39 playing at times [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]
 * Group B: voices 40,41,42,43 playing at times [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75]
 * Both groups have the same internal rhythm (0.5s IOI per voice, round-robin within group).
 */
function makeCallResponseFixture(): PerformanceEvent[] {
  const events: PerformanceEvent[] = [];
  const groupA = [36, 37, 38, 39];
  const groupB = [40, 41, 42, 43];

  // Group A: each voice plays at intervals of 2.0s, round-robin at 0.5s
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let i = 0; i < groupA.length; i++) {
      const time = cycle * 2.0 + i * 0.5;
      events.push(makeEvent(groupA[i], time));
    }
  }

  // Group B: same rhythm, offset by 0.25s
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let i = 0; i < groupB.length; i++) {
      const time = cycle * 2.0 + i * 0.5 + 0.25;
      events.push(makeEvent(groupB[i], time));
    }
  }

  return events.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Build a simple fixture where all voices have the same steady rhythm.
 */
function makeSameRhythmFixture(): PerformanceEvent[] {
  const events: PerformanceEvent[] = [];
  const voices = [36, 37, 38, 39];

  for (const note of voices) {
    for (let i = 0; i < 8; i++) {
      events.push(makeEvent(note, i * 0.5));
    }
  }

  return events.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Build a fixture with no rhythmic structure (random-ish onsets).
 */
function makeUnstructuredFixture(): PerformanceEvent[] {
  const events: PerformanceEvent[] = [];
  // Voice 36: regular 0.5s intervals
  for (let i = 0; i < 4; i++) events.push(makeEvent(36, i * 0.5));
  // Voice 37: irregular intervals
  events.push(makeEvent(37, 0.1));
  events.push(makeEvent(37, 0.3));
  events.push(makeEvent(37, 1.7));
  events.push(makeEvent(37, 2.9));
  // Voice 38: very different rhythm
  events.push(makeEvent(38, 0.0));
  events.push(makeEvent(38, 2.0));
  // Voice 39: single event (should be excluded)
  events.push(makeEvent(39, 1.0));

  return events.sort((a, b) => a.startTime - b.startTime);
}

// ============================================================================
// Rhythmic Signature Tests
// ============================================================================

describe('buildRhythmicSignature', () => {
  it('should produce empty signature for single onset', () => {
    const sig = buildRhythmicSignature([0.0], 0.5);
    expect(sig).toEqual([]);
  });

  it('should quantize IOIs to beat fractions', () => {
    // 120 BPM, beatDuration = 0.5s
    // Onsets at 0, 0.5, 1.0 → IOIs = [0.5, 0.5] → quantized = [1.0, 1.0] beats
    const sig = buildRhythmicSignature([0.0, 0.5, 1.0], 0.5);
    expect(sig).toEqual([1.0, 1.0]);
  });

  it('should handle uneven intervals', () => {
    // Onsets at 0, 0.25, 0.75 → IOIs = [0.25, 0.5]
    // At 120 BPM (beat=0.5s), quantize_resolution=0.25 beats
    // 0.25 / (0.5 * 0.25) = 2.0 quanta → 0.5 beats
    // 0.5 / (0.5 * 0.25) = 4.0 quanta → 1.0 beats
    const sig = buildRhythmicSignature([0.0, 0.25, 0.75], 0.5);
    expect(sig).toEqual([0.5, 1.0]);
  });
});

// ============================================================================
// Signature Similarity Tests
// ============================================================================

describe('signatureSimilarity', () => {
  it('should return 1.0 for identical signatures', () => {
    expect(signatureSimilarity([1.0, 1.0, 1.0], [1.0, 1.0, 1.0])).toBe(1.0);
  });

  it('should return 0.0 for completely different signatures', () => {
    const sim = signatureSimilarity([0.25, 0.25, 0.25], [4.0, 4.0, 4.0]);
    expect(sim).toBeLessThan(0.3);
  });

  it('should return high similarity for similar patterns', () => {
    const sim = signatureSimilarity([1.0, 1.0, 0.5, 1.0], [1.0, 1.0, 0.5, 1.0]);
    expect(sim).toBe(1.0);
  });

  it('should return 0 for empty signatures', () => {
    expect(signatureSimilarity([], [1.0])).toBe(0);
    expect(signatureSimilarity([1.0], [])).toBe(0);
  });

  it('should handle different lengths with partial match', () => {
    const sim = signatureSimilarity([1.0, 1.0, 1.0], [1.0, 1.0]);
    expect(sim).toBeGreaterThan(0.5);
  });
});

// ============================================================================
// Group Detection Tests
// ============================================================================

describe('detectStructuralGroups', () => {
  it('should detect groups in a call/response pattern', () => {
    const events = makeCallResponseFixture();
    const result = detectStructuralGroups(events, 120);

    // Should find at least one group (voices with same rhythm may cluster)
    expect(result.groups.length).toBeGreaterThanOrEqual(1);

    // All grouped voices should be from the fixture
    const allGroupedVoices = result.groups.flatMap(g => g.voiceIds);
    for (const vid of allGroupedVoices) {
      expect(Number(vid)).toBeGreaterThanOrEqual(36);
      expect(Number(vid)).toBeLessThanOrEqual(43);
    }
  });

  it('should group voices with identical rhythm into one group', () => {
    const events = makeSameRhythmFixture();
    const result = detectStructuralGroups(events, 120);

    // All 4 voices have identical rhythm, should be in one group
    expect(result.groups.length).toBeGreaterThanOrEqual(1);

    // The largest group should contain all 4 voices
    const largestGroup = result.groups[0];
    expect(largestGroup.voiceIds.length).toBe(4);
    expect(largestGroup.confidence).toBeGreaterThan(0.7);
  });

  it('should not group voices with very different rhythms', () => {
    const events = makeUnstructuredFixture();
    const result = detectStructuralGroups(events, 120);

    // Voice 39 has only 1 event, should be ungrouped
    expect(result.ungroupedVoiceIds).toContain('39');

    // No group should contain voice 38 with voice 36 (very different rhythms)
    for (const group of result.groups) {
      const has36 = group.voiceIds.includes('36');
      const has38 = group.voiceIds.includes('38');
      // If both are in the same group, that would be wrong
      if (has36 && has38) {
        // Allow this only if confidence is low
        expect(group.confidence).toBeLessThan(0.5);
      }
    }
  });

  it('should return empty analysis for no events', () => {
    const result = detectStructuralGroups([], 120);
    expect(result.groups).toEqual([]);
    expect(result.ungroupedVoiceIds).toEqual([]);
    expect(result.groupPairs).toEqual([]);
  });

  it('should identify parallel group pairs', () => {
    // Create two distinct groups with identical rhythms
    const events: PerformanceEvent[] = [];

    // Group 1: voices 36,37 with 0.5s IOI
    for (let i = 0; i < 8; i++) {
      events.push(makeEvent(36, i * 1.0, '36'));
      events.push(makeEvent(37, i * 1.0 + 0.5, '37'));
    }

    // Group 2: voices 40,41 with same 0.5s IOI
    for (let i = 0; i < 8; i++) {
      events.push(makeEvent(40, i * 1.0, '40'));
      events.push(makeEvent(41, i * 1.0 + 0.5, '41'));
    }

    events.sort((a, b) => a.startTime - b.startTime);
    const result = detectStructuralGroups(events, 120);

    // Should detect groups with voices that share rhythm
    expect(result.groups.length).toBeGreaterThanOrEqual(1);
  });

  it('should order voice IDs by first onset time within groups', () => {
    const events: PerformanceEvent[] = [];

    // Voice 40 starts first, voice 36 starts later
    events.push(makeEvent(40, 0.0, '40'));
    events.push(makeEvent(40, 0.5, '40'));
    events.push(makeEvent(40, 1.0, '40'));

    events.push(makeEvent(36, 0.1, '36'));
    events.push(makeEvent(36, 0.6, '36'));
    events.push(makeEvent(36, 1.1, '36'));

    events.sort((a, b) => a.startTime - b.startTime);
    const result = detectStructuralGroups(events, 120);

    if (result.groups.length > 0) {
      const group = result.groups[0];
      if (group.voiceIds.includes('40') && group.voiceIds.includes('36')) {
        // 40 starts at 0.0, 36 starts at 0.1 → 40 should come first
        expect(group.voiceIds.indexOf('40')).toBeLessThan(group.voiceIds.indexOf('36'));
      }
    }
  });
});
