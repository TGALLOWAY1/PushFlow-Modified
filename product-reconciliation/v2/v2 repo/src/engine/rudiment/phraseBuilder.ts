/**
 * Phrase Builder — Stage 2: Phrase Plan Expansion
 *
 * Expands one-bar motif seeds into multi-bar phrases using phrase plans.
 * Applies bounded transforms per bar to create variation while maintaining
 * recognizable connection to the original seed.
 */

import { type PatternEvent, type GeneratorConfig } from '../../types/patternCandidate';
import { type MotifSeed } from './motifLibrary';
import {
  applyTransform,
  type TransformName,
} from './transforms';

// ============================================================================
// Phrase Plans
// ============================================================================

/** Supported phrase plan templates keyed by bar count. */
const PHRASE_PLANS: Record<number, string[][]> = {
  2: [['A', 'A_prime']],
  4: [
    ['A', 'A_prime', 'B', 'A_return'],
    ['A', 'A_prime', 'A_var', 'A_return'],
  ],
  8: [
    ['A', 'A_prime', 'A_var', 'B', 'A_return', 'A_prime2', 'B_lite', 'A_final'],
    ['A', 'A_prime', 'B', 'A_return', 'A_var', 'B_lite', 'A_prime2', 'A_final'],
  ],
};

// ============================================================================
// Transform Selection
// ============================================================================

/** Transforms suitable for "prime" (slight variation) sections. */
const PRIME_TRANSFORMS: TransformName[] = ['accentShift', 'rotate'];

/** Transforms suitable for "B" (contrasting) sections. */
const CONTRAST_TRANSFORMS: TransformName[] = [
  'mirror',
  'callResponseSwap',
  'densityLift',
  'subdivisionInsertion',
];

/** Transforms suitable for "lite" (reduced) sections. */
const LITE_TRANSFORMS: TransformName[] = ['sparseReduction', 'accentShift'];

/** Select appropriate transforms based on section label. */
function getTransformPool(sectionLabel: string): TransformName[] {
  if (sectionLabel === 'A') return []; // Original, no transforms
  if (sectionLabel.includes('return') || sectionLabel.includes('final'))
    return PRIME_TRANSFORMS; // Return to A with slight variation
  if (sectionLabel.includes('prime') || sectionLabel.includes('var'))
    return PRIME_TRANSFORMS;
  if (sectionLabel.includes('lite')) return LITE_TRANSFORMS;
  if (sectionLabel === 'B') return CONTRAST_TRANSFORMS;
  return PRIME_TRANSFORMS; // Default to slight variation
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build a multi-bar phrase from a one-bar motif seed.
 *
 * @param seed - The one-bar motif seed to expand
 * @param bars - Target bar count (2, 4, or 8)
 * @param config - Generator configuration
 * @param rng - Seeded random number generator
 * @returns Expanded events across all bars and the chosen phrase plan
 */
export function buildPhrase(
  seed: MotifSeed,
  bars: number,
  config: GeneratorConfig,
  rng: () => number,
): { events: PatternEvent[]; phrasePlan: string[] } {
  const plans = PHRASE_PLANS[bars];
  if (!plans || plans.length === 0) {
    throw new Error(`No phrase plans available for ${bars} bars`);
  }

  // Select a phrase plan
  const plan = plans[Math.floor(rng() * plans.length)];
  const allEvents: PatternEvent[] = [];

  for (let barIndex = 0; barIndex < plan.length; barIndex++) {
    const section = plan[barIndex];
    const pool = getTransformPool(section);

    // Start from the seed events
    let barEvents = seed.events.map((e) => ({ ...e, bar: barIndex }));

    if (pool.length > 0) {
      // Apply up to max_transforms_per_bar transforms
      const numTransforms = Math.min(
        Math.floor(rng() * (config.max_transforms_per_bar + 1)),
        pool.length,
      );
      // Pick transforms without replacement
      const shuffled = shuffleArray(pool, rng);
      for (let t = 0; t < numTransforms; t++) {
        barEvents = applyTransform(shuffled[t], barEvents, rng);
        // Reassign bar index (transforms don't change bar)
        barEvents = barEvents.map((e) => ({ ...e, bar: barIndex }));
      }
    }

    allEvents.push(...barEvents);
  }

  return { events: allEvents, phrasePlan: plan };
}

/** Fisher-Yates shuffle returning a new array. */
function shuffleArray<T>(arr: readonly T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
