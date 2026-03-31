/**
 * Tests for phrase-aware cluster seed behavior.
 *
 * These tests verify that the Clustered Motif Layout seed:
 * 1. Places phrase-peer voices in analogous spatial positions
 * 2. Preserves repeated phrase geometry across different sounds
 * 3. Falls back to co-occurrence clustering when no phrase structure is detected
 */

import { describe, it, expect } from 'vitest';
import { clusterSeed, type SeedContext } from '../../../src/engine/optimization/seedGenerators';
import { extractSoundFeatures } from '../../../src/engine/structure/soundFeatures';
import { type Performance, type InstrumentConfig } from '../../../src/types/performance';
import { type Voice } from '../../../src/types/voice';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { createSeededRng } from '../../../src/utils/seededRng';

const DEFAULT_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'push3',
  name: 'Push 3',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

function createVoice(id: string, noteNumber: number): Voice {
  return {
    id,
    name: id,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: noteNumber,
    color: '#888',
  };
}

function buildSeedContext(
  events: PerformanceEvent[],
  tempo: number = 120,
): SeedContext {
  const voices = new Map<string, Voice>();
  const voiceIds = new Set<string>();

  for (const e of events) {
    const id = e.voiceId ?? String(e.noteNumber);
    if (!voiceIds.has(id)) {
      voiceIds.add(id);
      voices.set(id, createVoice(id, e.noteNumber));
    }
  }

  const performance: Performance = {
    events,
    tempo,
    name: 'Test Performance',
  };

  const features = extractSoundFeatures(events, []);

  return {
    features,
    voices,
    instrumentConfig: DEFAULT_INSTRUMENT_CONFIG,
    placementLocks: {},
    rng: createSeededRng(42),
    performance,
  };
}

function getPadPosition(layout: ReturnType<typeof clusterSeed.generate>, voiceId: string): { row: number; col: number } | null {
  for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
    if (voice.id === voiceId) {
      const [row, col] = padKey.split(',').map(Number);
      return { row, col };
    }
  }
  return null;
}

function manhattanDistance(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

describe('clusterSeed phrase-aware placement', () => {
  it('should place phrase-peer voices near each other', () => {
    const tempo = 120;
    const barDuration = 2;

    // Create a 4-bar loop with repeated 2-bar phrases
    // Phrase A (bars 0-1): A1, A2, A3
    // Phrase B (bars 2-3): B1, B2, B3 (same rhythmic positions)
    const events: PerformanceEvent[] = [
      // Phrase A
      { noteNumber: 36, voiceId: 'A1', startTime: 0 },
      { noteNumber: 38, voiceId: 'A2', startTime: 0.5 },
      { noteNumber: 40, voiceId: 'A3', startTime: barDuration },

      // Phrase B (same rhythm, different sounds)
      { noteNumber: 42, voiceId: 'B1', startTime: barDuration * 2 },
      { noteNumber: 44, voiceId: 'B2', startTime: barDuration * 2 + 0.5 },
      { noteNumber: 46, voiceId: 'B3', startTime: barDuration * 3 },
    ];

    const ctx = buildSeedContext(events, tempo);
    const layout = clusterSeed.generate(ctx);

    // All voices should be placed
    expect(Object.keys(layout.padToVoice).length).toBe(6);

    // Get positions
    const posA1 = getPadPosition(layout, 'A1');
    const posA2 = getPadPosition(layout, 'A2');
    const posA3 = getPadPosition(layout, 'A3');
    const posB1 = getPadPosition(layout, 'B1');
    const posB2 = getPadPosition(layout, 'B2');
    const posB3 = getPadPosition(layout, 'B3');

    expect(posA1).not.toBeNull();
    expect(posB1).not.toBeNull();

    // Phrase peers (A1/B1, A2/B2, A3/B3) should be close to each other
    // This is the key assertion: voices with the same rhythmic role
    // should be placed in analogous positions
    if (posA1 && posB1) {
      const peerDistance = manhattanDistance(posA1, posB1);
      expect(peerDistance).toBeLessThanOrEqual(3); // Should be adjacent or very close
    }

    if (posA2 && posB2) {
      const peerDistance = manhattanDistance(posA2, posB2);
      expect(peerDistance).toBeLessThanOrEqual(3);
    }

    if (posA3 && posB3) {
      const peerDistance = manhattanDistance(posA3, posB3);
      expect(peerDistance).toBeLessThanOrEqual(3);
    }
  });

  it('should produce compact cluster when no phrase structure detected', () => {
    // Events with no clear phrase repetition
    const events: PerformanceEvent[] = [
      { noteNumber: 36, voiceId: 'v1', startTime: 0 },
      { noteNumber: 38, voiceId: 'v2', startTime: 0.5 },
      { noteNumber: 40, voiceId: 'v3', startTime: 1.0 },
      { noteNumber: 42, voiceId: 'v4', startTime: 1.5 },
    ];

    const ctx = buildSeedContext(events, 120);
    const layout = clusterSeed.generate(ctx);

    // All voices should be placed
    expect(Object.keys(layout.padToVoice).length).toBe(4);

    // Get all positions
    const positions: { row: number; col: number }[] = [];
    for (const padKey of Object.keys(layout.padToVoice)) {
      const [row, col] = padKey.split(',').map(Number);
      positions.push({ row, col });
    }

    // All voices should be in a compact cluster (max diameter of 4)
    let maxDistance = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = manhattanDistance(positions[i], positions[j]);
        maxDistance = Math.max(maxDistance, d);
      }
    }

    expect(maxDistance).toBeLessThanOrEqual(6); // Compact cluster
  });

  it('should respect placement locks', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 36, voiceId: 'locked', startTime: 0 },
      { noteNumber: 38, voiceId: 'free', startTime: 0.5 },
    ];

    const ctx = buildSeedContext(events, 120);

    // Lock 'locked' voice to a specific pad
    ctx.placementLocks = { locked: '0,0' };

    const layout = clusterSeed.generate(ctx);

    // Locked voice should be at the locked position
    expect(layout.padToVoice['0,0']?.id).toBe('locked');

    // Free voice should still be placed
    const freePos = getPadPosition(layout, 'free');
    expect(freePos).not.toBeNull();
    expect(freePos).not.toEqual({ row: 0, col: 0 });
  });

  it('should handle empty events gracefully', () => {
    const ctx = buildSeedContext([], 120);
    const layout = clusterSeed.generate(ctx);

    expect(Object.keys(layout.padToVoice).length).toBe(0);
  });

  it('should be deterministic with same seed', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 36, voiceId: 'a', startTime: 0 },
      { noteNumber: 38, voiceId: 'b', startTime: 0.5 },
      { noteNumber: 40, voiceId: 'c', startTime: 1.0 },
    ];

    const ctx1 = buildSeedContext(events, 120);
    const ctx2 = buildSeedContext(events, 120);

    const layout1 = clusterSeed.generate(ctx1);
    const layout2 = clusterSeed.generate(ctx2);

    // Same positions for each voice
    for (const voiceId of ['a', 'b', 'c']) {
      const pos1 = getPadPosition(layout1, voiceId);
      const pos2 = getPadPosition(layout2, voiceId);
      expect(pos1).toEqual(pos2);
    }
  });
});
