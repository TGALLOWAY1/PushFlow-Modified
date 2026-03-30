/**
 * Candidate Ranker.
 *
 * Ranks and filters candidate solutions using composite scoring
 * and Pareto filtering.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type CandidateSolution, type TradeoffProfile } from '../../types/candidateSolution';

// ============================================================================
// Composite Scoring
// ============================================================================

/** Default weights for composite ranking. */
const DEFAULT_WEIGHTS: Record<keyof TradeoffProfile, number> = {
  playability: 0.35,
  compactness: 0.15,
  handBalance: 0.15,
  transitionEfficiency: 0.20,
  structuralCoherence: 0.15,
};

/**
 * Computes a single composite score from a TradeoffProfile.
 * Higher = better.
 */
export function compositeScore(
  profile: TradeoffProfile,
  weights?: Partial<Record<keyof TradeoffProfile, number>>
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  return (
    profile.playability * w.playability +
    profile.compactness * w.compactness +
    profile.handBalance * w.handBalance +
    profile.transitionEfficiency * w.transitionEfficiency +
    profile.structuralCoherence * w.structuralCoherence
  );
}

// ============================================================================
// Ranking
// ============================================================================

/**
 * Ranks candidates by composite score (best first).
 */
export function rankCandidates(
  candidates: CandidateSolution[],
  weights?: Partial<Record<keyof TradeoffProfile, number>>
): CandidateSolution[] {
  return [...candidates].sort((a, b) => {
    const scoreA = compositeScore(a.tradeoffProfile, weights);
    const scoreB = compositeScore(b.tradeoffProfile, weights);
    return scoreB - scoreA; // Descending
  });
}

// ============================================================================
// Pareto Filtering
// ============================================================================

/**
 * Returns the Pareto-optimal front on (score, maxPassageDifficulty).
 *
 * A candidate is Pareto-optimal if no other candidate is strictly
 * better on both dimensions.
 */
export function filterPareto(candidates: CandidateSolution[]): CandidateSolution[] {
  if (candidates.length <= 1) return [...candidates];

  // Compute the two objectives for each candidate
  const scored = candidates.map(c => ({
    candidate: c,
    compositeScore: compositeScore(c.tradeoffProfile),
    maxPassageDifficulty: c.difficultyAnalysis.passages.length > 0
      ? Math.max(...c.difficultyAnalysis.passages.map(p => p.score))
      : 0,
  }));

  const paretoFront: typeof scored = [];

  for (const point of scored) {
    const dominated = scored.some(other => {
      if (other === point) return false;
      // Other dominates point if better on both (higher composite, lower difficulty)
      return (
        other.compositeScore >= point.compositeScore &&
        other.maxPassageDifficulty <= point.maxPassageDifficulty &&
        (other.compositeScore > point.compositeScore ||
          other.maxPassageDifficulty < point.maxPassageDifficulty)
      );
    });

    if (!dominated) {
      paretoFront.push(point);
    }
  }

  return paretoFront.map(p => p.candidate);
}

// ============================================================================
// Dimension Comparison
// ============================================================================

/**
 * For each dimension of the TradeoffProfile, identifies which candidate wins.
 */
export function compareDimensions(
  a: CandidateSolution,
  b: CandidateSolution
): Record<keyof TradeoffProfile, 'A' | 'B' | 'tie'> {
  const dimensions: (keyof TradeoffProfile)[] = [
    'playability', 'compactness', 'handBalance',
    'transitionEfficiency', 'structuralCoherence',
  ];

  const result: Record<string, 'A' | 'B' | 'tie'> = {};
  for (const dim of dimensions) {
    const va = a.tradeoffProfile[dim];
    const vb = b.tradeoffProfile[dim];
    if (Math.abs(va - vb) < 0.01) result[dim] = 'tie';
    else if (va > vb) result[dim] = 'A';
    else result[dim] = 'B';
  }

  return result as Record<keyof TradeoffProfile, 'A' | 'B' | 'tie'>;
}
