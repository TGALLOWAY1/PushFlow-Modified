/**
 * Cluster Coherence Cost.
 *
 * Evaluates how well a layout respects temporal cluster adjacency constraints.
 * Sounds in the same temporal cluster should be placed on spatially adjacent pads.
 *
 * This cost is used during optimization to penalize layouts that scatter
 * temporally related sounds across the grid.
 */

import { type Layout } from '../../types/layout';
import { type TemporalClusterAnalysis, type TemporalAffinity } from '../../types/performanceStructure';
import { type PadCoord, parsePadKey } from '../../types/padGrid';
import { manhattanDistance } from '../surface/padGrid';

// ============================================================================
// Types
// ============================================================================

/** Per-cluster coherence detail. */
export interface ClusterCoherenceDetail {
  clusterId: string;
  /** Number of sounds in the cluster. */
  size: number;
  /** Average pairwise manhattan distance between cluster members. */
  avgDistance: number;
  /** Maximum pairwise distance (diameter). */
  maxDistance: number;
  /** Whether all members are connected (each adjacent to at least one other). */
  isConnected: boolean;
  /** Penalty contribution from this cluster. */
  penalty: number;
}

/** Overall cluster coherence score. */
export interface ClusterCoherenceScore {
  /** Total penalty (0 = perfectly coherent). */
  totalPenalty: number;
  /** Per-cluster breakdown. */
  details: ClusterCoherenceDetail[];
  /** Penalty from unclustered affinity violations (high-affinity pairs placed far apart). */
  affinityPenalty: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Target average distance for cluster members (1 = immediately adjacent). */
const TARGET_AVG_DISTANCE = 1.5;

/** Weight per unit of excess average distance within a cluster. */
const CLUSTER_DISTANCE_WEIGHT = 2.0;

/** Bonus penalty when a cluster is disconnected. */
const DISCONNECTION_PENALTY = 3.0;

/** Weight for high-affinity pairs not in the same cluster but placed far apart. */
const AFFINITY_DISTANCE_WEIGHT = 0.3;

/** Distance threshold beyond which high-affinity pairs incur penalty. */
const AFFINITY_DISTANCE_THRESHOLD = 2;

/** Minimum affinity to consider for affinity penalty. */
const AFFINITY_PENALTY_THRESHOLD = 3.0;

// ============================================================================
// Scoring
// ============================================================================

/**
 * Score how well a layout respects temporal cluster coherence.
 *
 * @param layout Current layout (pad→voice mapping)
 * @param clusterAnalysis Temporal cluster analysis from performance analyzer
 * @returns Coherence score with total penalty and per-cluster details
 */
export function scoreClusterCoherence(
  layout: Layout,
  clusterAnalysis: TemporalClusterAnalysis,
): ClusterCoherenceScore {
  // Build voiceId → pad position lookup
  const voiceToPad = new Map<string, PadCoord>();
  for (const [padKeyStr, voice] of Object.entries(layout.padToVoice)) {
    const coord = parsePadKey(padKeyStr);
    if (coord) {
      voiceToPad.set(voice.id, coord);
    }
  }

  const details: ClusterCoherenceDetail[] = [];

  for (const cluster of clusterAnalysis.clusters) {
    // Get pad positions for all cluster members that are placed on the grid
    const memberPads: PadCoord[] = [];
    for (const voiceId of cluster.soundIds) {
      const pad = voiceToPad.get(voiceId);
      if (pad) memberPads.push(pad);
    }

    if (memberPads.length < 2) {
      // Not enough members placed to evaluate
      details.push({
        clusterId: cluster.id,
        size: cluster.soundIds.length,
        avgDistance: 0,
        maxDistance: 0,
        isConnected: true,
        penalty: 0,
      });
      continue;
    }

    // Compute pairwise distances
    let totalDist = 0;
    let maxDist = 0;
    let pairCount = 0;

    for (let i = 0; i < memberPads.length; i++) {
      for (let j = i + 1; j < memberPads.length; j++) {
        const dist = manhattanDistance(memberPads[i], memberPads[j]);
        totalDist += dist;
        maxDist = Math.max(maxDist, dist);
        pairCount++;
      }
    }

    const avgDist = pairCount > 0 ? totalDist / pairCount : 0;

    // Check connectivity (each pad adjacent to at least one other)
    const isConnected = checkConnectivity(memberPads);

    // Compute penalty
    const excessDist = Math.max(0, avgDist - TARGET_AVG_DISTANCE);
    let penalty = excessDist * CLUSTER_DISTANCE_WEIGHT * cluster.confidence;
    if (!isConnected) penalty += DISCONNECTION_PENALTY * cluster.confidence;

    details.push({
      clusterId: cluster.id,
      size: cluster.soundIds.length,
      avgDistance: avgDist,
      maxDistance: maxDist,
      isConnected,
      penalty,
    });
  }

  // Affinity penalty: high-affinity pairs placed far apart
  let affinityPenalty = 0;
  for (const aff of clusterAnalysis.affinities) {
    if (aff.affinity < AFFINITY_PENALTY_THRESHOLD) break; // Sorted descending

    const padA = voiceToPad.get(aff.voiceA);
    const padB = voiceToPad.get(aff.voiceB);
    if (!padA || !padB) continue;

    const dist = manhattanDistance(padA, padB);
    if (dist > AFFINITY_DISTANCE_THRESHOLD) {
      const excess = dist - AFFINITY_DISTANCE_THRESHOLD;
      affinityPenalty += excess * AFFINITY_DISTANCE_WEIGHT * (aff.affinity / 10);
    }
  }

  const totalPenalty = details.reduce((s, d) => s + d.penalty, 0) + affinityPenalty;

  return { totalPenalty, details, affinityPenalty };
}

// ============================================================================
// Connectivity check
// ============================================================================

/**
 * Check if a set of pads forms a connected component.
 * Uses 8-connected adjacency (including diagonals).
 */
function checkConnectivity(pads: PadCoord[]): boolean {
  if (pads.length <= 1) return true;

  const padSet = new Set(pads.map(p => `${p.row},${p.col}`));
  const visited = new Set<string>();
  const queue: PadCoord[] = [pads[0]];
  visited.add(`${pads[0].row},${pads[0].col}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    // Check all 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const key = `${current.row + dr},${current.col + dc}`;
        if (padSet.has(key) && !visited.has(key)) {
          visited.add(key);
          queue.push({ row: current.row + dr, col: current.col + dc });
        }
      }
    }
  }

  return visited.size === pads.length;
}
