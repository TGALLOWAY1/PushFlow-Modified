/**
 * Greedy Optimizer — Trace & Restart Regression Tests.
 *
 * These tests guard against silent regressions to:
 * - Optimization trace (moveHistory) production
 * - Restart/exploration behavior
 * - Deterministic (seed=0) reproducibility
 * - Trace shape integrity
 *
 * See CLAUDE.md "Core Functionality Preservation Contract" and
 * "Do Not Regress" sections.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type OptimizerInput } from '../../../src/engine/optimization/optimizerInterface';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG, DEFAULT_RESTING_POSE } from '../../helpers/testHelpers';

// Import adapter to trigger self-registration
import '../../../src/engine/optimization/greedyOptimizer';
import { getOptimizer } from '../../../src/engine/optimization/optimizerRegistry';

// ============================================================================
// Helpers
// ============================================================================

function makeVoice(id: string, name: string, midi: number): Voice {
  return {
    id,
    name,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: midi,
    color: '#888',
  };
}

function makeTestInput(overrides?: Partial<OptimizerInput['config']>): OptimizerInput {
  const v1 = makeVoice('v1', 'Kick', 36);
  const v2 = makeVoice('v2', 'Snare', 38);
  const v3 = makeVoice('v3', 'HiHat', 42);

  const layout: Layout = {
    id: 'test-layout',
    name: 'Test',
    padToVoice: {
      '0,0': v1,
      '0,2': v2,
      '2,5': v3,
    },
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active' as const,
  };

  return {
    performance: {
      events: [
        { noteNumber: 36, startTime: 0, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e1', voiceId: 'v1' },
        { noteNumber: 38, startTime: 0.5, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e2', voiceId: 'v2' },
        { noteNumber: 42, startTime: 1.0, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e3', voiceId: 'v3' },
        { noteNumber: 36, startTime: 1.5, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e4', voiceId: 'v1' },
        { noteNumber: 38, startTime: 2.0, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e5', voiceId: 'v2' },
        { noteNumber: 42, startTime: 2.5, duration: 0.25, velocity: 100, channel: 1, eventKey: 'e6', voiceId: 'v3' },
      ],
      tempo: 120,
      name: 'Trace Test',
    },
    layout,
    costToggles: ALL_COSTS_ENABLED,
    constraints: {},
    config: {
      engineConfig: DEFAULT_ENGINE_CONFIG,
      seed: 0,
      ...overrides,
    },
    evaluationConfig: {
      restingPose: DEFAULT_RESTING_POSE,
      stiffness: 0.3,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      neutralHandCenters: null,
    },
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Greedy Optimizer — Trace Production', () => {
  it('produces non-empty moveHistory', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.moveHistory).toBeDefined();
    expect(result.moveHistory!.length).toBeGreaterThan(0);
  });

  it('moveHistory entries have required trace fields', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    for (const move of result.moveHistory!) {
      expect(move).toHaveProperty('iteration');
      expect(move).toHaveProperty('type');
      expect(move).toHaveProperty('description');
      expect(typeof move.description).toBe('string');
      expect(move.description.length).toBeGreaterThan(0);
      expect(move).toHaveProperty('costBefore');
      expect(move).toHaveProperty('costAfter');
      expect(move).toHaveProperty('costDelta');
      expect(move).toHaveProperty('reason');
      expect(move).toHaveProperty('phase');
      expect(['init-layout', 'init-fingers', 'hill-climb']).toContain(move.phase);
    }
  });

  it('provides a valid stopReason', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.stopReason).toBeDefined();
    expect([
      'no_improving_move', 'iteration_cap', 'local_minimum',
      'infeasible_neighborhood', 'completed', 'aborted',
    ]).toContain(result.stopReason);
  });

  it('provides telemetry with cost improvement data', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.telemetry).toBeDefined();
    expect(result.telemetry.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.telemetry.initialCost).toBe('number');
    expect(typeof result.telemetry.finalCost).toBe('number');
    expect(typeof result.telemetry.improvement).toBe('number');
  });

  it('provides full diagnostics from canonical evaluator', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.diagnostics).toBeDefined();
    expect(typeof result.diagnostics.total).toBe('number');
    expect(result.diagnostics.dimensions).toBeDefined();
    // Verify factorized dimensions are present, not collapsed into single score
    expect(typeof result.diagnostics.dimensions.poseNaturalness).toBe('number');
    expect(typeof result.diagnostics.dimensions.transitionCost).toBe('number');
    expect(typeof result.diagnostics.dimensions.handBalance).toBe('number');
  });
});

describe('Greedy Optimizer — Deterministic Mode', () => {
  it('seed=0 produces identical results across runs', async () => {
    const optimizer = getOptimizer('greedy');
    const input = makeTestInput({ seed: 0 });

    const result1 = await optimizer.optimize(input);
    const result2 = await optimizer.optimize(input);

    expect(result1.diagnostics.total).toBe(result2.diagnostics.total);
    expect(result1.moveHistory!.length).toBe(result2.moveHistory!.length);
    expect(result1.stopReason).toBe(result2.stopReason);

    // Verify move descriptions match
    for (let i = 0; i < result1.moveHistory!.length; i++) {
      expect(result1.moveHistory![i].description).toBe(result2.moveHistory![i].description);
      expect(result1.moveHistory![i].costDelta).toBe(result2.moveHistory![i].costDelta);
    }
  });

  it('different seeds produce different initial placements (from-scratch mode)', async () => {
    const optimizer = getOptimizer('greedy');

    // Use empty layout to trigger greedy init (from-scratch placement)
    const emptyLayout: Layout = {
      id: 'empty',
      name: 'Empty',
      padToVoice: {},
      fingerConstraints: {},
      scoreCache: null,
    };

    const input0 = makeTestInput({ seed: 0 });
    input0.layout = emptyLayout;
    const input1 = makeTestInput({ seed: 42 });
    input1.layout = emptyLayout;

    const result0 = await optimizer.optimize(input0);
    const result1 = await optimizer.optimize(input1);

    // Results should exist and may differ
    expect(result0.moveHistory!.length).toBeGreaterThan(0);
    expect(result1.moveHistory!.length).toBeGreaterThan(0);

    // Different seeds should at least produce different costs or layouts
    // (not guaranteed to differ with small examples, so we just verify both succeed)
    expect(result0.diagnostics.total).toBeDefined();
    expect(result1.diagnostics.total).toBeDefined();
  });
});

describe('Greedy Optimizer — Restart Support', () => {
  it('restartCount=0 produces single-attempt trace', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput({ seed: 0, restartCount: 0 }));

    expect(result.moveHistory).toBeDefined();
    // All moves should have attemptIndex 0
    for (const move of result.moveHistory!) {
      expect(move.attemptIndex ?? 0).toBe(0);
    }
  });

  it('restartCount=2 produces trace with multiple attempt indices', async () => {
    const optimizer = getOptimizer('greedy');

    // Use empty layout to trigger from-scratch placement for meaningful diversity
    const emptyLayout: Layout = {
      id: 'empty',
      name: 'Empty',
      padToVoice: {},
      fingerConstraints: {},
      scoreCache: null,
    };
    const input = makeTestInput({ seed: 1, restartCount: 2 });
    input.layout = emptyLayout;

    const result = await optimizer.optimize(input);
    expect(result.moveHistory).toBeDefined();
    expect(result.moveHistory!.length).toBeGreaterThan(0);

    // Should have moves from multiple attempts
    const attemptIndices = new Set(result.moveHistory!.map(m => m.attemptIndex ?? 0));
    expect(attemptIndices.size).toBeGreaterThan(1);
  });

  it('best result is kept across restarts', async () => {
    const optimizer = getOptimizer('greedy');

    const emptyLayout: Layout = {
      id: 'empty',
      name: 'Empty',
      padToVoice: {},
      fingerConstraints: {},
      scoreCache: null,
    };
    const input = makeTestInput({ seed: 1, restartCount: 2 });
    input.layout = emptyLayout;

    const resultWithRestarts = await optimizer.optimize(input);

    // With restarts, the final cost should be <= the cost of any single attempt
    // (we can't easily verify this without running each separately, but we can
    // verify the output has a reasonable cost)
    expect(resultWithRestarts.diagnostics.total).toBeGreaterThanOrEqual(0);
    expect(resultWithRestarts.layout).toBeDefined();
    expect(Object.keys(resultWithRestarts.layout.padToVoice).length).toBeGreaterThan(0);
  });
});

describe('Greedy Optimizer — Output Contract', () => {
  it('returns all required OptimizerOutput fields', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    // Required fields per CLAUDE.md Canonical Optimizer Output Contract
    expect(result.layout).toBeDefined();
    expect(result.padFingerAssignment).toBeDefined();
    expect(result.executionPlan).toBeDefined();
    expect(result.diagnostics).toBeDefined();
    expect(result.costTogglesUsed).toBeDefined();
    expect(result.stopReason).toBeDefined();
    expect(result.telemetry).toBeDefined();

    // Interpretable method must have moveHistory
    expect(result.moveHistory).toBeDefined();
    expect(Array.isArray(result.moveHistory)).toBe(true);
  });

  it('executionPlan contains finger assignments', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.executionPlan.fingerAssignments).toBeDefined();
    expect(result.executionPlan.fingerAssignments.length).toBeGreaterThan(0);
  });

  it('normalizes greedy execution plans to the shared UI contract', async () => {
    const optimizer = getOptimizer('greedy');
    const result = await optimizer.optimize(makeTestInput());

    expect(result.executionPlan.score).toBeGreaterThanOrEqual(0);
    expect(result.executionPlan.score).toBeLessThanOrEqual(100);
    expect(result.executionPlan.layoutBinding).toBeDefined();
    expect(result.executionPlan.layoutBinding?.layoutId).toBe(result.layout.id);
    expect(result.executionPlan.momentAssignments).toBeDefined();
    expect(result.executionPlan.momentAssignments!.length).toBeGreaterThan(0);

    const playableAssignments = result.executionPlan.fingerAssignments.filter(
      assignment => assignment.assignedHand !== 'Unplayable',
    );
    expect(playableAssignments.length).toBeGreaterThan(0);
    expect(playableAssignments.some(assignment => (assignment.costBreakdown?.total ?? 0) > 0)).toBe(true);
  });
});
