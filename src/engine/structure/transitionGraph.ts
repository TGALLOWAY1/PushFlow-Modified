/**
 * Transition graph: Directed voice-to-voice transition analysis.
 *
 * Builds a directed graph where edges represent one voice following
 * another in time, weighted by frequency and timing.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type TransitionGraph, type TransitionEdge } from '../../types/performanceStructure';

/** Maximum number of "most frequent" transitions to track. */
const TOP_K = 10;

/**
 * Build a transition graph from a sorted event sequence.
 *
 * For each consecutive pair of events (by startTime), creates a
 * directed edge from the earlier voice to the later voice.
 *
 * @param events - Sorted array of performance events
 * @returns TransitionGraph with weighted directed edges
 */
export function buildTransitionGraph(events: PerformanceEvent[]): TransitionGraph {
  if (events.length < 2) {
    return { edges: [], mostFrequent: [] };
  }

  const edgeMap = new Map<string, {
    fromVoice: number;
    toVoice: number;
    count: number;
    dtSum: number;
    minDt: number;
  }>();

  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i];
    const to = events[i + 1];
    const dt = to.startTime - from.startTime;
    const key = `${from.noteNumber}:${to.noteNumber}`;

    const existing = edgeMap.get(key);
    if (existing) {
      existing.count++;
      existing.dtSum += dt;
      existing.minDt = Math.min(existing.minDt, dt);
    } else {
      edgeMap.set(key, {
        fromVoice: from.noteNumber,
        toVoice: to.noteNumber,
        count: 1,
        dtSum: dt,
        minDt: dt,
      });
    }
  }

  const edges: TransitionEdge[] = [...edgeMap.values()].map((e) => ({
    fromVoice: e.fromVoice,
    toVoice: e.toVoice,
    count: e.count,
    averageDt: e.dtSum / e.count,
    minDt: e.minDt,
  }));

  edges.sort((a, b) => b.count - a.count);

  const mostFrequent = edges.slice(0, TOP_K);

  return { edges, mostFrequent };
}
