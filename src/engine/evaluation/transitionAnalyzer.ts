/**
 * Transition Analysis Engine.
 *
 * Analyzes transitions between consecutive moments to compute
 * movement difficulty metrics: hand switches, finger changes,
 * speed pressure, and composite difficulty.
 *
 * Ported from Version1/src/engine/transitionAnalyzer.ts with canonical terminology.
 */

import { gridDistance, parsePadKey } from '../../types/padGrid';
import { type AnalyzedMoment } from './eventMetrics';

// ============================================================================
// Types
// ============================================================================

/** Metrics for a single transition between two moments. */
export interface TransitionMetrics {
  timeDeltaMs: number;
  gridDistance: number;
  handSwitch: boolean;
  fingerChange: boolean;
  speedPressure: number;
  anatomicalStretchScore: number;
  compositeDifficultyScore: number;
}

/** A transition between two consecutive analyzed moments. */
export interface Transition {
  fromIndex: number;
  toIndex: number;
  fromMoment: AnalyzedMoment;
  toMoment: AnalyzedMoment;
  metrics: TransitionMetrics;
}

// ============================================================================
// Transition Analysis
// ============================================================================

/**
 * Analyzes a single transition between two consecutive moments.
 */
export function analyzeTransition(
  fromMoment: AnalyzedMoment,
  toMoment: AnalyzedMoment
): Transition {
  const timeDeltaSeconds = toMoment.timestamp - fromMoment.timestamp;
  const timeDeltaMs = timeDeltaSeconds * 1000;

  // Grid distance: max distance between any pair of pads
  let dist = 0;
  if (fromMoment.pads.length === 0 || toMoment.pads.length === 0) {
    dist = Infinity;
  } else {
    let maxDist = 0;
    for (const fp of fromMoment.pads) {
      for (const tp of toMoment.pads) {
        const from = parsePadKey(fp);
        const to = parsePadKey(tp);
        if (from && to) maxDist = Math.max(maxDist, gridDistance(from, to));
      }
    }
    dist = maxDist;
  }

  // Hand switch detection
  const fromHands = new Set(
    fromMoment.assignments.map(a => a.assignedHand).filter((h): h is 'left' | 'right' => h !== 'Unplayable')
  );
  const toHands = new Set(
    toMoment.assignments.map(a => a.assignedHand).filter((h): h is 'left' | 'right' => h !== 'Unplayable')
  );
  const handSwitch = fromHands.size > 0 && toHands.size > 0 &&
    !Array.from(fromHands).some(h => toHands.has(h));

  // Finger change detection
  let fingerChange = false;
  for (const fa of fromMoment.assignments) {
    for (const ta of toMoment.assignments) {
      if (fa.assignedHand !== 'Unplayable' && ta.assignedHand !== 'Unplayable' &&
          fa.assignedHand === ta.assignedHand &&
          fa.finger !== null && ta.finger !== null && fa.finger !== ta.finger) {
        fingerChange = true; break;
      }
    }
    if (fingerChange) break;
  }

  // Speed pressure
  const epsilon = 1.0;
  let speedPressure = 0;
  if (timeDeltaMs > 0 && dist !== Infinity) {
    speedPressure = Math.min(Math.tanh((dist / (timeDeltaMs + epsilon)) * 10), 1.0);
  } else if (timeDeltaMs === 0 || dist === Infinity) {
    speedPressure = 1.0;
  }

  // Aggregate stretch
  const anatomicalStretchScore = Math.max(
    fromMoment.metrics.anatomicalStretchScore,
    toMoment.metrics.anatomicalStretchScore
  );

  // Composite difficulty
  let baseScore = speedPressure * 0.6 + anatomicalStretchScore * 0.3;
  const maxGridDist = Math.sqrt(128); // ~11.31
  baseScore += Math.min(dist / maxGridDist, 1.0) * 0.1;
  if (handSwitch) baseScore += 0.15;
  if (fingerChange) baseScore += 0.1;
  const compositeDifficultyScore = Math.min(Math.max(baseScore, 0), 1);

  return {
    fromIndex: -1,
    toIndex: -1,
    fromMoment,
    toMoment,
    metrics: {
      timeDeltaMs,
      gridDistance: dist === Infinity ? 999.0 : dist,
      handSwitch,
      fingerChange,
      speedPressure,
      anatomicalStretchScore,
      compositeDifficultyScore,
    },
  };
}

/**
 * Analyzes all transitions between consecutive moments.
 */
export function analyzeAllTransitions(
  moments: AnalyzedMoment[]
): Transition[] {
  if (moments.length < 2) return [];

  const transitions: Transition[] = [];
  for (let i = 0; i < moments.length - 1; i++) {
    const transition = analyzeTransition(moments[i], moments[i + 1]);
    transition.fromIndex = i;
    transition.toIndex = i + 1;
    transitions.push(transition);
  }
  return transitions;
}
