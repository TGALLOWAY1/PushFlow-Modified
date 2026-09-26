/**
 * Shared moment grouping (roadmap P1b, T22 base).
 *
 * A moment is everything struck at one instant: all notes whose start times lie
 * within MOMENT_EPSILON of the moment's first note. This is the one grouping the
 * UI uses for the Events list, the difficulty chart and the selected-event
 * inspector; later phases reuse it rather than adding their own.
 *
 * The rule matches the solvers' own grouping (beamSolver's
 * groupEventsByTimestamp, buildPerformanceMoments): a moment is anchored at its
 * first note, and a note more than `epsilon` after that anchor starts the next
 * moment. A note exactly `epsilon` after the anchor still belongs to it.
 *
 * Both solvers attach the whole moment's cost to every note in it. A moment's
 * cost is therefore read once per moment (summarizeMomentCost), never summed
 * across its notes, so a chord doesn't cost more just for having more notes.
 */

import { MOMENT_EPSILON } from '../../types/performanceEvent';
import { type FingerAssignment, type DifficultyLevel } from '../../types/executionPlan';
import { type V1CostBreakdown, createZeroV1CostBreakdown } from '../../types/diagnostics';

/** Anything with a start time and, optionally, the Sound it belongs to. */
export interface MomentItem {
  startTime: number;
  voiceId?: string;
}

/** One moment: the items struck together, in time order. */
export interface Moment<T extends MomentItem> {
  /** Position in the timeline (0-based). */
  index: number;
  /** Start time of the moment's first item, in seconds. */
  startTime: number;
  /** Stable identity: quantised time plus the sorted Sound ids (see momentKey). */
  key: string;
  items: T[];
}

/**
 * A stable identity for a moment: its start time quantised to the millisecond,
 * plus the sorted, de-duplicated Sound ids struck in it. It depends only on the
 * performance, so it is the same across re-analysis and across solvers.
 * Items without a Sound contribute '?'.
 */
export function momentKey(startTime: number, soundIds: readonly (string | undefined)[]): string {
  const ids = [...new Set(soundIds.map(id => id ?? '?'))].sort();
  return `${Math.round(startTime * 1000)}:${ids.join('+')}`;
}

/**
 * Groups items into moments. The input need not be sorted; the output is in time
 * order, and items keep their input order within a moment when times tie.
 */
export function groupIntoMoments<T extends MomentItem>(
  items: readonly T[],
  epsilon: number = MOMENT_EPSILON,
): Moment<T>[] {
  const sorted = items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => a.item.startTime - b.item.startTime || a.order - b.order)
    .map(entry => entry.item);

  const moments: Moment<T>[] = [];
  let current: T[] = [];
  let anchor = 0;

  const flush = () => {
    if (current.length === 0) return;
    moments.push({
      index: moments.length,
      startTime: anchor,
      key: momentKey(anchor, current.map(item => item.voiceId)),
      items: current,
    });
    current = [];
  };

  for (const item of sorted) {
    if (current.length > 0 && item.startTime - anchor > epsilon) flush();
    if (current.length === 0) anchor = item.startTime;
    current.push(item);
  }
  flush();

  return moments;
}

/**
 * Stamps each note of a plan with its moment's index (S4.1, T24). Every
 * solver's plan goes through this one grouping, so momentIndex means the same
 * whichever solver produced the plan. Returns new objects, in the same order.
 */
export function withMomentIndices(assignments: readonly FingerAssignment[]): FingerAssignment[] {
  const momentOf = new Map<FingerAssignment, number>();
  for (const moment of groupIntoMoments(assignments)) {
    for (const a of moment.items) momentOf.set(a, moment.index);
  }
  return assignments.map(a => ({ ...a, momentIndex: momentOf.get(a) }));
}

/** A moment's cost, read once per moment. */
export interface MomentCost {
  noteCount: number;
  /** Notes with no pad or no grip. */
  unplayableNoteCount: number;
  /**
   * The moment's own cost breakdown, from one playable note (every playable note
   * of a moment carries the same moment-level breakdown). Null when no note of
   * the moment could be played.
   */
  breakdown: V1CostBreakdown | null;
  /** breakdown.total, or Infinity when no note could be played. */
  cost: number;
  /** 'Unplayable' when any note can't be played; otherwise the worst note's level. */
  difficulty: DifficultyLevel;
}

const DIFFICULTY_ORDER: DifficultyLevel[] = ['Easy', 'Medium', 'Hard', 'Unplayable'];

function isPlayable(a: FingerAssignment): boolean {
  return a.assignedHand !== 'Unplayable' && Number.isFinite(a.cost);
}

/** Summarises one moment's notes without counting the moment's cost once per note. */
export function summarizeMomentCost(assignments: readonly FingerAssignment[]): MomentCost {
  let breakdown: V1CostBreakdown | null = null;
  let unplayableNoteCount = 0;
  let worst = 0;

  for (const a of assignments) {
    worst = Math.max(worst, DIFFICULTY_ORDER.indexOf(a.difficulty));
    if (!isPlayable(a)) {
      unplayableNoteCount++;
      continue;
    }
    const own = a.costBreakdown ?? { ...createZeroV1CostBreakdown(), transitionCost: a.cost, total: a.cost };
    // Every playable note should carry the same breakdown; keep the largest so a
    // disagreement is never hidden by picking a cheaper copy.
    if (!breakdown || own.total > breakdown.total) breakdown = own;
  }

  return {
    noteCount: assignments.length,
    unplayableNoteCount,
    breakdown,
    cost: breakdown ? breakdown.total : Infinity,
    difficulty: unplayableNoteCount > 0 ? 'Unplayable' : DIFFICULTY_ORDER[worst],
  };
}
