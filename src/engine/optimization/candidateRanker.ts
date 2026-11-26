/**
 * Candidate Ranker.
 *
 * Composite scoring shared by the candidate generation pipelines.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type TradeoffProfile } from '../../types/candidateSolution';

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
