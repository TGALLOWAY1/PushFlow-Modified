/**
 * Phase 6: Execution plan validation tests.
 *
 * Validates freshness checking and
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

  it('should stay fresh when only the layout ID differs', () => {
    // Every workflow transition (promote, discard, load variant, apply generation)
    // clones the layout under a fresh id while leaving the pad map untouched. The
    // plan still describes what is on screen, so it must remain fresh — treating an
    // id change as staleness is what made the promoted layout show no analysis.
    const layout = makeLayout('layout-002', { '0,0': v1 });
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

  it('should return stale when the ID differs AND the pads differ', () => {
    const original = makeLayout('layout-001', { '0,0': v1 });
    const layout = makeLayout('layout-002', { '4,6': v1 });
    const plan = makePlan({
      layoutBinding: {
        layoutId: 'layout-001',
        layoutHash: hashLayout(original),
        layoutRole: 'active',
      },
    });

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('changed');
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

  it('should return stale for a plan with no binding', () => {
    const layout = makeLayout('layout-001', { '0,0': v1 });
    const plan = makePlan(); // no layoutBinding, no metadata

    const check = checkPlanFreshness(plan, layout);

    expect(check.isFresh).toBe(false);
    expect(check.reason).toContain('no layout binding');
  });

  it('does not trust a pre-binding plan, even when its old metadata matches', () => {
    const layout = makeLayout('layout-001', { '0,0': v1 });
    const plan = {
      ...makePlan(),
      metadata: { layoutIdUsed: layout.id, layoutHashUsed: hashLayout(layout) },
    } as unknown as ExecutionPlanResult;
    expect(checkPlanFreshness(plan, layout).isFresh).toBe(false);
  });
});
