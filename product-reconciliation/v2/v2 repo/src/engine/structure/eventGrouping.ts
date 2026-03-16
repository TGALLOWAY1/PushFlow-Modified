/**
 * Event grouping: Simultaneity detection for performance events.
 *
 * Groups events that occur at (approximately) the same time into
 * SimultaneityGroups. Events within TIME_EPSILON seconds of each
 * other are considered simultaneous.
 *
 * Extracted from the BeamSolver's internal groupEventsByTimestamp logic.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type SimultaneityGroup } from '../../types/performanceStructure';

/**
 * Events within this window (in seconds) are considered simultaneous.
 * 1ms epsilon handles floating-point timing imprecision.
 */
export const TIME_EPSILON = 0.001;

/**
 * Group performance events by timestamp into simultaneity groups.
 *
 * Events are sorted by startTime, then grouped when consecutive events
 * are within TIME_EPSILON of each other.
 *
 * @param events - Sorted array of performance events
 * @returns Array of SimultaneityGroups in chronological order
 */
export function groupEventsByTime(
  events: PerformanceEvent[]
): SimultaneityGroup[] {
  if (events.length === 0) return [];

  const groups: SimultaneityGroup[] = [];
  let currentGroup: PerformanceEvent[] = [events[0]];
  let currentTime = events[0].startTime;

  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    if (Math.abs(event.startTime - currentTime) <= TIME_EPSILON) {
      currentGroup.push(event);
    } else {
      groups.push({
        startTime: currentTime,
        events: currentGroup,
      });
      currentGroup = [event];
      currentTime = event.startTime;
    }
  }

  // Push the last group
  groups.push({
    startTime: currentTime,
    events: currentGroup,
  });

  return groups;
}

/**
 * Get the polyphony (number of simultaneous events) at each time point.
 */
export function getPolyphonyTimeline(
  groups: SimultaneityGroup[]
): Array<{ time: number; polyphony: number }> {
  return groups.map((g) => ({
    time: g.startTime,
    polyphony: g.events.length,
  }));
}

/**
 * Get the maximum polyphony across all groups.
 */
export function getMaxPolyphony(groups: SimultaneityGroup[]): number {
  if (groups.length === 0) return 0;
  return Math.max(...groups.map((g) => g.events.length));
}
