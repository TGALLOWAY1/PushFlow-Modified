/**
 * Canonical execution-plan score.
 *
 * A single 0–100 "how playable is this layout" percentage shared by every solver
 * (beam, annealing, greedy) so their headline scores are directly comparable.
 * Every caller feeds it the canonical evaluator's counts (Playability).
 *
 * The score combines three things, all in events (everything struck at one
 * instant is one event):
 *   1. The SHARE of events that are hard. A share, not a count, so the score
 *      rates how playable the material is, not how long it is: an 8-bar loop and
 *      a whole song with the same density of strained grips score the same. As a
 *      count (−5 each) any passage with 20 hard events read 0, and every
 *      candidate for a whole song tied there.
 *   2. Unplayable events, counted one by one (−20 each): each is a note the
 *      performer cannot play as written, a must-fix however long the song is.
 *      Candidates are also ranked by their unplayable count before their score.
 *   3. An ergonomic term from the average cost per event, rising steeply at
 *      first and then ever more slowly towards its cap, which it never reaches.
 *      It keeps the score honest (a comfortable clustered layout must beat an
 *      awkward spread-out one with no hard events either), and because it never
 *      flattens, dense material still ranks: a linear term capped at 25 hit its
 *      cap from a cost of about 4 per event, so every layout of a dense drop
 *      (5–18 per event) read exactly 75.
 */

/**
 * The displayed score from which a plan reads as comfortable (the UI's
 * "Comfortable" band, higher = easier). Claims such as "low overall difficulty"
 * use this same threshold, so they can't disagree with the score beside them.
 */
export const COMFORTABLE_PLAN_SCORE = 80;

/** Points removed per percentage point of events that are hard. */
const HARD_SHARE_PENALTY_PER_PERCENT = 2;

/** Points removed per unplayable event. */
const UNPLAYABLE_EVENT_PENALTY = 20;

/** The ergonomic term approaches this many points as the cost per event grows, and never reaches it. */
const ERGONOMIC_SCORE_CAP = 50;

/** The average cost per event at which the ergonomic term removes half its cap. */
const ERGONOMIC_HALF_CAP_COST = 5;

/** The weights above, so Learn More explains the score from the numbers it uses (invariant 2). */
export const PLAN_SCORE_WEIGHTS = {
  hardEventPercent: HARD_SHARE_PENALTY_PER_PERCENT,
  unplayableEvent: UNPLAYABLE_EVENT_PENALTY,
  ergonomicCap: ERGONOMIC_SCORE_CAP,
  ergonomicHalfCapCost: ERGONOMIC_HALF_CAP_COST,
} as const;

export interface PlanScoreInput {
  /** Hard events: playable, but only with a grip beyond the strict hand-geometry limits. */
  hardCount: number;
  /** Events that can't be played. */
  unplayableCount: number;
  /** Every event scored: the whole the hard events are a share of. */
  eventCount: number;
  /**
   * Average ergonomic cost per event (transition/grip/etc.). Lower = more
   * comfortable and compact. Omit (or pass 0) when unavailable.
   */
  avgErgonomicCost?: number;
}

/** The points the ergonomic term removes at an average cost per event: cap · c / (c + half-cap cost). */
export function ergonomicPenalty(avgErgonomicCost: number): number {
  const cost = Math.max(0, avgErgonomicCost);
  return (ERGONOMIC_SCORE_CAP * cost) / (cost + ERGONOMIC_HALF_CAP_COST);
}

/**
 * Compute the canonical 0–100 execution-plan score.
 * Higher is better. Clamped to [0, 100].
 */
export function computePlanScore(input: PlanScoreInput): number {
  const { hardCount, unplayableCount, eventCount, avgErgonomicCost = 0 } = input;
  const hardShare = Math.min(1, Math.max(0, hardCount) / Math.max(1, eventCount));
  const score =
    100 -
    HARD_SHARE_PENALTY_PER_PERCENT * 100 * hardShare -
    UNPLAYABLE_EVENT_PENALTY * unplayableCount -
    ergonomicPenalty(avgErgonomicCost);
  return Math.max(0, Math.min(100, score));
}
