/**
 * What a greedy iteration trace must stay: compact (a sample of the moves each
 * step weighed, with the counts) and still replayable (each step's state, its
 * chosen move and the state after agree). See moveTraceSample.ts.
 */

import { expect } from 'vitest';
import { type OptimizationIteration } from '../../src/engine/optimization/optimizerInterface';
import { SPATIAL_HIGHLIGHTS_PER_END, TRACE_BEST_MOVES } from '../../src/engine/optimization/moveTraceSample';

const FACTORS = ['alternation', 'constraintPenalty', 'handBalance', 'poseNaturalness', 'total', 'transitionCost'];

export function expectCompactReplayableTrace(trace: readonly OptimizationIteration[]): void {
  for (const [i, step] of trace.entries()) {
    // A bounded sample, the count of all it weighed, and always the chosen move.
    expect(step.candidateMoves.length).toBeLessThanOrEqual(1 + TRACE_BEST_MOVES + 2 * SPATIAL_HIGHLIGHTS_PER_END);
    expect(step.candidateMoveCount).toBeGreaterThanOrEqual(step.candidateMoves.length);
    expect(step.blockedMoveCount).toBeLessThanOrEqual(step.candidateMoveCount);
    expect(step.candidateMoves).toContain(step.chosenMove);
    expect(step.candidateMoves.filter(m => m.accepted)).toEqual([step.chosenMove]);

    // Hill-climb moves carry their change per cost factor, not the whole evaluation.
    for (const m of step.candidateMoves) {
      expect(m).not.toHaveProperty('costBreakdown');
      if (step.phase === 'hill-climb') expect(Object.keys(m.factorDeltas!).sort()).toEqual(FACTORS);
    }

    // Replay: the state before, the chosen move, the state after.
    const before = step.stateBefore.layout.padToVoice;
    const after = step.stateAfter!.layout.padToVoice;
    const move = step.chosenMove!;
    if (move.moveType === 'pad_swap') {
      expect(after[move.toPadKey!]).toBe(before[move.fromPadKey!]);
      expect(after[move.fromPadKey!]).toBe(before[move.toPadKey!]);
    } else if (move.moveType === 'pad_move' && move.fromPadKey) {
      expect(after[move.toPadKey!]).toBe(before[move.fromPadKey]);
      expect(after[move.fromPadKey]).toBeUndefined();
    } else if (move.moveType === 'pad_move') {
      // A placement: the Sound lands on the chosen pad.
      expect(after[move.toPadKey!]?.id).toBe(move.targetId);
      expect(Object.keys(after)).toHaveLength(Object.keys(before).length + 1);
    } else {
      expect(after).toEqual(before);
    }

    // Consecutive steps of one attempt and phase share their state rather than
    // copying it, and the chosen move's canonical change is the next step's start.
    const next = trace[i + 1];
    if (next && next.attemptIndex === step.attemptIndex && next.phase === step.phase) {
      expect(next.stateBefore.layout).toBe(step.stateAfter!.layout);
      expect(next.stateBefore.assignment).toEqual(step.stateAfter!.assignment);
      if (step.phase === 'hill-climb') {
        expect(step.scoreBefore + move.factorDeltas!.total).toBeCloseTo(next.scoreBefore, 6);
      }
    }
  }
}
