/**
 * Shared moment grouping (roadmap P1b, T22 base; criteria P1b-2b and P1b-2c).
 *
 * groupIntoMoments puts everything struck within MOMENT_EPSILON of a moment's
 * first note into that moment, momentKey is stable across re-analysis and
 * solvers, and a moment's cost is read once, so it doesn't grow with the number
 * of notes in the moment. The same checks on real Greedy, Beam and Annealing
 * plans (keys match the performance's, one cost per moment) are in
 * test/engine/optimization/testMidi1Integration.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  groupIntoMoments,
  momentKey,
  summarizeMomentCost,
} from '../../../src/engine';
import { MOMENT_EPSILON } from '../../../src/types/performanceEvent';
import { type FingerAssignment, type DifficultyLevel } from '../../../src/types/executionPlan';
import { type V1CostBreakdown } from '../../../src/types/diagnostics';

const note = (startTime: number, voiceId?: string) => ({ startTime, voiceId });

describe('groupIntoMoments', () => {
  it('uses the canonical 25 ms window by default', () => {
    expect(MOMENT_EPSILON).toBe(0.025);
  });

  it('keeps a note exactly epsilon after the first note in the same moment', () => {
    const moments = groupIntoMoments([note(0, 'a'), note(0.025, 'b')]);
    expect(moments).toHaveLength(1);
    expect(moments[0].items.map(i => i.voiceId)).toEqual(['a', 'b']);
  });

  it('starts a new moment just past epsilon', () => {
    const moments = groupIntoMoments([note(0, 'a'), note(0.0251, 'b')]);
    expect(moments.map(m => m.items.length)).toEqual([1, 1]);
    expect(moments.map(m => m.index)).toEqual([0, 1]);
  });

  it('anchors the window at the moment’s first note, not the previous note', () => {
    // 0 → 0.02 → 0.04: each gap is under epsilon, but 0.04 is past the anchor's window.
    const moments = groupIntoMoments([note(0, 'a'), note(0.02, 'b'), note(0.04, 'c')]);
    expect(moments.map(m => m.items.map(i => i.voiceId))).toEqual([['a', 'b'], ['c']]);
    expect(moments[1].startTime).toBe(0.04);
  });

  it('groups a chord into one moment and a humanized chord too', () => {
    const moments = groupIntoMoments([
      note(1, 'kick'), note(1, 'snare'), note(1, 'hat'),
      note(2, 'kick'), note(2.004, 'snare'), note(2.011, 'hat'),
      note(3, 'hat'),
    ]);
    expect(moments.map(m => m.items.length)).toEqual([3, 3, 1]);
    expect(moments.map(m => m.startTime)).toEqual([1, 2, 3]);
  });

  it('sorts its input and keeps input order within a tie', () => {
    const moments = groupIntoMoments([note(2, 'x'), note(1, 'b'), note(1, 'a')]);
    expect(moments.map(m => m.items.map(i => i.voiceId))).toEqual([['b', 'a'], ['x']]);
  });

  it('returns nothing for no items', () => {
    expect(groupIntoMoments([])).toEqual([]);
  });
});

describe('momentKey', () => {
  it('is quantised time plus the sorted, de-duplicated Sound ids', () => {
    expect(momentKey(1.2344, ['snare', 'kick', 'kick'])).toBe('1234:kick+snare');
    expect(momentKey(1.2341, ['kick', 'snare'])).toBe(momentKey(1.2344, ['snare', 'kick']));
  });

  it('does not depend on the order of the notes', () => {
    const a = groupIntoMoments([note(1, 'a'), note(1.01, 'b'), note(1.02, 'c')]);
    const b = groupIntoMoments([note(1.02, 'c'), note(1, 'a'), note(1.01, 'b')]);
    expect(a[0].key).toBe(b[0].key);
  });
});

function breakdown(total: number): V1CostBreakdown {
  return {
    fingerPreference: 1, handShapeDeviation: 0.5, transitionCost: total - 4.5,
    alternation: 2, handBalance: 0.5, constraintPenalty: 0.5, total,
  };
}

function assignment(i: number, cost: V1CostBreakdown, difficulty: DifficultyLevel = 'Medium'): FingerAssignment {
  return {
    noteNumber: 36 + i, voiceId: `s${i}`, startTime: 1, assignedHand: 'right', finger: 'index',
    cost: cost.total, costBreakdown: cost, difficulty, eventIndex: i, row: 0, col: i,
  };
}

function unplayable(i: number): FingerAssignment {
  return {
    noteNumber: 36 + i, voiceId: `s${i}`, startTime: 1, assignedHand: 'Unplayable', finger: null,
    cost: Infinity, costBreakdown: { ...breakdown(0), total: Infinity }, difficulty: 'Unplayable', eventIndex: i,
  };
}

describe('summarizeMomentCost', () => {
  it('P1b-2b: a 3-note moment and a 1-note moment with the same breakdown cost the same', () => {
    const b = breakdown(7);
    const chord = summarizeMomentCost([assignment(0, b), assignment(1, b), assignment(2, b)]);
    const single = summarizeMomentCost([assignment(0, b)]);
    expect(chord.cost).toBe(7);
    expect(chord.cost).toBe(single.cost);
    expect(chord.breakdown).toEqual(single.breakdown);
    expect(chord.noteCount).toBe(3);
    expect(single.noteCount).toBe(1);
  });

  it('marks a moment with any unplayable note Unplayable and never reads it as zero cost', () => {
    const partial = summarizeMomentCost([assignment(0, breakdown(5)), unplayable(1)]);
    expect(partial.difficulty).toBe('Unplayable');
    expect(partial.unplayableNoteCount).toBe(1);

    const none = summarizeMomentCost([unplayable(0), unplayable(1)]);
    expect(none.breakdown).toBeNull();
    expect(none.cost).toBe(Infinity);
    expect(none.difficulty).toBe('Unplayable');
  });

  it('takes the worst note difficulty', () => {
    const b = breakdown(6);
    expect(summarizeMomentCost([assignment(0, b, 'Easy'), assignment(1, b, 'Hard')]).difficulty).toBe('Hard');
  });
});
