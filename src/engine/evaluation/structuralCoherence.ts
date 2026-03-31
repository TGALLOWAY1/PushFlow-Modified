/**
 * Structural Coherence Scoring.
 *
 * Scores how well a layout preserves structural relationships between
 * temporally parallel voice groups. Rewards:
 * - Within-group compactness (members close together)
 * - Within-group order preservation (spatial order matches temporal order)
 * - Between-group shape parallelism (parallel groups have analogous shapes)
 *
 * This is a static layout property — it does not depend on finger
 * assignment or execution plan, only on pad placement.
 */

import { type Layout } from '../../types/layout';
import {
  type StructuralGroupAnalysis,
  type StructuralGroup,
} from '../structure/structuralGroupDetection';

// ============================================================================
// Types
// ============================================================================

/**
 * Per-group coherence breakdown.
 */
export interface GroupCoherenceDetail {
  groupId: string;
  compactness: number;
  orderPreservation: number;
}

/**
 * Per-pair parallelism breakdown.
 */
export interface PairParallelismDetail {
  groupAId: string;
  groupBId: string;
  shapeParallelism: number;
}

/**
 * Complete structural coherence score for a layout.
 */
export interface StructuralCoherenceScore {
  /** Composite score (0-1, higher = better). */
  overall: number;
  /** Average within-group compactness (0-1). */
  withinGroupCompactness: number;
  /** Average within-group order preservation (0-1). */
  withinGroupOrder: number;
  /** Average between-group shape parallelism (0-1). */
  betweenGroupParallelism: number;
  /** Per-group detail. */
  perGroupScores: GroupCoherenceDetail[];
  /** Per-pair detail. */
  perPairScores: PairParallelismDetail[];
}

// ============================================================================
// Weights
// ============================================================================

const WEIGHT_COMPACTNESS = 0.3;
const WEIGHT_ORDER = 0.3;
const WEIGHT_PARALLELISM = 0.4;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Score how well a layout preserves structural group coherence.
 *
 * @param layout - The layout to score
 * @param groupAnalysis - Structural group analysis from detectStructuralGroups()
 * @returns Coherence score breakdown
 */
export function scoreStructuralCoherence(
  layout: Layout,
  groupAnalysis: StructuralGroupAnalysis,
): StructuralCoherenceScore {
  if (groupAnalysis.groups.length === 0) {
    return {
      overall: 0.5, // neutral when no groups detected
      withinGroupCompactness: 0.5,
      withinGroupOrder: 0.5,
      betweenGroupParallelism: 0.5,
      perGroupScores: [],
      perPairScores: [],
    };
  }

  // Build voice → pad position lookup
  const voiceToPad = buildVoiceToPadMap(layout);

  // Score each group
  const perGroupScores: GroupCoherenceDetail[] = [];
  let totalCompactness = 0;
  let totalOrder = 0;
  let scoredGroupCount = 0;

  for (const group of groupAnalysis.groups) {
    const positions = resolveGroupPositions(group, voiceToPad);
    if (positions.length < 2) continue;

    const compactness = scoreCompactness(positions);
    const orderPreservation = scoreOrderPreservation(group.voiceIds, voiceToPad);

    perGroupScores.push({
      groupId: group.id,
      compactness,
      orderPreservation,
    });

    totalCompactness += compactness;
    totalOrder += orderPreservation;
    scoredGroupCount++;
  }

  const avgCompactness = scoredGroupCount > 0 ? totalCompactness / scoredGroupCount : 0.5;
  const avgOrder = scoredGroupCount > 0 ? totalOrder / scoredGroupCount : 0.5;

  // Score group pairs
  const perPairScores: PairParallelismDetail[] = [];
  let totalParallelism = 0;
  let scoredPairCount = 0;

  for (const pair of groupAnalysis.groupPairs) {
    const groupA = groupAnalysis.groups.find(g => g.id === pair.groupA);
    const groupB = groupAnalysis.groups.find(g => g.id === pair.groupB);
    if (!groupA || !groupB) continue;

    const posA = resolveGroupPositions(groupA, voiceToPad);
    const posB = resolveGroupPositions(groupB, voiceToPad);
    if (posA.length < 2 || posB.length < 2) continue;

    const shapeParallelism = scoreShapeParallelism(posA, posB);

    perPairScores.push({
      groupAId: pair.groupA,
      groupBId: pair.groupB,
      shapeParallelism,
    });

    totalParallelism += shapeParallelism;
    scoredPairCount++;
  }

  const avgParallelism = scoredPairCount > 0 ? totalParallelism / scoredPairCount : 0.5;

  // Composite score
  const overall =
    avgCompactness * WEIGHT_COMPACTNESS +
    avgOrder * WEIGHT_ORDER +
    avgParallelism * WEIGHT_PARALLELISM;

  return {
    overall,
    withinGroupCompactness: avgCompactness,
    withinGroupOrder: avgOrder,
    betweenGroupParallelism: avgParallelism,
    perGroupScores,
    perPairScores,
  };
}

// ============================================================================
// Voice → Pad Resolution
// ============================================================================

interface PadPosition {
  row: number;
  col: number;
}

/**
 * Build a map from voiceId to pad position from the layout.
 */
function buildVoiceToPadMap(layout: Layout): Map<string, PadPosition> {
  const map = new Map<string, PadPosition>();

  for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
    const [rowStr, colStr] = padKey.split(',');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    if (!isNaN(row) && !isNaN(col)) {
      map.set(voice.id, { row, col });
      // Also index by originalMidiNote for feature-based lookups
      if (voice.originalMidiNote != null) {
        const noteKey = String(voice.originalMidiNote);
        if (!map.has(noteKey)) {
          map.set(noteKey, { row, col });
        }
      }
    }
  }

  return map;
}

/**
 * Resolve pad positions for all voices in a group.
 */
function resolveGroupPositions(
  group: StructuralGroup,
  voiceToPad: Map<string, PadPosition>,
): PadPosition[] {
  const positions: PadPosition[] = [];
  for (const voiceId of group.voiceIds) {
    const pos = voiceToPad.get(voiceId);
    if (pos) positions.push(pos);
  }
  return positions;
}

// ============================================================================
// Compactness
// ============================================================================

/**
 * Score how compact a set of pad positions is.
 *
 * Uses bounding box area relative to the minimum possible area.
 * A group of N pads in a line has compactness ~1.0.
 * A group scattered across the grid has compactness ~0.0.
 *
 * @returns 0-1, higher = more compact.
 */
function scoreCompactness(positions: PadPosition[]): number {
  if (positions.length <= 1) return 1.0;

  const rows = positions.map(p => p.row);
  const cols = positions.map(p => p.col);

  const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
  const colSpan = Math.max(...cols) - Math.min(...cols) + 1;

  const boundingArea = rowSpan * colSpan;
  // Minimum area for N items is N (a line)
  const minArea = positions.length;
  // Maximum area is 8*8 = 64 (full grid)
  const maxArea = 64;

  if (maxArea <= minArea) return 1.0;

  // Normalized: 1.0 when bounding area == minArea, 0.0 when bounding area == maxArea
  return Math.max(0, 1 - (boundingArea - minArea) / (maxArea - minArea));
}

// ============================================================================
// Order Preservation
// ============================================================================

/**
 * Score how well spatial order preserves temporal order.
 *
 * Uses Kendall tau-b rank correlation between temporal order (voice index
 * in the group) and spatial order (row-major scan position).
 *
 * @returns 0-1, where 1.0 = perfect rank preservation.
 */
function scoreOrderPreservation(
  voiceIds: string[],
  voiceToPad: Map<string, PadPosition>,
): number {
  // Get spatial positions in temporal order
  const spatialPositions: number[] = [];
  for (const voiceId of voiceIds) {
    const pos = voiceToPad.get(voiceId);
    if (pos) {
      spatialPositions.push(pos.row * 8 + pos.col); // row-major index
    }
  }

  if (spatialPositions.length < 2) return 1.0;

  // Compute Kendall tau: fraction of concordant pairs
  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < spatialPositions.length; i++) {
    for (let j = i + 1; j < spatialPositions.length; j++) {
      // Temporal order: i < j (always concordant by construction)
      // Spatial order: compare spatialPositions[i] vs spatialPositions[j]
      if (spatialPositions[i] < spatialPositions[j]) {
        concordant++;
      } else if (spatialPositions[i] > spatialPositions[j]) {
        discordant++;
      }
      // ties count as neither
    }
  }

  const totalPairs = concordant + discordant;
  if (totalPairs === 0) return 1.0;

  // Normalize to [0, 1]: tau = (C - D) / (C + D), range [-1, 1]
  // Map to [0, 1]
  const tau = (concordant - discordant) / totalPairs;
  return (tau + 1) / 2;
}

// ============================================================================
// Shape Parallelism
// ============================================================================

/**
 * Score how similar the spatial shapes of two groups are.
 *
 * Centers each group's positions and compares the relative offsets.
 * Handles different group sizes by comparing the overlapping portion.
 *
 * A perfect score (1.0) means one group is an exact translation of the other.
 *
 * @returns 0-1, higher = more parallel shapes.
 */
function scoreShapeParallelism(
  positionsA: PadPosition[],
  positionsB: PadPosition[],
): number {
  if (positionsA.length === 0 || positionsB.length === 0) return 0;

  // Center each group
  const centeredA = centerPositions(positionsA);
  const centeredB = centerPositions(positionsB);

  // Compare shapes by matching elements pairwise (by index)
  // Use the shorter length for comparison
  const n = Math.min(centeredA.length, centeredB.length);
  if (n === 0) return 0;

  let totalDeviation = 0;
  for (let i = 0; i < n; i++) {
    const dr = centeredA[i].row - centeredB[i].row;
    const dc = centeredA[i].col - centeredB[i].col;
    totalDeviation += Math.sqrt(dr * dr + dc * dc);
  }

  const avgDeviation = totalDeviation / n;

  // Size penalty: penalize different group sizes
  const maxSize = Math.max(positionsA.length, positionsB.length);
  const sizePenalty = n / maxSize; // 1.0 when same size

  // Normalize deviation: max meaningful deviation on 8x8 grid is ~11 (diagonal)
  const normalizedDeviation = Math.min(avgDeviation / 8, 1);

  return (1 - normalizedDeviation) * sizePenalty;
}

/**
 * Center a set of positions by subtracting the centroid.
 */
function centerPositions(positions: PadPosition[]): PadPosition[] {
  if (positions.length === 0) return [];

  const centroidRow = positions.reduce((sum, p) => sum + p.row, 0) / positions.length;
  const centroidCol = positions.reduce((sum, p) => sum + p.col, 0) / positions.length;

  return positions.map(p => ({
    row: p.row - centroidRow,
    col: p.col - centroidCol,
  }));
}
