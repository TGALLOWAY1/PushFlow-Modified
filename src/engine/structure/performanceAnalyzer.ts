/**
 * Performance Analyzer: Facade that converts raw events into a rich PerformanceStructure.
 *
 * This is the primary entry point for Milestone 1's structural analysis.
 * It runs all sub-analyzers and assembles the complete PerformanceStructure.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type PerformanceStructure } from '../../types/performanceStructure';
import { groupEventsByTime } from './eventGrouping';
import { computeDensityProfile } from './densityAnalysis';
import { detectSections } from './sectionDetection';
import { buildCooccurrenceGraph } from './cooccurrence';
import { buildTransitionGraph } from './transitionGraph';
import { inferVoiceRoles } from './roleInference';

/**
 * Analyze a performance and produce a complete PerformanceStructure.
 *
 * @param events - Sorted array of performance events
 * @param tempo - Performance tempo in BPM (default 120)
 * @returns Complete structural analysis
 */
export function analyzePerformance(
  events: PerformanceEvent[],
  tempo: number = 120
): PerformanceStructure {
  // 1. Group simultaneous events
  const simultaneityGroups = groupEventsByTime(events);

  // 2. Compute density profile
  const densityProfile = computeDensityProfile(events);

  // 3. Detect sections
  const sections = detectSections(events, densityProfile);

  // 4. Build co-occurrence graph
  const cooccurrenceGraph = buildCooccurrenceGraph(simultaneityGroups);

  // 5. Build transition graph
  const transitionGraph = buildTransitionGraph(events);

  // 6. Infer voice roles
  const voiceProfiles = inferVoiceRoles(events);

  // 7. Detect motifs (simplified - recurring 2-4 note patterns)
  const motifs = detectSimpleMotifs(events);

  return {
    events,
    tempo,
    sections,
    densityProfile,
    cooccurrenceGraph,
    transitionGraph,
    motifs,
    voiceProfiles,
    simultaneityGroups,
  };
}

/**
 * Simple motif detection using hash-based sliding window.
 *
 * Detects recurring sequences of 2-4 voices by hashing consecutive noteNumbers.
 */
function detectSimpleMotifs(
  events: PerformanceEvent[]
): Array<{
  voices: number[];
  occurrenceCount: number;
  occurrences: number[];
}> {
  if (events.length < 4) return [];

  const motifCounts = new Map<
    string,
    { voices: number[]; occurrences: number[] }
  >();

  // Try pattern lengths 2, 3, 4
  for (const patternLen of [2, 3, 4]) {
    for (let i = 0; i <= events.length - patternLen; i++) {
      const voices = events.slice(i, i + patternLen).map((e) => e.noteNumber);
      const key = voices.join(',');

      const existing = motifCounts.get(key);
      if (existing) {
        existing.occurrences.push(events[i].startTime);
      } else {
        motifCounts.set(key, {
          voices,
          occurrences: [events[i].startTime],
        });
      }
    }
  }

  // Only keep patterns that occur at least 3 times
  return [...motifCounts.values()]
    .filter((m) => m.occurrences.length >= 3)
    .map((m) => ({
      voices: m.voices,
      occurrenceCount: m.occurrences.length,
      occurrences: m.occurrences,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, 20); // Cap at 20 most common motifs
}
