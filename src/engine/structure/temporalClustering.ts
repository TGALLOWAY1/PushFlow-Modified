/**
 * Temporal Sound Clustering.
 *
 * Pre-optimization analysis that identifies groups of sounds (voices) that
 * play in tight temporal sequence and should be placed on spatially adjacent
 * pads. These clusters become topology constraints: "these N pads must form
 * a connected, playable shape."
 *
 * Algorithm:
 * 1. Build a weighted directed transition graph (voice A → voice B with timing)
 * 2. Compute temporal affinity between all voice pairs (bidirectional strength)
 * 3. Greedily merge highest-affinity pairs into clusters
 * 4. Assign shape hints based on cluster size and transition directionality
 *
 * The output feeds into the temporal seed generator, which places each cluster
 * as a connected shape on the grid before filling in remaining sounds.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import {
  type TransitionGraph,
  type TransitionEdge,
  type CooccurrenceGraph,
} from '../../types/performanceStructure';

// ============================================================================
// Types
// ============================================================================

/**
 * A pair of sounds with measured temporal affinity.
 * Higher affinity = more reason to place these pads adjacent.
 */
export interface TemporalAffinity {
  /** Voice ID of first sound. */
  voiceA: string;
  /** Voice ID of second sound. */
  voiceB: string;
  /** Combined affinity score (0+). Higher = tighter temporal relationship. */
  affinity: number;
  /** Number of transitions between these voices (both directions). */
  transitionCount: number;
  /** Average time delta between transitions (seconds). */
  avgTimeDelta: number;
  /** Minimum time delta observed (seconds). */
  minTimeDelta: number;
  /** Whether the relationship is primarily one-directional or bidirectional. */
  directionality: 'A→B' | 'B→A' | 'bidirectional';
}

/**
 * Shape hint for how a cluster should be laid out on the grid.
 * The seed generator uses this to pick from the shape catalog.
 */
export type ShapeHint = 'row' | 'column' | 'block' | 'any';

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
  shapeHint: ShapeHint;
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

// ============================================================================
// Configuration
// ============================================================================

/** Minimum affinity score to consider merging two voices. */
const MIN_AFFINITY_THRESHOLD = 1.0;

/** Maximum cluster size (beyond this, hand can't cover them). */
const MAX_CLUSTER_SIZE = 8;

/** Time delta threshold for "rapid succession" (seconds). */
const RAPID_SUCCESSION_DT = 0.15;

/** Minimum transitions to establish a meaningful relationship. */
const MIN_TRANSITION_COUNT = 2;

/** Weight for transition frequency in affinity calculation. */
const FREQ_WEIGHT = 1.0;

/** Weight for timing tightness (inverse of avgDt). */
const TIMING_WEIGHT = 2.0;

/** Weight for co-occurrence (simultaneous play). */
const COOCCURRENCE_WEIGHT = 0.5;

/** Weight bonus for bidirectional transitions (alternation). */
const ALTERNATION_BONUS = 1.5;

// ============================================================================
// Affinity computation
// ============================================================================

/**
 * Build a voice-ID-keyed transition summary from a noteNumber-keyed
 * TransitionGraph, using events to map noteNumbers to voiceIds.
 */
interface VoiceTransition {
  fromVoice: string;
  toVoice: string;
  count: number;
  avgDt: number;
  minDt: number;
}

function buildVoiceTransitions(
  events: PerformanceEvent[],
): VoiceTransition[] {
  // Build transitions directly from events using voiceId
  const edgeMap = new Map<string, {
    fromVoice: string;
    toVoice: string;
    count: number;
    dtSum: number;
    minDt: number;
  }>();

  const sorted = [...events].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const fromId = from.voiceId ?? String(from.noteNumber);
    const toId = to.voiceId ?? String(to.noteNumber);
    if (fromId === toId) continue; // Skip self-transitions

    const dt = to.startTime - from.startTime;
    const key = `${fromId}:${toId}`;

    const existing = edgeMap.get(key);
    if (existing) {
      existing.count++;
      existing.dtSum += dt;
      existing.minDt = Math.min(existing.minDt, dt);
    } else {
      edgeMap.set(key, {
        fromVoice: fromId,
        toVoice: toId,
        count: 1,
        dtSum: dt,
        minDt: dt,
      });
    }
  }

  return [...edgeMap.values()].map(e => ({
    fromVoice: e.fromVoice,
    toVoice: e.toVoice,
    count: e.count,
    avgDt: e.dtSum / e.count,
    minDt: e.minDt,
  }));
}

/**
 * Compute pairwise temporal affinity between all voice pairs.
 *
 * Affinity combines:
 * - Transition frequency (how often A→B or B→A)
 * - Timing tightness (inverse of average time delta)
 * - Co-occurrence bonus (simultaneous hits)
 * - Alternation bonus (strong bidirectional pattern)
 */
export function computeTemporalAffinities(
  events: PerformanceEvent[],
  cooccurrenceGraph?: CooccurrenceGraph,
  noteToVoiceId?: Map<number, string>,
): TemporalAffinity[] {
  const voiceTransitions = buildVoiceTransitions(events);

  // Build forward and reverse lookup
  const pairMap = new Map<string, {
    fwdCount: number; fwdDtSum: number; fwdMinDt: number;
    revCount: number; revDtSum: number; revMinDt: number;
  }>();

  for (const t of voiceTransitions) {
    // Canonical key: alphabetically first voice comes first
    const [a, b] = t.fromVoice < t.toVoice
      ? [t.fromVoice, t.toVoice]
      : [t.toVoice, t.fromVoice];
    const key = `${a}::${b}`;
    const isForward = t.fromVoice === a;

    let entry = pairMap.get(key);
    if (!entry) {
      entry = {
        fwdCount: 0, fwdDtSum: 0, fwdMinDt: Infinity,
        revCount: 0, revDtSum: 0, revMinDt: Infinity,
      };
      pairMap.set(key, entry);
    }

    if (isForward) {
      entry.fwdCount += t.count;
      entry.fwdDtSum += t.avgDt * t.count;
      entry.fwdMinDt = Math.min(entry.fwdMinDt, t.minDt);
    } else {
      entry.revCount += t.count;
      entry.revDtSum += t.avgDt * t.count;
      entry.revMinDt = Math.min(entry.revMinDt, t.minDt);
    }
  }

  // Build co-occurrence lookup (noteNumber → voiceId)
  const cooccurrenceLookup = new Map<string, number>();
  if (cooccurrenceGraph && noteToVoiceId) {
    for (const edge of cooccurrenceGraph.edges) {
      const idA = noteToVoiceId.get(edge.voiceA);
      const idB = noteToVoiceId.get(edge.voiceB);
      if (idA && idB) {
        const [a, b] = idA < idB ? [idA, idB] : [idB, idA];
        cooccurrenceLookup.set(`${a}::${b}`, edge.count);
      }
    }
  }

  const affinities: TemporalAffinity[] = [];

  for (const [key, entry] of pairMap) {
    const [voiceA, voiceB] = key.split('::');
    const totalCount = entry.fwdCount + entry.revCount;

    if (totalCount < MIN_TRANSITION_COUNT) continue;

    const totalDtSum = entry.fwdDtSum + entry.revDtSum;
    const avgDt = totalDtSum / totalCount;
    const minDt = Math.min(entry.fwdMinDt, entry.revMinDt);

    // Determine directionality
    const fwdRatio = entry.fwdCount / totalCount;
    let directionality: TemporalAffinity['directionality'];
    if (fwdRatio > 0.7) directionality = 'A→B';
    else if (fwdRatio < 0.3) directionality = 'B→A';
    else directionality = 'bidirectional';

    // Compute affinity score
    const freqScore = Math.log2(1 + totalCount) * FREQ_WEIGHT;
    const timingScore = (1 / (avgDt + 0.01)) * TIMING_WEIGHT;
    const coocCount = cooccurrenceLookup.get(key) ?? 0;
    const coocScore = Math.log2(1 + coocCount) * COOCCURRENCE_WEIGHT;
    const altBonus = directionality === 'bidirectional' ? ALTERNATION_BONUS : 0;

    const affinity = freqScore + timingScore + coocScore + altBonus;

    affinities.push({
      voiceA,
      voiceB,
      affinity,
      transitionCount: totalCount,
      avgTimeDelta: avgDt,
      minTimeDelta: minDt,
      directionality,
    });
  }

  // Sort by affinity descending
  affinities.sort((a, b) => b.affinity - a.affinity);
  return affinities;
}

// ============================================================================
// Clustering
// ============================================================================

/**
 * Detect temporal clusters from performance events.
 *
 * Uses a greedy agglomerative approach:
 * 1. Compute pairwise affinities
 * 2. Sort by affinity (highest first)
 * 3. Merge pairs into clusters, respecting MAX_CLUSTER_SIZE
 * 4. Assign shape hints based on cluster characteristics
 */
export function detectTemporalClusters(
  events: PerformanceEvent[],
  cooccurrenceGraph?: CooccurrenceGraph,
  noteToVoiceId?: Map<number, string>,
): TemporalClusterAnalysis {
  if (events.length < 2) {
    return { clusters: [], unclusteredVoiceIds: [], affinities: [] };
  }

  const affinities = computeTemporalAffinities(
    events, cooccurrenceGraph, noteToVoiceId
  );

  // Collect all voice IDs
  const allVoiceIds = new Set<string>();
  for (const e of events) {
    allVoiceIds.add(e.voiceId ?? String(e.noteNumber));
  }

  // Union-find for cluster membership
  const parent = new Map<string, string>();
  for (const id of allVoiceIds) parent.set(id, id);

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  function union(a: string, b: string): boolean {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent.set(rb, ra);
    return true;
  }

  // Track cluster sizes
  const clusterSize = new Map<string, number>();
  for (const id of allVoiceIds) clusterSize.set(id, 1);

  // Greedy merge by affinity
  const mergedPairs: TemporalAffinity[] = [];

  for (const aff of affinities) {
    if (aff.affinity < MIN_AFFINITY_THRESHOLD) break;

    const rootA = find(aff.voiceA);
    const rootB = find(aff.voiceB);
    if (rootA === rootB) continue; // Already in same cluster

    const sizeA = clusterSize.get(rootA) ?? 1;
    const sizeB = clusterSize.get(rootB) ?? 1;
    if (sizeA + sizeB > MAX_CLUSTER_SIZE) continue; // Would exceed max size

    union(aff.voiceA, aff.voiceB);
    const newRoot = find(aff.voiceA);
    clusterSize.set(newRoot, sizeA + sizeB);
    mergedPairs.push(aff);
  }

  // Collect clusters
  const clusterMembers = new Map<string, string[]>();
  for (const id of allVoiceIds) {
    const root = find(id);
    let members = clusterMembers.get(root);
    if (!members) {
      members = [];
      clusterMembers.set(root, members);
    }
    members.push(id);
  }

  // Order members within each cluster by temporal flow
  const firstOnset = new Map<string, number>();
  for (const e of events) {
    const id = e.voiceId ?? String(e.noteNumber);
    if (!firstOnset.has(id) || e.startTime < firstOnset.get(id)!) {
      firstOnset.set(id, e.startTime);
    }
  }

  // Build affinities lookup for cluster metrics
  const affinityLookup = new Map<string, TemporalAffinity>();
  for (const aff of affinities) {
    const key = `${aff.voiceA}::${aff.voiceB}`;
    affinityLookup.set(key, aff);
  }

  function getAffinity(a: string, b: string): TemporalAffinity | undefined {
    const [x, y] = a < b ? [a, b] : [b, a];
    return affinityLookup.get(`${x}::${y}`);
  }

  const clusters: TemporalCluster[] = [];
  const clusteredVoiceIds = new Set<string>();
  let clusterId = 0;

  for (const [_root, members] of clusterMembers) {
    if (members.length < 2) continue; // Singletons aren't clusters

    // Order by first onset
    members.sort((a, b) => (firstOnset.get(a) ?? 0) - (firstOnset.get(b) ?? 0));

    // Compute cluster metrics from internal affinities
    let totalDt = 0;
    let minDt = Infinity;
    let totalTransitions = 0;
    let pairCount = 0;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const aff = getAffinity(members[i], members[j]);
        if (aff) {
          totalDt += aff.avgTimeDelta * aff.transitionCount;
          totalTransitions += aff.transitionCount;
          minDt = Math.min(minDt, aff.minTimeDelta);
          pairCount++;
        }
      }
    }

    const avgInternalDt = totalTransitions > 0 ? totalDt / totalTransitions : 0;

    // Determine cluster reason
    let reason: TemporalCluster['reason'];
    if (members.length === 2) {
      const aff = getAffinity(members[0], members[1]);
      if (aff?.directionality === 'bidirectional') reason = 'alternation';
      else if (aff && aff.minTimeDelta < RAPID_SUCCESSION_DT) reason = 'rapid-succession';
      else reason = 'co-occurrence';
    } else {
      reason = 'merged';
    }

    // Confidence based on internal affinity density
    const maxPossiblePairs = (members.length * (members.length - 1)) / 2;
    const pairDensity = maxPossiblePairs > 0 ? pairCount / maxPossiblePairs : 0;
    const timingConfidence = avgInternalDt < RAPID_SUCCESSION_DT ? 1.0
      : avgInternalDt < 0.5 ? 0.7
      : 0.4;
    const confidence = Math.min(1.0, pairDensity * timingConfidence);

    // Shape hint based on cluster properties
    const shapeHint = inferShapeHint(members, affinities);

    clusters.push({
      id: `tc-${clusterId++}`,
      soundIds: members,
      confidence,
      reason,
      metrics: {
        avgInternalDt,
        minInternalDt: minDt === Infinity ? 0 : minDt,
        totalTransitions,
      },
      shapeHint,
    });

    for (const id of members) clusteredVoiceIds.add(id);
  }

  // Sort clusters by confidence
  clusters.sort((a, b) => b.confidence - a.confidence);

  const unclusteredVoiceIds = [...allVoiceIds].filter(id => !clusteredVoiceIds.has(id));

  return { clusters, unclusteredVoiceIds, affinities };
}

// ============================================================================
// Shape hint inference
// ============================================================================

/**
 * Infer the best shape hint for a cluster based on its transition patterns.
 *
 * - Strong linear sequence → 'row' (played like a scale)
 * - Strong alternation → 'column' or 'block' (two-hand patterns)
 * - Mixed → 'any' (let shape catalog pick)
 */
function inferShapeHint(
  members: string[],
  affinities: TemporalAffinity[],
): ShapeHint {
  if (members.length <= 2) return 'any';

  // Check if the cluster forms a strong linear chain
  // (each member mostly transitions to the next)
  const memberSet = new Set(members);
  let linearCount = 0;
  let totalInternalAffinities = 0;

  for (const aff of affinities) {
    if (!memberSet.has(aff.voiceA) || !memberSet.has(aff.voiceB)) continue;
    totalInternalAffinities++;

    // Check if this is a "neighbor" transition in the ordering
    const idxA = members.indexOf(aff.voiceA);
    const idxB = members.indexOf(aff.voiceB);
    if (Math.abs(idxA - idxB) === 1) linearCount++;
  }

  if (totalInternalAffinities > 0) {
    const linearRatio = linearCount / totalInternalAffinities;
    if (linearRatio > 0.6 && members.length <= 5) return 'row';
  }

  // For larger clusters or mixed patterns, prefer block
  if (members.length >= 4) return 'block';

  return 'any';
}
