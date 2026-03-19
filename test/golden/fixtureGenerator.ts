/**
 * Golden Test Fixture Generator.
 *
 * Creates the 10 canonical test scenarios as programmatic Performance objects.
 * Each fixture is deterministic and versionable (no hand-authored MIDI files).
 */

import { type Performance } from '../../src/types/performance';
import { type PerformanceEvent } from '../../src/types/performanceEvent';
import {
  createTestPerformance,
  createAlternatingPerformance,
  createRepeatedNotePerformance,
  createSimultaneousPerformance,
  beatsToSeconds,
} from '../helpers/testHelpers';

// ============================================================================
// Scenario 1: Two-note alternation (medium tempo)
// Pattern: 36,38 alternating at 8th notes (120 BPM = 0.25s per 8th)
// ============================================================================
export function createScenario1(): Performance {
  return createAlternatingPerformance(36, 38, 16, beatsToSeconds(0.5));
}

// ============================================================================
// Scenario 2: Two-note alternation (fast tempo)
// Pattern: 36,38 alternating at 16th/32nd notes
// ============================================================================
export function createScenario2(): Performance {
  return createAlternatingPerformance(36, 38, 16, beatsToSeconds(0.25));
}

// ============================================================================
// Scenario 3: Single repeated note
// Pattern: 36 x16, medium-fast tempo
// ============================================================================
export function createScenario3(): Performance {
  return createRepeatedNotePerformance(36, 16, beatsToSeconds(0.5));
}

// ============================================================================
// Scenario 4: Three-note phrase
// Pattern: 36,38,42 repeated
// ============================================================================
export function createScenario4(): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  const phrase = [36, 38, 42];
  for (let rep = 0; rep < 4; rep++) {
    for (let i = 0; i < phrase.length; i++) {
      notes.push({
        noteNumber: phrase[i],
        startTime: (rep * phrase.length + i) * beatsToSeconds(0.5),
      });
    }
  }
  return createTestPerformance(notes, 'Three-note phrase');
}

// ============================================================================
// Scenario 5: Four-note run
// Pattern: 36,38,40,41 repeated
// ============================================================================
export function createScenario5(): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  const phrase = [36, 38, 40, 41];
  for (let rep = 0; rep < 4; rep++) {
    for (let i = 0; i < phrase.length; i++) {
      notes.push({
        noteNumber: phrase[i],
        startTime: (rep * phrase.length + i) * beatsToSeconds(0.5),
      });
    }
  }
  return createTestPerformance(notes, 'Four-note run');
}

// ============================================================================
// Scenario 6: Hand-split call-and-response
// Beat1: 36,38 (low cluster) Beat2: 45,47 (high cluster)
// ============================================================================
export function createScenario6(): Performance {
  const groups: Array<{ time: number; notes: number[] }> = [];
  for (let bar = 0; bar < 4; bar++) {
    groups.push({
      time: bar * beatsToSeconds(2),
      notes: [36, 38],
    });
    groups.push({
      time: bar * beatsToSeconds(2) + beatsToSeconds(1),
      notes: [45, 47],
    });
  }
  return createSimultaneousPerformance(groups);
}

// ============================================================================
// Scenario 7: Simultaneous hits
// 0.0: 36+42, 0.5: 38, 1.0: 36+38+42
// ============================================================================
export function createScenario7(): Performance {
  return createSimultaneousPerformance([
    { time: 0.0, notes: [36, 42] },
    { time: 0.5, notes: [38] },
    { time: 1.0, notes: [36, 38, 42] },
    { time: 1.5, notes: [36, 42] },
    { time: 2.0, notes: [38] },
    { time: 2.5, notes: [36, 38, 42] },
  ]);
}

// ============================================================================
// Scenario 8: Crossover prevention
// Left-group phrase then right-group phrase
// ============================================================================
export function createScenario8(): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  // Left-group: low notes (36,37,38,39)
  const leftNotes = [36, 37, 38, 39];
  // Right-group: high notes (44,45,46,47)
  const rightNotes = [44, 45, 46, 47];

  let t = 0;
  for (let rep = 0; rep < 2; rep++) {
    for (const n of leftNotes) {
      notes.push({ noteNumber: n, startTime: t });
      t += beatsToSeconds(0.5);
    }
    for (const n of rightNotes) {
      notes.push({ noteNumber: n, startTime: t });
      t += beatsToSeconds(0.5);
    }
  }
  return createTestPerformance(notes, 'Crossover prevention');
}

// ============================================================================
// Scenario 9: Large-jump with return
// Pattern: 36,36,48,36,50,36
// ============================================================================
export function createScenario9(): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  const phrase = [36, 36, 48, 36, 50, 36];
  for (let rep = 0; rep < 3; rep++) {
    for (let i = 0; i < phrase.length; i++) {
      notes.push({
        noteNumber: phrase[i],
        startTime: (rep * phrase.length + i) * beatsToSeconds(0.5),
      });
    }
  }
  return createTestPerformance(notes, 'Large-jump with return');
}

// ============================================================================
// Scenario 10: Simple drum groove
// kick=36, snare=38, hat=42, accent=46
// ============================================================================
export function createScenario10(): Performance {
  const groups: Array<{ time: number; notes: number[] }> = [];
  const bpm = 120;

  for (let bar = 0; bar < 2; bar++) {
    const barOffset = bar * beatsToSeconds(4, bpm);
    // Beat 1: kick + hat
    groups.push({ time: barOffset, notes: [36, 42] });
    // Beat 1.5: hat
    groups.push({ time: barOffset + beatsToSeconds(0.5, bpm), notes: [42] });
    // Beat 2: snare + hat
    groups.push({ time: barOffset + beatsToSeconds(1, bpm), notes: [38, 42] });
    // Beat 2.5: hat
    groups.push({ time: barOffset + beatsToSeconds(1.5, bpm), notes: [42] });
    // Beat 3: kick + hat
    groups.push({ time: barOffset + beatsToSeconds(2, bpm), notes: [36, 42] });
    // Beat 3.5: hat + accent
    groups.push({ time: barOffset + beatsToSeconds(2.5, bpm), notes: [42, 46] });
    // Beat 4: snare + hat
    groups.push({ time: barOffset + beatsToSeconds(3, bpm), notes: [38, 42] });
    // Beat 4.5: hat
    groups.push({ time: barOffset + beatsToSeconds(3.5, bpm), notes: [42] });
  }

  return createSimultaneousPerformance(groups);
}

/** Map of scenario number to generator function. */
export const GOLDEN_SCENARIOS: Record<number, () => Performance> = {
  1: createScenario1,
  2: createScenario2,
  3: createScenario3,
  4: createScenario4,
  5: createScenario5,
  6: createScenario6,
  7: createScenario7,
  8: createScenario8,
  9: createScenario9,
  10: createScenario10,
};
