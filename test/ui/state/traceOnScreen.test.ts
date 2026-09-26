/**
 * S3.4 · the trace follows the candidate (T33, P3-9).
 *
 * MoveTracePanel stays bound to state.moveHistory (CLAUDE.md Do-Not-Regress),
 * so the reducer keeps moveHistory, iterationTrace, moveHistoryStopReason and
 * traceSubject on the trace on screen: the inspected candidate's, else the
 * run's candidate A's, or the promoted candidate's once one is promoted. The
 * trace is session state: Undo never restores it, and it never enters history.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyProjectState,
  getActiveTrace,
  hasTraceOnScreen,
  isReplayingTrace,
  projectReducer,
  withPromotedTrace,
  type ProjectAction,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { documentChanged, pickDocument, restoreDocument } from '../../../src/ui/state/projectDocument';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type OptimizerMove, type OptimizationIteration } from '../../../src/engine/optimization/optimizerInterface';
import { type AnnealingIterationSnapshot } from '../../../src/types/executionPlan';
import { importTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const inspect = (id: string | null): ProjectAction =>
  ({ type: 'INSPECT_LAYOUT', payload: id ? { kind: 'candidate', id } : null });

function candidateLayout(state: ProjectState, id: string, pads: string[]): Layout {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i]!;
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  return { ...state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' };
}

function fake(id: string, state: ProjectState, pads: string[], trace: Partial<CandidateSolution>): CandidateSolution {
  const layout = candidateLayout(state, id, pads);
  return {
    id,
    layout,
    executionPlan: { layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' }, fingerAssignments: [] },
    metadata: { strategy: 'pose0-offset-0', seed: 0 },
    ...trace,
  } as unknown as CandidateSolution;
}

const moves = (n: number): OptimizerMove[] => Array.from({ length: n }, (_, i) => ({
  iteration: i, type: 'pad_move', description: `move ${i}`, costBefore: 10 - i, costAfter: 9 - i, costDelta: -1, reason: 'cheaper', phase: 'hill-climb',
}));
const iterations = (layout: Layout, n: number): OptimizationIteration[] => Array.from({ length: n }, (_, i) => ({
  iterationIndex: i, phase: 'hill-climb', scoreBefore: 10 - i, scoreAfter: 9 - i, netDelta: -1,
  stateBefore: { layout, assignment: {} }, candidateMoves: [], chosenMove: null, summary: `step ${i}`,
}) as OptimizationIteration);
const snapshots = (n: number): AnnealingIterationSnapshot[] => Array.from({ length: n }, (_, i) => ({
  iteration: i, temperature: 100 / (i + 1), currentCost: 50 - i, bestCost: 50 - i, accepted: true, deltaCost: 0,
  transitionSum: 0, fingerPreferenceSum: 0, handShapeDeviationSum: 0, handBalanceSum: 0, constraintPenaltySum: 0, restartIndex: 0,
}));

/** A draft on [7,0]+[7,1]; a greedy run's candidates A (greedy trace), B (annealing), C (beam). */
async function generated(): Promise<{ state: ProjectState; a: CandidateSolution; b: CandidateSolution; c: CandidateSolution }> {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-trace' };
  const place = (padKey: string, i: number): ProjectAction => ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });
  state = reduce(state, place('7,0', 0), place('7,1', 1));
  const aLayout = candidateLayout(state, 'cand-a', ['4,4', '4,5']);
  const a = fake('cand-a', state, ['4,4', '4,5'], { moveHistory: moves(3), iterationTrace: iterations(aLayout, 3), stopReason: 'no_improving_move' });
  const b = fake('cand-b', state, ['5,5', '5,6'], { annealingTrace: snapshots(40), stopReason: 'time_budget', telemetry: { wallClockMs: 1, iterationsCompleted: 40, initialCost: 50, finalCost: 11, improvement: 0.7 } });
  const c = fake('cand-c', state, ['6,5', '6,6'], { beamSummary: { beamWidth: 16, noteCount: 48, layoutStrategy: 'baseline', wallClockMs: 30 }, stopReason: 'completed' });
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [a, b, c] });
  return { state, a, b, c };
}

/** The trace fields MoveTracePanel reads, by identity. */
const onScreen = (s: ProjectState) => ({
  candidateId: s.traceSubject?.candidateId ?? null,
  letter: s.traceSubject?.letter ?? null,
  moves: s.moveHistory,
  iterations: s.iterationTrace,
  stopReason: s.moveHistoryStopReason,
  annealing: s.traceSubject?.annealing ?? null,
  beam: s.traceSubject?.beam ?? null,
});

const traceOf = (c: CandidateSolution, letter: string) => ({
  candidateId: c.id,
  letter,
  moves: c.moveHistory ?? null,
  iterations: c.iterationTrace ?? null,
  stopReason: c.stopReason ?? null,
  annealing: c.annealingTrace ?? null,
  beam: c.beamSummary ?? null,
});

describe('the trace on screen (T33)', () => {
  it('after Generate, the trace fields hold candidate A’s own trace, which is also the resting one', async () => {
    const { state, a } = await generated();
    expect(state.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-a' });
    expect(onScreen(state)).toEqual(traceOf(a, 'A'));
    expect(state.moveHistory).toBe(a.moveHistory);
    expect(state.iterationTrace).toBe(a.iterationTrace);
    expect(getActiveTrace(state)).toBe(a.iterationTrace);
    expect(state.restingTrace).toMatchObject({ candidateId: 'cand-a', letter: 'A', promoted: false });
    expect(hasTraceOnScreen(state)).toBe(true);
  });

  it('inspecting a candidate loads its trace into state, whatever its method; Back to my draft shows A’s again', async () => {
    const { state, a, b, c } = await generated();
    const onB = reduce(state, inspect('cand-b'));
    expect(onScreen(onB)).toEqual(traceOf(b, 'B'));
    expect(onB.traceSubject?.annealing).toBe(b.annealingTrace);
    expect(onB.moveHistory).toBeNull();
    expect(hasTraceOnScreen(onB)).toBe(true);
    const onC = reduce(onB, inspect('cand-c'));
    expect(onScreen(onC)).toEqual(traceOf(c, 'C'));
    expect(onC.moveHistoryStopReason).toBe('completed');
    expect(hasTraceOnScreen(onC)).toBe(true);
    // Showing the draft, Active or nothing inspected: the run's candidate A.
    expect(onScreen(reduce(onC, inspect(null)))).toEqual(traceOf(a, 'A'));
    expect(onScreen(reduce(onC, { type: 'INSPECT_LAYOUT', payload: { kind: 'active', id: state.activeLayout.id } }))).toEqual(traceOf(a, 'A'));
  });

  it('a replay step belongs to its trace: switching candidates ends it', async () => {
    const { state } = await generated();
    const replaying = reduce(state, { type: 'SET_MOVE_HISTORY_INDEX', payload: 1 });
    expect(isReplayingTrace(replaying)).toBe(true);
    expect(reduce(replaying, inspect('cand-b')).moveHistoryIndex).toBeNull();
    // Back to A's own trace from B starts afresh too.
    const onB = reduce(state, inspect('cand-b'));
    expect(reduce(onB, inspect('cand-a'), { type: 'SET_MOVE_HISTORY_INDEX', payload: 2 }).moveHistoryIndex).toBe(2);
  });

  it('looking at traces never changes the document or enters undo history', async () => {
    const { state } = await generated();
    let s = state;
    for (const id of ['cand-b', 'cand-c', null, 'cand-a', 'cand-b']) {
      const next = reduce(s, inspect(id));
      expect(documentChanged(pickDocument(s), pickDocument(next))).toBe(false);
      s = next;
    }
  });
});

describe('traces survive promotion (T33, P3-9)', () => {
  it('promoting a candidate keeps its trace and stop reason on screen, named by its letter, after it leaves the list', async () => {
    const { state, a, b } = await generated();
    const promoted = reduce(state, inspect('cand-b'), { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(promoted.candidates.map(x => x.id)).toEqual(['cand-a', 'cand-c']);
    expect(promoted.inspectedLayout).toBeNull();
    expect(onScreen(promoted)).toEqual(traceOf(b, 'B'));
    expect(promoted.moveHistoryStopReason).toBe('time_budget');
    expect(promoted.restingTrace).toMatchObject({ candidateId: 'cand-b', letter: 'B', promoted: true });
    // It stays the trace shown with nothing inspected: inspecting another and coming back returns to it.
    expect(onScreen(reduce(promoted, inspect('cand-a')))).toEqual(traceOf(a, 'A'));
    expect(onScreen(reduce(promoted, inspect('cand-a'), inspect(null)))).toEqual(traceOf(b, 'B'));
  });

  it('a candidate promoted from its card while another is inspected brings its own trace', async () => {
    const { state, c } = await generated();
    expect(state.inspectedLayout?.id).toBe('cand-a');
    const promoted = reduce(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-c' } });
    expect(onScreen(promoted)).toEqual(traceOf(c, 'C'));
  });

  it('withPromotedTrace is the one carry-over: it makes the promoted candidate’s trace the resting one', async () => {
    const { state, b } = await generated();
    const after = withPromotedTrace(state, { ...state, candidates: state.candidates.filter(x => x.id !== 'cand-b') }, b);
    expect(after.restingTrace).toMatchObject({ candidateId: 'cand-b', letter: 'B', promoted: true, stopReason: 'time_budget' });
    expect(after.restingTrace?.annealing).toBe(b.annealingTrace);
  });

  it('Undo of the promotion keeps the trace: the trace is session state', async () => {
    const { state, b } = await generated();
    const promoted = reduce(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    const undone = restoreDocument(promoted, pickDocument(state), [b]);
    expect(undone.candidates.map(x => x.id)).toEqual(['cand-a', 'cand-c', 'cand-b']);
    expect(onScreen(undone)).toEqual(traceOf(b, 'B'));
  });

  it('an Undo that ends an inspection shows the resting trace again', async () => {
    const { state, a } = await generated();
    const place: ProjectAction = { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: state.soundStreams[2]! } };
    const edited = reduce(state, inspect(null), place);
    const onB = reduce(edited, inspect('cand-b'));
    const undone = restoreDocument(onB, pickDocument(reduce(state, inspect(null))));
    expect(undone.inspectedLayout).toBeNull();
    expect(onScreen(undone)).toEqual(traceOf(a, 'A'));
  });
});

describe('what replaces the resting trace', () => {
  it('a new run shows its own first candidate’s trace; a run with no candidates leaves none', async () => {
    const { state, b } = await generated();
    const promoted = reduce(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    const next = fake('cand-n', promoted, ['1,1', '1,2'], { moveHistory: moves(2), stopReason: 'iteration_cap' });
    const rerun = reduce(promoted, { type: 'SET_CANDIDATES', payload: [next] });
    // Letters run on through the session (S3.3): the first run had A–C, so this one starts at D.
    expect(onScreen(rerun)).toEqual(traceOf(next, 'D'));
    expect(onScreen(reduce(rerun, inspect(null)))).toEqual(traceOf(next, 'D'));
    const empty = reduce(rerun, { type: 'SET_CANDIDATES', payload: [] });
    expect(onScreen(empty)).toEqual({ candidateId: null, letter: null, moves: null, iterations: null, stopReason: null, annealing: null, beam: null });
    expect(hasTraceOnScreen(empty)).toBe(false);
    expect(b.stopReason).toBe('time_budget');
  });

  it('a "Place remaining" run shows its candidate’s trace once inspection ends, like a Generate run', async () => {
    const { state } = await generated();
    const fill = fake('cand-f', state, ['2,2', '2,3'], { stopReason: 'completed' });
    const added = reduce(state, { type: 'ADD_CANDIDATE_RUN', payload: [fill] });
    expect(onScreen(added)).toEqual(traceOf(fill, 'D'));
    expect(onScreen(reduce(added, inspect(null)))).toEqual(traceOf(fill, 'D'));
  });

  it('deleting the resting candidate drops its trace; deleting another keeps it', async () => {
    const { state, a } = await generated();
    const shown = reduce(state, inspect(null));
    expect(onScreen(reduce(shown, { type: 'DELETE_CANDIDATE', payload: { candidateId: 'cand-b' } }))).toEqual(traceOf(a, 'A'));
    const dropped = reduce(shown, { type: 'DELETE_CANDIDATE', payload: { candidateId: 'cand-a' } });
    expect(dropped.moveHistory).toBeNull();
    expect(dropped.traceSubject).toBeNull();
  });

  it('SET_MOVE_HISTORY sets a trace with no candidate, shown while none is inspected', async () => {
    const { state } = await generated();
    const set = reduce(state, inspect(null), { type: 'SET_MOVE_HISTORY', payload: { moves: moves(1), trace: null, stopReason: 'completed' } });
    expect(onScreen(set)).toMatchObject({ candidateId: null, letter: null, stopReason: 'completed' });
    expect(set.moveHistory).toHaveLength(1);
    expect(onScreen(reduce(set, inspect('cand-b'))).candidateId).toBe('cand-b');
  });

  it('an empty project has no trace', () => {
    const empty = createEmptyProjectState();
    expect({ subject: empty.traceSubject, resting: empty.restingTrace, onScreen: hasTraceOnScreen(empty) })
      .toEqual({ subject: null, resting: null, onScreen: false });
  });
});
