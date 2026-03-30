/**
 * Structural Group Detection.
 *
 * Detects groups of voices that share similar rhythmic/temporal patterns.
 * Used by the optimization pipeline to reward spatially coherent layouts
 * for structurally parallel voice groups.
 *
 * Algorithm:
 * 1. Build a rhythmic signature per voice (quantized inter-onset intervals)
 * 2. Cluster voices by signature similarity
 * 3. Identify parallel group pairs (same rhythm, same cardinality)
 */

import { type PerformanceEvent } from '../../types/performanceEvent';

// ============================================================================
// Types
// ============================================================================

/**
 * A group of voices sharing similar rhythmic structure.
 */
export interface StructuralGroup {
  /** Unique group identifier. */
  id: string;
  /** Voice IDs in this group, ordered by first onset time. */
  voiceIds: string[];
  /** Quantized IOI pattern shared by group members. */
  rhythmSignature: number[];
  /** Approximate event count per voice in this group. */
  eventCount: number;
  /** Confidence in the grouping (0-1). Higher = more rhythmically similar. */
  confidence: number;
}

/**
 * A pair of groups identified as structurally parallel.
 */
export interface GroupPair {
  /** First group ID. */
  groupA: string;
  /** Second group ID. */
  groupB: string;
  /** How parallel these groups are (0-1). 1 = identical rhythm + cardinality. */
  parallelism: number;
}

/**
 * Complete structural group analysis for a performance.
 */
export interface StructuralGroupAnalysis {
  /** Detected structural groups. */
  groups: StructuralGroup[];
  /** Voice IDs not assigned to any group. */
  ungroupedVoiceIds: string[];
  /** Pairs of groups with high structural parallelism. */
  groupPairs: GroupPair[];
}

// ============================================================================
// Constants
// ============================================================================

/** Quantization resolution in beats for IOI comparison. */
const QUANTIZE_RESOLUTION = 0.25;

/** Minimum similarity (0-1) to consider two voices in the same rhythmic group. */
const SIMILARITY_THRESHOLD = 0.7;

/** Minimum voices per group. */
const MIN_GROUP_SIZE = 2;

/** Minimum events per voice to be considered for grouping. */
const MIN_EVENTS_PER_VOICE = 2;

/** Minimum parallelism score to report a group pair. */
const MIN_PARALLELISM = 0.5;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Detect structural voice groups in a performance.
 *
 * Groups voices that share similar rhythmic patterns (quantized IOI sequences).
 * Also identifies pairs of groups that are structurally parallel.
 *
 * @param events - Sorted performance events
 * @param tempo - Performance tempo in BPM (for beat quantization)
 * @returns Structural group analysis
 */
export function detectStructuralGroups(
  events: PerformanceEvent[],
  tempo: number = 120,
): StructuralGroupAnalysis {
  if (events.length === 0) {
    return { groups: [], ungroupedVoiceIds: [], groupPairs: [] };
  }

  const beatDuration = 60 / tempo;

  // 1. Collect per-voice onset times
  const voiceOnsets = collectVoiceOnsets(events);

  // 2. Build rhythmic signature per voice
  const voiceSignatures = new Map<string, number[]>();
  const voiceEventCounts = new Map<string, number>();
  const voiceFirstOnset = new Map<string, number>();

  for (const [voiceId, onsets] of voiceOnsets) {
    if (onsets.length < MIN_EVENTS_PER_VOICE) continue;

    const signature = buildRhythmicSignature(onsets, beatDuration);
    if (signature.length > 0) {
      voiceSignatures.set(voiceId, signature);
      voiceEventCounts.set(voiceId, onsets.length);
      voiceFirstOnset.set(voiceId, onsets[0]);
    }
  }

  // 3. Cluster voices by signature similarity
  const groups = clusterBySimilarity(
    voiceSignatures,
    voiceEventCounts,
    voiceFirstOnset,
  );

  // 4. Determine ungrouped voices
  const groupedVoiceIds = new Set<string>();
  for (const group of groups) {
    for (const vid of group.voiceIds) {
      groupedVoiceIds.add(vid);
    }
  }

  const allVoiceIds = new Set<string>();
  for (const event of events) {
    allVoiceIds.add(event.voiceId ?? String(event.noteNumber));
  }

  const ungroupedVoiceIds = [...allVoiceIds].filter(id => !groupedVoiceIds.has(id));

  // 5. Identify parallel group pairs
  const groupPairs = findParallelGroupPairs(groups);

  return { groups, ungroupedVoiceIds, groupPairs };
}

// ============================================================================
// Per-Voice Onset Collection
// ============================================================================

/**
 * Collect sorted onset times per voice.
 */
function collectVoiceOnsets(
  events: PerformanceEvent[],
): Map<string, number[]> {
  const onsets = new Map<string, number[]>();

  for (const event of events) {
    const voiceId = event.voiceId ?? String(event.noteNumber);
    if (!onsets.has(voiceId)) onsets.set(voiceId, []);
    onsets.get(voiceId)!.push(event.startTime);
  }

  // Sort each voice's onsets
  for (const times of onsets.values()) {
    times.sort((a, b) => a - b);
  }

  return onsets;
}

// ============================================================================
// Rhythmic Signature
// ============================================================================

/**
 * Build a quantized inter-onset interval (IOI) sequence for a voice.
 *
 * The signature captures the rhythmic pattern by quantizing IOIs to the
 * nearest beat fraction. This allows comparison across voices regardless
 * of absolute timing.
 */
export function buildRhythmicSignature(
  onsets: number[],
  beatDuration: number,
): number[] {
  if (onsets.length < 2) return [];

  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const ioi = onsets[i] - onsets[i - 1];
    // Quantize to beat fractions
    const quantized = Math.round(ioi / (beatDuration * QUANTIZE_RESOLUTION))
      * QUANTIZE_RESOLUTION;
    iois.push(Math.max(QUANTIZE_RESOLUTION, quantized)); // at least one quantum
  }

  return iois;
}

// ============================================================================
// Signature Similarity
// ============================================================================

/**
 * Compute similarity between two rhythmic signatures.
 *
 * Uses longest common subsequence (LCS) ratio as the similarity metric.
 * Two identical rhythmic patterns score 1.0 regardless of length.
 * Different-length patterns are compared by their overlapping structure.
 *
 * @returns Similarity score 0-1.
 */
export function signatureSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length === b.length && a.every((v, i) => v === b[i])) return 1.0;

  // LCS length
  const lcsLen = lcsLength(a, b);
  const maxLen = Math.max(a.length, b.length);

  return lcsLen / maxLen;
}

/**
 * LCS length using dynamic programming.
 * Values are compared with tolerance for small quantization differences.
 */
function lcsLength(a: number[], b: number[]): number {
  const m = a.length;
  const n = b.length;

  // Use 1D DP for space efficiency
  const prev = new Array<number>(n + 1).fill(0);
  const curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (Math.abs(a[i - 1] - b[j - 1]) < QUANTIZE_RESOLUTION * 0.5) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    // Copy curr to prev
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j];
      curr[j] = 0;
    }
  }

  return prev[n];
}

// ============================================================================
// Clustering
// ============================================================================

/**
 * Cluster voices by rhythmic signature similarity.
 *
 * Uses single-linkage agglomerative clustering: greedily merge
 * the most similar pair of voices/groups until no pair exceeds threshold.
 */
function clusterBySimilarity(
  signatures: Map<string, number[]>,
  eventCounts: Map<string, number>,
  firstOnsets: Map<string, number>,
): StructuralGroup[] {
  const voiceIds = [...signatures.keys()];

  if (voiceIds.length < MIN_GROUP_SIZE) return [];

  // Build pairwise similarity matrix
  const similarities = new Map<string, number>();
  for (let i = 0; i < voiceIds.length; i++) {
    for (let j = i + 1; j < voiceIds.length; j++) {
      const sigA = signatures.get(voiceIds[i])!;
      const sigB = signatures.get(voiceIds[j])!;
      const sim = signatureSimilarity(sigA, sigB);
      similarities.set(`${voiceIds[i]}|${voiceIds[j]}`, sim);
    }
  }

  // Union-Find for clustering
  const parent = new Map<string, string>();
  for (const vid of voiceIds) {
    parent.set(vid, vid);
  }

  function find(x: string): string {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!); // path compression
      x = parent.get(x)!;
    }
    return x;
  }

  function union(x: string, y: string): void {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }

  // Merge pairs above threshold
  const pairs = [...similarities.entries()]
    .filter(([, sim]) => sim >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b[1] - a[1]); // highest similarity first

  for (const [key] of pairs) {
    const [va, vb] = key.split('|');
    union(va, vb);
  }

  // Collect clusters
  const clusters = new Map<string, string[]>();
  for (const vid of voiceIds) {
    const root = find(vid);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(vid);
  }

  // Convert to StructuralGroup[]
  const groups: StructuralGroup[] = [];
  let groupIdx = 0;

  for (const members of clusters.values()) {
    if (members.length < MIN_GROUP_SIZE) continue;

    // Order by first onset time
    members.sort((a, b) => (firstOnsets.get(a) ?? 0) - (firstOnsets.get(b) ?? 0));

    // Use first member's signature as representative
    const representativeSig = signatures.get(members[0]) ?? [];

    // Compute group confidence: average pairwise similarity
    let totalSim = 0;
    let pairCount = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key1 = `${members[i]}|${members[j]}`;
        const key2 = `${members[j]}|${members[i]}`;
        totalSim += similarities.get(key1) ?? similarities.get(key2) ?? 0;
        pairCount++;
      }
    }
    const confidence = pairCount > 0 ? totalSim / pairCount : 0;

    // Average event count
    const avgEvents = members.reduce(
      (sum, vid) => sum + (eventCounts.get(vid) ?? 0), 0,
    ) / members.length;

    groups.push({
      id: `sg-${groupIdx++}`,
      voiceIds: members,
      rhythmSignature: representativeSig,
      eventCount: Math.round(avgEvents),
      confidence,
    });
  }

  // Sort groups by event count (most active first)
  groups.sort((a, b) => b.eventCount - a.eventCount);

  return groups;
}

// ============================================================================
// Parallel Group Pairs
// ============================================================================

/**
 * Identify pairs of groups with high structural parallelism.
 *
 * Two groups are parallel when they share similar rhythmic signatures
 * and similar group sizes. This captures call/response, variation families,
 * and repeated motif groups.
 */
function findParallelGroupPairs(groups: StructuralGroup[]): GroupPair[] {
  const pairs: GroupPair[] = [];

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const parallelism = computeGroupParallelism(groups[i], groups[j]);
      if (parallelism >= MIN_PARALLELISM) {
        pairs.push({
          groupA: groups[i].id,
          groupB: groups[j].id,
          parallelism,
        });
      }
    }
  }

  // Sort by parallelism descending
  pairs.sort((a, b) => b.parallelism - a.parallelism);

  return pairs;
}

/**
 * Compute parallelism between two groups.
 *
 * Components:
 * - Rhythm similarity (weight 0.6): LCS-based signature comparison
 * - Size similarity (weight 0.4): penalize very different group sizes
 */
function computeGroupParallelism(a: StructuralGroup, b: StructuralGroup): number {
  const rhythmSim = signatureSimilarity(a.rhythmSignature, b.rhythmSignature);

  const maxSize = Math.max(a.voiceIds.length, b.voiceIds.length);
  const minSize = Math.min(a.voiceIds.length, b.voiceIds.length);
  const sizeSim = maxSize > 0 ? minSize / maxSize : 0;

  return rhythmSim * 0.6 + sizeSim * 0.4;
}
