/**
 * Execution Plan Validation.
 *
 * Utilities for checking whether an ExecutionPlanResult is still valid
 * relative to its source layout. Enables staleness detection so the UI
 * knows when re-analysis is needed.
 *
 * Phase 2: Layout-bound execution context.
 */

import { type ExecutionPlanResult, type ExecutionPlanLayoutBinding } from '../../types/executionPlan';
import { type Layout } from '../../types/layout';
import { hashLayout } from '../mapping/mappingResolver';

/**
 * Result of an execution plan freshness check.
 */
export interface FreshnessCheck {
  /** Whether the plan is still fresh (matches the given layout). */
  isFresh: boolean;
  /** Human-readable reason if stale. */
  reason?: string;
}

/**
 * Check whether an execution plan is still fresh relative to a layout.
 *
 * A plan is stale if:
 * - It has no layoutBinding (pre-Phase-2 plan)
 * - Its layoutId doesn't match the given layout
 * - Its layoutHash doesn't match the current layout state
 *
 * This enables the UI to detect when pad assignments have changed
 * since the plan was computed, triggering re-analysis.
 */
export function checkPlanFreshness(
  plan: ExecutionPlanResult,
  layout: Layout,
): FreshnessCheck {
  const binding = plan.layoutBinding;

  if (!binding) {
    // Pre-Phase-2 plan: check legacy metadata fields
    const legacyId = plan.metadata?.layoutIdUsed;
    const legacyHash = plan.metadata?.layoutHashUsed;

    if (!legacyId && !legacyHash) {
      return { isFresh: false, reason: 'Plan has no layout binding (pre-Phase-2)' };
    }

    if (legacyHash) {
      const currentHash = hashLayout(layout);
      if (legacyHash !== currentHash) {
        return { isFresh: false, reason: 'Layout pad assignments have changed since plan was computed' };
      }
    }

    if (legacyId && legacyId !== layout.id) {
      return { isFresh: false, reason: 'Plan was computed for a different layout' };
    }

    return { isFresh: true };
  }

  // Phase 2+ plan: use layoutBinding
  if (binding.layoutId !== layout.id) {
    return { isFresh: false, reason: 'Plan was computed for a different layout' };
  }

  const currentHash = hashLayout(layout);
  if (binding.layoutHash !== currentHash) {
    return { isFresh: false, reason: 'Layout pad assignments have changed since plan was computed' };
  }

  return { isFresh: true };
}

/**
 * Extract the layout binding from an execution plan,
 * falling back to legacy metadata fields for pre-Phase-2 plans.
 */
export function getEffectiveLayoutBinding(
  plan: ExecutionPlanResult,
): ExecutionPlanLayoutBinding | null {
  if (plan.layoutBinding) return plan.layoutBinding;

  // Fall back to legacy metadata
  const id = plan.metadata?.layoutIdUsed;
  const hash = plan.metadata?.layoutHashUsed;

  if (id && hash) {
    return {
      layoutId: id,
      layoutHash: hash,
      layoutRole: 'active', // Legacy plans don't track role; assume active
    };
  }

  return null;
}
