/**
 * Optimizer Registry.
 *
 * Simple registry mapping OptimizerMethodKey → OptimizerMethod.
 * The UI calls getOptimizer(key) instead of branching on method type.
 *
 * Each optimizer adapter/implementation registers itself at import time.
 * The registry is a singleton for the application lifecycle.
 */

import {
  type OptimizerMethod,
  type OptimizerMethodKey,
} from './optimizerInterface';

// ============================================================================
// Registry
// ============================================================================

const registry = new Map<OptimizerMethodKey, OptimizerMethod>();

/**
 * Register an optimizer method.
 * Called by each adapter/implementation at module load time.
 */
export function registerOptimizer(method: OptimizerMethod): void {
  if (registry.has(method.key)) {
    console.warn(`Optimizer "${method.key}" already registered — replacing.`);
  }
  registry.set(method.key, method);
}

/**
 * Look up an optimizer by key.
 * Throws if the key is not registered.
 */
export function getOptimizer(key: OptimizerMethodKey): OptimizerMethod {
  const method = registry.get(key);
  if (!method) {
    const available = [...registry.keys()].join(', ') || '(none)';
    throw new Error(
      `Unknown optimizer method "${key}". Available: ${available}`
    );
  }
  return method;
}

/**
 * Get all registered optimizer methods.
 * Returns entries in registration order.
 */
export function getAllOptimizers(): OptimizerMethod[] {
  return [...registry.values()];
}

/**
 * Get all registered method keys.
 */
export function getAvailableMethodKeys(): OptimizerMethodKey[] {
  return [...registry.keys()];
}

/**
 * Check if a method is registered.
 */
export function hasOptimizer(key: OptimizerMethodKey): boolean {
  return registry.has(key);
}
