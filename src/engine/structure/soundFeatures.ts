/**
 * Sound Feature Extraction Layer.
 *
 * Computes per-sound features used by diverse seed generators.
 * Aggregates frequency, role, co-occurrence, transition, and
 * alternation data into a unified SoundFeatureMap.
 *
 * Reuses existing infrastructure:
 * - buildSoundFrequency() from greedyEvaluation
 * - inferVoiceRoles() from roleInference
 * - buildCooccurrenceMatrix() from greedyEvaluation
 * - buildTransitionGraph() from transitionGraph
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type Section, type MusicalRole } from '../../types/performanceStructure';
import { buildSoundFrequency, buildCooccurrenceMatrix } from '../optimization/greedyEvaluation';
import { inferVoiceRoles } from './roleInference';
import { buildTransitionGraph } from './transitionGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Per-sound feature vector used by seed generators.
 */
export interface SoundFeatures {
  /** Voice/sound identifier (voiceId or noteNumber string). */
  voiceId: string;
  /** Raw event count. */
  frequency: number;
  /** Composite importance: frequency + role + density contribution. */
  weightedImportance: number;
  /** Inferred musical role. */
  role: MusicalRole;
  /** Fraction of sections this voice appears in (0-1). */
  sectionCoverage: number;
  /** Top-k voices that co-occur simultaneously with this voice. */
  cooccurrenceNeighbors: string[];
  /** Top-k voices that follow/precede this voice in time. */
  transitionNeighbors: string[];
  /** Voices frequently alternating (back-and-forth) with this voice. */
  alternationPartners: string[];
  /** Voices frequently simultaneous with this voice. */
  simultaneityPartners: string[];
  /** Average MIDI velocity (expressiveness proxy). */
  averageVelocity: number;
  /** Whether this voice is classified as backbone. */
  isBackbone: boolean;
}

/** Map of voiceId → SoundFeatures. */
export type SoundFeatureMap = Map<string, SoundFeatures>;

// ============================================================================
// Constants
// ============================================================================

const TOP_K_NEIGHBORS = 5;

/** Role importance weights for computing weightedImportance. */
const ROLE_WEIGHTS: Record<MusicalRole, number> = {
  backbone: 1.0,
  lead: 0.8,
  texture: 0.6,
  fill: 0.4,
  accent: 0.3,
};

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extract sound features for all voices in a performance.
 *
 * @param events - Sorted performance events
 * @param sections - Optional detected sections for section coverage
 * @returns Map of voiceId → SoundFeatures
 */
export function extractSoundFeatures(
  events: PerformanceEvent[],
  sections?: Section[],
): SoundFeatureMap {
  if (events.length === 0) return new Map();

  const features = new Map<string, SoundFeatures>();

  // 1. Raw frequency
  const frequency = buildSoundFrequency(events);
  const maxFreq = Math.max(...frequency.values(), 1);

  // 2. Role inference
  const voiceProfiles = inferVoiceRoles(events);
  const roleMap = new Map<string, MusicalRole>();
  const velocityMap = new Map<string, number>();
  for (const profile of voiceProfiles) {
    const id = String(profile.noteNumber);
    roleMap.set(id, profile.role);
    velocityMap.set(id, profile.averageVelocity);
  }

  // 3. Co-occurrence matrix
  const cooccurrence = buildCooccurrenceMatrix(events);

  // 4. Transition graph
  const transitionGraph = buildTransitionGraph(events);

  // 5. Alternation detection (bidirectional high-frequency transitions)
  const alternationMap = buildAlternationMap(transitionGraph.edges);

  // 6. Simultaneity partners (from co-occurrence with high counts)
  // (co-occurrence already captures this)

  // 7. Section coverage
  const sectionCoverageMap = sections && sections.length > 0
    ? computeSectionCoverage(events, sections)
    : new Map<string, number>();

  // 8. Build voice ID mapping (voiceId takes precedence over noteNumber)
  const voiceIdToNote = new Map<string, number>();
  for (const event of events) {
    const id = event.voiceId ?? String(event.noteNumber);
    if (!voiceIdToNote.has(id)) {
      voiceIdToNote.set(id, event.noteNumber);
    }
  }

  // Build features for each voice
  for (const [voiceId, freq] of frequency) {
    const noteNum = voiceIdToNote.get(voiceId);
    const noteKey = noteNum !== undefined ? String(noteNum) : voiceId;

    const role = roleMap.get(noteKey) ?? roleMap.get(voiceId) ?? 'fill';
    const avgVelocity = velocityMap.get(noteKey) ?? velocityMap.get(voiceId) ?? 100;
    const sectionCov = sectionCoverageMap.get(voiceId) ?? 0;

    // Weighted importance: normalized frequency * role weight * section coverage boost
    const normalizedFreq = freq / maxFreq;
    const roleWeight = ROLE_WEIGHTS[role];
    const coverageBoost = 1 + sectionCov * 0.5; // up to 1.5x for full coverage
    const weightedImportance = normalizedFreq * roleWeight * coverageBoost;

    // Top-k co-occurrence neighbors
    const cooccNeighbors = getTopKNeighbors(cooccurrence, voiceId, TOP_K_NEIGHBORS);

    // Top-k transition neighbors (both directions)
    const transNeighbors = getTopKTransitionNeighbors(
      transitionGraph.edges, voiceId, voiceIdToNote, TOP_K_NEIGHBORS,
    );

    // Alternation partners
    const altPartners = alternationMap.get(voiceId) ?? [];

    // Simultaneity partners = co-occurrence neighbors (same data, different name for clarity)
    const simPartners = cooccNeighbors.slice();

    features.set(voiceId, {
      voiceId,
      frequency: freq,
      weightedImportance,
      role,
      sectionCoverage: sectionCov,
      cooccurrenceNeighbors: cooccNeighbors,
      transitionNeighbors: transNeighbors,
      alternationPartners: altPartners,
      simultaneityPartners: simPartners,
      averageVelocity: avgVelocity,
      isBackbone: role === 'backbone',
    });
  }

  return features;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get top-k co-occurrence neighbors for a voice.
 */
function getTopKNeighbors(
  cooccurrence: Map<string, Map<string, number>>,
  voiceId: string,
  k: number,
): string[] {
  const neighbors = cooccurrence.get(voiceId);
  if (!neighbors) return [];

  return [...neighbors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => id);
}

/**
 * Get top-k transition neighbors for a voice (both incoming and outgoing).
 */
function getTopKTransitionNeighbors(
  edges: Array<{ fromVoice: number; toVoice: number; count: number }>,
  voiceId: string,
  voiceIdToNote: Map<string, number>,
  k: number,
): string[] {
  const noteNum = voiceIdToNote.get(voiceId);
  if (noteNum === undefined) return [];

  const neighborCounts = new Map<string, number>();

  for (const edge of edges) {
    if (edge.fromVoice === noteNum) {
      const toId = findVoiceIdForNote(voiceIdToNote, edge.toVoice);
      if (toId && toId !== voiceId) {
        neighborCounts.set(toId, (neighborCounts.get(toId) ?? 0) + edge.count);
      }
    }
    if (edge.toVoice === noteNum) {
      const fromId = findVoiceIdForNote(voiceIdToNote, edge.fromVoice);
      if (fromId && fromId !== voiceId) {
        neighborCounts.set(fromId, (neighborCounts.get(fromId) ?? 0) + edge.count);
      }
    }
  }

  return [...neighborCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => id);
}

/**
 * Find voiceId for a given noteNumber (reverse lookup).
 */
function findVoiceIdForNote(
  voiceIdToNote: Map<string, number>,
  noteNumber: number,
): string | undefined {
  for (const [id, note] of voiceIdToNote) {
    if (note === noteNumber) return id;
  }
  return String(noteNumber);
}

/**
 * Build alternation map: voices that frequently alternate (A→B→A pattern).
 */
function buildAlternationMap(
  edges: Array<{ fromVoice: number; toVoice: number; count: number; averageDt: number }>,
): Map<string, string[]> {
  const alternations = new Map<string, Map<string, number>>();

  // Find bidirectional pairs with similar counts
  for (const edge of edges) {
    const fromId = String(edge.fromVoice);
    const toId = String(edge.toVoice);

    // Look for reverse edge
    const reverse = edges.find(
      e => e.fromVoice === edge.toVoice && e.toVoice === edge.fromVoice,
    );

    if (reverse && reverse.count >= edge.count * 0.3) {
      // Bidirectional transition = alternation
      const score = Math.min(edge.count, reverse.count);
      if (!alternations.has(fromId)) alternations.set(fromId, new Map());
      alternations.get(fromId)!.set(toId, score);
    }
  }

  // Convert to sorted partner lists
  const result = new Map<string, string[]>();
  for (const [voiceId, partners] of alternations) {
    result.set(
      voiceId,
      [...partners.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_K_NEIGHBORS)
        .map(([id]) => id),
    );
  }

  return result;
}

/**
 * Compute section coverage for each voice: fraction of sections the voice appears in.
 */
function computeSectionCoverage(
  events: PerformanceEvent[],
  sections: Section[],
): Map<string, number> {
  if (sections.length === 0) return new Map();

  const voiceSections = new Map<string, Set<string>>();

  for (const event of events) {
    const voiceId = event.voiceId ?? String(event.noteNumber);
    if (!voiceSections.has(voiceId)) voiceSections.set(voiceId, new Set());

    for (const section of sections) {
      if (event.startTime >= section.startTime && event.startTime <= section.endTime) {
        voiceSections.get(voiceId)!.add(section.id);
      }
    }
  }

  const coverage = new Map<string, number>();
  for (const [voiceId, sectionSet] of voiceSections) {
    coverage.set(voiceId, sectionSet.size / sections.length);
  }

  return coverage;
}

/**
 * Get voices sorted by weighted importance (highest first).
 * Convenience function for seed generators.
 */
export function rankByImportance(features: SoundFeatureMap): SoundFeatures[] {
  return [...features.values()].sort((a, b) => b.weightedImportance - a.weightedImportance);
}
