/**
 * Density analysis: Temporal density profiling for performance events.
 *
 * Computes event density (events per second) across the performance
 * using a sliding window approach. Identifies peak density regions
 * and sparse/dense transitions.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type DensityProfile } from '../../types/performanceStructure';

/** Default sliding window width in seconds. */
const DEFAULT_WINDOW_SIZE = 1.0;

/** Default step size between density samples in seconds. */
const DEFAULT_STEP_SIZE = 0.25;

/**
 * Compute a temporal density profile over the performance.
 *
 * Uses a sliding window to count events per second at regular intervals.
 *
 * @param events - Sorted array of performance events
 * @param windowSize - Width of the sliding window in seconds
 * @param stepSize - Step between samples in seconds
 * @returns DensityProfile with sampled density values
 */
export function computeDensityProfile(
  events: PerformanceEvent[],
  windowSize: number = DEFAULT_WINDOW_SIZE,
  stepSize: number = DEFAULT_STEP_SIZE
): DensityProfile {
  if (events.length === 0) {
    return {
      samples: [],
      averageDensity: 0,
      peakDensity: 0,
      peakTime: 0,
    };
  }

  const startTime = events[0].startTime;
  const endTime = events[events.length - 1].startTime;
  const duration = endTime - startTime;

  if (duration <= 0) {
    // All events at same time
    return {
      samples: [{ time: startTime, density: events.length }],
      averageDensity: events.length,
      peakDensity: events.length,
      peakTime: startTime,
    };
  }

  const samples: Array<{ time: number; density: number }> = [];
  let peakDensity = 0;
  let peakTime = startTime;
  let densitySum = 0;

  // Sliding window: count events within [t - window/2, t + window/2]
  const halfWindow = windowSize / 2;

  for (let t = startTime; t <= endTime + stepSize; t += stepSize) {
    const windowStart = t - halfWindow;
    const windowEnd = t + halfWindow;

    let count = 0;
    for (const event of events) {
      if (event.startTime >= windowStart && event.startTime < windowEnd) {
        count++;
      }
    }

    const density = count / windowSize;
    samples.push({ time: t, density });
    densitySum += density;

    if (density > peakDensity) {
      peakDensity = density;
      peakTime = t;
    }
  }

  return {
    samples,
    averageDensity: samples.length > 0 ? densitySum / samples.length : 0,
    peakDensity,
    peakTime,
  };
}

/**
 * Classify a density value as sparse, moderate, or dense.
 *
 * Thresholds are relative to the average density of the performance.
 */
export function classifyDensity(
  density: number,
  averageDensity: number
): 'sparse' | 'moderate' | 'dense' {
  if (averageDensity <= 0) return 'sparse';
  const ratio = density / averageDensity;
  if (ratio < 0.5) return 'sparse';
  if (ratio > 1.5) return 'dense';
  return 'moderate';
}
