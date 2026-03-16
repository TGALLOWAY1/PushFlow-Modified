/**
 * Mutation Service for Simulated Annealing Solver.
 *
 * Provides functions to mutate Layout configurations by moving or swapping
 * Voice assignments on the 8x8 grid. All mutations return new immutable objects
 * to preserve history and prevent state corruption.
 *
 * Ported from Version1/src/engine/solvers/mutationService.ts with canonical terminology:
 * - GridMapping → Layout, .cells → .padToVoice, cellKey → padKey, parseCellKey → parsePadKey
 */

import { type Layout } from '../../types/layout';
import { type PadCoord, padKey, parsePadKey } from '../../types/padGrid';

export type Rng = () => number;

/**
 * Returns a list of all 8x8 pad coordinates that do not currently have a Voice assigned.
 */
export function getEmptyPads(layout: Layout): PadCoord[] {
  const emptyPads: PadCoord[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const key = padKey(row, col);
      if (!(key in layout.padToVoice)) {
        emptyPads.push({ row, col });
      }
    }
  }

  return emptyPads;
}

/**
 * Gets a list of all occupied pad coordinates (pads that have a Voice assigned).
 */
function getOccupiedPads(layout: Layout): PadCoord[] {
  const occupiedPads: PadCoord[] = [];

  for (const key of Object.keys(layout.padToVoice)) {
    const coord = parsePadKey(key);
    if (coord) {
      occupiedPads.push(coord);
    }
  }

  return occupiedPads;
}

/**
 * Applies a random mutation to a Layout.
 *
 * Mutation types (probability):
 *   - Swap (35%): Exchange voices between two occupied pads
 *   - Move (35%): Move a voice to an empty pad
 *   - Cluster swap (15%): Swap two adjacent groups of voices
 *   - Row/col shift (15%): Shift all voices in a row or column by ±1
 *
 * Multi-pad mutations (cluster swap, shift) allow the annealing solver to
 * explore non-local layout reorganizations that single-pad mutations cannot reach.
 *
 * @param layout - The Layout to mutate
 * @param rng - Optional RNG (default Math.random). Use seeded RNG for determinism.
 */
export function applyRandomMutation(layout: Layout, rng: Rng = Math.random): Layout {
  const occupiedPads = getOccupiedPads(layout);
  const emptyPads = getEmptyPads(layout);

  if (occupiedPads.length === 0) {
    return layout;
  }

  const roll = rng();

  if (roll < 0.35 && occupiedPads.length >= 2) {
    // Single swap
    const [pad1, pad2] = getRandomPair(occupiedPads, rng);
    return applySwapMutation(layout, pad1, pad2);
  } else if (roll < 0.70 && emptyPads.length > 0) {
    // Single move
    const sourcePad = getRandomElement(occupiedPads, rng);
    const targetPad = getRandomElement(emptyPads, rng);
    return applyMoveMutation(layout, sourcePad, targetPad);
  } else if (roll < 0.85 && occupiedPads.length >= 4) {
    // Cluster swap: swap two groups of adjacent voices
    return applyClusterSwapMutation(layout, occupiedPads, rng);
  } else if (occupiedPads.length >= 2) {
    // Row/col shift: shift occupied pads in a row or column
    return applyShiftMutation(layout, occupiedPads, emptyPads, rng);
  } else if (emptyPads.length > 0) {
    // Fallback to move
    const sourcePad = getRandomElement(occupiedPads, rng);
    const targetPad = getRandomElement(emptyPads, rng);
    return applyMoveMutation(layout, sourcePad, targetPad);
  } else {
    return layout;
  }
}

/**
 * Applies a swap mutation: swaps the Voices assigned to two pads.
 */
function applySwapMutation(
  layout: Layout,
  pad1: PadCoord,
  pad2: PadCoord
): Layout {
  const key1 = padKey(pad1.row, pad1.col);
  const key2 = padKey(pad2.row, pad2.col);

  const voice1 = layout.padToVoice[key1];
  const voice2 = layout.padToVoice[key2];

  if (!voice1 || !voice2) {
    return layout;
  }

  const newPadToVoice = { ...layout.padToVoice };
  newPadToVoice[key1] = voice2;
  newPadToVoice[key2] = voice1;

  const newFingerConstraints = { ...layout.fingerConstraints };
  const constraint1 = layout.fingerConstraints[key1];
  const constraint2 = layout.fingerConstraints[key2];

  if (constraint1 !== undefined) {
    newFingerConstraints[key2] = constraint1;
  } else {
    delete newFingerConstraints[key2];
  }

  if (constraint2 !== undefined) {
    newFingerConstraints[key1] = constraint2;
  } else {
    delete newFingerConstraints[key1];
  }

  return {
    ...layout,
    padToVoice: newPadToVoice,
    fingerConstraints: newFingerConstraints,
    scoreCache: null,
  };
}

/**
 * Applies a move mutation: moves a Voice from one pad to an empty pad.
 */
function applyMoveMutation(
  layout: Layout,
  sourcePad: PadCoord,
  targetPad: PadCoord
): Layout {
  const sourceKey = padKey(sourcePad.row, sourcePad.col);
  const targetKey = padKey(targetPad.row, targetPad.col);

  const voice = layout.padToVoice[sourceKey];

  if (!voice) {
    return layout;
  }

  if (layout.padToVoice[targetKey]) {
    return layout;
  }

  const newPadToVoice = { ...layout.padToVoice };
  newPadToVoice[targetKey] = voice;
  delete newPadToVoice[sourceKey];

  const newFingerConstraints = { ...layout.fingerConstraints };
  const constraint = layout.fingerConstraints[sourceKey];

  if (constraint !== undefined) {
    newFingerConstraints[targetKey] = constraint;
    delete newFingerConstraints[sourceKey];
  } else {
    delete newFingerConstraints[targetKey];
  }

  return {
    ...layout,
    padToVoice: newPadToVoice,
    fingerConstraints: newFingerConstraints,
    scoreCache: null,
  };
}

/**
 * Cluster swap: picks two occupied pads and swaps each with its nearest
 * occupied neighbor. This effectively swaps two 2-pad clusters,
 * allowing the annealing solver to reorganize local groups.
 */
function applyClusterSwapMutation(
  layout: Layout,
  occupiedPads: PadCoord[],
  rng: Rng
): Layout {
  // Pick two random occupied pads as cluster seeds
  const [seed1, seed2] = getRandomPair(occupiedPads, rng);

  // Find nearest occupied neighbor of each seed (excluding each other)
  const neighbor1 = findNearestOccupied(seed1, occupiedPads, new Set([padKey(seed2.row, seed2.col)]));
  const neighbor2 = findNearestOccupied(seed2, occupiedPads, new Set([padKey(seed1.row, seed1.col)]));

  if (!neighbor1 || !neighbor2) {
    // Fall back to simple swap if no valid neighbors
    return applySwapMutation(layout, seed1, seed2);
  }

  // Swap seed1 ↔ seed2, then neighbor1 ↔ neighbor2
  let result = applySwapMutation(layout, seed1, seed2);
  // Only swap neighbors if they are different pads
  const n1Key = padKey(neighbor1.row, neighbor1.col);
  const n2Key = padKey(neighbor2.row, neighbor2.col);
  if (n1Key !== n2Key) {
    result = applySwapMutation(result, neighbor1, neighbor2);
  }
  return result;
}

/**
 * Finds the nearest occupied pad to `target`, excluding pads in `exclude`.
 */
function findNearestOccupied(
  target: PadCoord,
  occupiedPads: PadCoord[],
  exclude: Set<string>
): PadCoord | null {
  let best: PadCoord | null = null;
  let bestDist = Infinity;
  const targetKey = padKey(target.row, target.col);

  for (const pad of occupiedPads) {
    const key = padKey(pad.row, pad.col);
    if (key === targetKey || exclude.has(key)) continue;
    const dist = Math.abs(pad.row - target.row) + Math.abs(pad.col - target.col);
    if (dist < bestDist) {
      bestDist = dist;
      best = pad;
    }
  }
  return best;
}

/**
 * Shift mutation: picks a random row or column containing occupied pads
 * and shifts all voices in that row/col by +1 or -1, wrapping into empty slots.
 * Voices that would collide with occupied pads outside the shift group are skipped.
 */
function applyShiftMutation(
  layout: Layout,
  occupiedPads: PadCoord[],
  emptyPads: PadCoord[],
  rng: Rng
): Layout {
  const emptySet = new Set(emptyPads.map(p => padKey(p.row, p.col)));
  const shiftRow = rng() < 0.5;
  const direction = rng() < 0.5 ? 1 : -1;

  if (shiftRow) {
    // Pick a random row that has occupied pads
    const rowCounts = new Map<number, PadCoord[]>();
    for (const pad of occupiedPads) {
      const arr = rowCounts.get(pad.row) ?? [];
      arr.push(pad);
      rowCounts.set(pad.row, arr);
    }
    const rows = [...rowCounts.keys()];
    if (rows.length === 0) return layout;
    const targetRow = getRandomElement(rows, rng);
    const padsInRow = rowCounts.get(targetRow)!;

    // Check if all shifted positions are valid (empty or part of the shift group)
    const shiftGroupKeys = new Set(padsInRow.map(p => padKey(p.row, p.col)));
    const moves: Array<{ from: PadCoord; to: PadCoord }> = [];
    let valid = true;

    for (const pad of padsInRow) {
      const newCol = pad.col + direction;
      if (newCol < 0 || newCol > 7) { valid = false; break; }
      const newKey = padKey(pad.row, newCol);
      if (!emptySet.has(newKey) && !shiftGroupKeys.has(newKey)) { valid = false; break; }
      moves.push({ from: pad, to: { row: pad.row, col: newCol } });
    }

    if (valid && moves.length > 0) {
      return applyMultiMove(layout, moves);
    }
  } else {
    // Pick a random column that has occupied pads
    const colCounts = new Map<number, PadCoord[]>();
    for (const pad of occupiedPads) {
      const arr = colCounts.get(pad.col) ?? [];
      arr.push(pad);
      colCounts.set(pad.col, arr);
    }
    const cols = [...colCounts.keys()];
    if (cols.length === 0) return layout;
    const targetCol = getRandomElement(cols, rng);
    const padsInCol = colCounts.get(targetCol)!;

    const shiftGroupKeys = new Set(padsInCol.map(p => padKey(p.row, p.col)));
    const moves: Array<{ from: PadCoord; to: PadCoord }> = [];
    let valid = true;

    for (const pad of padsInCol) {
      const newRow = pad.row + direction;
      if (newRow < 0 || newRow > 7) { valid = false; break; }
      const newKey = padKey(newRow, pad.col);
      if (!emptySet.has(newKey) && !shiftGroupKeys.has(newKey)) { valid = false; break; }
      moves.push({ from: pad, to: { row: newRow, col: pad.col } });
    }

    if (valid && moves.length > 0) {
      return applyMultiMove(layout, moves);
    }
  }

  // Fallback: simple swap if shift wasn't possible
  if (occupiedPads.length >= 2) {
    const [pad1, pad2] = getRandomPair(occupiedPads, rng);
    return applySwapMutation(layout, pad1, pad2);
  }
  return layout;
}

/**
 * Applies multiple simultaneous moves (voice relocations).
 * All moves happen atomically: sources are cleared first, then targets are set.
 */
function applyMultiMove(
  layout: Layout,
  moves: Array<{ from: PadCoord; to: PadCoord }>
): Layout {
  const newPadToVoice = { ...layout.padToVoice };
  const newFingerConstraints = { ...layout.fingerConstraints };

  // Collect all voices and constraints before moving
  const collected: Array<{
    voice: (typeof layout.padToVoice)[string];
    constraint: (typeof layout.fingerConstraints)[string] | undefined;
    to: PadCoord;
  }> = [];

  for (const { from, to } of moves) {
    const fromKey = padKey(from.row, from.col);
    collected.push({
      voice: newPadToVoice[fromKey],
      constraint: newFingerConstraints[fromKey],
      to,
    });
    delete newPadToVoice[fromKey];
    delete newFingerConstraints[fromKey];
  }

  // Place at new positions
  for (const { voice, constraint, to } of collected) {
    if (!voice) continue;
    const toKey = padKey(to.row, to.col);
    newPadToVoice[toKey] = voice;
    if (constraint !== undefined) {
      newFingerConstraints[toKey] = constraint;
    }
  }

  return {
    ...layout,
    padToVoice: newPadToVoice,
    fingerConstraints: newFingerConstraints,
    scoreCache: null,
  };
}

/**
 * Zone transfer mutation: moves a voice from one hand zone to the opposite zone.
 *
 * Left zone = cols 0-3, Right zone = cols 4-7.
 * Picks a random occupied pad, finds empty pads in the opposite zone,
 * and moves the voice there. This encourages hand-balance exploration
 * during deep optimization by crossing the zone boundary.
 *
 * Falls back to applyRandomMutation if no valid transfer target exists.
 */
export function applyZoneTransferMutation(layout: Layout, rng: Rng = Math.random): Layout {
  const occupiedPads = getOccupiedPads(layout);
  if (occupiedPads.length === 0) return layout;

  // Pick a random occupied pad as the source
  const sourcePad = occupiedPads[Math.floor(rng() * occupiedPads.length)];
  const sourceZone = sourcePad.col < 4 ? 'left' : 'right';

  // Find empty pads in the opposite zone
  const emptyPads = getEmptyPads(layout);
  const oppositeZoneEmpty = emptyPads.filter(p =>
    sourceZone === 'left' ? p.col >= 4 : p.col < 4
  );

  if (oppositeZoneEmpty.length === 0) {
    // No empty pads in opposite zone — fall back to standard mutation
    return applyRandomMutation(layout, rng);
  }

  // Pick a random empty pad in the opposite zone
  const targetPad = oppositeZoneEmpty[Math.floor(rng() * oppositeZoneEmpty.length)];

  // Move the voice: replicates applyMoveMutation logic inline since it's private
  const sourceKey = padKey(sourcePad.row, sourcePad.col);
  const targetKey = padKey(targetPad.row, targetPad.col);

  const voice = layout.padToVoice[sourceKey];
  if (!voice) return layout;

  const newPadToVoice = { ...layout.padToVoice };
  newPadToVoice[targetKey] = voice;
  delete newPadToVoice[sourceKey];

  const newFingerConstraints = { ...layout.fingerConstraints };
  const constraint = layout.fingerConstraints[sourceKey];

  if (constraint !== undefined) {
    newFingerConstraints[targetKey] = constraint;
    delete newFingerConstraints[sourceKey];
  } else {
    delete newFingerConstraints[targetKey];
  }

  return {
    ...layout,
    padToVoice: newPadToVoice,
    fingerConstraints: newFingerConstraints,
    scoreCache: null,
  };
}

function getRandomElement<T>(array: T[], rng: Rng = Math.random): T {
  return array[Math.floor(rng() * array.length)];
}

function getRandomPair<T>(array: T[], rng: Rng = Math.random): [T, T] {
  if (array.length < 2) {
    throw new Error('Array must have at least 2 elements to get a pair');
  }
  const index1 = Math.floor(rng() * array.length);
  let index2 = Math.floor(rng() * array.length);
  while (index2 === index1) {
    index2 = Math.floor(rng() * array.length);
  }
  return [array[index1], array[index2]];
}
