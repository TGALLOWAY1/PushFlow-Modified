/**
 * Integration test: Pose0-seeded drum layout produces playable solutions.
 *
 * Validates that the natural hand pose layout strategy places drum sounds
 * on adjacent pads within reachable hand zones, and that the solver can
 * find valid finger assignments for typical drum patterns.
 */

import { describe, it, expect } from 'vitest';
import { type Voice } from '../../../src/types/voice';
import { type Layout } from '../../../src/types/layout';
import { type Performance } from '../../../src/types/performance';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type SolverConfig } from '../../../src/types/engineConfig';
import { seedLayoutFromPose0 } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import {
  createTestPerformance,
  createSimultaneousPerformance,
  generateEventKey,
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  countHandUsage,
  assertNoNaNs,
  assertValidGridPositions,
  assertMappingIntegrity,
} from '../../helpers/testHelpers';

// ============================================================================
// Voice factory preserving stream IDs (simulates the real voiceId chain)
// ============================================================================

function buildExistingVoices(
  specs: Array<{ id: string; name: string; midi: number; color: string }>
): Map<number, Voice> {
  const map = new Map<number, Voice>();
  for (const s of specs) {
    map.set(s.midi, {
      id: s.id,
      name: s.name,
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: s.midi,
      color: s.color,
    });
  }
  return map;
}

// ============================================================================
// Tests
// ============================================================================

describe('Pose0-seeded drum layout', () => {
  const drumVoices = buildExistingVoices([
    { id: 'stream-kick', name: 'Kick', midi: 36, color: '#ef4444' },
    { id: 'stream-snare', name: 'Snare', midi: 38, color: '#3b82f6' },
    { id: 'stream-hihat', name: 'Hi-Hat', midi: 42, color: '#22c55e' },
  ]);

  it('places all voices within reachable zones (cols 0-7)', () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 42, startTime: 1.0 },
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    // All voices should be placed
    const voices = Object.values(layout.padToVoice);
    expect(voices.length).toBe(3);

    // All pads should be within 8x8 grid
    for (const [key] of Object.entries(layout.padToVoice)) {
      const [row, col] = key.split(',').map(Number);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(8);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(8);
    }
  });

  it('preserves voice IDs from existingVoices', () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 42, startTime: 1.0 },
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    const voiceIds = Object.values(layout.padToVoice).map(v => v.id);
    expect(voiceIds).toContain('stream-kick');
    expect(voiceIds).toContain('stream-snare');
    expect(voiceIds).toContain('stream-hihat');
  });

  it('generates playable candidates for a simple drum pattern', async () => {
    // Typical drum groove: kick+hihat together, snare alone, hihat alone
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },   // kick
      { noteNumber: 42, startTime: 0.0 },   // hihat (simultaneous)
      { noteNumber: 42, startTime: 0.25 },  // hihat
      { noteNumber: 38, startTime: 0.5 },   // snare
      { noteNumber: 42, startTime: 0.5 },   // hihat (simultaneous)
      { noteNumber: 42, startTime: 0.75 },  // hihat
      { noteNumber: 36, startTime: 1.0 },   // kick
      { noteNumber: 42, startTime: 1.0 },   // hihat (simultaneous)
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    const result = await generateCandidates(perf, pose0, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
    });

    expect(result.candidates.length).toBeGreaterThan(0);

    // At least one candidate should have mostly playable events
    const bestCandidate = result.candidates[0];
    const usage = countHandUsage(bestCandidate.executionPlan);
    const totalEvents = 8;
    const playableRatio = (usage.left + usage.right) / totalEvents;

    // Must have >50% playable events (should be close to 100%)
    expect(playableRatio).toBeGreaterThan(0.5);
  });

  it('handles simultaneous kick+hihat without zone conflicts', async () => {
    const perf = createSimultaneousPerformance([
      { time: 0.0, notes: [36, 42] },  // kick + hihat
      { time: 0.5, notes: [38, 42] },  // snare + hihat
      { time: 1.0, notes: [36, 42] },  // kick + hihat
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    const result = await generateCandidates(perf, pose0, {
      count: 1,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
    });

    expect(result.candidates.length).toBeGreaterThan(0);

    const usage = countHandUsage(result.candidates[0].executionPlan);
    // At least some events should be playable
    expect(usage.left + usage.right).toBeGreaterThan(0);
    // Unplayable should be minority
    expect(usage.unplayable).toBeLessThan(4);
  });

  it('places most-played sounds on dominant finger positions', () => {
    // Hi-hat is most frequent → should get index finger position
    const perf = createTestPerformance([
      { noteNumber: 42, startTime: 0.0 },
      { noteNumber: 42, startTime: 0.25 },
      { noteNumber: 42, startTime: 0.5 },
      { noteNumber: 42, startTime: 0.75 },
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 36, startTime: 0.5 },
      { noteNumber: 38, startTime: 0.25 },
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    // Default pose0: L_INDEX at (3,3), R_INDEX at (3,4)
    // Hi-hat (most played) should be at one of the index finger positions
    let hihatPad: string | null = null;
    for (const [key, voice] of Object.entries(layout.padToVoice)) {
      if (voice.id === 'stream-hihat') {
        hihatPad = key;
        break;
      }
    }

    expect(hihatPad).not.toBeNull();
    // Should be at L_INDEX (3,3) or R_INDEX (3,4) — the first two priority positions
    expect(['3,3', '3,4']).toContain(hihatPad);
  });
});

// ============================================================================
// Strict-mode solver tests (matches real auto-analysis path)
// ============================================================================

describe('Pose0-seeded layout with strict-mode solver', () => {
  const drumVoices = buildExistingVoices([
    { id: 'stream-kick', name: 'Kick', midi: 36, color: '#ef4444' },
    { id: 'stream-snare', name: 'Snare', midi: 38, color: '#3b82f6' },
    { id: 'stream-hihat', name: 'Hi-Hat', midi: 42, color: '#22c55e' },
  ]);

  /**
   * Creates a performance with voiceId on events, matching the real app flow
   * where getActivePerformance sets voiceId = stream.id.
   */
  function createDrumPerformanceWithVoiceIds(
    notes: Array<{ noteNumber: number; startTime: number; voiceId: string }>
  ): Performance {
    const events: PerformanceEvent[] = notes.map((n) => ({
      noteNumber: n.noteNumber,
      startTime: n.startTime,
      duration: 0.25,
      velocity: 100,
      channel: 1,
      eventKey: generateEventKey(n.noteNumber, n.startTime),
      voiceId: n.voiceId,
    }));
    return { events, tempo: 120, name: 'Drum Pattern' };
  }

  it('solver in strict mode resolves all events (no unmapped) with pose0 layout', async () => {
    const perf = createDrumPerformanceWithVoiceIds([
      { noteNumber: 36, startTime: 0.0, voiceId: 'stream-kick' },
      { noteNumber: 42, startTime: 0.0, voiceId: 'stream-hihat' },
      { noteNumber: 42, startTime: 0.25, voiceId: 'stream-hihat' },
      { noteNumber: 38, startTime: 0.5, voiceId: 'stream-snare' },
      { noteNumber: 42, startTime: 0.5, voiceId: 'stream-hihat' },
      { noteNumber: 42, startTime: 0.75, voiceId: 'stream-hihat' },
      { noteNumber: 36, startTime: 1.0, voiceId: 'stream-kick' },
      { noteNumber: 42, startTime: 1.0, voiceId: 'stream-hihat' },
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    // Strict mode — exactly like auto-analysis path
    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
    };
    const solver = createBeamSolver(solverConfig);
    const result = await solver.solve(perf, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    // All 8 events must be in the result
    expect(result.fingerAssignments.length).toBe(8);

    // Zero unplayable events — this is the critical assertion
    const usage = countHandUsage(result);
    expect(usage.unplayable).toBe(0);
    expect(usage.left + usage.right).toBe(8);

    assertNoNaNs(result);
    assertValidGridPositions(result);
    assertMappingIntegrity(result);
  });

  it('solver in strict mode handles 4-bar drum loop with zero unplayable', async () => {
    // Realistic 4-bar loop: kick on 1 and 3, snare on 2 and 4, hi-hat on every 8th
    const notes: Array<{ noteNumber: number; startTime: number; voiceId: string }> = [];
    const bpm = 120;
    const beatDuration = 60 / bpm; // 0.5s per beat

    for (let bar = 0; bar < 4; bar++) {
      const barStart = bar * 4 * beatDuration;
      for (let beat = 0; beat < 4; beat++) {
        const t = barStart + beat * beatDuration;
        // Hi-hat on every beat
        notes.push({ noteNumber: 42, startTime: t, voiceId: 'stream-hihat' });
        // Hi-hat on upbeat
        notes.push({ noteNumber: 42, startTime: t + beatDuration / 2, voiceId: 'stream-hihat' });
        // Kick on beats 1, 3
        if (beat === 0 || beat === 2) {
          notes.push({ noteNumber: 36, startTime: t, voiceId: 'stream-kick' });
        }
        // Snare on beats 2, 4
        if (beat === 1 || beat === 3) {
          notes.push({ noteNumber: 38, startTime: t, voiceId: 'stream-snare' });
        }
      }
    }

    const perf = createDrumPerformanceWithVoiceIds(notes);
    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
    };
    const solver = createBeamSolver(solverConfig);
    const result = await solver.solve(perf, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    expect(result.fingerAssignments.length).toBe(notes.length);

    const usage = countHandUsage(result);
    // All events must be playable for this simple pattern
    expect(usage.unplayable).toBe(0);
    expect(usage.left + usage.right).toBe(notes.length);
  });

  it('noteNumber fallback works in strict mode (no voiceId on events)', async () => {
    // Tests the path where events don't have voiceId — relies on noteNumber lookup
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 42, startTime: 0.0 },
      { noteNumber: 42, startTime: 0.5 },
    ]);

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(perf, pose0, 0, drumVoices);

    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
    };
    const solver = createBeamSolver(solverConfig);
    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    expect(result.fingerAssignments.length).toBe(4);
    expect(result.unplayableCount).toBe(0);
  });
});
