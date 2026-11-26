/**
 * Which considered moves a greedy iteration keeps in its trace.
 *
 * A hill-climb step weighs up to 500 moves. Keeping every one, each with its
 * full evaluation, made a candidate's trace 90–190 MB on an 8-bar loop and
 * stopped greedy finishing on longer material. The trace keeps the moves its
 * surfaces show, plus how many were weighed:
 * - the chosen move;
 * - the TRACE_BEST_MOVES best (lowest cost change), a superset of the trace
 *   panel's top four;
 * - the spatial highlights: the three best and three worst moves that relocate
 *   a Sound, and the chosen one if it does (the grid's Visual Debugger arrows).
 *
 * The sample keeps the moves' original order, so sorting it ranks ties as
 * sorting the full list did, and the panel and the overlay show the same moves.
 */

import { type CandidateMoveRecord } from './optimizerInterface';

/** Best moves (lowest cost change) each iteration keeps. */
export const TRACE_BEST_MOVES = 8;
/** Best and worst Sound-relocating moves the grid overlay draws, each. */
export const SPATIAL_HIGHLIGHTS_PER_END = 3;

/** A move that relocates a Sound between two pads (pad moves and swaps), drawn as an arrow. */
export function isSpatialMove(move: CandidateMoveRecord): boolean {
  return !!move.fromPadKey && !!move.toPadKey && move.fromPadKey !== move.toPadKey;
}

/** Indices of the `n` lowest-delta moves among `indices`, ties in original order. */
function lowest(moves: readonly CandidateMoveRecord[], indices: number[], n: number): number[] {
  return [...indices].sort((a, b) => moves[a]!.deltaTotal - moves[b]!.deltaTotal || a - b).slice(0, n);
}

/** Indices of the `n` highest-delta moves among `indices`, ties in original order. */
function highest(moves: readonly CandidateMoveRecord[], indices: number[], n: number): number[] {
  return [...indices].sort((a, b) => moves[b]!.deltaTotal - moves[a]!.deltaTotal || a - b).slice(0, n);
}

function spatialHighlightIndices(moves: readonly CandidateMoveRecord[]): Set<number> {
  const spatial = moves.flatMap((m, i) => (isSpatialMove(m) ? [i] : []));
  return new Set([
    ...lowest(moves, spatial, SPATIAL_HIGHLIGHTS_PER_END),
    ...highest(moves, spatial, SPATIAL_HIGHLIGHTS_PER_END),
    ...spatial.filter(i => moves[i]!.accepted),
  ]);
}

/**
 * The Sound-relocating moves the Visual Debugger draws: the three best, the
 * three worst and the chosen one, in their original order.
 */
export function spatialHighlights(moves: readonly CandidateMoveRecord[]): CandidateMoveRecord[] {
  const keep = spatialHighlightIndices(moves);
  return moves.filter((_, i) => keep.has(i));
}

/** The moves an iteration's trace keeps (see the module comment), in their original order. */
export function sampleTraceMoves(moves: readonly CandidateMoveRecord[]): CandidateMoveRecord[] {
  const all = moves.map((_, i) => i);
  const keep = new Set([
    ...all.filter(i => moves[i]!.accepted),
    ...lowest(moves, all, TRACE_BEST_MOVES),
    ...spatialHighlightIndices(moves),
  ]);
  return moves.filter((_, i) => keep.has(i));
}
