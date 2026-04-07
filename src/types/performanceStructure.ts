/**
 * Performance structure types.
 *
 * These types represent the rich structural analysis of a performance,
 * beyond a flat event list. This is the output of Milestone 1.
 */

import { type PerformanceEvent } from './performanceEvent';

/**
 * Section: A meaningful temporal segment of the performance.
 * E.g., intro, verse, chorus, drop, fill phrase.
 */
export interface Section {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  /** Average event density (events per second) in this section. */
  density: number;
  /** Characterization of the section's density level. */
  densityLevel: 'sparse' | 'moderate' | 'dense';
}

/**
 * DensityProfile: Temporal density analysis over the full performance.
 */
export interface DensityProfile {
  /** Density values at regular time intervals. */
  samples: Array<{ time: number; density: number }>;
  /** Overall average density (events per second). */
  averageDensity: number;
  /** Peak density value. */
  peakDensity: number;
  /** Time of peak density. */
  peakTime: number;
}

/**
 * CooccurrenceEdge: Two voices that appear together in simultaneity groups.
 */
export interface CooccurrenceEdge {
  voiceA: number; // noteNumber
  voiceB: number; // noteNumber
  count: number;  // how many times they co-occur
}

/**
 * CooccurrenceGraph: Which voices frequently play together.
 */
export interface CooccurrenceGraph {
  edges: CooccurrenceEdge[];
  /** Voices (noteNumbers) that appear in the performance. */
  voices: number[];
}

/**
 * TransitionEdge: A directed transition from one voice to another.
 */
export interface TransitionEdge {
  fromVoice: number; // noteNumber
  toVoice: number;   // noteNumber
  count: number;
  averageDt: number; // average time delta in seconds
  minDt: number;     // minimum time delta
}

/**
 * TransitionGraph: Directed graph of voice-to-voice transitions.
 */
export interface TransitionGraph {
  edges: TransitionEdge[];
  /** Most frequent transition pairs, sorted by count descending. */
  mostFrequent: TransitionEdge[];
}

/**
 * MotifPattern: A recurring sequence of voices.
 */
export interface MotifPattern {
  /** Sequence of noteNumbers forming the motif. */
  voices: number[];
  /** Number of times this motif appears. */
  occurrenceCount: number;
  /** Start times of each occurrence. */
  occurrences: number[];
}

/**
 * MusicalRole: Functional purpose of a voice in the arrangement.
 */
export type MusicalRole = 'backbone' | 'accent' | 'fill' | 'texture' | 'lead';

/**
 * VoiceProfile: Statistics and role for a single voice.
 */
export interface VoiceProfile {
  noteNumber: number;
  eventCount: number;
  /** Average events per second when this voice is active. */
  frequency: number;
  /** How regular the voice's timing is (0 = irregular, 1 = perfectly regular). */
  regularity: number;
  /** Average velocity. */
  averageVelocity: number;
  /** Inferred musical role. */
  role: MusicalRole;
}

/**
 * SimultaneityGroup: Events that occur at the same time (a "chord").
 */
export interface SimultaneityGroup {
  /** The shared start time. */
  startTime: number;
  /** Events in this group. */
  events: PerformanceEvent[];
}

/**
 * PerformanceStructure: Complete structural analysis of a performance.
 *
 * This is the primary output of the performance analyzer (Milestone 1).
 */
export interface PerformanceStructure {
  /** Original events (sorted by startTime). */
  events: PerformanceEvent[];
  /** Performance tempo in BPM. */
  tempo: number;
  /** Detected sections. */
  sections: Section[];
  /** Temporal density profile. */
  densityProfile: DensityProfile;
  /** Voice co-occurrence graph. */
  cooccurrenceGraph: CooccurrenceGraph;
  /** Voice transition graph. */
  transitionGraph: TransitionGraph;
  /** Detected motif patterns. */
  motifs: MotifPattern[];
  /** Per-voice profiles with role inference. */
  voiceProfiles: VoiceProfile[];
  /** Simultaneity groups (events at the same time). */
  simultaneityGroups: SimultaneityGroup[];
  /** Temporal clusters: groups of sounds that play in tight sequence. */
  temporalClusters?: TemporalClusterAnalysis;
}

// ============================================================================
// Temporal Clustering (pre-optimization sound grouping)
// ============================================================================

/**
 * A group of sounds that play in tight temporal proximity and should
 * be placed on spatially adjacent pads.
 */
export interface TemporalCluster {
  /** Unique cluster identifier. */
  id: string;
  /** Voice IDs in this cluster, ordered by temporal flow (first→last). */
  soundIds: string[];
  /** Overall confidence in this grouping (0-1). */
  confidence: number;
  /** How this cluster was detected. */
  reason: 'rapid-succession' | 'alternation' | 'co-occurrence' | 'merged';
  /** Metrics about the cluster's temporal tightness. */
  metrics: {
    /** Average time between consecutive sounds in the cluster (seconds). */
    avgInternalDt: number;
    /** Minimum internal time delta (seconds). */
    minInternalDt: number;
    /** Total transition count between cluster members. */
    totalTransitions: number;
  };
  /** Suggested spatial layout. */
  shapeHint: 'row' | 'column' | 'block' | 'any';
}

/**
 * Complete temporal clustering analysis for a performance.
 */
export interface TemporalClusterAnalysis {
  /** Detected temporal clusters. Ordered by confidence (highest first). */
  clusters: TemporalCluster[];
  /** Voice IDs not assigned to any cluster. */
  unclusteredVoiceIds: string[];
  /** Pairwise affinity data (useful for cost evaluation). */
  affinities: TemporalAffinity[];
}

/**
 * Pairwise temporal affinity between two sounds.
 */
export interface TemporalAffinity {
  voiceA: string;
  voiceB: string;
  affinity: number;
  transitionCount: number;
  avgTimeDelta: number;
  minTimeDelta: number;
  directionality: 'A→B' | 'B→A' | 'bidirectional';
}
