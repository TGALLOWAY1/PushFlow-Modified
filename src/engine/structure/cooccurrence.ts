/**
 * Co-occurrence analysis: Which voices frequently play together.
 *
 * Builds an adjacency graph where voices that appear in the same
 * simultaneity group are connected with weighted edges.
 */

import { type SimultaneityGroup, type CooccurrenceGraph, type CooccurrenceEdge } from '../../types/performanceStructure';

/**
 * Build a co-occurrence graph from simultaneity groups.
 *
 * For each group with N > 1 events, creates edges between all pairs of
 * voices (noteNumbers) in that group. Edges accumulate counts across groups.
 *
 * @param groups - Simultaneity groups from eventGrouping
 * @returns CooccurrenceGraph with weighted edges
 */
export function buildCooccurrenceGraph(
  groups: SimultaneityGroup[]
): CooccurrenceGraph {
  const edgeMap = new Map<string, CooccurrenceEdge>();
  const voiceSet = new Set<number>();

  for (const group of groups) {
    const voices = [...new Set(group.events.map((e) => e.noteNumber))];
    for (const v of voices) voiceSet.add(v);

    // Create edges between all pairs in this group
    for (let i = 0; i < voices.length; i++) {
      for (let j = i + 1; j < voices.length; j++) {
        const a = Math.min(voices[i], voices[j]);
        const b = Math.max(voices[i], voices[j]);
        const key = `${a}:${b}`;

        const existing = edgeMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          edgeMap.set(key, { voiceA: a, voiceB: b, count: 1 });
        }
      }
    }
  }

  const edges = [...edgeMap.values()].sort((a, b) => b.count - a.count);
  const voices = [...voiceSet].sort((a, b) => a - b);

  return { edges, voices };
}
