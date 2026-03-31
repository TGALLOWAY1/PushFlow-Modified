/**
 * Rhythm Peer Optimization Test.
 *
 * Verifies that when two sets of sounds follow the same rhythmic pattern
 * (e.g., 4 notes in bar 1, 4 different notes in bar 2 with the same rhythm),
 * the optimizer places corresponding notes on the same hand with the same
 * fingers, producing a nearly identical layout.
 */

import { describe, it, expect } from 'vitest';
import { getOptimizer } from '../../../src/engine/optimization/optimizerRegistry';
// Import to trigger registration
import '../../../src/engine/optimization/greedyOptimizer';
import { type OptimizerInput } from '../../../src/engine/optimization/optimizerInterface';
import { type Performance } from '../../../src/types/performance';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import {
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_RESTING_POSE,
} from '../../helpers/testHelpers';
import { resolveNeutralPadPositions, computeNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { analyzePhraseStructure } from '../../../src/engine/structure/phraseStructure';
import { parsePadKey } from '../../../src/engine/optimization/greedyEvaluation';

// ============================================================================
// Helpers
// ============================================================================

function makeOptimizerInput(events: PerformanceEvent[], tempo: number): OptimizerInput {
  const performance: Performance = {
    events: [...events].sort((a, b) => a.startTime - b.startTime),
    tempo,
    name: 'Rhythm Peer Test',
  };

  const emptyLayout = {
    id: 'test-rhythm-layout',
    name: 'Rhythm Test Layout',
    padToVoice: {},
    fingerConstraints: {},
    scoreCache: null,
  };

  const neutralPads = resolveNeutralPadPositions(emptyLayout, DEFAULT_TEST_INSTRUMENT_CONFIG);
  const neutralHandCenters = computeNeutralHandCenters(neutralPads);

  return {
    performance,
    layout: emptyLayout,
    costToggles: ALL_COSTS_ENABLED,
    constraints: {},
    config: {
      engineConfig: DEFAULT_ENGINE_CONFIG,
      maxIterations: 100,
      seed: 0,
      restartCount: 0,
    },
    evaluationConfig: {
      restingPose: DEFAULT_RESTING_POSE,
      stiffness: 0.3,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      neutralHandCenters,
    },
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
  };
}

function getVoiceColumn(layout: Record<string, any>, voiceId: string): number {
  for (const [pk, voice] of Object.entries(layout)) {
    const id = (voice as any).id ?? String((voice as any).originalMidiNote);
    if (id === voiceId) {
      return parsePadKey(pk).col;
    }
  }
  return -1;
}

function getHandForCol(col: number): 'left' | 'right' {
  return col <= 3 ? 'left' : 'right';
}

// ============================================================================
// Tests
// ============================================================================

describe('Rhythm peer optimization', () => {
  it('should detect phrase structure for repeated rhythmic patterns', () => {
    // 120 BPM → bar = 2 seconds
    const tempo = 120;
    const barDuration = 2.0;

    // Distinctive rhythm: beat 1, "2-and", beat 3, "4-e"
    const rhythm = [0, 0.75, 1.0, 1.625];

    const events: PerformanceEvent[] = [
      // Bar 1 (A sounds)
      { noteNumber: 36, startTime: rhythm[0], duration: 0.2, velocity: 100, voiceId: 'A1' },
      { noteNumber: 37, startTime: rhythm[1], duration: 0.2, velocity: 100, voiceId: 'A2' },
      { noteNumber: 38, startTime: rhythm[2], duration: 0.2, velocity: 100, voiceId: 'A3' },
      { noteNumber: 39, startTime: rhythm[3], duration: 0.2, velocity: 100, voiceId: 'A4' },
      // Bar 2 (B sounds — same rhythm)
      { noteNumber: 40, startTime: barDuration + rhythm[0], duration: 0.2, velocity: 100, voiceId: 'B1' },
      { noteNumber: 41, startTime: barDuration + rhythm[1], duration: 0.2, velocity: 100, voiceId: 'B2' },
      { noteNumber: 42, startTime: barDuration + rhythm[2], duration: 0.2, velocity: 100, voiceId: 'B3' },
      { noteNumber: 43, startTime: barDuration + rhythm[3], duration: 0.2, velocity: 100, voiceId: 'B4' },
    ];

    const structure = analyzePhraseStructure(events, tempo);
    expect(structure.confidence).toBeGreaterThan(0.5);
    expect(structure.roleGroups.length).toBe(4);

    // Verify peer detection: A1↔B1, A2↔B2, A3↔B3, A4↔B4
    for (let i = 0; i < 4; i++) {
      const aId = `A${i + 1}`;
      const bId = `B${i + 1}`;
      const peers = structure.voicePeers.get(aId) ?? [];
      expect(peers).toContain(bId);
    }
  });

  it('should assign same hand and finger to sounds sharing a rhythmic pattern', async () => {
    const tempo = 120;
    const barDuration = 2.0;

    // Distinctive rhythm pattern: 4 unique positions per bar
    const rhythm = [0, 0.75, 1.0, 1.625];

    const events: PerformanceEvent[] = [
      // Bar 1 (A sounds)
      { noteNumber: 36, startTime: rhythm[0], duration: 0.2, velocity: 100, voiceId: 'A1' },
      { noteNumber: 37, startTime: rhythm[1], duration: 0.2, velocity: 100, voiceId: 'A2' },
      { noteNumber: 38, startTime: rhythm[2], duration: 0.2, velocity: 100, voiceId: 'A3' },
      { noteNumber: 39, startTime: rhythm[3], duration: 0.2, velocity: 100, voiceId: 'A4' },
      // Bar 2 (B sounds — same rhythm)
      { noteNumber: 40, startTime: barDuration + rhythm[0], duration: 0.2, velocity: 100, voiceId: 'B1' },
      { noteNumber: 41, startTime: barDuration + rhythm[1], duration: 0.2, velocity: 100, voiceId: 'B2' },
      { noteNumber: 42, startTime: barDuration + rhythm[2], duration: 0.2, velocity: 100, voiceId: 'B3' },
      { noteNumber: 43, startTime: barDuration + rhythm[3], duration: 0.2, velocity: 100, voiceId: 'B4' },
    ];

    const input = makeOptimizerInput(events, tempo);
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(input);

    // Get column positions for all voices
    const padToVoice = result.layout.padToVoice;

    const peerPairs = [
      ['A1', 'B1'],
      ['A2', 'B2'],
      ['A3', 'B3'],
      ['A4', 'B4'],
    ];

    let sameColumnCount = 0;
    let sameHandCount = 0;

    for (const [peerA, peerB] of peerPairs) {
      const colA = getVoiceColumn(padToVoice, peerA);
      const colB = getVoiceColumn(padToVoice, peerB);

      expect(colA).not.toBe(-1);
      expect(colB).not.toBe(-1);

      if (colA === colB) sameColumnCount++;

      const handA = getHandForCol(colA);
      const handB = getHandForCol(colB);
      if (handA === handB) sameHandCount++;
    }

    // All A sounds on the same hand
    const aCols = ['A1', 'A2', 'A3', 'A4'].map(id => getVoiceColumn(padToVoice, id));
    const bCols = ['B1', 'B2', 'B3', 'B4'].map(id => getVoiceColumn(padToVoice, id));
    const aHands = aCols.map(getHandForCol);
    const bHands = bCols.map(getHandForCol);

    console.log('  Peer columns:', peerPairs.map(([a, b]) =>
      `${a}(col ${getVoiceColumn(padToVoice, a)}) ↔ ${b}(col ${getVoiceColumn(padToVoice, b)})`
    ).join(', '));
    console.log(`  Same column: ${sameColumnCount}/4, Same hand: ${sameHandCount}/4`);
    console.log(`  A hands: [${aHands}], B hands: [${bHands}]`);

    // All peer pairs should be on the same hand
    expect(sameHandCount).toBe(4);

    // At least 3 of 4 peer pairs should share the same column (same finger)
    expect(sameColumnCount).toBeGreaterThanOrEqual(3);

    // All sounds from each group should be on a single hand
    expect(aHands.every(h => h === aHands[0])).toBe(true);
    expect(bHands.every(h => h === bHands[0])).toBe(true);

    // Both groups should use the same hand
    expect(aHands[0]).toBe(bHands[0]);
  });

  it('should work with 3 repetitions of the same rhythm', async () => {
    const tempo = 120;
    const barDuration = 2.0;
    const rhythm = [0, 0.5, 1.0, 1.5]; // Simple quarter note pattern

    const events: PerformanceEvent[] = [];
    const groups = ['A', 'B', 'C'];
    for (let g = 0; g < groups.length; g++) {
      for (let i = 0; i < 4; i++) {
        events.push({
          noteNumber: 36 + g * 4 + i,
          startTime: g * barDuration + rhythm[i],
          duration: 0.2,
          velocity: 100,
          voiceId: `${groups[g]}${i + 1}`,
        });
      }
    }

    const input = makeOptimizerInput(events, tempo);
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(input);

    const padToVoice = result.layout.padToVoice;

    // Check that corresponding sounds across all 3 groups share the same column
    let totalSameCol = 0;
    let totalPairs = 0;

    for (let i = 0; i < 4; i++) {
      const cols = groups.map(g => getVoiceColumn(padToVoice, `${g}${i + 1}`));
      // Check all pairs within this rhythm position
      for (let a = 0; a < cols.length; a++) {
        for (let b = a + 1; b < cols.length; b++) {
          totalPairs++;
          if (cols[a] === cols[b]) totalSameCol++;
        }
      }
    }

    console.log(`  3-group rhythm: ${totalSameCol}/${totalPairs} peer pairs share same column`);

    // At least 75% of peer pairs should share the same column
    expect(totalSameCol / totalPairs).toBeGreaterThanOrEqual(0.75);
  });
});
