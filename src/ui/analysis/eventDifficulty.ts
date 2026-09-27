/**
 * How hard each Performance Event is under the plan on screen (S4.2, T27).
 *
 * One reading for the Events list's rows, filter chips and Prev/Next hard,
 * the docked inspector and Shift+←/→: each event's cost is read once for the
 * whole event (summarizeMomentCost, never summed per note), from the plan's
 * notes at that event (planNotesByEvent). An event the plan plays no note of
 * (none of its Sounds is placed) has no cost: it matches only "All".
 */

import { summarizeMomentCost, type MomentCost } from '@/engine';
import { type DifficultyLevel, type FingerAssignment } from '../../types/executionPlan';
import { getEventTimeline, planNotesByEvent, resolveEventKey, type EventTimeline, type TimelineEvent } from './eventTimeline';
import { getDisplayedExecutionPlan, type ProjectState } from '../state/projectState';

export type EventsFilter = 'all' | 'medium-up' | 'hard' | 'unplayable';

/** The filter chips, in order: "Medium+" takes Medium and worse; Hard and Unplayable are exact. */
export const EVENTS_FILTERS: ReadonlyArray<{ id: EventsFilter; label: string; description: string }> = [
  { id: 'all', label: 'All', description: 'Every event' },
  { id: 'medium-up', label: 'Medium+', description: 'Medium, Hard and Unplayable events' },
  { id: 'hard', label: 'Hard', description: 'Hard events' },
  { id: 'unplayable', label: 'Unplayable', description: 'Events with a note that can’t be played' },
];

const costCache = new WeakMap<readonly FingerAssignment[], { timeline: EventTimeline; costs: Map<number, MomentCost> }>();

/** Each event's cost under the plan, by event index; events the plan plays no note of are absent. */
export function eventCostsOf(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
): ReadonlyMap<number, MomentCost> {
  if (!assignments) return new Map();
  const hit = costCache.get(assignments);
  if (hit && hit.timeline === timeline) return hit.costs;
  const costs = new Map<number, MomentCost>();
  for (const [index, notes] of planNotesByEvent(timeline, assignments)) costs.set(index, summarizeMomentCost(notes));
  costCache.set(assignments, { timeline, costs });
  return costs;
}

const RANK: Record<DifficultyLevel, number> = { Easy: 0, Medium: 1, Hard: 2, Unplayable: 3 };

/** Whether an event with this cost (null: not analysed) shows under a filter. */
export function matchesFilter(cost: MomentCost | null | undefined, filter: EventsFilter): boolean {
  if (filter === 'all') return true;
  if (!cost) return false;
  switch (filter) {
    case 'medium-up': return RANK[cost.difficulty] >= RANK.Medium;
    case 'hard': return cost.difficulty === 'Hard';
    case 'unplayable': return cost.difficulty === 'Unplayable';
  }
}

/** The events a filter shows, in time order. */
export function filterEvents(
  timeline: EventTimeline,
  costs: ReadonlyMap<number, MomentCost>,
  filter: EventsFilter,
): TimelineEvent[] {
  return timeline.events.filter(event => matchesFilter(costs.get(event.index), filter));
}

/** How many events each filter shows. */
export function filterCounts(
  timeline: EventTimeline,
  costs: ReadonlyMap<number, MomentCost>,
): Record<EventsFilter, number> {
  const counts: Record<EventsFilter, number> = { 'all': 0, 'medium-up': 0, 'hard': 0, 'unplayable': 0 };
  for (const event of timeline.events) {
    for (const { id } of EVENTS_FILTERS) if (matchesFilter(costs.get(event.index), id)) counts[id]++;
  }
  return counts;
}

/**
 * Prev/Next hard: the Hard event before or after event `from`, in time order,
 * or null at the ends (it never wraps). With nothing selected (`from` null),
 * "next" is the first Hard event and "previous" the last.
 */
export function adjacentHardEvent(
  timeline: EventTimeline,
  costs: ReadonlyMap<number, MomentCost>,
  from: number | null,
  direction: 1 | -1,
): TimelineEvent | null {
  const { events } = timeline;
  const isHard = (event: TimelineEvent) => costs.get(event.index)?.difficulty === 'Hard';
  if (direction === 1) {
    for (let i = from === null ? 0 : from + 1; i < events.length; i++) if (isHard(events[i]!)) return events[i]!;
  } else {
    for (let i = from === null ? events.length - 1 : from - 1; i >= 0; i--) if (isHard(events[i]!)) return events[i]!;
  }
  return null;
}

/** Prev/Next hard for the plan on screen and the selected event, and where the selection sits among the Hard events. */
export interface HardEventSteps {
  previous: TimelineEvent | null;
  next: TimelineEvent | null;
  /** How many Hard events there are. */
  total: number;
  /** The selected event's place among them (0-based), or -1 when it isn't Hard or nothing is selected. */
  position: number;
}

export function hardEventSteps(state: ProjectState): HardEventSteps {
  const timeline = getEventTimeline(state);
  const costs = eventCostsOf(timeline, getDisplayedExecutionPlan(state)?.fingerAssignments);
  const from = resolveEventKey(timeline, state.selectedMomentKey)?.index ?? null;
  const hard = timeline.events.filter(event => costs.get(event.index)?.difficulty === 'Hard');
  return {
    previous: adjacentHardEvent(timeline, costs, from, -1),
    next: adjacentHardEvent(timeline, costs, from, 1),
    total: hard.length,
    position: from === null ? -1 : hard.findIndex(event => event.index === from),
  };
}
