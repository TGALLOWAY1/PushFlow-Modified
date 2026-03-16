/**
 * Variation Applicator.
 *
 * Modifies hit masks and/or velocities based on a VariationConfig.
 * Variations take effect starting at a specified bar.
 */

import { type VariationConfig } from '../../types/patternRecipe';

export interface VariationInput {
  hitMask: boolean[];
  velocities: number[];
}

/**
 * Apply a variation transform to a hit mask and velocity array.
 * Returns new arrays (does not mutate input).
 */
export function applyVariation(
  input: VariationInput,
  variation: VariationConfig,
  stepsPerBar: number,
  barCount: number,
): VariationInput {
  if (variation.type === 'none') return input;

  const totalSteps = input.hitMask.length;
  const startBar = variation.startBar ?? Math.floor(barCount / 2);
  const startStep = startBar * stepsPerBar;

  if (startStep >= totalSteps) return input;

  const hitMask = [...input.hitMask];
  const velocities = [...input.velocities];

  switch (variation.type) {
    case 'hand_swap':
      // For sticking-based patterns, the hand swap is handled at the recipe level
      // by swapping which layers are active. At this level, we invert the hit mask
      // in the variation region (active becomes silent, silent becomes active).
      for (let i = startStep; i < totalSteps; i++) {
        hitMask[i] = !input.hitMask[i];
        velocities[i] = hitMask[i] ? (input.velocities[i] || 90) : 0;
      }
      break;

    case 'density_ramp': {
      // Progressively add hits in previously empty positions after startStep.
      const variationSteps = totalSteps - startStep;
      for (let i = startStep; i < totalSteps; i++) {
        if (input.hitMask[i]) continue; // Already active
        const progress = (i - startStep) / variationSteps;
        // Deterministic: add hit if step position is rhythmically "on" enough
        const posInBar = i % stepsPerBar;
        const beatSize = Math.max(1, Math.floor(stepsPerBar / 4));
        const isOnBeat = posInBar % beatSize === 0;
        const isOnSubdivision = posInBar % Math.max(1, Math.floor(beatSize / 2)) === 0;
        if (progress > 0.7 && isOnSubdivision) {
          hitMask[i] = true;
          velocities[i] = 70;
        } else if (progress > 0.4 && isOnBeat) {
          hitMask[i] = true;
          velocities[i] = 80;
        }
      }
      break;
    }

    case 'density_thin': {
      // Progressively remove hits after startStep.
      const variationSteps = totalSteps - startStep;
      for (let i = startStep; i < totalSteps; i++) {
        if (!input.hitMask[i]) continue;
        const progress = (i - startStep) / variationSteps;
        const posInBar = i % stepsPerBar;
        const beatSize = Math.max(1, Math.floor(stepsPerBar / 4));
        const isOnBeat = posInBar % beatSize === 0;
        // Remove off-beat hits first, then beat hits as progress increases
        if (progress > 0.3 && !isOnBeat) {
          hitMask[i] = false;
          velocities[i] = 0;
        } else if (progress > 0.7 && posInBar !== 0) {
          hitMask[i] = false;
          velocities[i] = 0;
        }
      }
      break;
    }

    case 'inversion':
      // Invert the hit mask in the variation region.
      for (let i = startStep; i < totalSteps; i++) {
        hitMask[i] = !input.hitMask[i];
        velocities[i] = hitMask[i] ? (input.velocities[i] || 80) : 0;
      }
      break;

    case 'accent_shift': {
      // Rotate accent intensity: shift velocity pattern by one beat position.
      const beatSize = Math.max(1, Math.floor(stepsPerBar / 4));
      for (let i = startStep; i < totalSteps; i++) {
        if (!hitMask[i]) continue;
        const posInBar = i % stepsPerBar;
        // Shift accent by one beat: what was on beat 1 is now on beat 2, etc.
        const shiftedPos = (posInBar + beatSize) % stepsPerBar;
        const isAccented = shiftedPos % beatSize === 0;
        if (isAccented && velocities[i] < 100) {
          velocities[i] = Math.min(127, velocities[i] + 25);
        } else if (!isAccented && velocities[i] > 60) {
          velocities[i] = Math.max(40, velocities[i] - 20);
        }
      }
      break;
    }
  }

  return { hitMask, velocities };
}
