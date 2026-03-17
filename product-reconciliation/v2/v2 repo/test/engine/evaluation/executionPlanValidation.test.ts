/**
 * Phase 6: Execution plan validation tests.
 *
 * Validates freshness checking, layout binding extraction, and
 * staleness detection for execution plans.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { type V1CostBreakdown } from '../../../src/types/diagnostics';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import {
  checkPlanFreshness,
  getEffectiveLayoutBinding,
} from '../../../src/engine/evaluation/executionPlanValidation';

// ============================================================================
// Factories
// ============================================================================

function makeVoice(id: string, midi: number): Voice {
  return {
    id,
    name: `Voice ${id}`,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: midi,
    color: '#000',
  };
}

function makeLayout(id: string, padToVoice: Record<string, Voice>): Layout {
  return {
    id,
    name: `Layout ${id}`,
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active' as const,
  };
}

const emptyMetrics: V1CostBreakdown = {
  fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0,
};

function makePlan(overrides?: Partial<ExecutionPlanResult>): ExecutionPlanResult {
  return {
    score: 1.0,
    unplayableCount: 0,
    hardCount: 0,
    fingerAssignments: [],
    fingerUsageStats: {},
    fatigueMap: {},
    averageDrift: 0,
    averageMetrics: emptyMetrics,
    ...overrides,
  };
}

// ============================================================================
// Tests: checkPlanFreshness
// ============================================================================

describe('checkPlanFreshness', () => {
  const v1 = makeVoice('v1', 36);
  const v2 = makeVoice('v2', 38);

  it('should return fresh when layoutBinding matches layout', () => {
    const layout = makeLayout('layout-001', { '0,0': v1, '0,2': v2 });
    const plan = makePlan({
      layoutBinding: {
        layoutId: 'layout-001',
        layoutHash: hashLayout(layout),
        layoutRole: 'active',
      },
    });

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(true);
    expect(check.reason).toBeUndefined();
  });

  it('should return stale when layout ID differs', () => {
    const layout = makeLayout('layout-002', { '0,0': v1 });
    const plan = makePlan({
      layoutBinding: {
        layoutId: 'layout-001',
        layoutHash: hashLayout(layout),
        layoutRole: 'active',
      },
    });

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('different layout');
  });

  it('should return stale when layout hash differs (pad assignments changed)', () => {
    const originalLayout = makeLayout('layout-001', { '0,0': v1, '0,2': v2 });
    const modifiedLayout = makeLayout('layout-001', { '0,0': v1, '4,6': v2 }); // v2 moved

    const plan = makePlan({
      layoutBinding: {
        layoutId: 'layout-001',
        layoutHash: hashLayout(originalLayout),
        layoutRole: 'active',
      },
    });

    const check = checkPlanFreshness(plan, modifiedLayout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('changed');
  });

  it('should return stale for plan with no binding and no legacy metadata', () => {
    const layout = makeLayout('layout-001', { '0,0': v1 });
    const plan = makePlan(); // no layoutBinding, no metadata

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('no layout binding');
  });

  it('should use legacy metadata when no layoutBinding present', () => {
    const layout = makeLayout('layout-001', { '0,0': v1, '0,2': v2 });
    const plan = makePlan({
      metadata: {
        layoutIdUsed: 'layout-001',
        layoutHashUsed: hashLayout(layout),
      },
    });

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(true);
  });

  it('should detect stale via legacy hash mismatch', () => {
    const originalLayout = makeLayout('layout-001', { '0,0': v1 });
    const modifiedLayout = makeLayout('layout-001', { '0,0': v1, '2,4': v2 });

    const plan = makePlan({
      metadata: {
        layoutIdUsed: 'layout-001',
        layoutHashUsed: hashLayout(originalLayout),
      },
    });

    const check = checkPlanFreshness(plan, modifiedLayout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('changed');
  });

  it('should detect stale via legacy ID mismatch', () => {
    const layout = makeLayout('layout-002', { '0,0': v1 });
    const plan = makePlan({
      metadata: {
        layoutIdUsed: 'layout-001',
        layoutHashUsed: hashLayout(layout),
      },
    });

    const check = checkPlanFreshness(plan, layout);

    // Hash matches but ID doesn't — should be stale
    // Note: the function checks hash first, and if hash matches it then checks ID
    expect(check.isFresh).toBe(false);
  });
});

// ============================================================================
// Tests: getEffectiveLayoutBinding
// ============================================================================

describe('getEffectiveLayoutBinding', () => {
  it('should return layoutBinding directly when present', () => {
    const binding = {
      layoutId: 'layout-001',
      layoutHash: 'abc123',
      layoutRole: 'active' as const,
    };
    const plan = makePlan({ layoutBinding: binding });

    const result = getEffectiveLayoutBinding(plan);

    expect(result).toEqual(binding);
  });

  it('should fall back to legacy metadata', () => {
    const plan = makePlan({
      metadata: {
        layoutIdUsed: 'layout-legacy',
        layoutHashUsed: 'hash-legacy',
      },
    });

    const result = getEffectiveLayoutBinding(plan);

    expect(result).not.toBeNull();
    expect(result!.layoutId).toBe('layout-legacy');
    expect(result!.layoutHash).toBe('hash-legacy');
    expect(result!.layoutRole).toBe('active'); // Default for legacy plans
  });

  it('should return null when no binding or legacy metadata', () => {
    const plan = makePlan();

    const result = getEffectiveLayoutBinding(plan);

    expect(result).toBeNull();
  });

  it('should return null when legacy metadata is incomplete (only ID)', () => {
    const plan = makePlan({
      metadata: {
        layoutIdUsed: 'layout-legacy',
        // No hash
      },
    });

    const result = getEffectiveLayoutBinding(plan);

    expect(result).toBeNull();
  });

  it('should prefer layoutBinding over legacy metadata', () => {
    const plan = makePlan({
      layoutBinding: {
        layoutId: 'layout-new',
        layoutHash: 'hash-new',
        layoutRole: 'working',
      },
      metadata: {
        layoutIdUsed: 'layout-legacy',
        layoutHashUsed: 'hash-legacy',
      },
    });

    const result = getEffectiveLayoutBinding(plan);

    expect(result!.layoutId).toBe('layout-new');
    expect(result!.layoutRole).toBe('working');
  });
});
