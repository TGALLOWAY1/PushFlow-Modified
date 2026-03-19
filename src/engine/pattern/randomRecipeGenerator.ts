/**
 * Random Recipe Generator.
 *
 * Generates deterministic random PatternRecipes from a seed.
 * Uses seeded RNG so the same seed always produces the same recipe.
 */

import {
  type PatternRecipe,
  type PatternLayer,
  type RhythmSpec,
  type AccentProfile,
  type VelocityRange,
  type VariationConfig,
  type VariationType,
  type SurfaceRole,
  type RandomRecipeConstraints,
} from '../../types/patternRecipe';
import { createSeededRng } from '../../utils/seededRng';

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a deterministic random PatternRecipe from a seed.
 *
 * @param seed        Integer seed for deterministic generation
 * @param constraints Optional constraints to narrow output
 * @returns           A complete PatternRecipe
 */
export function generateRandomRecipe(
  seed: number,
  constraints?: RandomRecipeConstraints,
): PatternRecipe {
  const rng = createSeededRng(seed);

  const minLayers = constraints?.minLayers ?? 2;
  const maxLayers = constraints?.maxLayers ?? 6;
  const layerCount = randomInt(rng, minLayers, maxLayers);

  const allowedSurfaces = constraints?.allowedSurfaces ?? PERCUSSION_POOL;
  const minDensity = constraints?.minDensity ?? 20;
  const maxDensity = constraints?.maxDensity ?? 100;

  // Pick unique surfaces
  const surfaces = pickUnique(rng, allowedSurfaces, layerCount);

  // Generate layers
  const layers: PatternLayer[] = surfaces.map((surface, i) => {
    const rhythm = generateRhythm(rng, constraints?.requireEuclidean ?? false);
    const accent = generateAccent(rng);
    const velocity = generateVelocityRange(rng);
    const density = randomInt(rng, minDensity, maxDensity);

    return {
      id: `rand_layer_${seed}_${i}`,
      surface,
      rhythm,
      accent,
      velocity,
      density,
    };
  });

  // Pick variation
  const variation = generateVariation(rng, constraints?.variation);

  return {
    id: `random_${seed}`,
    name: `Random Pattern #${seed}`,
    description: `Auto-generated pattern (seed: ${seed})`,
    layers,
    variation,
    isPreset: false,
    tags: ['random'],
  };
}

// ============================================================================
// Internals
// ============================================================================

const PERCUSSION_POOL: SurfaceRole[] = [
  'kick', 'snare', 'closed_hat', 'open_hat',
  'tom_1', 'tom_2', 'rim', 'crash',
  'clap', 'shaker', 'ride', 'floor_tom',
];

const ALL_VARIATIONS: VariationType[] = [
  'none', 'hand_swap', 'density_ramp', 'density_thin', 'inversion', 'accent_shift',
];

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickUnique<T>(rng: () => number, pool: readonly T[], count: number): T[] {
  const available = [...pool];
  const result: T[] = [];
  const n = Math.min(count, available.length);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * available.length);
    result.push(available[idx]);
    available.splice(idx, 1);
  }

  return result;
}

function generateRhythm(rng: () => number, requireEuclidean: boolean): RhythmSpec {
  if (requireEuclidean) {
    return generateEuclidean(rng);
  }

  const roll = rng();
  if (roll < 0.4) return generateEuclidean(rng);
  if (roll < 0.7) return generateInterval(rng);
  if (roll < 0.9) return generateGrid(rng);
  return generateSticking(rng);
}

function generateEuclidean(rng: () => number): RhythmSpec {
  const steps = pickOne(rng, [4, 5, 6, 7, 8, 12, 16]);
  const maxHits = Math.max(1, steps - 1);
  const hits = randomInt(rng, 1, maxHits);
  const rotation = randomInt(rng, 0, steps - 1);

  return { type: 'euclidean', hits, steps, rotation };
}

function generateInterval(rng: () => number): RhythmSpec {
  const interval = pickOne(rng, [1, 2, 3, 4, 6, 8]);
  const offset = randomInt(rng, 0, interval - 1);

  return { type: 'interval', interval, offset };
}

function generateGrid(rng: () => number): RhythmSpec {
  const length = pickOne(rng, [4, 6, 8, 12, 16]);
  const pattern: boolean[] = [];

  for (let i = 0; i < length; i++) {
    pattern.push(rng() > 0.5);
  }

  // Ensure at least one hit
  if (!pattern.some(Boolean)) {
    pattern[0] = true;
  }

  return { type: 'grid', pattern };
}

function generateSticking(rng: () => number): RhythmSpec {
  const length = pickOne(rng, [2, 4, 6, 8]);
  const pattern: ('R' | 'L')[] = [];

  for (let i = 0; i < length; i++) {
    pattern.push(rng() > 0.5 ? 'R' : 'L');
  }

  const side: 'R' | 'L' = rng() > 0.5 ? 'R' : 'L';
  return { type: 'sticking', pattern, side };
}

function generateAccent(rng: () => number): AccentProfile {
  const roll = rng();

  if (roll < 0.25) {
    return { type: 'flat' };
  }
  if (roll < 0.45) {
    return {
      type: 'downbeat',
      accentVelocity: randomInt(rng, 95, 120),
      ghostVelocity: randomInt(rng, 50, 80),
    };
  }
  if (roll < 0.6) {
    return {
      type: 'offbeat',
      accentVelocity: randomInt(rng, 90, 115),
      ghostVelocity: randomInt(rng, 50, 80),
    };
  }
  if (roll < 0.75) {
    const start = randomInt(rng, 50, 80);
    return { type: 'crescendo', startVelocity: start, endVelocity: start + randomInt(rng, 20, 50) };
  }
  if (roll < 0.9) {
    const start = randomInt(rng, 90, 120);
    return { type: 'decrescendo', startVelocity: start, endVelocity: start - randomInt(rng, 20, 50) };
  }

  // Pattern accent
  const count = randomInt(rng, 2, 6);
  const velocities: number[] = [];
  for (let i = 0; i < count; i++) {
    velocities.push(randomInt(rng, 40, 120));
  }
  return { type: 'pattern', velocities };
}

function generateVelocityRange(rng: () => number): VelocityRange {
  const min = randomInt(rng, 30, 80);
  const max = randomInt(rng, Math.max(min + 10, 80), 127);
  return { min, max };
}

function generateVariation(
  rng: () => number,
  constraint?: VariationType | 'random',
): VariationConfig {
  if (constraint && constraint !== 'random') {
    return { type: constraint };
  }

  const type = pickOne(rng, ALL_VARIATIONS);
  return { type };
}
