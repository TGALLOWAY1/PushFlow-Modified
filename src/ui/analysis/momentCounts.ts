/**
 * One meaning for "event" (T23, decision Q7): an event is everything struck at
 * one instant (a moment), and single hits are notes. A plan's own counts mix
 * the two (beam plans count notes, greedy plans count moments), so every
 * displayed Easy/Medium/Hard/Unplayable count comes from here instead, through
 * the shared groupIntoMoments, and is the same for both solvers.
 */

import { groupIntoMoments, summarizeMomentCost } from '@/engine';
import { type FingerAssignment } from '../../types/executionPlan';

export interface MomentDifficultyCounts {
  /** Events (moments). */
  events: number;
  /** Notes (single hits). */
  notes: number;
  easy: number;
  medium: number;
  hard: number;
  /** Events with at least one note that can't be played. */
  unplayable: number;
  /** Notes that can't be played. */
  unplayableNotes: number;
}

export function momentDifficultyCounts(assignments: readonly FingerAssignment[] | undefined): MomentDifficultyCounts {
  const counts: MomentDifficultyCounts = { events: 0, notes: 0, easy: 0, medium: 0, hard: 0, unplayable: 0, unplayableNotes: 0 };
  if (!assignments) return counts;
  for (const moment of groupIntoMoments(assignments)) {
    const summary = summarizeMomentCost(moment.items);
    counts.events++;
    counts.notes += summary.noteCount;
    counts.unplayableNotes += summary.unplayableNoteCount;
    switch (summary.difficulty) {
      case 'Unplayable': counts.unplayable++; break;
      case 'Hard': counts.hard++; break;
      case 'Medium': counts.medium++; break;
      default: counts.easy++;
    }
  }
  return counts;
}
