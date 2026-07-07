/**
 * Canonical execution-plan score.
 *
 * A single 0–100 "how playable is this layout" percentage shared by every solver
 * (beam, annealing, greedy) so their headline scores are directly comparable.
 *
 * The score combines two things:
 *   1. Hard/unplayable moment counts — the dominant, discrete penalty.
 *   2. A bounded ergonomic term — average per-unit movement/grip cost.
 *
 * The ergonomic term is what keeps the score HONEST: without it, any layout with
 * zero hard/unplayable moments scored a flat 100 regardless of how scattered its
 * pads were, so a comfortable clustered layout and an awkward spread-out one looked
 * identical. The term is capped so it can never overturn the hard/unplayable signal
 * (a genuinely unplayable layout must always score worse than a merely awkward one).
 */

/** Points removed per hard moment. */
const HARD_MOMENT_PENALTY = 5;

/** Points removed per unplayable moment. */
const UNPLAYABLE_MOMENT_PENALTY = 20;

/** Points removed per unit of average ergonomic cost. */
const ERGONOMIC_SCORE_WEIGHT = 6;

/** Maximum points the ergonomic term may remove — never dominates hard/unplayable. */
const ERGONOMIC_SCORE_CAP = 25;

export interface PlanScoreInput {
  /** Number of hard (but playable) moments. */
  hardCount: number;
  /** Number of unplayable moments. */
  unplayableCount: number;
  /**
   * Average per-unit ergonomic cost (transition/grip/etc.). Lower = more
   * comfortable and compact. Omit (or pass 0) when unavailable.
   */
  avgErgonomicCost?: number;
}

/**
 * Compute the canonical 0–100 execution-plan score.
 * Higher is better. Clamped to [0, 100].
 */
export function computePlanScore(input: PlanScoreInput): number {
  const { hardCount, unplayableCount, avgErgonomicCost = 0 } = input;
  const ergonomicPenalty = Math.min(
    ERGONOMIC_SCORE_CAP,
    Math.max(0, ERGONOMIC_SCORE_WEIGHT * avgErgonomicCost),
  );
  const score =
    100 -
    HARD_MOMENT_PENALTY * hardCount -
    UNPLAYABLE_MOMENT_PENALTY * unplayableCount -
    ergonomicPenalty;
  return Math.max(0, Math.min(100, score));
}
