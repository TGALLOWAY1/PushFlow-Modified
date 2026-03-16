/**
 * Candidate Filter — Stage 4: Filtering and Diversity Selection
 *
 * Applies rejection thresholds from config and enforces diversity
 * by clustering/deduplicating candidates by motif family, phrase plan,
 * and rhythm signature.
 */

import {
  type PatternCandidate,
  type GeneratorConfig,
} from '../../types/patternCandidate';

// ============================================================================
// Filtering
// ============================================================================

/** Check if a candidate passes all quality thresholds. */
function passesThresholds(
  candidate: PatternCandidate,
  config: GeneratorConfig,
): boolean {
  const m = candidate.metadata;

  // Density bounds
  if (m.density < config.density_range[0] || m.density > config.density_range[1])
    return false;

  // Syncopation bounds
  if (
    m.syncopation_ratio < config.syncopation_range[0] ||
    m.syncopation_ratio > config.syncopation_range[1]
  )
    return false;

  // Independence minimum
  if (m.independence_score < config.min_independence) return false;

  // Collision pressure maximum
  if (m.collision_pressure_score > config.max_collision_pressure) return false;

  // Repetition bounds
  if (m.repetition_score < config.min_repetition) return false;
  if (m.repetition_score > config.max_repetition) return false;

  return true;
}

// ============================================================================
// Diversity
// ============================================================================

/**
 * Compute a rhythm signature string for clustering.
 * Combines motif families, phrase plan, and event density profile.
 */
function rhythmSignature(candidate: PatternCandidate): string {
  const familyKey = `${candidate.left_hand.motif_family}+${candidate.right_hand.motif_family}`;
  const planKey = candidate.phrase_plan.join(',');

  // Density per bar (quantized to nearest 0.1)
  const allEvents = [
    ...candidate.left_hand.events,
    ...candidate.right_hand.events,
  ];
  const barDensities: number[] = [];
  for (let b = 0; b < candidate.bars; b++) {
    const count = allEvents.filter((e) => e.bar === b).length;
    barDensities.push(Math.round((count / 16) * 10) / 10); // 16 = 8 slots * 2 hands
  }
  const densityKey = barDensities.join(',');

  return `${familyKey}|${planKey}|${densityKey}`;
}

/**
 * Select a diverse subset from candidates by ensuring no more than
 * a few candidates share the same rhythm signature.
 */
function selectDiverse(
  candidates: PatternCandidate[],
  targetCount: number,
): PatternCandidate[] {
  if (candidates.length <= targetCount) return candidates;

  // Group by rhythm signature
  const clusters = new Map<string, PatternCandidate[]>();
  for (const c of candidates) {
    const sig = rhythmSignature(c);
    const group = clusters.get(sig) ?? [];
    group.push(c);
    clusters.set(sig, group);
  }

  const result: PatternCandidate[] = [];
  const maxPerCluster = Math.max(1, Math.ceil(targetCount / clusters.size));

  // Round-robin through clusters
  const clusterEntries = [...clusters.values()];
  let round = 0;
  while (result.length < targetCount) {
    let added = false;
    for (const cluster of clusterEntries) {
      if (round < cluster.length && round < maxPerCluster) {
        result.push(cluster[round]);
        if (result.length >= targetCount) break;
        added = true;
      }
    }
    round++;
    if (!added) break; // No more candidates to add
  }

  return result;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Filter candidates by quality thresholds and select a diverse subset.
 *
 * @param candidates - Over-generated candidate pool
 * @param targetCount - Desired number of output candidates
 * @param config - Generator configuration with thresholds
 * @returns Filtered and diversified subset
 */
export function filterAndDiversify(
  candidates: PatternCandidate[],
  targetCount: number,
  config: GeneratorConfig,
): PatternCandidate[] {
  // Stage 1: Apply quality thresholds
  const passing = candidates.filter((c) => passesThresholds(c, config));

  // Stage 2: Select diverse subset
  return selectDiverse(passing, targetCount);
}
