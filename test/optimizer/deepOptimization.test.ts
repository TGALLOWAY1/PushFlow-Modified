/**
 * Deep Optimization Solver Tests.
 *
 * Comprehensive test suite for the deep optimization feature:
 * - AnnealingConfig correctness
 * - AnnealingSolver parameterization and restart logic
 * - Zone transfer mutation operator
 * - Difficulty pre-classification
 * - MultiCandidateGenerator wiring
 * - Solver telemetry
 * - Determinism
 */

import { describe, it, expect } from 'vitest';
import {
  FAST_ANNEALING_CONFIG,
  DEEP_ANNEALING_CONFIG,
  type AnnealingConfig,
  type SolverConfig,
} from '../../src/types/engineConfig';
import { type Layout } from '../../src/types/layout';
import { type Performance } from '../../src/types/performance';
import { applyRandomMutation, applyZoneTransferMutation, getEmptyPads } from '../../src/engine/optimization/mutationService';
import { classifyOptimizationDifficulty } from '../../src/engine/evaluation/difficultyScoring';
import { createSeededRng } from '../../src/utils/seededRng';
import {
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  createTestPerformance,
  createAlternatingPerformance,
  createSimultaneousPerformance,
  assertNoNaNs,
  assertMappingIntegrity,
} from '../helpers/testHelpers';
import { padKey } from '../../src/types/padGrid';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Creates a layout with voices on specified pads. */
function createTestLayout(pads: Array<{ row: number; col: number; noteNumber: number }>): Layout {
  const padToVoice: Layout['padToVoice'] = {};
  for (const pad of pads) {
    padToVoice[padKey(pad.row, pad.col)] = {
      id: `voice-${pad.noteNumber}`,
      name: `Voice ${pad.noteNumber}`,
      sourceType: 'midi_track',
      sourceFile: 'test.mid',
      originalMidiNote: pad.noteNumber,
      color: '#fff',
    };
  }
  return {
    id: 'test-layout',
    name: 'Test Layout',
    padToVoice,
    fingerConstraints: {},
    scoreCache: null,
  };
}

/** Creates a simple 4-voice layout in left zone. */
function createLeftZoneLayout(): Layout {
  return createTestLayout([
    { row: 3, col: 1, noteNumber: 36 },
    { row: 3, col: 2, noteNumber: 37 },
    { row: 4, col: 1, noteNumber: 38 },
    { row: 4, col: 2, noteNumber: 39 },
  ]);
}

/** Creates a layout with voices in both zones. */
function createDualZoneLayout(): Layout {
  return createTestLayout([
    { row: 3, col: 1, noteNumber: 36 },
    { row: 3, col: 2, noteNumber: 37 },
    { row: 3, col: 5, noteNumber: 38 },
    { row: 3, col: 6, noteNumber: 39 },
  ]);
}

/** Creates a simple performance matching a layout. */
function createMatchingPerformance(layout: Layout): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  let time = 0;
  for (const voice of Object.values(layout.padToVoice)) {
    if (voice.originalMidiNote != null) {
      notes.push({ noteNumber: voice.originalMidiNote, startTime: time });
      time += 0.25;
    }
  }
  return createTestPerformance(notes);
}

// ============================================================================
// 1. AnnealingConfig Correctness
// ============================================================================

describe('AnnealingConfig constants', () => {
  it('FAST_ANNEALING_CONFIG matches expected values', () => {
    expect(FAST_ANNEALING_CONFIG.iterations).toBe(3000);
    expect(FAST_ANNEALING_CONFIG.initialTemp).toBe(500);
    expect(FAST_ANNEALING_CONFIG.coolingRate).toBe(0.997);
    expect(FAST_ANNEALING_CONFIG.restartCount).toBe(0);
    expect(FAST_ANNEALING_CONFIG.fastBeamWidth).toBe(12);
    expect(FAST_ANNEALING_CONFIG.finalBeamWidth).toBe(50);
    expect(FAST_ANNEALING_CONFIG.useZoneTransfer).toBe(false);
  });

  it('DEEP_ANNEALING_CONFIG has more iterations and restarts than FAST', () => {
    expect(DEEP_ANNEALING_CONFIG.iterations).toBeGreaterThan(FAST_ANNEALING_CONFIG.iterations);
    expect(DEEP_ANNEALING_CONFIG.restartCount).toBeGreaterThan(FAST_ANNEALING_CONFIG.restartCount);
  });

  it('DEEP_ANNEALING_CONFIG enables zone transfer', () => {
    expect(DEEP_ANNEALING_CONFIG.useZoneTransfer).toBe(true);
  });

  it('DEEP_ANNEALING_CONFIG has expected values', () => {
    expect(DEEP_ANNEALING_CONFIG.iterations).toBe(8000);
    expect(DEEP_ANNEALING_CONFIG.initialTemp).toBe(500);
    expect(DEEP_ANNEALING_CONFIG.coolingRate).toBe(0.9985);
    expect(DEEP_ANNEALING_CONFIG.restartCount).toBe(3);
    expect(DEEP_ANNEALING_CONFIG.fastBeamWidth).toBe(16);
    expect(DEEP_ANNEALING_CONFIG.finalBeamWidth).toBe(50);
  });

  it('both configs have valid cooling rates (0 < rate < 1)', () => {
    expect(FAST_ANNEALING_CONFIG.coolingRate).toBeGreaterThan(0);
    expect(FAST_ANNEALING_CONFIG.coolingRate).toBeLessThan(1);
    expect(DEEP_ANNEALING_CONFIG.coolingRate).toBeGreaterThan(0);
    expect(DEEP_ANNEALING_CONFIG.coolingRate).toBeLessThan(1);
  });
});

// ============================================================================
// 2. Zone Transfer Mutation
// ============================================================================

describe('Zone transfer mutation', () => {
  it('preserves voice count', () => {
    const layout = createLeftZoneLayout();
    const rng = createSeededRng(42);
    const mutated = applyZoneTransferMutation(layout, rng);

    const originalVoiceIds = new Set(Object.values(layout.padToVoice).map(v => v.id));
    const mutatedVoiceIds = new Set(Object.values(mutated.padToVoice).map(v => v.id));

    expect(mutatedVoiceIds.size).toBe(originalVoiceIds.size);
    // Same set of voice IDs
    for (const id of originalVoiceIds) {
      expect(mutatedVoiceIds.has(id)).toBe(true);
    }
  });

  it('moves voice to opposite zone', () => {
    const layout = createLeftZoneLayout();
    const rng = createSeededRng(42);
    const mutated = applyZoneTransferMutation(layout, rng);

    // At least one voice should now be in cols 4-7 (right zone)
    const rightZoneVoices = Object.keys(mutated.padToVoice).filter(key => {
      const col = parseInt(key.split(',')[1]);
      return col >= 4;
    });

    // Original layout has no voices in right zone
    const originalRightZone = Object.keys(layout.padToVoice).filter(key => {
      const col = parseInt(key.split(',')[1]);
      return col >= 4;
    });

    expect(originalRightZone.length).toBe(0);
    expect(rightZoneVoices.length).toBeGreaterThan(0);
  });

  it('returns valid layout when no empty pads in target zone', () => {
    // Fill all right zone pads
    const pads: Array<{ row: number; col: number; noteNumber: number }> = [];
    let note = 36;
    for (let row = 0; row < 8; row++) {
      for (let col = 4; col < 8; col++) {
        pads.push({ row, col, noteNumber: note++ });
      }
    }
    // Add one voice in left zone
    pads.push({ row: 3, col: 1, noteNumber: note++ });

    const layout = createTestLayout(pads);
    const rng = createSeededRng(42);

    // Should not throw, should return a valid layout
    const mutated = applyZoneTransferMutation(layout, rng);
    expect(Object.keys(mutated.padToVoice).length).toBeGreaterThan(0);
  });

  it('produces new layout object (immutability)', () => {
    const layout = createLeftZoneLayout();
    const rng = createSeededRng(42);
    const mutated = applyZoneTransferMutation(layout, rng);

    expect(mutated).not.toBe(layout);
    expect(mutated.padToVoice).not.toBe(layout.padToVoice);
  });

  it('clears scoreCache on mutation', () => {
    const layout = { ...createLeftZoneLayout(), scoreCache: { score: 42 } as any };
    const rng = createSeededRng(42);
    const mutated = applyZoneTransferMutation(layout, rng);
    expect(mutated.scoreCache).toBeNull();
  });
});

// ============================================================================
// 3. applyRandomMutation (existing mutations still work)
// ============================================================================

describe('applyRandomMutation', () => {
  it('returns valid layout with same voice count', () => {
    const layout = createDualZoneLayout();
    const rng = createSeededRng(42);

    for (let i = 0; i < 20; i++) {
      const mutated = applyRandomMutation(layout, rng);
      const originalCount = Object.keys(layout.padToVoice).length;
      const mutatedCount = Object.keys(mutated.padToVoice).length;
      expect(mutatedCount).toBe(originalCount);
    }
  });

  it('handles single-voice layout', () => {
    const layout = createTestLayout([{ row: 3, col: 3, noteNumber: 60 }]);
    const rng = createSeededRng(42);

    // Should not crash
    const mutated = applyRandomMutation(layout, rng);
    expect(Object.keys(mutated.padToVoice).length).toBe(1);
  });

  it('is deterministic with seeded RNG', () => {
    const layout = createDualZoneLayout();

    const mutated1 = applyRandomMutation(layout, createSeededRng(42));
    const mutated2 = applyRandomMutation(layout, createSeededRng(42));

    expect(Object.keys(mutated1.padToVoice).sort()).toEqual(
      Object.keys(mutated2.padToVoice).sort()
    );
  });
});

// ============================================================================
// 4. Difficulty Pre-Classification
// ============================================================================

describe('classifyOptimizationDifficulty', () => {
  it('returns "fast" for empty performance', () => {
    const perf: Performance = { events: [], tempo: 120 };
    expect(classifyOptimizationDifficulty(perf)).toBe('fast');
  });

  it('returns "fast" for simple scale (4 notes, low density)', () => {
    const perf = createTestPerformance([
      { noteNumber: 60, startTime: 0 },
      { noteNumber: 62, startTime: 0.5 },
      { noteNumber: 64, startTime: 1.0 },
      { noteNumber: 65, startTime: 1.5 },
    ]);
    expect(classifyOptimizationDifficulty(perf)).toBe('fast');
  });

  it('returns "deep" for dense polyrhythm (many voices, high density, polyphony)', () => {
    // 10 unique voices, high density, high polyphony
    const notes: Array<{ noteNumber: number; startTime: number }> = [];
    for (let i = 0; i < 10; i++) {
      // Simultaneous chord of 5 at each beat
      for (let j = 0; j < 5; j++) {
        notes.push({ noteNumber: 36 + j + (i % 5), startTime: i * 0.1 });
      }
    }
    const perf = createTestPerformance(notes);
    expect(classifyOptimizationDifficulty(perf)).toBe('deep');
  });

  it('returns "fast" for single-event performance', () => {
    const perf = createTestPerformance([{ noteNumber: 60, startTime: 0 }]);
    expect(classifyOptimizationDifficulty(perf)).toBe('fast');
  });

  it('returns "deep" when voice count exceeds 8', () => {
    // 10 unique notes, spread out (low density, no polyphony)
    const notes: Array<{ noteNumber: number; startTime: number }> = [];
    for (let i = 0; i < 10; i++) {
      notes.push({ noteNumber: 36 + i, startTime: i * 1.0 });
    }
    // Even with low density, 10 voices + some density should push toward deep
    // Let's add more events to increase density
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        notes.push({ noteNumber: 36 + i, startTime: i * 1.0 + j * 0.15 });
      }
    }
    const perf = createTestPerformance(notes);
    const mode = classifyOptimizationDifficulty(perf);
    // With 10 voices (score += 2) and peak density > 4 (score += 1), total >= 3
    expect(mode).toBe('deep');
  });
});

// ============================================================================
// 5. AnnealingSolver Integration (lightweight — uses minimal iterations)
// ============================================================================

describe('AnnealingSolver integration', () => {
  // Use very small iteration counts for fast test execution
  const TINY_CONFIG: AnnealingConfig = {
    iterations: 5,
    initialTemp: 100,
    coolingRate: 0.9,
    restartCount: 0,
    fastBeamWidth: 5,
    finalBeamWidth: 10,
    useZoneTransfer: false,
  };

  const TINY_RESTART_CONFIG: AnnealingConfig = {
    ...TINY_CONFIG,
    restartCount: 2,
  };

  it('produces valid result with tiny config', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    assertNoNaNs(result);
    assertMappingIntegrity(result);
    expect(result.fingerAssignments.length).toBe(perf.events.length);
  });

  it('getBestLayout() returns a layout after solving', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    expect(solver.getBestLayout()).toBeNull();
    await solver.solve(perf, DEFAULT_ENGINE_CONFIG);
    expect(solver.getBestLayout()).not.toBeNull();
  });

  it('emits solver telemetry in metadata', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    const telemetry = result.metadata?.solverTelemetry;
    expect(telemetry).toBeDefined();
    expect(telemetry!.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(telemetry!.iterationsCompleted).toBe(TINY_CONFIG.iterations);
    expect(telemetry!.restartCount).toBe(0);
    expect(telemetry!.totalAccepted).toBeGreaterThanOrEqual(0);
    expect(telemetry!.totalRejected).toBeGreaterThanOrEqual(0);
    expect(telemetry!.acceptanceRate).toBeGreaterThanOrEqual(0);
    expect(telemetry!.acceptanceRate).toBeLessThanOrEqual(1);
  });

  it('emits annealingTrace with correct iteration count', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    expect(result.annealingTrace).toBeDefined();
    expect(result.annealingTrace!.length).toBe(TINY_CONFIG.iterations);
  });

  it('restart trace has correct segment count', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_RESTART_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    expect(result.annealingTrace).toBeDefined();
    // Total iterations = iterations * (restartCount + 1)
    const expectedTotal = TINY_RESTART_CONFIG.iterations * (TINY_RESTART_CONFIG.restartCount + 1);
    expect(result.annealingTrace!.length).toBe(expectedTotal);

    // Verify restart indices exist
    const restartIndices = new Set(result.annealingTrace!.map(s => s.restartIndex));
    expect(restartIndices.size).toBe(TINY_RESTART_CONFIG.restartCount + 1);
    expect(restartIndices.has(0)).toBe(true);
    expect(restartIndices.has(1)).toBe(true);
    expect(restartIndices.has(2)).toBe(true);
  });

  it('restartBestCosts has correct length', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_RESTART_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);

    const telemetry = result.metadata?.solverTelemetry;
    expect(telemetry!.restartBestCosts.length).toBe(TINY_RESTART_CONFIG.restartCount + 1);
    // Each restart's best cost should be non-negative
    for (const cost of telemetry!.restartBestCosts) {
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(cost)).toBe(true);
    }
  });

  it('is deterministic with same seed', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const result1 = await createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    }).solve(perf, DEFAULT_ENGINE_CONFIG);

    const result2 = await createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    }).solve(perf, DEFAULT_ENGINE_CONFIG);

    expect(result1.averageMetrics.total).toBe(result2.averageMetrics.total);
    expect(result1.annealingTrace!.length).toBe(result2.annealingTrace!.length);
    // Check trace values match
    for (let i = 0; i < result1.annealingTrace!.length; i++) {
      expect(result1.annealingTrace![i].bestCost).toBe(result2.annealingTrace![i].bestCost);
    }
  });

  it('throws on layout with missing voice coverage', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    // Layout has note 36, but performance requires note 60 (not on the layout)
    const layout = createTestLayout([{ row: 0, col: 0, noteNumber: 36 }]);
    const perf = createTestPerformance([
      { noteNumber: 60, startTime: 0 },
    ]);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    await expect(solver.solve(perf, DEFAULT_ENGINE_CONFIG)).rejects.toThrow(
      /initial layout does not cover/i
    );
  });

  it('throws when no layout provided', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const perf = createTestPerformance([{ noteNumber: 60, startTime: 0 }]);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      seed: 42,
      annealingConfig: TINY_CONFIG,
    });

    await expect(solver.solve(perf, DEFAULT_ENGINE_CONFIG)).rejects.toThrow(
      /requires an initial Layout/i
    );
  });
});

// ============================================================================
// 6. Zone Transfer in SA (integration)
// ============================================================================

describe('AnnealingSolver with zone transfer', () => {
  const TINY_ZT_CONFIG: AnnealingConfig = {
    iterations: 10,
    initialTemp: 100,
    coolingRate: 0.9,
    restartCount: 0,
    fastBeamWidth: 5,
    finalBeamWidth: 10,
    useZoneTransfer: true,
  };

  it('produces valid result with zone transfer enabled', async () => {
    const { createAnnealingSolver } = await import('../../src/engine/optimization/annealingSolver');

    const layout = createLeftZoneLayout();
    const perf = createMatchingPerformance(layout);

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      seed: 42,
      annealingConfig: TINY_ZT_CONFIG,
    });

    const result = await solver.solve(perf, DEFAULT_ENGINE_CONFIG);
    assertNoNaNs(result);
    assertMappingIntegrity(result);
  });
});
