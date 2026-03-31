/**
 * Composite Difficulty Scoring.
 *
 * Aggregates passage-level difficulty into an overall difficulty analysis.
 * Provides role-weighted scoring, difficulty classification thresholds,
 * and binding constraint identification.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section } from '../../types/performanceStructure';
import { type DifficultyAnalysis, type PassageDifficulty, type TradeoffProfile } from '../../types/candidateSolution';
import { scorePassagesFromSections, scorePassagesFixedWindow } from './passageDifficulty';
import { type Performance } from '../../types/performance';
import { type OptimizationMode } from '../../types/engineConfig';

// ============================================================================
// Difficulty Classification
// ============================================================================

export type DifficultyClass = 'Easy' | 'Moderate' | 'Hard' | 'Extreme';

export interface DifficultyClassification {
  overallClass: DifficultyClass;
  score: number;
  passageClasses: Array<{ sectionIndex: number; class: DifficultyClass; score: number }>;
}

const DIFFICULTY_THRESHOLDS = {
  easy: 0.2,
  moderate: 0.45,
  hard: 0.7,
  // >= 0.7 is Extreme
};

function classifyScore(score: number): DifficultyClass {
  if (score <= DIFFICULTY_THRESHOLDS.easy) return 'Easy';
  if (score <= DIFFICULTY_THRESHOLDS.moderate) return 'Moderate';
  if (score <= DIFFICULTY_THRESHOLDS.hard) return 'Hard';
  return 'Extreme';
}

// ============================================================================
// Composite Difficulty Analysis
// ============================================================================

/**
 * Builds a full DifficultyAnalysis from an execution plan result and sections.
 *
 * This is the primary entry point for difficulty scoring. It:
 * 1. Scores each passage using passageDifficulty
 * 2. Identifies binding constraints
 * 3. Classifies overall difficulty
 */
export function analyzeDifficulty(
  result: ExecutionPlanResult,
  sections: Section[],
): DifficultyAnalysis {
  const passageResults = sections.length > 0
    ? scorePassagesFromSections(result.fingerAssignments, sections)
    : scorePassagesFixedWindow(result.fingerAssignments, 2.0);

  const passages: PassageDifficulty[] = passageResults.map((pr, idx) => {
    const section: Section = sections[idx] ?? {
      id: `window-${idx}`,
      name: `Passage ${idx + 1}`,
      startTime: pr.startTime,
      endTime: pr.endTime,
      density: pr.density,
      densityLevel: pr.density > 6 ? 'dense' : pr.density > 3 ? 'moderate' : 'sparse',
    };

    // Build dominant factors from factorScores
    const dominantFactors = Object.entries(pr.factorScores)
      .filter(([k]) => k !== 'mixed')
      .map(([factor, score]) => ({ factor, contribution: score }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    // Find hardest transitions within the passage
    const passageAssignments = result.fingerAssignments.filter(
      a => a.startTime >= pr.startTime && a.startTime < pr.endTime
    );
    const hardestTransitions = findHardestTransitions(passageAssignments, 3);

    return {
      section,
      score: pr.difficultyScore,
      dominantFactors,
      hardestTransitions,
    };
  });

  // Overall score: weighted average emphasizing harder passages
  const overallScore = computeOverallScore(passages);

  // Identify binding constraints
  const bindingConstraints = identifyBindingConstraints(result, passages);

  return {
    overallScore,
    passages,
    bindingConstraints,
  };
}

/**
 * Classifies difficulty at both overall and passage levels.
 */
export function classifyDifficulty(
  result: ExecutionPlanResult,
  sections: Section[],
): DifficultyClassification {
  const analysis = analyzeDifficulty(result, sections);

  return {
    overallClass: classifyScore(analysis.overallScore),
    score: analysis.overallScore,
    passageClasses: analysis.passages.map((p, idx) => ({
      sectionIndex: idx,
      class: classifyScore(p.score),
      score: p.score,
    })),
  };
}

// ============================================================================
// Tradeoff Profile Computation
// ============================================================================

/**
 * Computes the TradeoffProfile for a candidate solution.
 * All scores are 0-1, higher = better.
 */
export function computeTradeoffProfile(
  result: ExecutionPlanResult,
  analysis: DifficultyAnalysis,
  structuralCoherenceOverride?: number,
): TradeoffProfile {
  const assignments = result.fingerAssignments;

  // Playability: inverse of overall difficulty
  const playability = Math.max(0, 1 - analysis.overallScore);

  // Compactness: inverse of average drift
  const compactness = Math.max(0, 1 - Math.min(result.averageDrift / 4, 1));

  // Hand balance: 1 - |leftFraction - 0.5| * 2
  let leftCount = 0, rightCount = 0;
  for (const a of assignments) {
    if (a.assignedHand === 'left') leftCount++;
    else if (a.assignedHand === 'right') rightCount++;
  }
  const total = leftCount + rightCount;
  const leftFraction = total > 0 ? leftCount / total : 0.5;
  const handBalance = Math.max(0, 1 - Math.abs(leftFraction - 0.5) * 2);

  // Transition efficiency: inverse of avg movement cost
  const avgMovement = result.averageMetrics?.transitionCost ?? 0;
  const transitionEfficiency = Math.max(0, 1 - Math.min(avgMovement / 10, 1));

  // Structural coherence: passed in from caller, or neutral default
  const structuralCoherence = structuralCoherenceOverride ?? 0.5;

  return {
    playability,
    compactness,
    handBalance,
    transitionEfficiency,
    structuralCoherence,
  };
}

// ============================================================================
// Optimization Difficulty Pre-Classification
// ============================================================================

/**
 * Classifies a performance's optimization difficulty to auto-select Fast or Deep mode.
 *
 * Uses lightweight heuristics (no solver execution required):
 * - Voice count: more unique notes → more layout combinations → harder
 * - Peak density: events per second in the densest 1s window → harder transitions
 * - Max polyphony: simultaneous events → harder hand/finger allocation
 *
 * Weighted scoring: ≥3 → deep, <3 → fast.
 */
export function classifyOptimizationDifficulty(
  performance: Performance
): OptimizationMode {
  const events = performance.events;
  if (events.length === 0) return 'fast';

  // Voice count
  const uniqueNotes = new Set(events.map(e => e.noteNumber));
  const voiceCount = uniqueNotes.size;

  // Peak density (events per second, sliding 1s window)
  const peakDensity = computePeakDensity(events);

  // Max polyphony (max simultaneous events)
  const maxPoly = computeMaxPolyphony(events);

  // Weighted score
  let score = 0;
  if (voiceCount > 8) score += 2;
  else if (voiceCount > 4) score += 1;

  if (peakDensity > 8) score += 2;
  else if (peakDensity > 4) score += 1;

  if (maxPoly > 4) score += 2;
  else if (maxPoly > 2) score += 1;

  return score >= 3 ? 'deep' : 'fast';
}

/**
 * Computes the peak event density (events per second) across the performance.
 * Uses a sliding 1-second window.
 */
function computePeakDensity(
  events: Performance['events']
): number {
  if (events.length === 0) return 0;

  const sorted = [...events].sort((a, b) => a.startTime - b.startTime);
  let maxDensity = 0;
  let windowStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    // Advance windowStart until we're within 1s of events[i]
    while (windowStart < i && sorted[i].startTime - sorted[windowStart].startTime > 1.0) {
      windowStart++;
    }
    const density = i - windowStart + 1;
    if (density > maxDensity) maxDensity = density;
  }

  return maxDensity;
}

/**
 * Computes the maximum polyphony (simultaneous events) in the performance.
 * Events starting within 10ms of each other are considered simultaneous.
 */
function computeMaxPolyphony(
  events: Performance['events']
): number {
  if (events.length === 0) return 0;

  const sorted = [...events].sort((a, b) => a.startTime - b.startTime);
  let maxPoly = 1;
  let currentPoly = 1;
  let groupStart = 0;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime - sorted[groupStart].startTime <= 0.01) {
      currentPoly++;
    } else {
      groupStart = i;
      currentPoly = 1;
    }
    if (currentPoly > maxPoly) maxPoly = currentPoly;
  }

  return maxPoly;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function computeOverallScore(passages: PassageDifficulty[]): number {
  if (passages.length === 0) return 0;

  // Weight harder passages more (square weighting)
  let weightedSum = 0;
  let weightSum = 0;
  for (const p of passages) {
    const weight = 1 + p.score; // Harder passages get more weight
    weightedSum += p.score * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

function findHardestTransitions(
  assignments: import('../../types/executionPlan').FingerAssignment[],
  topK: number
): Array<{ fromEventIndex: number; toEventIndex: number; difficulty: number; explanation: string }> {
  const transitions: Array<{ fromEventIndex: number; toEventIndex: number; difficulty: number; explanation: string }> = [];

  for (let i = 1; i < assignments.length; i++) {
    const prev = assignments[i - 1];
    const curr = assignments[i];

    // Skip simultaneous events
    if (Math.abs(curr.startTime - prev.startTime) < 0.001) continue;

    let difficulty = 0;
    const reasons: string[] = [];

    // Movement cost
    const movement = curr.costBreakdown?.transitionCost ?? 0;
    if (movement > 3) {
      difficulty += movement / 10;
      reasons.push(`large movement (${movement.toFixed(1)})`);
    }

    // Hand switch
    if (prev.assignedHand !== 'Unplayable' && curr.assignedHand !== 'Unplayable' &&
        prev.assignedHand !== curr.assignedHand) {
      difficulty += 0.15;
      reasons.push('hand switch');
    }

    // Speed pressure
    const dt = curr.startTime - prev.startTime;
    if (dt < 0.1 && dt > 0) {
      difficulty += 0.2;
      reasons.push(`fast transition (${(dt * 1000).toFixed(0)}ms)`);
    }

    // Overall cost
    if (curr.cost !== Infinity && curr.cost > 5) {
      difficulty += curr.cost / 30;
    }

    difficulty = Math.min(difficulty, 1);

    if (difficulty > 0.1) {
      transitions.push({
        fromEventIndex: prev.eventIndex ?? (i - 1),
        toEventIndex: curr.eventIndex ?? i,
        difficulty,
        explanation: reasons.length > 0 ? reasons.join(', ') : 'moderate difficulty',
      });
    }
  }

  return transitions
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, topK);
}

function identifyBindingConstraints(
  result: ExecutionPlanResult,
  passages: PassageDifficulty[]
): string[] {
  const constraints: string[] = [];

  // Unplayable events
  if (result.unplayableCount > 0) {
    constraints.push(
      `${result.unplayableCount} event(s) classified as Unplayable — layout may not cover all voices`
    );
  }

  // Hard events
  if (result.hardCount > 0) {
    const hardPct = ((result.hardCount / Math.max(result.fingerAssignments.length, 1)) * 100).toFixed(0);
    constraints.push(
      `${result.hardCount} Hard event(s) (${hardPct}% of total) — grip or stretch limit reached`
    );
  }

  // High drift
  if (result.averageDrift > 2.5) {
    constraints.push(
      `Average drift ${result.averageDrift.toFixed(1)} — hands frequently far from home positions`
    );
  }

  // Passage with extreme difficulty
  const extremePassages = passages.filter(p => p.score > 0.7);
  if (extremePassages.length > 0) {
    for (const ep of extremePassages) {
      const topFactor = ep.dominantFactors[0];
      constraints.push(
        `${ep.section.name} is extremely difficult (${(ep.score * 100).toFixed(0)}%) — ` +
        `dominant factor: ${topFactor?.factor ?? 'mixed'}`
      );
    }
  }

  return constraints;
}
