/**
 * Simple ID generation utilities.
 */

/**
 * Generate a unique ID with an optional prefix.
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
