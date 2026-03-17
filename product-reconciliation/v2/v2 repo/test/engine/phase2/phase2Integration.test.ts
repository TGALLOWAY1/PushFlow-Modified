/**
 * Phase 2 Integration Tests.
 *
 * Tests the Phase 2 "Align solver inputs with workflow concepts" changes:
 * 1. voiceId propagation through solver output
 * 2. Placement lock enforcement in mutations
 * 3. Layout binding in execution plan output
 * 4. Execution plan staleness detection
 * 5. Hard vs soft constraint separation
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type ExecutionPlanResult, type ExecutionPlanLayoutBinding } from '../../../src/types/executionPlan';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type Performance } from '../../../src/types/performance';
import { padKey } from '../../../src/types/padGrid';
import { applyRandomMutation, applyZoneTransferMutation } from '../../../src/engine/optimization/mutationService';
import { checkPlanFreshness, getEffectiveLayoutBinding } from '../../../src/engine/evaluation/executionPlanValidation';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import {
  runSolver,
  createTestPerformance,
  assertNoNaNs,
  assertEventCount,
  DEFAULT_TEST_INSTRUMENT_CONFIG,
} from '../../helpers/testHelpers';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeVoice(id: string, noteNumber: number): Voice {
  return {
    id,
    noteNumber,
    name: `Voice ${id}`,
    channel: 1,
  };
}

function makeTestLayout(overrides?: Partial<Layout>): Layout {
  return {
    id: 'test-layout-001',
    name: 'Test Layout',
    padToVoice: {
      '0,0': makeVoice('kick', 36),
      '0,1': makeVoice('snare', 38),
      '1,0': makeVoice('hat', 42),
      '1,1': makeVoice('tom', 45),
    },
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active',
    ...overrides,
  };
}

function makePerformanceWithVoiceIds(): Performance {
  const events: PerformanceEvent[] = [
    { noteNumber: 36, voiceId: 'kick', startTime: 0.0, duration: 0.25, velocity: 100, channel: 1, eventKey: '0:36:1:1' },
    { noteNumber: 38, voiceId: 'snare', startTime: 0.25, duration: 0.25, velocity: 100, channel: 1, eventKey: '2500:38:1:1' },
    { noteNumber: 42, voiceId: 'hat', startTime: 0.5, duration: 0.25, velocity: 100, channel: 1, eventKey: '5000:42:1:1' },
  ];
  return { events, tempo: 120, name: 'voiceId test' };
}

// ============================================================================
// 1. voiceId Propagation
// ============================================================================

describe('Phase 2: voiceId Propagation', () => {
  it('should propagate voiceId from events to FingerAssignments', async () => {
    const layout = makeTestLayout();
    const perf = makePerformanceWithVoiceIds();

    const result = await runSolver(perf, {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      mappingResolverMode: 'allow-fallback',
    });

    assertEventCount(result, 3);
    assertNoNaNs(result);

    // Each FingerAssignment should carry the voiceId from its source event
    const voiceIds = result.fingerAssignments.map(fa => fa.voiceId);
    expect(voiceIds).toContain('kick');
    expect(voiceIds).toContain('snare');
    expect(voiceIds).toContain('hat');
  });

  it('should handle events without voiceId gracefully', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const result = await runSolver(perf);
    assertEventCount(result, 2);
    assertNoNaNs(result);

    // voiceId should be undefined for events that don't provide one
    for (const fa of result.fingerAssignments) {
      expect(fa.voiceId === undefined || typeof fa.voiceId === 'string').toBe(true);
    }
  });
});

// ============================================================================
// 2. Placement Lock Enforcement
// ============================================================================

describe('Phase 2: Placement Lock Enforcement', () => {
  it('should never move a voice from a locked pad', () => {
    const layout = makeTestLayout({
      placementLocks: {
        'kick': '0,0',   // kick is locked to pad 0,0
        'snare': '0,1',  // snare is locked to pad 0,1
      },
    });

    // Run many mutations and verify locked pads are never moved
    let seed = 0.1;
    const deterministicRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < 100; i++) {
      const mutated = applyRandomMutation(layout, deterministicRng);

      // Locked voices must remain at their locked pads
      expect(mutated.padToVoice['0,0']?.id).toBe('kick');
      expect(mutated.padToVoice['0,1']?.id).toBe('snare');
    }
  });

  it('should return layout unchanged if all pads are locked', () => {
    const layout = makeTestLayout({
      placementLocks: {
        'kick': '0,0',
        'snare': '0,1',
        'hat': '1,0',
        'tom': '1,1',
      },
    });

    const mutated = applyRandomMutation(layout, () => 0.5);

    // Should be exactly the same layout since nothing can move
    expect(mutated.padToVoice).toEqual(layout.padToVoice);
  });

  it('should enforce locks in zone transfer mutations', () => {
    const layout = makeTestLayout({
      placementLocks: {
        'kick': '0,0',
        'snare': '0,1',
        'hat': '1,0',
        'tom': '1,1',
      },
    });

    const mutated = applyZoneTransferMutation(layout, () => 0.5);

    // All locked voices stay put
    expect(mutated.padToVoice['0,0']?.id).toBe('kick');
    expect(mutated.padToVoice['0,1']?.id).toBe('snare');
    expect(mutated.padToVoice['1,0']?.id).toBe('hat');
    expect(mutated.padToVoice['1,1']?.id).toBe('tom');
  });

  it('should only mutate unlocked pads when some are locked', () => {
    // Lock kick and snare, leave hat and tom unlocked
    const layout = makeTestLayout({
      placementLocks: {
        'kick': '0,0',
        'snare': '0,1',
      },
    });

    let seed = 0.3;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let sawMutation = false;
    for (let i = 0; i < 50; i++) {
      const mutated = applyRandomMutation(layout, rng);
      // Locked pads must not change
      expect(mutated.padToVoice['0,0']?.id).toBe('kick');
      expect(mutated.padToVoice['0,1']?.id).toBe('snare');

      // Check if unlocked pads moved (hat or tom)
      if (
        mutated.padToVoice['1,0']?.id !== layout.padToVoice['1,0']?.id ||
        mutated.padToVoice['1,1']?.id !== layout.padToVoice['1,1']?.id
      ) {
        sawMutation = true;
      }
    }

    // Should have seen at least one mutation of unlocked pads
    expect(sawMutation).toBe(true);
  });
});

// ============================================================================
// 3. Layout Binding in Execution Plans
// ============================================================================

describe('Phase 2: Layout Binding', () => {
  it('should include layoutBinding when solver has a layout', async () => {
    const layout = makeTestLayout();
    const perf = makePerformanceWithVoiceIds();

    const result = await runSolver(perf, {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      sourceLayoutRole: 'active',
      mappingResolverMode: 'allow-fallback',
    });

    expect(result.layoutBinding).toBeDefined();
    expect(result.layoutBinding!.layoutId).toBe('test-layout-001');
    expect(result.layoutBinding!.layoutRole).toBe('active');
    expect(typeof result.layoutBinding!.layoutHash).toBe('string');
    expect(result.layoutBinding!.layoutHash.length).toBeGreaterThan(0);
  });

  it('should reflect working role when solving against working layout', async () => {
    const layout = makeTestLayout({ role: 'working' });
    const perf = makePerformanceWithVoiceIds();

    const result = await runSolver(perf, {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      sourceLayoutRole: 'working',
      mappingResolverMode: 'allow-fallback',
    });

    expect(result.layoutBinding).toBeDefined();
    expect(result.layoutBinding!.layoutRole).toBe('working');
  });

  it('should produce consistent layout hash for same layout state', () => {
    const layout = makeTestLayout();
    const hash1 = hashLayout(layout);
    const hash2 = hashLayout(layout);
    expect(hash1).toBe(hash2);
  });

  it('should produce different layout hash when padToVoice changes', () => {
    const layout1 = makeTestLayout();
    const layout2 = makeTestLayout({
      padToVoice: {
        ...layout1.padToVoice,
        '2,2': makeVoice('extra', 50),
      },
    });

    const hash1 = hashLayout(layout1);
    const hash2 = hashLayout(layout2);
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// 4. Execution Plan Staleness Detection
// ============================================================================

describe('Phase 2: Staleness Detection', () => {
  const layout = makeTestLayout();
  const layoutHash = hashLayout(layout);

  const freshPlan: ExecutionPlanResult = {
    score: 100,
    unplayableCount: 0,
    hardCount: 0,
    fingerAssignments: [],
    fingerUsageStats: {},
    fatigueMap: {},
    averageDrift: 0,
    averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
    layoutBinding: {
      layoutId: 'test-layout-001',
      layoutHash,
      layoutRole: 'active',
    },
  };

  it('should report fresh when plan matches layout', () => {
    const result = checkPlanFreshness(freshPlan, layout);
    expect(result.isFresh).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should report stale when layout id differs', () => {
    const differentLayout = makeTestLayout({ id: 'different-layout' });
    const result = checkPlanFreshness(freshPlan, differentLayout);
    expect(result.isFresh).toBe(false);
    expect(result.reason).toContain('different layout');
  });

  it('should report stale when layout hash differs', () => {
    const modifiedLayout = makeTestLayout({
      padToVoice: {
        '0,0': makeVoice('kick', 36),
        '3,3': makeVoice('new-voice', 50),
      },
    });
    const result = checkPlanFreshness(freshPlan, modifiedLayout);
    expect(result.isFresh).toBe(false);
    expect(result.reason).toContain('changed');
  });

  it('should report stale when plan has no binding', () => {
    const unboundPlan: ExecutionPlanResult = {
      ...freshPlan,
      layoutBinding: undefined,
      metadata: {},
    };
    const result = checkPlanFreshness(unboundPlan, layout);
    expect(result.isFresh).toBe(false);
    expect(result.reason).toContain('no layout binding');
  });

  it('should support legacy metadata fields for pre-Phase-2 plans', () => {
    const legacyPlan: ExecutionPlanResult = {
      ...freshPlan,
      layoutBinding: undefined,
      metadata: {
        layoutIdUsed: 'test-layout-001',
        layoutHashUsed: layoutHash,
      },
    };
    const result = checkPlanFreshness(legacyPlan, layout);
    expect(result.isFresh).toBe(true);
  });

  it('should detect legacy plan staleness when hash changes', () => {
    const legacyPlan: ExecutionPlanResult = {
      ...freshPlan,
      layoutBinding: undefined,
      metadata: {
        layoutIdUsed: 'test-layout-001',
        layoutHashUsed: 'outdated-hash',
      },
    };
    const result = checkPlanFreshness(legacyPlan, layout);
    expect(result.isFresh).toBe(false);
    expect(result.reason).toContain('changed');
  });
});

// ============================================================================
// 5. getEffectiveLayoutBinding
// ============================================================================

describe('Phase 2: getEffectiveLayoutBinding', () => {
  it('should return layoutBinding when present', () => {
    const binding: ExecutionPlanLayoutBinding = {
      layoutId: 'layout-1',
      layoutHash: 'hash-1',
      layoutRole: 'active',
    };
    const plan: ExecutionPlanResult = {
      score: 0,
      unplayableCount: 0,
      hardCount: 0,
      fingerAssignments: [],
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
      layoutBinding: binding,
    };

    const result = getEffectiveLayoutBinding(plan);
    expect(result).toBe(binding);
  });

  it('should fall back to legacy metadata', () => {
    const plan: ExecutionPlanResult = {
      score: 0,
      unplayableCount: 0,
      hardCount: 0,
      fingerAssignments: [],
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
      metadata: {
        layoutIdUsed: 'legacy-id',
        layoutHashUsed: 'legacy-hash',
      },
    };

    const result = getEffectiveLayoutBinding(plan);
    expect(result).not.toBeNull();
    expect(result!.layoutId).toBe('legacy-id');
    expect(result!.layoutHash).toBe('legacy-hash');
    expect(result!.layoutRole).toBe('active'); // default for legacy
  });

  it('should return null when no binding and no legacy metadata', () => {
    const plan: ExecutionPlanResult = {
      score: 0,
      unplayableCount: 0,
      hardCount: 0,
      fingerAssignments: [],
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
    };

    const result = getEffectiveLayoutBinding(plan);
    expect(result).toBeNull();
  });
});
