/**
 * Accent Applicator.
 *
 * Computes per-step velocities from a hit mask and an AccentProfile.
 */

import { type AccentProfile, type VelocityRange } from '../../types/patternRecipe';

/**
 * Apply an accent profile to a hit mask, producing a velocity array.
 * Non-hit steps get velocity 0.
 *
 * @param hitMask     Boolean array: true = hit on this step
 * @param accent      The accent profile to apply
 * @param velocity    Min/max velocity range
 * @param stepsPerBar Steps in one bar (used for beat detection)
 * @returns           Velocity per step (0 for non-hit steps)
 */
export function applyAccent(
  hitMask: boolean[],
  accent: AccentProfile,
  velocity: VelocityRange,
  stepsPerBar: number,
): number[] {
  const len = hitMask.length;
  const result = new Array(len).fill(0);
  const mid = Math.round((velocity.min + velocity.max) / 2);

  switch (accent.type) {
    case 'flat':
      for (let i = 0; i < len; i++) {
        if (hitMask[i]) result[i] = mid;
      }
      break;

    case 'downbeat': {
      const beatSize = Math.max(1, Math.floor(stepsPerBar / 4));
      for (let i = 0; i < len; i++) {
        if (!hitMask[i]) continue;
        const posInBar = i % stepsPerBar;
        result[i] = posInBar % beatSize === 0
          ? clampVelocity(accent.accentVelocity)
          : clampVelocity(accent.ghostVelocity);
      }
      break;
    }

    case 'offbeat': {
      const beatSize = Math.max(1, Math.floor(stepsPerBar / 4));
      for (let i = 0; i < len; i++) {
        if (!hitMask[i]) continue;
        const posInBar = i % stepsPerBar;
        result[i] = posInBar % beatSize !== 0
          ? clampVelocity(accent.accentVelocity)
          : clampVelocity(accent.ghostVelocity);
      }
      break;
    }

    case 'crescendo': {
      const hitIndices = hitMask.reduce<number[]>((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
      const count = hitIndices.length;
      for (let h = 0; h < count; h++) {
        const t = count > 1 ? h / (count - 1) : 1;
        result[hitIndices[h]] = clampVelocity(
          Math.round(accent.startVelocity + t * (accent.endVelocity - accent.startVelocity)),
        );
      }
      break;
    }

    case 'decrescendo': {
      const hitIndices = hitMask.reduce<number[]>((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
      const count = hitIndices.length;
      for (let h = 0; h < count; h++) {
        const t = count > 1 ? h / (count - 1) : 0;
        result[hitIndices[h]] = clampVelocity(
          Math.round(accent.startVelocity + t * (accent.endVelocity - accent.startVelocity)),
        );
      }
      break;
    }

    case 'pattern': {
      const velPattern = accent.velocities;
      if (velPattern.length === 0) {
        for (let i = 0; i < len; i++) {
          if (hitMask[i]) result[i] = mid;
        }
      } else {
        let hitCount = 0;
        for (let i = 0; i < len; i++) {
          if (!hitMask[i]) continue;
          result[i] = clampVelocity(velPattern[hitCount % velPattern.length]);
          hitCount++;
        }
      }
      break;
    }
  }

  return result;
}

function clampVelocity(v: number): number {
  return Math.max(1, Math.min(127, Math.round(v)));
}
