/**
 * Passage-level difficulty scoring.
 *
 * Segments a performance into passages (sections or fixed-length windows)
 * and computes a difficulty score for each, identifying what makes each
 * passage hard and which factor dominates.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type Section } from '../../types/performanceStructure';
import { type FingerAssignment } from '../../types/executionPlan';

// ============================================================================
// Types
// ============================================================================

/** Dominant difficulty factor for a passage. */
export type DifficultyFactor =
  | 'transition'
  | 'stretch'
  | 'alternation'
  | 'crossover'
  | 'polyphony'
  | 'speed'
  | 'mixed';

/** Difficulty analysis for a single passage. */
export interface PassageDifficultyResult {
  /** Section or window this passage corresponds to. */
  sectionIndex: number;
  /** Time range of the passage. */
  startTime: number;
  endTime: number;
  /** Number of events in this passage. */
  eventCount: number;
  /** Overall difficulty score (0-1, higher = harder). */
  difficultyScore: number;
  /** Dominant factor contributing to difficulty. */
  dominantFactor: DifficultyFactor;
  /** Per-factor scores. */
  factorScores: Record<DifficultyFactor, number>;
  /** Events density (events per second). */
  density: number;
  /** Maximum polyphony in this passage. */
  maxPolyphony: number;
  /** Count of hard/unplayable events. */
  hardEventCount: number;
  unplayableEventCount: number;
}

// ============================================================================
// Core Scoring
// ============================================================================

/**
 * Computes passage-level difficulty from a slice of finger assignments.
 *
 * @param assignments - Finger assignments within this passage
 * @param sectionIndex - Index of the section/passage
 * @param startTime - Start time of the passage
 * @param endTime - End time of the passage
 * @returns PassageDifficultyResult with per-factor breakdown
 */
export function scorePassage(
  assignments: FingerAssignment[],
  sectionIndex: number,
  startTime: number,
  endTime: number
): PassageDifficultyResult {
  const duration = Math.max(endTime - startTime, 0.001);
  const eventCount = assignments.length;
  const density = eventCount / duration;

  // Count hard/unplayable
  let hardCount = 0;
  let unplayableCount = 0;
  for (const a of assignments) {
    if (a.difficulty === 'Hard') hardCount++;
    if (a.difficulty === 'Unplayable') unplayableCount++;
  }

  // Detect max polyphony via time grouping
  let maxPoly = 1;
  const timeEps = 0.001;
  let currentPoly = 1;
  for (let i = 1; i < assignments.length; i++) {
    if (Math.abs(assignments[i].startTime - assignments[i - 1].startTime) <= timeEps) {
      currentPoly++;
      maxPoly = Math.max(maxPoly, currentPoly);
    } else {
      currentPoly = 1;
    }
  }

  // Aggregate cost breakdowns
  let totalMovement = 0, totalStretch = 0, totalBounce = 0;
  let totalCrossover = 0, totalCost = 0;
  let withBreakdown = 0;
  for (const a of assignments) {
    if (a.costBreakdown) {
      totalMovement += a.costBreakdown.movement;
      totalStretch += a.costBreakdown.stretch;
      totalBounce += a.costBreakdown.bounce;
      totalCrossover += a.costBreakdown.crossover;
      withBreakdown++;
    }
    if (a.cost !== Infinity) totalCost += a.cost;
  }

  const n = Math.max(withBreakdown, 1);

  // Factor scores (normalized 0-1)
  const transitionScore = Math.min((totalMovement / n) / 10, 1);
  const stretchScore = Math.min((totalStretch / n) / 5, 1);
  const alternationScore = Math.min((totalBounce / n) / 3, 1);
  const crossoverScore = Math.min((totalCrossover / n) / 20, 1);
  const polyphonyScore = Math.min(maxPoly / 5, 1);
  const speedScore = Math.min(density / 10, 1);

  const factorScores: Record<DifficultyFactor, number> = {
    transition: transitionScore,
    stretch: stretchScore,
    alternation: alternationScore,
    crossover: crossoverScore,
    polyphony: polyphonyScore,
    speed: speedScore,
    mixed: 0,
  };

  // Find dominant factor
  let dominant: DifficultyFactor = 'mixed';
  let maxFactor = 0;
  for (const [factor, score] of Object.entries(factorScores)) {
    if (factor === 'mixed') continue;
    if (score > maxFactor) {
      maxFactor = score;
      dominant = factor as DifficultyFactor;
    }
  }

  // If no single factor dominates (top two are close), mark as mixed
  const scores = Object.entries(factorScores)
    .filter(([k]) => k !== 'mixed')
    .map(([, v]) => v)
    .sort((a, b) => b - a);
  if (scores.length >= 2 && scores[0] - scores[1] < 0.1 && scores[0] > 0.1) {
    dominant = 'mixed';
  }

  // Overall difficulty score (weighted combination)
  const hardRatio = (hardCount + unplayableCount * 2) / Math.max(eventCount, 1);
  const avgCost = totalCost / Math.max(eventCount, 1);
  const difficultyScore = Math.min(
    0.3 * hardRatio +
    0.2 * speedScore +
    0.15 * transitionScore +
    0.1 * stretchScore +
    0.1 * polyphonyScore +
    0.1 * Math.min(avgCost / 15, 1) +
    0.05 * crossoverScore,
    1.0
  );

  return {
    sectionIndex,
    startTime,
    endTime,
    eventCount,
    difficultyScore,
    dominantFactor: dominant,
    factorScores,
    density,
    maxPolyphony: maxPoly,
    hardEventCount: hardCount,
    unplayableEventCount: unplayableCount,
  };
}

/**
 * Scores all passages based on detected sections.
 */
export function scorePassagesFromSections(
  assignments: FingerAssignment[],
  sections: Section[]
): PassageDifficultyResult[] {
  if (sections.length === 0 && assignments.length > 0) {
    const start = assignments[0].startTime;
    const end = assignments[assignments.length - 1].startTime + 0.001;
    return [scorePassage(assignments, 0, start, end)];
  }

  return sections.map((section, idx) => {
    const sectionAssignments = assignments.filter(
      a => a.startTime >= section.startTime && a.startTime < section.endTime
    );
    return scorePassage(sectionAssignments, idx, section.startTime, section.endTime);
  });
}

/**
 * Scores passages using fixed-size time windows (e.g., 2-second windows).
 */
export function scorePassagesFixedWindow(
  assignments: FingerAssignment[],
  windowSize: number = 2.0
): PassageDifficultyResult[] {
  if (assignments.length === 0) return [];

  const start = assignments[0].startTime;
  const end = assignments[assignments.length - 1].startTime;
  const results: PassageDifficultyResult[] = [];

  let windowStart = start;
  let idx = 0;
  while (windowStart <= end) {
    const windowEnd = windowStart + windowSize;
    const windowAssignments = assignments.filter(
      a => a.startTime >= windowStart && a.startTime < windowEnd
    );
    if (windowAssignments.length > 0) {
      results.push(scorePassage(windowAssignments, idx, windowStart, windowEnd));
    }
    windowStart = windowEnd;
    idx++;
  }

  return results;
}
