/**
 * Rhythm Resolvers.
 *
 * Convert each RhythmSpec variant into a boolean hit mask of length totalSteps.
 */

import { type RhythmSpec } from '../../types/patternRecipe';

/**
 * Resolve any RhythmSpec to a boolean[] hit mask.
 */
export function resolveRhythm(
  spec: RhythmSpec,
  totalSteps: number,
  _stepsPerBar: number,
): boolean[] {
  switch (spec.type) {
    case 'euclidean':
      return resolveEuclidean(spec.hits, spec.steps, spec.rotation, totalSteps);
    case 'grid':
      return resolveGrid(spec.pattern, totalSteps);
    case 'interval':
      return resolveInterval(spec.interval, spec.offset, totalSteps);
    case 'sticking':
      return resolveSticking(spec.pattern, spec.side, totalSteps);
  }
}

// ============================================================================
// Bjorklund's Algorithm (Euclidean Rhythm)
// ============================================================================

/**
 * Bjorklund's algorithm: distribute `hits` as evenly as possible across `steps`.
 *
 * E.g., bjorklund(3, 8) → [true, false, false, true, false, false, true, false]
 *       bjorklund(5, 8) → [true, false, true, true, false, true, true, false]
 */
export function bjorklund(hits: number, steps: number): boolean[] {
  if (steps <= 0) return [];
  if (hits <= 0) return new Array(steps).fill(false);
  if (hits >= steps) return new Array(steps).fill(true);

  // Build sequences using Euclidean division
  let groups: boolean[][] = [];
  for (let i = 0; i < hits; i++) groups.push([true]);
  let remainders: boolean[][] = [];
  for (let i = 0; i < steps - hits; i++) remainders.push([false]);

  while (remainders.length > 1) {
    const newGroups: boolean[][] = [];
    const minLen = Math.min(groups.length, remainders.length);
    for (let i = 0; i < minLen; i++) {
      newGroups.push([...groups[i], ...remainders[i]]);
    }
    const leftoverGroups = groups.slice(minLen);
    const leftoverRemainders = remainders.slice(minLen);

    groups = newGroups;
    remainders = leftoverGroups.length > 0 ? leftoverGroups : leftoverRemainders;
  }

  // Flatten remaining groups + remainders
  const result: boolean[] = [];
  for (const g of groups) result.push(...g);
  for (const r of remainders) result.push(...r);
  return result;
}

/**
 * Euclidean rhythm: Bjorklund + rotation + tiling to totalSteps.
 */
function resolveEuclidean(
  hits: number,
  steps: number,
  rotation: number,
  totalSteps: number,
): boolean[] {
  const base = bjorklund(hits, steps);
  // Apply rotation (positive = shift right)
  const rot = ((rotation % steps) + steps) % steps;
  const rotated = [...base.slice(steps - rot), ...base.slice(0, steps - rot)];
  // Tile to fill totalSteps
  return tile(rotated, totalSteps);
}

/**
 * Grid rhythm: tile explicit pattern to totalSteps.
 */
function resolveGrid(pattern: boolean[], totalSteps: number): boolean[] {
  if (pattern.length === 0) return new Array(totalSteps).fill(false);
  return tile(pattern, totalSteps);
}

/**
 * Interval rhythm: place a hit every `interval` steps, starting at `offset`.
 */
function resolveInterval(interval: number, offset: number, totalSteps: number): boolean[] {
  if (interval <= 0) return new Array(totalSteps).fill(false);
  const result = new Array(totalSteps).fill(false);
  const safeOffset = ((offset % interval) + interval) % interval;
  for (let i = safeOffset; i < totalSteps; i += interval) {
    result[i] = true;
  }
  return result;
}

/**
 * Sticking rhythm: from a sticking pattern like ['R','L','R','R'],
 * produce hits only where the pattern matches `side`.
 */
function resolveSticking(
  pattern: ('R' | 'L')[],
  side: 'R' | 'L',
  totalSteps: number,
): boolean[] {
  if (pattern.length === 0) return new Array(totalSteps).fill(false);
  const result = new Array(totalSteps).fill(false);
  for (let i = 0; i < totalSteps; i++) {
    const p = pattern[i % pattern.length];
    result[i] = p === side;
  }
  return result;
}

// ============================================================================
// Helpers
// ============================================================================

/** Tile a pattern to fill exactly `length` slots. */
function tile(pattern: boolean[], length: number): boolean[] {
  const result = new Array(length).fill(false);
  for (let i = 0; i < length; i++) {
    result[i] = pattern[i % pattern.length];
  }
  return result;
}
