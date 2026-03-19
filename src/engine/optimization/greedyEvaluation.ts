/**
 * Greedy Evaluation Helpers.
 *
 * Partial and incremental cost computation for the greedy optimizer.
 * These functions use the canonical evaluator's atomic cost functions
 * but support computing cost for a subset of affected moments.
 */

import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type PerformanceEvent } from '../../types/performanceEvent';
import { type CostToggles } from '../../types/costToggles';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type PadCoord } from '../../types/padGrid';

// ============================================================================
// Co-occurrence Matrix
// ============================================================================

/**
 * Pre-compute a co-occurrence affinity matrix for sounds.
 * Counts how often each pair of sounds plays simultaneously
 * or within a short time window.
 */
export function buildCooccurrenceMatrix(
  events: PerformanceEvent[],
  windowSec: number = 0.05,
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    const aId = a.voiceId ?? String(a.noteNumber);

    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      if (b.startTime - a.startTime > windowSec) break;

      const bId = b.voiceId ?? String(b.noteNumber);
      if (aId === bId) continue;

      // Increment both directions
      if (!matrix.has(aId)) matrix.set(aId, new Map());
      if (!matrix.has(bId)) matrix.set(bId, new Map());
      matrix.get(aId)!.set(bId, (matrix.get(aId)!.get(bId) ?? 0) + 1);
      matrix.get(bId)!.set(aId, (matrix.get(bId)!.get(aId) ?? 0) + 1);
    }
  }

  return matrix;
}

// ============================================================================
// Sound Frequency Analysis
// ============================================================================

/** Count how many events each sound appears in. */
export function buildSoundFrequency(
  events: PerformanceEvent[],
): Map<string, number> {
  const freq = new Map<string, number>();
  for (const e of events) {
    const id = e.voiceId ?? String(e.noteNumber);
    freq.set(id, (freq.get(id) ?? 0) + 1);
  }
  return freq;
}

// ============================================================================
// Finger Assignment Heuristics
// ============================================================================

/** Canonical finger ordering within a hand zone. */
const LEFT_HAND_FINGERS: FingerType[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];
const RIGHT_HAND_FINGERS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/**
 * Assign a finger to a pad based on its position within the hand zone.
 * Cols 0-3 = left hand, cols 4-7 = right hand (as specified in requirements).
 * The finger is chosen based on the column position within the zone.
 */
export function assignFingerForPad(
  _row: number,
  col: number,
): { hand: HandSide; finger: FingerType } {
  if (col <= 3) {
    // Left hand: col 0 = pinky, col 1 = ring, col 2 = middle, col 3 = index
    const fingerIdx = Math.min(col, LEFT_HAND_FINGERS.length - 1);
    return { hand: 'left', finger: LEFT_HAND_FINGERS[fingerIdx] };
  } else {
    // Right hand: col 4 = index, col 5 = middle, col 6 = ring, col 7 = pinky
    const fingerIdx = Math.min(col - 4, RIGHT_HAND_FINGERS.length - 1);
    return { hand: 'right', finger: RIGHT_HAND_FINGERS[fingerIdx] };
  }
}

/**
 * Build a PadFingerAssignment from a layout by assigning fingers
 * based on pad positions (column-based hand zone heuristic).
 */
export function buildFingerAssignmentFromLayout(
  layout: Layout,
): PadFingerAssignment {
  const assignment: PadFingerAssignment = {};
  for (const padKeyStr of Object.keys(layout.padToVoice)) {
    const parts = padKeyStr.split(',');
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    assignment[padKeyStr] = assignFingerForPad(row, col);
  }
  return assignment;
}

// ============================================================================
// Layout Manipulation Helpers
// ============================================================================

/** Get adjacent pad positions (up, down, left, right). */
export function getAdjacentPads(
  row: number,
  col: number,
  rows: number = 8,
  cols: number = 8,
): PadCoord[] {
  const neighbors: PadCoord[] = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < rows - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < cols - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

/** Parse "row,col" to PadCoord. */
export function parsePadKey(pk: string): PadCoord {
  const parts = pk.split(',');
  return { row: parseInt(parts[0], 10), col: parseInt(parts[1], 10) };
}

/** Get all pad keys occupied in a layout. */
export function getOccupiedPadKeys(layout: Layout): Set<string> {
  return new Set(Object.keys(layout.padToVoice));
}

/** Get all empty pad positions on the grid. */
export function getEmptyPadPositions(
  layout: Layout,
  rows: number = 8,
  cols: number = 8,
): PadCoord[] {
  const occupied = getOccupiedPadKeys(layout);
  const empty: PadCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied.has(`${r},${c}`)) {
        empty.push({ row: r, col: c });
      }
    }
  }
  return empty;
}

// ============================================================================
// Scoring Heuristics for Greedy Placement
// ============================================================================

/**
 * Score a candidate pad position for placing a sound during greedy initialization.
 * Lower score = better placement.
 *
 * Considers:
 * - Distance from natural hand zone centers (static cost proxy)
 * - Co-occurrence affinity with already-placed sounds
 */
export function scorePlacement(
  candidatePad: PadCoord,
  soundId: string,
  currentLayout: Layout,
  cooccurrence: Map<string, Map<string, number>>,
  costToggles: CostToggles,
): number {
  let score = 0;

  // 1. Distance from natural hand zone center
  // Left center ~ (3.5, 1.5), Right center ~ (3.5, 5.5)
  if (costToggles.poseNaturalness) {
    const leftCenterDist = Math.sqrt(
      (candidatePad.row - 3.5) ** 2 + (candidatePad.col - 1.5) ** 2
    );
    const rightCenterDist = Math.sqrt(
      (candidatePad.row - 3.5) ** 2 + (candidatePad.col - 5.5) ** 2
    );
    const minDist = Math.min(leftCenterDist, rightCenterDist);
    score += minDist * 0.5; // Prefer positions closer to natural zones
  }

  // 2. Co-occurrence affinity: penalize distance from co-occurring sounds
  if (costToggles.transitionCost) {
    const soundCooc = cooccurrence.get(soundId);
    if (soundCooc) {
      for (const [otherId, count] of soundCooc) {
        // Find where the other sound is placed
        for (const [pk, voice] of Object.entries(currentLayout.padToVoice)) {
          const voiceId = voice.id ?? String(voice.originalMidiNote);
          if (voiceId === otherId) {
            const otherPad = parsePadKey(pk);
            const dist = Math.abs(candidatePad.row - otherPad.row) + Math.abs(candidatePad.col - otherPad.col);
            // Weight by co-occurrence count: frequently co-occurring sounds should be close
            score += dist * count * 0.3;
            break;
          }
        }
      }
    }
  }

  return score;
}

// ============================================================================
// Affected Moment Detection
// ============================================================================

/**
 * Find which moments are affected by a change to a specific voice.
 * Returns indices into the moments array.
 */
export function findAffectedMoments(
  moments: PerformanceMoment[],
  voiceId: string,
): number[] {
  const affected: number[] = [];
  for (let i = 0; i < moments.length; i++) {
    if (moments[i].notes.some(n => n.soundId === voiceId)) {
      affected.push(i);
    }
  }
  return affected;
}

/**
 * Find which moments are affected by a change to a specific pad.
 * Returns indices into the moments array.
 */
export function findMomentsUsingPad(
  moments: PerformanceMoment[],
  padKey: string,
): number[] {
  const affected: number[] = [];
  for (let i = 0; i < moments.length; i++) {
    if (moments[i].notes.some(n => n.padId === padKey)) {
      affected.push(i);
    }
  }
  return affected;
}
