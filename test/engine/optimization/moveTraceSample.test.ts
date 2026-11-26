/**
 * The moves a greedy iteration keeps in its trace (moveTraceSample.ts): a sample
 * that still shows the trace panel and the Visual Debugger exactly what the
 * full list of considered moves would.
 */

import { describe, it, expect } from 'vitest';
import {
  SPATIAL_HIGHLIGHTS_PER_END,
  TRACE_BEST_MOVES,
  isSpatialMove,
  sampleTraceMoves,
  spatialHighlights,
} from '../../../src/engine/optimization/moveTraceSample';
import { type CandidateMoveRecord } from '../../../src/engine/optimization/optimizerInterface';
import { createSeededRng } from '../../../src/utils/seededRng';

function move(i: number, deltaTotal: number, kind: 'move' | 'finger' = 'move', accepted = false): CandidateMoveRecord {
  return kind === 'move'
    ? { moveType: 'pad_move', description: `Move ${i}`, fromPadKey: `${i % 8},0`, toPadKey: `${i % 8},1`, deltaTotal, accepted }
    : { moveType: 'finger_reassignment', description: `Finger ${i}`, fromPadKey: `${i % 8},2`, toPadKey: `${i % 8},2`, deltaTotal, accepted };
}

/** What the trace panel lists for a step: the four lowest deltas (MoveTracePanel StepDetail). */
const panelTop4 = (moves: readonly CandidateMoveRecord[]) =>
  [...moves].sort((a, b) => a.deltaTotal - b.deltaTotal).slice(0, 4);

describe('sampleTraceMoves', () => {
  it('keeps a short list whole, in order', () => {
    const moves = [move(0, 2), move(1, -1, 'finger', true), move(2, 0.5)];
    expect(sampleTraceMoves(moves)).toEqual(moves);
  });

  it('keeps the chosen move, the best few and the best and worst Sound moves, in their original order', () => {
    // 40 finger moves (not spatial) and 40 pad moves; the chosen move is mid-pack.
    const moves = [
      ...Array.from({ length: 40 }, (_, i) => move(i, i - 20, 'finger')),
      ...Array.from({ length: 40 }, (_, i) => move(40 + i, (i - 20) / 10)),
    ];
    moves[60] = { ...moves[60]!, accepted: true };
    const sample = sampleTraceMoves(moves);

    expect(sample).toContain(moves[60]);
    const byDelta = [...moves].sort((a, b) => a.deltaTotal - b.deltaTotal);
    for (const best of byDelta.slice(0, TRACE_BEST_MOVES)) expect(sample).toContain(best);
    const spatial = byDelta.filter(isSpatialMove);
    for (const m of [...spatial.slice(0, SPATIAL_HIGHLIGHTS_PER_END), ...spatial.slice(-SPATIAL_HIGHLIGHTS_PER_END)]) {
      expect(sample).toContain(m);
    }
    expect(sample.length).toBeLessThanOrEqual(1 + TRACE_BEST_MOVES + 2 * SPATIAL_HIGHLIGHTS_PER_END);
    // Original order, so sorting the sample ranks ties as sorting the full list does.
    expect(sample).toEqual(moves.filter(m => sample.includes(m)));
  });

  it('shows the trace panel and the Visual Debugger the same moves as the full list (random lists, ties included)', () => {
    const rng = createSeededRng(7);
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rng() * 120);
      const moves = Array.from({ length: n }, (_, i) =>
        // Deltas on a coarse grid so ties are common.
        move(i, Math.round((rng() - 0.6) * 10) / 2, rng() < 0.4 ? 'finger' : 'move'));
      const chosen = Math.floor(rng() * n);
      moves[chosen] = { ...moves[chosen]!, accepted: true };

      const sample = sampleTraceMoves(moves);
      expect(panelTop4(sample)).toEqual(panelTop4(moves));
      expect(spatialHighlights(sample)).toEqual(spatialHighlights(moves));
      expect(sample).toContain(moves[chosen]);
    }
  });
});

describe('spatialHighlights', () => {
  it('draws only moves that relocate a Sound: the best three, the worst three and the chosen one', () => {
    const moves = [
      ...Array.from({ length: 10 }, (_, i) => move(i, i)),
      move(10, -100, 'finger'),
    ];
    moves[5] = { ...moves[5]!, accepted: true };
    expect(spatialHighlights(moves).map(m => m.description))
      .toEqual(['Move 0', 'Move 1', 'Move 2', 'Move 5', 'Move 7', 'Move 8', 'Move 9']);
  });
});
