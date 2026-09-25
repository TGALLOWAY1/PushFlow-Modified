/**
 * The selected moment: the whole moment containing the selected event, costed
 * once (never once per note). selectedEventIndex indexes FingerAssignment
 * .eventIndex, which is a note index in beam plans and a moment index in greedy
 * plans; resolving it to its moment gives both the same meaning here.
 */

import { groupIntoMoments, summarizeMomentCost, type Moment, type MomentCost } from '@/engine';
import { type FingerAssignment } from '../../types/executionPlan';

export interface SelectedMoment {
  moment: Moment<FingerAssignment>;
  cost: MomentCost;
}

export function findSelectedMoment(
  assignments: readonly FingerAssignment[] | null | undefined,
  selectedEventIndex: number | null,
): SelectedMoment | null {
  if (selectedEventIndex === null || !assignments) return null;
  const moment = groupIntoMoments(assignments)
    .find(m => m.items.some(a => a.eventIndex === selectedEventIndex));
  return moment ? { moment, cost: summarizeMomentCost(moment.items) } : null;
}
