/**
 * Coherence Metrics — Stage 4: Generator-Side Quality Metrics
 *
 * Computes musical quality metrics for PatternCandidates.
 * These metrics are used by the candidate filter to accept/reject patterns
 * and ensure diverse, musically coherent output.
 */

import {
  type PatternCandidate,
  type PatternCandidateMetadata,
} from '../../types/patternCandidate';

// ============================================================================
// Individual Metrics
// ============================================================================

/**
 * Compute event density: fraction of available slots that contain events.
 * Available slots = bars * 8 (eighth-note backbone) for each hand.
 * Total available = bars * 8 * 2 (both hands).
 */
export function computeDensity(candidate: PatternCandidate): number {
  const totalSlots = candidate.bars * 8 * 2;
  if (totalSlots === 0) return 0;
  const totalEvents =
    candidate.left_hand.events.length + candidate.right_hand.events.length;
  return Math.min(1, totalEvents / totalSlots);
}

/**
 * Compute syncopation ratio: fraction of events on off-beat positions.
 * Off-beat slots are odd-numbered (1, 3, 5, 7) or any sub_offset=1.
 */
export function computeSyncopationRatio(candidate: PatternCandidate): number {
  const allEvents = [
    ...candidate.left_hand.events,
    ...candidate.right_hand.events,
  ];
  if (allEvents.length === 0) return 0;
  const offBeatCount = allEvents.filter(
    (e) => e.slot % 2 === 1 || e.sub_offset === 1,
  ).length;
  return offBeatCount / allEvents.length;
}

/**
 * Compute independence score: how different left and right streams are.
 * 0 = fully mirrored (identical slot positions), 1 = fully independent.
 */
export function computeIndependenceScore(candidate: PatternCandidate): number {
  const leftPositions = new Set(
    candidate.left_hand.events.map(
      (e) => `${e.bar}:${e.slot}:${e.sub_offset}`,
    ),
  );
  const rightPositions = new Set(
    candidate.right_hand.events.map(
      (e) => `${e.bar}:${e.slot}:${e.sub_offset}`,
    ),
  );

  if (leftPositions.size === 0 && rightPositions.size === 0) return 1;

  // Count shared positions
  let sharedCount = 0;
  for (const pos of leftPositions) {
    if (rightPositions.has(pos)) sharedCount++;
  }

  const totalUnique = new Set([...leftPositions, ...rightPositions]).size;
  if (totalUnique === 0) return 1;

  return 1 - sharedCount / totalUnique;
}

/**
 * Compute repetition score: how similar bars are to each other.
 * 1 = all bars identical, 0 = all bars completely different.
 */
export function computeRepetitionScore(candidate: PatternCandidate): number {
  if (candidate.bars <= 1) return 1;

  const allEvents = [
    ...candidate.left_hand.events,
    ...candidate.right_hand.events,
  ];

  // Build a rhythm signature per bar (set of slot:sub_offset:sound_class)
  const barSignatures: string[][] = [];
  for (let b = 0; b < candidate.bars; b++) {
    const barEvents = allEvents.filter((e) => e.bar === b);
    const sig = barEvents
      .map((e) => `${e.slot}:${e.sub_offset}:${e.sound_class}`)
      .sort();
    barSignatures.push(sig);
  }

  // Compare all pairs of bars using Jaccard similarity
  let totalSimilarity = 0;
  let pairCount = 0;
  for (let i = 0; i < barSignatures.length; i++) {
    for (let j = i + 1; j < barSignatures.length; j++) {
      totalSimilarity += jaccardSimilarity(barSignatures[i], barSignatures[j]);
      pairCount++;
    }
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

/**
 * Compute phrase coherence score: how well the pattern follows its phrase plan.
 * Checks that "return" bars are similar to the "A" bar, and "B" bars differ.
 */
export function computePhraseCoherenceScore(
  candidate: PatternCandidate,
): number {
  const plan = candidate.phrase_plan;
  if (plan.length <= 1) return 1;

  const allEvents = [
    ...candidate.left_hand.events,
    ...candidate.right_hand.events,
  ];

  const barSignatures: string[][] = [];
  for (let b = 0; b < candidate.bars; b++) {
    const barEvents = allEvents.filter((e) => e.bar === b);
    barSignatures.push(
      barEvents.map((e) => `${e.slot}:${e.sub_offset}:${e.sound_class}`).sort(),
    );
  }

  let score = 0;
  let checks = 0;

  for (let i = 1; i < plan.length; i++) {
    const label = plan[i];
    const sim = jaccardSimilarity(barSignatures[0], barSignatures[i]);

    if (
      label.includes('return') ||
      label.includes('final') ||
      label.includes('prime')
    ) {
      // Should be similar to bar 0
      score += sim > 0.3 ? 1 : sim / 0.3;
      checks++;
    } else if (label === 'B') {
      // Should differ from bar 0
      score += sim < 0.8 ? 1 : (1 - sim) / 0.2;
      checks++;
    }
  }

  return checks > 0 ? Math.min(1, score / checks) : 1;
}

/**
 * Compute collision pressure: fraction of time positions where both hands
 * have events simultaneously.
 */
export function computeCollisionPressureScore(
  candidate: PatternCandidate,
): number {
  const leftPositions = new Set(
    candidate.left_hand.events.map(
      (e) => `${e.bar}:${e.slot}:${e.sub_offset}`,
    ),
  );
  const rightPositions = new Set(
    candidate.right_hand.events.map(
      (e) => `${e.bar}:${e.slot}:${e.sub_offset}`,
    ),
  );

  if (leftPositions.size === 0 || rightPositions.size === 0) return 0;

  let collisions = 0;
  for (const pos of leftPositions) {
    if (rightPositions.has(pos)) collisions++;
  }

  const totalPositions = new Set([...leftPositions, ...rightPositions]).size;
  return totalPositions > 0 ? collisions / totalPositions : 0;
}

/**
 * Compute all metrics for a PatternCandidate.
 */
export function computeAllMetrics(
  candidate: PatternCandidate,
): PatternCandidateMetadata {
  return {
    density: computeDensity(candidate),
    syncopation_ratio: computeSyncopationRatio(candidate),
    independence_score: computeIndependenceScore(candidate),
    repetition_score: computeRepetitionScore(candidate),
    phrase_coherence_score: computePhraseCoherenceScore(candidate),
    collision_pressure_score: computeCollisionPressureScore(candidate),
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Jaccard similarity between two sorted string arrays. */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}
