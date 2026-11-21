/**
 * Execution Plan Validation.
 *
 * Utilities for checking whether an ExecutionPlanResult is still valid
 * relative to its source layout. Enables staleness detection so the UI
 * knows when re-analysis is needed.
 *
 * Phase 2: Layout-bound execution context.
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
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
 * - It has no layoutBinding
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
    return { isFresh: false, reason: 'Plan has no layout binding' };
  }

  // The HASH decides freshness, not the id. Every workflow transition (promote,
  // discard, load variant, apply generation) clones the layout with a fresh id
  // while leaving the pad map untouched, so an id comparison reported a perfectly
  // valid plan as stale after each of those — and in the promote case the analysis
  // simply vanished from the UI. Identical pads, constraints and locks mean the
  // plan still describes what is on screen, whatever the layout object is called.
  const currentHash = hashLayout(layout);
  if (binding.layoutHash !== currentHash) {
    return { isFresh: false, reason: 'Layout pad assignments have changed since plan was computed' };
  }

  return { isFresh: true };
}
