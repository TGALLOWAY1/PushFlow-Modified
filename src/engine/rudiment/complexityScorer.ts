/**
 * Complexity Scorer for Rudiments.
 *
 * Computes a 5-factor weighted complexity score (0-100) for a
 * generated rudiment pattern.
 */

import {
  type LoopEvent,
  type LoopCellKey,
  type LoopConfig,
  type LoopLane,
  totalSteps,
  stepDuration,
} from '../../types/loopEditor';
import {
  type RudimentComplexity,
  type ComplexityLabel,
  type RudimentFingerAssignment,
} from '../../types/rudiment';

// ============================================================================
// Weights
// ============================================================================

const WEIGHT_DENSITY = 0.30;
const WEIGHT_LANE_COUNT = 0.15;
const WEIGHT_SIMULTANEOUS = 0.20;
const WEIGHT_CROSSOVER = 0.15;
const WEIGHT_PEAK_RATE = 0.20;

// ============================================================================
// Public API
// ============================================================================

/**
 * Score the complexity of a rudiment pattern.
 *
 * Returns a RudimentComplexity with a 0-100 score and human-readable label.
 */
export function scoreComplexity(
  events: Map<LoopCellKey, LoopEvent>,
  _lanes: LoopLane[],
  config: LoopConfig,
  fingerAssignments: RudimentFingerAssignment[],
): RudimentComplexity {
  const total = totalSteps(config);
  const stepDur = stepDuration(config);
  const eventCount = events.size;

  if (eventCount === 0 || total === 0) {
    return { score: 0, density: 0, laneCount: 0, simultaneousHits: 0, peakEventsPerSecond: 0, label: 'Simple' };
  }

  // ---- Factor 1: Density (events per step, normalized) ----
  const density = eventCount / total;
  const densityNorm = Math.min(1, density); // 1.0 = every step has an event

  // ---- Factor 2: Lane count ----
  const activeLanes = new Set<string>();
  for (const event of events.values()) {
    activeLanes.add(event.laneId);
  }
  const laneCount = activeLanes.size;
  const laneNorm = Math.min(1, laneCount / 8);

  // ---- Factor 3: Simultaneous hits ----
  const stepEventCounts = new Map<number, number>();
  for (const event of events.values()) {
    stepEventCounts.set(event.stepIndex, (stepEventCounts.get(event.stepIndex) ?? 0) + 1);
  }
  let simultaneousSteps = 0;
  for (const count of stepEventCounts.values()) {
    if (count > 1) simultaneousSteps++;
  }
  const simultaneousNorm = total > 0 ? simultaneousSteps / total : 0;

  // ---- Factor 4: Hand crossover (steps where both hands active) ----
  const stepHands = new Map<number, Set<string>>();
  for (const fa of fingerAssignments) {
    let hands = stepHands.get(fa.stepIndex);
    if (!hands) {
      hands = new Set();
      stepHands.set(fa.stepIndex, hands);
    }
    hands.add(fa.hand);
  }
  let crossoverSteps = 0;
  for (const hands of stepHands.values()) {
    if (hands.size > 1) crossoverSteps++;
  }
  const crossoverNorm = total > 0 ? crossoverSteps / total : 0;

  // ---- Factor 5: Peak event rate (events per second) ----
  // Look at rolling windows of 4 steps to find the densest passage
  let peakEventsPerSecond = 0;
  const windowSize = Math.min(4, total);
  for (let start = 0; start <= total - windowSize; start++) {
    let windowEvents = 0;
    for (let s = start; s < start + windowSize; s++) {
      windowEvents += stepEventCounts.get(s) ?? 0;
    }
    const windowDur = windowSize * stepDur;
    const rate = windowDur > 0 ? windowEvents / windowDur : 0;
    peakEventsPerSecond = Math.max(peakEventsPerSecond, rate);
  }
  // Normalize: 16 events/sec is very fast for drumming
  const peakRateNorm = Math.min(1, peakEventsPerSecond / 16);

  // ---- Weighted score ----
  const rawScore =
    WEIGHT_DENSITY * densityNorm +
    WEIGHT_LANE_COUNT * laneNorm +
    WEIGHT_SIMULTANEOUS * simultaneousNorm +
    WEIGHT_CROSSOVER * crossoverNorm +
    WEIGHT_PEAK_RATE * peakRateNorm;

  const score = Math.round(rawScore * 100);
  const label = complexityLabel(score);

  return {
    score,
    density,
    laneCount,
    simultaneousHits: simultaneousSteps,
    peakEventsPerSecond: Math.round(peakEventsPerSecond * 10) / 10,
    label,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function complexityLabel(score: number): ComplexityLabel {
  if (score <= 25) return 'Simple';
  if (score <= 50) return 'Moderate';
  if (score <= 75) return 'Complex';
  return 'Advanced';
}
