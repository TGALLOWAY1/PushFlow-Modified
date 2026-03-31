/**
 * Pluggable Seed Generators for Greedy Candidate Diversity.
 *
 * Four seed generators produce fundamentally different starting layouts:
 * A. Natural Pose  — comfort and finger dominance
 * B. Cluster       — phrase-aware musically related sounds grouped together
 * C. Coordination  — rhythmic motion patterns optimized
 * D. Novelty       — stochastic exploration with minimal constraints
 *
 * Each generator uses the shared SoundFeatureMap and returns a valid Layout.
 */

import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { type InstrumentConfig, type Performance } from '../../types/performance';
import { type PadCoord } from '../../types/padGrid';
import { type SoundFeatureMap, rankByImportance } from '../structure/soundFeatures';
import {
  type PhraseStructure,
  analyzePhraseStructure,
  getVoicePeers,
  getVoicePhraseIndex,
  getRoleGroupsByImportance,
} from '../structure/phraseStructure';
import { type StructuralGroupAnalysis } from '../structure/structuralGroupDetection';
import { adjacentPads } from '../surface/padGrid';
import { generateId } from '../../utils/idGenerator';

// ============================================================================
// Types
// ============================================================================

export interface SeedGenerator {
  key: string;
  name: string;
  generate(ctx: SeedContext): Layout;
}

export interface SeedContext {
  /** Sound features for all voices. */
  features: SoundFeatureMap;
  /** Voice objects keyed by voiceId. */
  voices: Map<string, Voice>;
  /** Grid dimensions. */
  instrumentConfig: InstrumentConfig;
  /** Locked voice→pad assignments that must not change. */
  placementLocks: Record<string, string>;
  /** Seeded RNG returning [0, 1). */
  rng: () => number;
  /** Optional base layout for reference. */
  baseLayout?: Layout;
  /** Performance data for phrase structure analysis. */
  performance?: Performance;
  /** Optional structural group analysis for group-aware seeding. */
  structuralGroups?: StructuralGroupAnalysis;
}

// ============================================================================
// Helpers
// ============================================================================

function padKey(row: number, col: number): string {
  return `${row},${col}`;
}

function isOccupied(layout: Layout, row: number, col: number): boolean {
  return padKey(row, col) in layout.padToVoice;
}

function createEmptyLayout(name: string, baseLayout?: Layout): Layout {
  return {
    id: generateId('layout'),
    name,
    padToVoice: {},
    fingerConstraints: baseLayout?.fingerConstraints ?? {},
    placementLocks: baseLayout?.placementLocks ?? {},
    scoreCache: null,
    layoutMode: 'optimized' as const,
    role: 'working' as const,
  };
}

function placeVoice(
  layout: Layout,
  row: number,
  col: number,
  voice: Voice,
): void {
  layout.padToVoice[padKey(row, col)] = voice;
}

/** Golden pads near the natural hand pose center (rows 2-4, all cols). */
const GOLDEN_PADS: PadCoord[] = [
  // Center area — most ergonomic
  { row: 3, col: 3 }, { row: 3, col: 4 }, // index fingers
  { row: 4, col: 2 }, { row: 4, col: 5 }, // middle fingers
  { row: 4, col: 1 }, { row: 4, col: 6 }, // ring fingers
  { row: 2, col: 3 }, { row: 2, col: 4 }, // thumbs
  { row: 4, col: 0 }, { row: 4, col: 7 }, // pinkies
  // Extended comfortable zone
  { row: 3, col: 2 }, { row: 3, col: 5 },
  { row: 2, col: 2 }, { row: 2, col: 5 },
  { row: 3, col: 1 }, { row: 3, col: 6 },
  { row: 5, col: 2 }, { row: 5, col: 5 },
  { row: 5, col: 3 }, { row: 5, col: 4 },
  { row: 5, col: 1 }, { row: 5, col: 6 },
  { row: 2, col: 1 }, { row: 2, col: 6 },
];

function getFirstEmptyPad(
  layout: Layout,
  candidates: PadCoord[],
): PadCoord | null {
  for (const pad of candidates) {
    if (!isOccupied(layout, pad.row, pad.col)) {
      return pad;
    }
  }
  return null;
}

/** Get all empty pads in row-major order. */
function getAllEmptyPads(
  layout: Layout,
  rows: number,
  cols: number,
): PadCoord[] {
  const empty: PadCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isOccupied(layout, r, c)) {
        empty.push({ row: r, col: c });
      }
    }
  }
  return empty;
}

/** Apply placement locks to layout (place locked voices first). */
function applyPlacementLocks(
  layout: Layout,
  locks: Record<string, string>,
  voices: Map<string, Voice>,
): Set<string> {
  const placedVoiceIds = new Set<string>();
  for (const [voiceId, pk] of Object.entries(locks)) {
    const voice = voices.get(voiceId);
    if (voice) {
      layout.padToVoice[pk] = voice;
      placedVoiceIds.add(voiceId);
    }
  }
  return placedVoiceIds;
}

// ============================================================================
// Seed Generator A: Natural Pose
// ============================================================================

/**
 * Natural Pose Anchor seed.
 *
 * Places sounds by weighted importance onto the most ergonomic
 * "golden pads" near the natural hand pose center.
 */
export const naturalPoseSeed: SeedGenerator = {
  key: 'natural-pose',
  name: 'Natural Pose Anchor',

  generate(ctx: SeedContext): Layout {
    const layout = createEmptyLayout('Natural Pose Anchor', ctx.baseLayout);
    const placedVoiceIds = applyPlacementLocks(layout, ctx.placementLocks, ctx.voices);

    // Sort voices by weighted importance (highest first)
    const ranked = rankByImportance(ctx.features)
      .filter(f => !placedVoiceIds.has(f.voiceId));

    // Place on golden pads in order of importance
    for (const feat of ranked) {
      const voice = ctx.voices.get(feat.voiceId);
      if (!voice) continue;

      // Try golden pads first, then any remaining empty pad
      const pad = getFirstEmptyPad(layout, GOLDEN_PADS)
        ?? getFirstEmptyPad(layout, getAllEmptyPads(layout, ctx.instrumentConfig.rows, ctx.instrumentConfig.cols));

      if (!pad) break;
      placeVoice(layout, pad.row, pad.col, voice);
    }

    return layout;
  },
};

// ============================================================================
// Seed Generator B: Cluster (Phrase-Aware)
// ============================================================================

/**
 * Clustered Motif seed.
 *
 * Groups musically related sounds into compact physical regions on the grid,
 * with phrase-awareness: voices that share rhythmic roles across phrase
 * iterations are placed in analogous spatial positions.
 *
 * Algorithm:
 * 1. Analyze phrase structure to detect repeated rhythmic patterns
 * 2. Group voices by their rhythmic role (independent of sound identity)
 * 3. For each role group, place the first-phrase voice, then place peer
 *    voices at the same relative position (offset by phrase index)
 * 4. Fall back to co-occurrence clustering for non-repeating patterns
 */
export const clusterSeed: SeedGenerator = {
  key: 'cluster',
  name: 'Clustered Motif Layout',

  generate(ctx: SeedContext): Layout {
    const layout = createEmptyLayout('Clustered Motif Layout', ctx.baseLayout);
    const placedVoiceIds = applyPlacementLocks(layout, ctx.placementLocks, ctx.voices);
    const rows = ctx.instrumentConfig.rows;
    const cols = ctx.instrumentConfig.cols;

    // Analyze phrase structure if performance is available
    let phraseStructure: PhraseStructure | null = null;
    if (ctx.performance && ctx.performance.events.length > 0) {
      phraseStructure = analyzePhraseStructure(
        ctx.performance.events,
        ctx.performance.tempo ?? 120,
      );
    }

    // Build relationship graph: voiceId → voiceId → strength
    const relationships = new Map<string, Map<string, number>>();
    for (const [voiceId, feat] of ctx.features) {
      if (placedVoiceIds.has(voiceId)) continue;
      const rels = new Map<string, number>();
      for (let i = 0; i < feat.cooccurrenceNeighbors.length; i++) {
        const neighbor = feat.cooccurrenceNeighbors[i];
        rels.set(neighbor, (rels.get(neighbor) ?? 0) + (5 - i));
      }
      for (let i = 0; i < feat.transitionNeighbors.length; i++) {
        const neighbor = feat.transitionNeighbors[i];
        rels.set(neighbor, (rels.get(neighbor) ?? 0) + (5 - i) * 0.8);
      }
      relationships.set(voiceId, rels);
    }

    const unplaced = rankByImportance(ctx.features)
      .filter(f => !placedVoiceIds.has(f.voiceId));

    if (unplaced.length === 0) return layout;

    // Use phrase-aware placement if phrase structure is detected with confidence
    if (phraseStructure && phraseStructure.confidence > 0.4 && phraseStructure.roleGroups.length > 0) {
      placePhraseAware(
        layout, ctx, phraseStructure, relationships, placedVoiceIds, rows, cols,
      );
    } else {
      // Fall back to legacy co-occurrence clustering
      placeLegacyCluster(layout, ctx, relationships, placedVoiceIds, rows, cols);
    }

    return layout;
  },
};

/**
 * Phrase-aware placement: place voices sharing rhythmic roles in analogous positions.
 */
function placePhraseAware(
  layout: Layout,
  ctx: SeedContext,
  phraseStructure: PhraseStructure,
  relationships: Map<string, Map<string, number>>,
  placedVoiceIds: Set<string>,
  rows: number,
  cols: number,
): void {
  const placed = new Set<string>(placedVoiceIds);

  // Get role groups sorted by importance (most phrase coverage first)
  const roleGroups = getRoleGroupsByImportance(phraseStructure);

  // Track template positions for each role (roleKey → relative pad position)
  const roleTemplates = new Map<string, { row: number; col: number }>();

  // Start placement at center of grid
  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  let nextRow = centerRow;
  let nextCol = centerCol;

  // Process each role group
  for (const group of roleGroups) {
    // Sort voices in this group by phrase index (first phrase first)
    const sortedVoices = group.voiceIds
      .filter(v => !placed.has(v) && ctx.voices.has(v))
      .sort((a, b) => {
        const idxA = getVoicePhraseIndex(phraseStructure, a);
        const idxB = getVoicePhraseIndex(phraseStructure, b);
        return idxA - idxB;
      });

    if (sortedVoices.length === 0) continue;

    // Check if we already have a template for this role
    const existingTemplate = roleTemplates.get(group.roleKey);

    if (existingTemplate) {
      // Place all voices in this group at the template position
      for (const voiceId of sortedVoices) {
        const voice = ctx.voices.get(voiceId);
        if (!voice) continue;

        // Try to place at template position or nearby
        const targetPad = findNearestEmptyPad(
          layout, existingTemplate.row, existingTemplate.col, rows, cols,
        );

        if (targetPad) {
          placeVoice(layout, targetPad.row, targetPad.col, voice);
          placed.add(voiceId);
        }
      }
    } else {
      // This is a new role group - find best position for first voice
      const firstVoiceId = sortedVoices[0];
      const voice = ctx.voices.get(firstVoiceId);
      if (!voice) continue;

      // Find best position considering relationships and adjacency
      const bestPad = findBestPadForVoice(
        layout, firstVoiceId, relationships, rows, cols, ctx.rng,
        nextRow, nextCol,
      );

      if (bestPad) {
        placeVoice(layout, bestPad.row, bestPad.col, voice);
        placed.add(firstVoiceId);

        // Record this as the template for this role
        roleTemplates.set(group.roleKey, { row: bestPad.row, col: bestPad.col });

        // Update next position hint for unrelated voices
        nextRow = bestPad.row;
        nextCol = (bestPad.col + 1) % cols;
        if (nextCol === 0) nextRow = (nextRow + 1) % rows;
      }

      // Place remaining voices in this group at the same template position
      for (let i = 1; i < sortedVoices.length; i++) {
        const peerVoiceId = sortedVoices[i];
        const peerVoice = ctx.voices.get(peerVoiceId);
        if (!peerVoice) continue;

        const template = roleTemplates.get(group.roleKey);
        if (template) {
          const targetPad = findNearestEmptyPad(
            layout, template.row, template.col, rows, cols,
          );
          if (targetPad) {
            placeVoice(layout, targetPad.row, targetPad.col, peerVoice);
            placed.add(peerVoiceId);
          }
        }
      }
    }
  }

  // Place any remaining voices that weren't in role groups
  const unplacedFeatures = rankByImportance(ctx.features)
    .filter(f => !placed.has(f.voiceId));

  for (const feat of unplacedFeatures) {
    const voice = ctx.voices.get(feat.voiceId);
    if (!voice) continue;

    // Check for phrase peers that are already placed
    const peers = getVoicePeers(phraseStructure, feat.voiceId);
    let targetPad: PadCoord | null = null;

    for (const peerId of peers) {
      const peerPad = findVoicePad(layout, peerId);
      if (peerPad) {
        targetPad = findNearestEmptyPad(layout, peerPad.row, peerPad.col, rows, cols);
        break;
      }
    }

    if (!targetPad) {
      targetPad = findBestPadForVoice(
        layout, feat.voiceId, relationships, rows, cols, ctx.rng,
        nextRow, nextCol,
      );
    }

    if (targetPad) {
      placeVoice(layout, targetPad.row, targetPad.col, voice);
      placed.add(feat.voiceId);
      nextRow = targetPad.row;
      nextCol = (targetPad.col + 1) % cols;
    }
  }
}

/**
 * Legacy clustering (fallback when no phrase structure detected).
 */
function placeLegacyCluster(
  layout: Layout,
  ctx: SeedContext,
  relationships: Map<string, Map<string, number>>,
  placedVoiceIds: Set<string>,
  rows: number,
  cols: number,
): void {
  const unplaced = rankByImportance(ctx.features)
    .filter(f => !placedVoiceIds.has(f.voiceId));

  if (unplaced.length === 0) return;

  const startRow = Math.floor(rows / 2);
  const startCol = Math.floor(cols / 2);

  const firstVoice = ctx.voices.get(unplaced[0].voiceId);
  if (firstVoice) {
    placeVoice(layout, startRow, startCol, firstVoice);
  }
  const placed = new Set([unplaced[0].voiceId]);

  for (let i = 1; i < unplaced.length; i++) {
    const feat = unplaced[i];
    const voice = ctx.voices.get(feat.voiceId);
    if (!voice) continue;

    let bestPad: PadCoord | null = null;
    let bestScore = -Infinity;

    const rels = relationships.get(feat.voiceId);
    const emptyPads = getAllEmptyPads(layout, rows, cols);

    for (const pad of emptyPads) {
      let score = 0;
      const neighbors = adjacentPads(pad);

      for (const neighbor of neighbors) {
        const nKey = padKey(neighbor.row, neighbor.col);
        const neighborVoice = layout.padToVoice[nKey];
        if (neighborVoice) {
          const neighborId = neighborVoice.id;
          const relStrength = rels?.get(neighborId) ?? 0;
          score += relStrength + 1;
        }
      }

      score += ctx.rng() * 0.01;

      if (score > bestScore) {
        bestScore = score;
        bestPad = pad;
      }
    }

    if (bestPad) {
      placeVoice(layout, bestPad.row, bestPad.col, voice);
      placed.add(feat.voiceId);
    }
  }
}

/**
 * Find the best pad for a voice considering relationships and position hints.
 */
function findBestPadForVoice(
  layout: Layout,
  voiceId: string,
  relationships: Map<string, Map<string, number>>,
  rows: number,
  cols: number,
  rng: () => number,
  hintRow: number,
  hintCol: number,
): PadCoord | null {
  const emptyPads = getAllEmptyPads(layout, rows, cols);
  if (emptyPads.length === 0) return null;

  let bestPad: PadCoord | null = null;
  let bestScore = -Infinity;

  const rels = relationships.get(voiceId);

  for (const pad of emptyPads) {
    let score = 0;

    // Score by adjacency to related voices
    const neighbors = adjacentPads(pad);
    for (const neighbor of neighbors) {
      const nKey = padKey(neighbor.row, neighbor.col);
      const neighborVoice = layout.padToVoice[nKey];
      if (neighborVoice) {
        const neighborId = neighborVoice.id;
        const relStrength = rels?.get(neighborId) ?? 0;
        score += relStrength + 1;
      }
    }

    // Prefer positions near the hint
    const distToHint = Math.abs(pad.row - hintRow) + Math.abs(pad.col - hintCol);
    score -= distToHint * 0.1;

    // Prefer center of grid
    const distToCenter = Math.abs(pad.row - rows / 2) + Math.abs(pad.col - cols / 2);
    score -= distToCenter * 0.05;

    score += rng() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      bestPad = pad;
    }
  }

  return bestPad;
}

/**
 * Find the nearest empty pad to a target position.
 */
function findNearestEmptyPad(
  layout: Layout,
  targetRow: number,
  targetCol: number,
  rows: number,
  cols: number,
): PadCoord | null {
  // Check the target first
  if (!isOccupied(layout, targetRow, targetCol)) {
    return { row: targetRow, col: targetCol };
  }

  // Spiral outward from target
  for (let d = 1; d < Math.max(rows, cols); d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue;
        const r = targetRow + dr;
        const c = targetCol + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols && !isOccupied(layout, r, c)) {
          return { row: r, col: c };
        }
      }
    }
  }

  return null;
}

/**
 * Find the pad where a voice is placed.
 */
function findVoicePad(layout: Layout, voiceId: string): PadCoord | null {
  for (const [pk, voice] of Object.entries(layout.padToVoice)) {
    if (voice.id === voiceId) {
      const [r, c] = pk.split(',').map(Number);
      return { row: r, col: c };
    }
  }
  return null;
}

// ============================================================================
// Seed Generator C: Coordination
// ============================================================================

/**
 * Coordination Pattern seed.
 *
 * Optimizes for rhythmic motion patterns:
 * - Fast alternation pairs placed across hands
 * - Simultaneous voices in same-hand clusters
 * - Sequential patterns along natural motion paths
 */
export const coordinationSeed: SeedGenerator = {
  key: 'coordination',
  name: 'Coordination-Optimized',

  generate(ctx: SeedContext): Layout {
    const layout = createEmptyLayout('Coordination-Optimized', ctx.baseLayout);
    const placedVoiceIds = applyPlacementLocks(layout, ctx.placementLocks, ctx.voices);
    const rows = ctx.instrumentConfig.rows;
    const cols = ctx.instrumentConfig.cols;

    const ranked = rankByImportance(ctx.features)
      .filter(f => !placedVoiceIds.has(f.voiceId));

    if (ranked.length === 0) return layout;

    // Identify alternation pairs and assign them to opposite hands
    const leftVoices: string[] = [];
    const rightVoices: string[] = [];
    const assigned = new Set<string>();

    // First pass: find strong alternation pairs and split across hands
    for (const feat of ranked) {
      if (assigned.has(feat.voiceId)) continue;

      for (const partnerId of feat.alternationPartners) {
        if (assigned.has(partnerId)) continue;
        const partnerFeat = ctx.features.get(partnerId);
        if (!partnerFeat) continue;

        // Assign to opposite hands
        leftVoices.push(feat.voiceId);
        rightVoices.push(partnerId);
        assigned.add(feat.voiceId);
        assigned.add(partnerId);
        break;
      }
    }

    // Second pass: assign unassigned voices to the hand with fewer voices
    for (const feat of ranked) {
      if (assigned.has(feat.voiceId)) continue;

      // Check if this voice has simultaneity partners already assigned
      const leftPartners = feat.simultaneityPartners.filter(p => leftVoices.includes(p)).length;
      const rightPartners = feat.simultaneityPartners.filter(p => rightVoices.includes(p)).length;

      if (leftPartners > rightPartners) {
        leftVoices.push(feat.voiceId);
      } else if (rightPartners > leftPartners) {
        rightVoices.push(feat.voiceId);
      } else if (leftVoices.length <= rightVoices.length) {
        leftVoices.push(feat.voiceId);
      } else {
        rightVoices.push(feat.voiceId);
      }
      assigned.add(feat.voiceId);
    }

    // Place left voices in left zone (cols 0-3), right in right zone (cols 4-7)
    placeInZone(layout, leftVoices, ctx.voices, 0, 3, rows, ctx.rng);
    placeInZone(layout, rightVoices, ctx.voices, 4, cols - 1, rows, ctx.rng);

    return layout;
  },
};

/**
 * Place voices within a column range, centered vertically.
 */
function placeInZone(
  layout: Layout,
  voiceIds: string[],
  voices: Map<string, Voice>,
  colStart: number,
  colEnd: number,
  rows: number,
  _rng: () => number,
): void {
  const zoneCols = colEnd - colStart + 1;
  const zoneRows = Math.ceil(voiceIds.length / zoneCols);
  const startRow = Math.max(0, Math.floor((rows - zoneRows) / 2));

  let idx = 0;
  for (let r = startRow; r < rows && idx < voiceIds.length; r++) {
    for (let c = colStart; c <= colEnd && idx < voiceIds.length; c++) {
      if (isOccupied(layout, r, c)) continue;
      const voice = voices.get(voiceIds[idx]);
      if (voice) {
        placeVoice(layout, r, c, voice);
        idx++;
      }
    }
  }
}

// ============================================================================
// Seed Generator D: Novelty
// ============================================================================

/**
 * Novelty / Exploration seed.
 *
 * Semi-random placement with minimal constraints:
 * - Pins top 2-3 backbone sounds to reasonable positions
 * - Remaining sounds placed with probabilistic zone affinity
 */
export const noveltySeed: SeedGenerator = {
  key: 'novelty',
  name: 'Exploratory Variant',

  generate(ctx: SeedContext): Layout {
    const layout = createEmptyLayout('Exploratory Variant', ctx.baseLayout);
    const placedVoiceIds = applyPlacementLocks(layout, ctx.placementLocks, ctx.voices);
    const rows = ctx.instrumentConfig.rows;
    const cols = ctx.instrumentConfig.cols;

    const ranked = rankByImportance(ctx.features)
      .filter(f => !placedVoiceIds.has(f.voiceId));

    if (ranked.length === 0) return layout;

    // Pin top 2-3 backbone sounds to golden pads
    const backbones = ranked.filter(f => f.isBackbone).slice(0, 3);
    const goldenPadsCopy = [...GOLDEN_PADS];

    for (const feat of backbones) {
      const voice = ctx.voices.get(feat.voiceId);
      if (!voice) continue;

      const pad = getFirstEmptyPad(layout, goldenPadsCopy);
      if (pad) {
        placeVoice(layout, pad.row, pad.col, voice);
        placedVoiceIds.add(feat.voiceId);
        // Remove this pad from golden pads
        const idx = goldenPadsCopy.findIndex(p => p.row === pad.row && p.col === pad.col);
        if (idx >= 0) goldenPadsCopy.splice(idx, 1);
      }
    }

    // Place remaining voices randomly
    const remaining = ranked.filter(f => !placedVoiceIds.has(f.voiceId));
    const emptyPads = getAllEmptyPads(layout, rows, cols);

    // Shuffle empty pads using RNG
    for (let i = emptyPads.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rng() * (i + 1));
      [emptyPads[i], emptyPads[j]] = [emptyPads[j], emptyPads[i]];
    }

    for (let i = 0; i < remaining.length && i < emptyPads.length; i++) {
      const voice = ctx.voices.get(remaining[i].voiceId);
      if (voice) {
        placeVoice(layout, emptyPads[i].row, emptyPads[i].col, voice);
      }
    }

    return layout;
  },
};

// ============================================================================
// Seed Generator E: Structural Coherence
// ============================================================================

/**
 * Structural Coherence seed.
 *
 * Places voices from detected structural groups into coherent spatial shapes:
 * - Each group occupies a contiguous row or block
 * - Parallel group pairs are placed in adjacent rows
 * - Voice order within groups follows temporal order (left→right)
 * - Ungrouped voices fill remaining golden pads
 *
 * Falls back to natural-pose seeding when no structural groups are detected.
 */
export const structuralSeed: SeedGenerator = {
  key: 'structural',
  name: 'Structural Coherence',

  generate(ctx: SeedContext): Layout {
    const layout = createEmptyLayout('Structural Coherence', ctx.baseLayout);
    const placedVoiceIds = applyPlacementLocks(layout, ctx.placementLocks, ctx.voices);
    const rows = ctx.instrumentConfig.rows;
    const cols = ctx.instrumentConfig.cols;

    const groups = ctx.structuralGroups?.groups ?? [];

    // Fall back to natural-pose if no structural groups detected
    if (groups.length === 0) {
      return naturalPoseSeed.generate(ctx);
    }

    // Identify parallel pairs for adjacent-row placement
    const groupPairs = ctx.structuralGroups?.groupPairs ?? [];
    const pairedGroupIds = new Set<string>();
    const adjacencyPairs: Array<[string, string]> = [];

    for (const pair of groupPairs) {
      if (!pairedGroupIds.has(pair.groupA) && !pairedGroupIds.has(pair.groupB)) {
        adjacencyPairs.push([pair.groupA, pair.groupB]);
        pairedGroupIds.add(pair.groupA);
        pairedGroupIds.add(pair.groupB);
      }
    }

    // Build placement order: paired groups first (adjacent rows), then unpaired groups
    const placementOrder: string[] = [];
    for (const [a, b] of adjacencyPairs) {
      placementOrder.push(a, b);
    }
    for (const group of groups) {
      if (!pairedGroupIds.has(group.id)) {
        placementOrder.push(group.id);
      }
    }

    const groupMap = new Map(groups.map(g => [g.id, g]));

    // Allocate rows starting from ergonomic center (row 3), expanding outward
    const centerRow = Math.min(3, rows - 1);
    let nextRow = centerRow;
    const rowDirection = [0, 1, -1, 2, -2, 3, -3, 4]; // expand from center

    let rowIdx = 0;

    for (const groupId of placementOrder) {
      const group = groupMap.get(groupId);
      if (!group) continue;

      // Find next available row
      let targetRow = -1;
      while (rowIdx < rowDirection.length) {
        const candidate = centerRow + rowDirection[rowIdx];
        if (candidate >= 0 && candidate < rows) {
          targetRow = candidate;
          rowIdx++;
          break;
        }
        rowIdx++;
      }

      if (targetRow < 0) {
        targetRow = nextRow % rows;
        nextRow++;
      }

      // Place group members left→right in temporal order, centered in the row
      const unplacedMembers = group.voiceIds.filter(vid => !placedVoiceIds.has(vid));
      const startCol = Math.max(0, Math.floor((cols - unplacedMembers.length) / 2));

      let colIdx = startCol;
      for (const voiceId of unplacedMembers) {
        const voice = ctx.voices.get(voiceId);
        if (!voice) continue;

        // Find next empty pad in this row, starting from colIdx
        while (colIdx < cols && isOccupied(layout, targetRow, colIdx)) {
          colIdx++;
        }

        if (colIdx < cols) {
          placeVoice(layout, targetRow, colIdx, voice);
          placedVoiceIds.add(voiceId);
          colIdx++;
        }
      }
    }

    // Place ungrouped voices on remaining golden pads
    const ungrouped = ctx.structuralGroups?.ungroupedVoiceIds ?? [];
    const ranked = rankByImportance(ctx.features)
      .filter(f => !placedVoiceIds.has(f.voiceId) || ungrouped.includes(f.voiceId));

    for (const feat of ranked) {
      if (placedVoiceIds.has(feat.voiceId)) continue;
      const voice = ctx.voices.get(feat.voiceId);
      if (!voice) continue;

      const pad = getFirstEmptyPad(layout, GOLDEN_PADS)
        ?? getFirstEmptyPad(layout, getAllEmptyPads(layout, rows, cols));
      if (!pad) break;
      placeVoice(layout, pad.row, pad.col, voice);
      placedVoiceIds.add(feat.voiceId);
    }

    return layout;
  },
};

// ============================================================================
// Registry
// ============================================================================

/** All available seed generators, indexed by key. */
export const SEED_GENERATORS: Record<string, SeedGenerator> = {
  'natural-pose': naturalPoseSeed,
  'cluster': clusterSeed,
  'coordination': coordinationSeed,
  'novelty': noveltySeed,
  'structural': structuralSeed,
};

/** Get a seed generator by key. */
export function getSeedGenerator(key: string): SeedGenerator | undefined {
  return SEED_GENERATORS[key];
}
