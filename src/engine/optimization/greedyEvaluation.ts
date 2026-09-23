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
import { type PadCoord, padKey } from '../../types/padGrid';
import { buildVoiceIdToPadIndex, buildNoteToPadIndex } from '../mapping/mappingResolver';
import { isZoneValid } from '../surface/handZone';
import { isStrictGripValid } from '../prior/feasibility';

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
 * Cols 0-3 = left hand, cols 4-7 = right hand.
 * The finger is chosen based on the column position within the zone.
 *
 * This is the anatomically preferred choice for a pad considered in isolation.
 * Use `buildFingerAssignmentFromLayout` when a whole layout is being assigned —
 * it additionally guarantees that two pads which sound together never share a
 * finger, which this function on its own cannot know about.
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
 * Ranks every (hand, finger) option for a pad, best anatomical fit first.
 *
 * The preferred hand's fingers are tried in order of how close the finger's
 * natural column is to the pad's column, then the other hand's fingers as
 * cross-body reaches. Thumbs come last within a hand: they are usable on pads
 * but awkward, which the cost model already reflects.
 */
function rankFingerOptions(col: number): Array<{ hand: HandSide; finger: FingerType }> {
  const options: Array<{ hand: HandSide; finger: FingerType; rank: number }> = [];
  for (const hand of ['left', 'right'] as HandSide[]) {
    const order = hand === 'left' ? LEFT_HAND_FINGERS : RIGHT_HAND_FINGERS;
    const zoneStart = hand === 'left' ? 0 : 4;
    const crossBody = (hand === 'left' && col > 3) || (hand === 'right' && col <= 3);
    order.forEach((finger, idx) => {
      const naturalCol = zoneStart + idx;
      const rank =
        Math.abs(naturalCol - col) +
        (finger === 'thumb' ? 4 : 0) +
        (crossBody ? 16 : 0);
      options.push({ hand, finger, rank });
    });
  }
  options.sort((a, b) => a.rank - b.rank);
  return options.map(({ hand, finger }) => ({ hand, finger }));
}

/**
 * Build a PadFingerAssignment from a layout.
 *
 * A pad's finger is fixed for the whole performance (that is what makes a layout
 * learnable), so two pads may share a finger only if they never sound at the same
 * instant. The previous implementation chose a finger from the pad's COLUMN alone
 * and ignored the row, which handed the same finger to every pad in a column and
 * produced assignments demanding one finger strike two pads simultaneously. The
 * greedy path then reported those layouts as "0 unplayable, all Easy".
 *
 * When `moments` are supplied, pads that sound together are guaranteed distinct
 * fingers. Without them the function falls back to the per-pad anatomical choice.
 */
export function buildFingerAssignmentFromLayout(
  layout: Layout,
  moments?: Array<{ notes: Array<{ padId?: string; soundId?: string; noteNumber?: number }> }>,
  /**
   * Per-Sound finger preferences set by the user, keyed by voice id.
   *
   * Keyed by VOICE, not by pad: the optimizer moves sounds between pads, so a
   * pad-keyed preference stops describing the sound the moment it is relocated.
   * Without this the greedy path built its assignment purely from pad geometry
   * and every user preference was silently discarded — a sound pinned to the
   * left pinky came back on the right index with no warning.
   */
  voicePreferences?: Record<string, { hand: HandSide; finger: FingerType }>,
): PadFingerAssignment {
  const assignment: PadFingerAssignment = {};
  const padKeys = Object.keys(layout.padToVoice);

  const preferenceForPad = (padKeyStr: string) => {
    const voiceId = layout.padToVoice[padKeyStr]?.id;
    return voiceId ? voicePreferences?.[voiceId] : undefined;
  };

  if (!moments || moments.length === 0) {
    for (const padKeyStr of padKeys) {
      const parts = padKeyStr.split(',');
      assignment[padKeyStr] = preferenceForPad(padKeyStr)
        ?? assignFingerForPad(parseInt(parts[0], 10), parseInt(parts[1], 10));
    }
    return assignment;
  }

  // Which pads ever sound at the same instant as which others.
  //
  // Each note is resolved through the LAYOUT rather than read from its `padId`.
  // The production caller builds moments with `buildPerformanceMoments(events)`
  // and no padLookup, which leaves every `padId` as the empty string — so a
  // padId-based graph was always empty and this whole collision-avoidance step
  // silently did nothing, handing three simultaneous pads the same finger.
  const voiceIdToPad = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteToPad = buildNoteToPadIndex(layout.padToVoice);

  const knownPads = new Set(padKeys);
  const resolvePad = (note: { padId?: string; soundId?: string; noteNumber?: number }) => {
    if (note.padId && knownPads.has(note.padId)) return note.padId;
    const byVoice = note.soundId ? voiceIdToPad.get(note.soundId) : undefined;
    if (byVoice) return padKey(byVoice.row, byVoice.col);
    const byNote = note.noteNumber != null ? noteToPad.get(note.noteNumber) : undefined;
    if (byNote) return padKey(byNote.row, byNote.col);
    return null;
  };

  const coOccurring = new Map<string, Set<string>>();
  for (const padKeyStr of padKeys) coOccurring.set(padKeyStr, new Set());
  const momentPadSets = new Map<string, string[]>();
  for (const moment of moments) {
    const active = [...new Set(moment.notes
      .map(resolvePad)
      .filter((id): id is string => !!id && coOccurring.has(id)))];
    for (const a of active) {
      for (const b of active) {
        if (a !== b) coOccurring.get(a)!.add(b);
      }
    }
    if (active.length > 1) momentPadSets.set([...active].sort().join('|'), active);
  }

  // Pads whose Sound the user gave an explicit preference are assigned first and
  // are never displaced, so the user's choice survives the collision resolution
  // below rather than being whatever is left over.
  const preferred: string[] = [];
  const unconstrained: string[] = [];
  for (const padKeyStr of padKeys) {
    if (preferenceForPad(padKeyStr)) preferred.push(padKeyStr);
    else unconstrained.push(padKeyStr);
  }
  for (const padKeyStr of preferred) {
    assignment[padKeyStr] = { ...preferenceForPad(padKeyStr)! };
  }

  // Then the most constrained pads, so crowded moments get the anatomically
  // sensible fingers rather than whatever is left over.
  const ordered = unconstrained.sort((a, b) => {
    const da = coOccurring.get(a)!.size;
    const db = coOccurring.get(b)!.size;
    if (da !== db) return db - da;
    return a.localeCompare(b);
  });

  // Hand separation is a hard rule, and so is a playable grip. First look for
  // an assignment that keeps every pad on a hand whose zone it lies in, never
  // shares a finger between pads that sound together, and gives every chord a
  // valid grip. Failing that, allow a pad to cross hands — the beam solver's
  // order too: a rule gives way before a hand is asked for an impossible shape.
  // Only if neither exists does the first-fit pass below take over.
  const groups = [...momentPadSets.values()];
  const withinZones = assignByRules(ordered, coOccurring, assignment, groups, false);
  if (withinZones) return withinZones;
  const crossing = assignByRules(ordered, coOccurring, assignment, groups, true);
  if (crossing) return crossing;

  for (const padKeyStr of ordered) {
    const parts = padKeyStr.split(',');
    const col = parseInt(parts[1], 10);
    const taken = new Set<string>();
    for (const neighbour of coOccurring.get(padKeyStr)!) {
      const owner = assignment[neighbour];
      if (owner) taken.add(`${owner.hand}:${owner.finger}`);
    }
    const options = rankFingerOptions(col);
    const choice =
      options.find(o => !taken.has(`${o.hand}:${o.finger}`)) ??
      assignFingerForPad(parseInt(parts[0], 10), col);
    assignment[padKeyStr] = { hand: choice.hand, finger: choice.finger };
  }

  return assignment;
}

/**
 * Whether some `size + 1` of `pads` all pairwise sound together. A small
 * Bron–Kerbosch search that stops at the first clique of that size — the
 * one-hand-only pads of a layout number a couple of dozen at most.
 */
function hasCliqueLargerThan(
  pads: string[],
  coOccurring: Map<string, Set<string>>,
  size: number,
): boolean {
  if (pads.length <= size) return false;
  const inSet = new Set(pads);
  const neighbours = (pk: string) =>
    [...(coOccurring.get(pk) ?? [])].filter(nb => inSet.has(nb));
  const search = (clique: number, candidates: string[]): boolean => {
    if (clique > size) return true;
    if (clique + candidates.length <= size) return false;
    for (let i = 0; i < candidates.length; i++) {
      const pk = candidates[i];
      const adjacent = new Set(neighbours(pk));
      if (search(clique + 1, candidates.slice(i + 1).filter(c => adjacent.has(c)))) return true;
    }
    return false;
  };
  return search(0, pads);
}

/** Upper bound on backtracking steps in each `assignByRules` pass. */
const RULES_ASSIGNMENT_STEP_BUDGET = 2_000;

const OWNER_FINGERS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const ownerCode = (hand: HandSide, finger: FingerType) =>
  (hand === 'left' ? 0 : 5) + OWNER_FINGERS.indexOf(finger);
const ownerOf = (code: number): { hand: HandSide; finger: FingerType } =>
  ({ hand: code < 5 ? 'left' : 'right', finger: OWNER_FINGERS[code % 5] });

/**
 * Finds one finger per pad such that pads sounding together never share a
 * finger and every chord has a valid grip for each hand — keeping every pad in
 * its hand's zone unless `allowCrossing`. Returns null if the bounded search
 * finds none.
 *
 * Depth-first in the given pad order, trying each pad's options in anatomical
 * rank order, so whenever the plain first-fit choice already satisfies all of
 * this, the first path explored IS that choice and the result is unchanged.
 * Forward checking abandons a branch as soon as some pad it would reach has no
 * finger left, and moments with more pads than one hand can take are rejected
 * before any search, so an impossible layout costs almost nothing — this runs
 * for every candidate move of a hill-climb.
 */
function assignByRules(
  ordered: string[],
  coOccurring: Map<string, Set<string>>,
  fixed: PadFingerAssignment,
  momentPadSets: string[][],
  allowCrossing: boolean,
): PadFingerAssignment | null {
  const n = ordered.length;
  const index = new Map(ordered.map((pk, i) => [pk, i]));
  const coords = ordered.map(pk => pk.split(',').map(Number) as [number, number]);
  const colOf = (pk: string) => Number(pk.split(',')[1]);

  if (!allowCrossing) {
    // Pads only one hand may play, that all sound together somewhere pairwise,
    // each need a different finger of that hand. More than five such pads can
    // never be fingered in-zone — say so now rather than searching for it.
    const oneHandOnly = (hand: HandSide) => [...new Set([...ordered, ...Object.keys(fixed)])].filter(pk => {
      const col = colOf(pk);
      const owner = fixed[pk];
      if (owner && owner.hand !== hand) return false;
      return hand === 'left' ? col <= 2 : col >= 5;
    });
    for (const hand of ['left', 'right'] as const) {
      if (hasCliqueLargerThan(oneHandOnly(hand), coOccurring, 5)) return null;
    }
  } else if (hasCliqueLargerThan([...new Set([...ordered, ...Object.keys(fixed)])], coOccurring, 10)) {
    // More than ten pads that pairwise sound together cannot all have distinct fingers.
    return null;
  }

  const options = ordered.map((_, i) => {
    const [row, col] = coords[i];
    return rankFingerOptions(col)
      .filter(o => allowCrossing || isZoneValid({ row, col }, o.hand))
      .map(o => ownerCode(o.hand, o.finger));
  });
  const neighbours = ordered.map(pk =>
    [...(coOccurring.get(pk) ?? [])].map(nb => index.get(nb)).filter((j): j is number => j !== undefined));
  // Fingers already taken by fixed (preferred) neighbours.
  const fixedTaken = ordered.map(pk => {
    const taken = new Set<number>();
    for (const nb of coOccurring.get(pk) ?? []) {
      const owner = fixed[nb];
      if (owner) taken.add(ownerCode(owner.hand, owner.finger));
    }
    return taken;
  });

  // Each chord is checked once, when the last of its pads (in search order) is placed.
  const completing: string[][][] = ordered.map(() => []);
  for (const pads of momentPadSets) {
    const positions = pads.map(pk => index.get(pk)).filter((i): i is number => i !== undefined);
    if (positions.length === 0) continue;
    completing[Math.max(...positions)].push(pads);
  }

  const assigned = new Int8Array(n).fill(-1);
  // takenBy[j][code] = how many placed neighbours of j use `code`.
  const takenBy = ordered.map(() => new Int16Array(10));

  const available = (j: number) => {
    let count = 0;
    for (const code of options[j]) {
      if (!fixedTaken[j].has(code) && takenBy[j][code] === 0) count++;
    }
    return count;
  };

  const gripsValid = (pads: string[]) => {
    const hands: Record<HandSide, Partial<Record<FingerType, { x: number; y: number }>>> = { left: {}, right: {} };
    for (const pk of pads) {
      const i = index.get(pk);
      const owner = i !== undefined ? ownerOf(assigned[i]) : fixed[pk];
      if (!owner) continue;
      const [row, col] = pk.split(',').map(Number);
      if (hands[owner.hand][owner.finger]) return false;
      hands[owner.hand][owner.finger] = { x: col, y: row };
    }
    return (['left', 'right'] as const).every(hand =>
      Object.keys(hands[hand]).length === 0 || isStrictGripValid(hands[hand], hand));
  };

  let steps = 0;
  const place = (i: number): boolean => {
    if (i === n) return true;
    if (++steps > RULES_ASSIGNMENT_STEP_BUDGET) return false;
    for (const code of options[i]) {
      if (fixedTaken[i].has(code) || takenBy[i][code] > 0) continue;
      assigned[i] = code;
      for (const j of neighbours[i]) takenBy[j][code]++;
      let viable = completing[i].every(gripsValid);
      if (viable) {
        for (const j of neighbours[i]) {
          if (j > i && assigned[j] === -1 && available(j) === 0) { viable = false; break; }
        }
      }
      if (viable && place(i + 1)) return true;
      for (const j of neighbours[i]) takenBy[j][code]--;
      assigned[i] = -1;
      if (steps > RULES_ASSIGNMENT_STEP_BUDGET) return false;
    }
    return false;
  };

  if (!place(0)) return null;
  const result: PadFingerAssignment = { ...fixed };
  ordered.forEach((pk, i) => { result[pk] = ownerOf(assigned[i]); });
  return result;
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
