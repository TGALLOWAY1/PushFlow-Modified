/**
 * S3.3 · Runs, stable letters, stale candidates and Keep (T30, T08, T14).
 *
 * Each Generate adds a run instead of replacing the list (state.candidates
 * stays the flat list, newest run first); older runs fold into "Earlier runs"
 * (capped at 3) and "Clear older runs" removes them. Candidate letters are
 * given once and never reused in the session. A candidate made for an earlier
 * performance is stale. A candidate is kept once a variant, Active or the
 * draft has its pads; leaving warns about the others.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import {
  EARLIER_RUNS_CAP,
  REMAINING_PLACED_STRATEGY,
  candidateLetterFor,
  isCandidateStale,
  runAge,
  runLabel,
  runViews,
} from '../../../src/ui/state/candidateRuns';
import { isCandidateKept, isCandidateSavedAsVariant, unkeptCandidates } from '../../../src/ui/state/keptCandidates';
import { pickDocument, documentChanged, restoreDocument } from '../../../src/ui/state/projectDocument';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type Layout } from '../../../src/types/layout';
import { importTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

let start: ProjectState;
beforeAll(async () => { start = await importTestMidi1(); });

function fake(id: string, state: ProjectState, pads: string[], metadata: Partial<CandidateSolution['metadata']> = {}): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i]!;
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  return {
    id,
    layout: { ...state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' },
    executionPlan: { fingerAssignments: [] },
    metadata: { strategy: 'test', seed: 0, ...metadata },
  } as unknown as CandidateSolution;
}

const run = (state: ProjectState, prefix: string, n = 2, metadata: Partial<CandidateSolution['metadata']> = {}): ProjectAction => ({
  type: 'SET_CANDIDATES',
  payload: Array.from({ length: n }, (_, i) => fake(`${prefix}${i}`, state, [`${i},0`, `${i},1`], metadata)),
});

describe('runs (T30)', () => {
  it('each Generate adds a run, newest first, and shows its first candidate read-only; nothing is written', () => {
    const one = reduce(start, run(start, 'r1-'));
    const two = reduce(one, run(one, 'r2-', 3));
    expect(two.candidates.map(c => c.id)).toEqual(['r2-0', 'r2-1', 'r2-2', 'r1-0', 'r1-1']);
    expect(two.candidateRuns.runs.map(r => r.number)).toEqual([2, 1]);
    expect(runViews(two).map(v => v.candidates.map(c => c.id))).toEqual([['r2-0', 'r2-1', 'r2-2'], ['r1-0', 'r1-1']]);
    expect(two.inspectedLayout).toEqual({ kind: 'candidate', id: 'r2-0' });
    expect(documentChanged(pickDocument(start), pickDocument(two))).toBe(false);
  });

  it(`keeps at most ${EARLIER_RUNS_CAP} earlier runs; an older one goes with its candidates, and "Clear older runs" leaves the newest`, () => {
    let state = start;
    for (let i = 1; i <= EARLIER_RUNS_CAP + 2; i++) state = reduce(state, run(state, `r${i}-`));
    expect(state.candidateRuns.runs.map(r => r.number)).toEqual([5, 4, 3, 2]);
    expect(state.candidates.some(c => c.id.startsWith('r1-'))).toBe(false);
    // An inspected candidate of a cleared run stops being shown.
    state = reduce(state, { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'r3-1' } });
    const cleared = reduce(state, { type: 'CLEAR_OLDER_RUNS' });
    expect(cleared.candidateRuns.runs.map(r => r.number)).toEqual([5]);
    expect(cleared.candidates.map(c => c.id)).toEqual(['r5-0', 'r5-1']);
    expect(cleared.inspectedLayout).toBeNull();
    // Run numbers keep counting.
    expect(reduce(cleared, run(cleared, 'r6-')).candidateRuns.runs.map(r => r.number)).toEqual([6, 5]);
  });

  it('labels a run from its candidates\' metadata', () => {
    expect(runLabel([fake('a', start, [], { candidateFamily: 'Natural Pose' })])).toBe('Greedy · Natural Pose');
    expect(runLabel([fake('a', start, [], { candidateFamily: 'A' }), fake('b', start, [], { candidateFamily: 'B' })])).toBe('Greedy');
    expect(runLabel([fake('a', start, [], { optimizationMode: 'fast' })])).toBe('Quick');
    expect(runLabel([fake('a', start, [], { optimizationMode: 'deep' })])).toBe('Thorough');
    expect(runLabel([fake('a', start, [], { strategy: REMAINING_PLACED_STRATEGY })])).toBe('Place remaining');
    const now = Date.parse('2026-09-25T12:10:30Z');
    expect([runAge('2026-09-25T12:10:00Z', now), runAge('2026-09-25T12:09:00Z', now), runAge('2026-09-25T11:00:00Z', now)])
      .toEqual(['just now', '1 min ago', '1 h ago']);
  });

  it('a Place remaining run is added the same way, and leaves isProcessing and the Generate summary alone', () => {
    const busy: ProjectState = { ...reduce(start, run(start, 'r1-')), isProcessing: true };
    const added = projectReducer(busy, { type: 'ADD_CANDIDATE_RUN', payload: [fake('rest', start, ['5,5'], { strategy: REMAINING_PLACED_STRATEGY })] });
    expect(added.candidates.map(c => c.id)).toEqual(['rest', 'r1-0', 'r1-1']);
    expect(added.inspectedLayout).toEqual({ kind: 'candidate', id: 'rest' });
    expect(added.isProcessing).toBe(true);
    expect(projectReducer(busy, { type: 'ADD_CANDIDATE_RUN', payload: [] })).toBe(busy);
  });
});

describe('stable letters (T08)', () => {
  it('a candidate keeps its letter after a delete, a Promote and another run, and no letter is reused', () => {
    let state = reduce(start, run(start, 'r1-', 3));
    expect(state.candidates.map(c => candidateLetterFor(state, c.id))).toEqual(['A', 'B', 'C']);
    state = reduce(state, { type: 'DELETE_CANDIDATE', payload: { candidateId: 'r1-0' } });
    state = reduce(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'r1-1' } });
    expect(candidateLetterFor(state, 'r1-2')).toBe('C');
    state = reduce(state, run(state, 'r2-', 2));
    expect(state.candidates.map(c => [c.id, candidateLetterFor(state, c.id)])).toEqual([['r2-0', 'D'], ['r2-1', 'E'], ['r1-2', 'C']]);
  });
});

describe('stale candidates (T14)', () => {
  it('are stale once the notes, the mute state or the tempo change, not after a rename, and fresh again when undone', () => {
    const generated = reduce(start, run(start, 'r1-'));
    expect(isCandidateStale(generated, 'r1-0')).toBe(false);
    const renamed = reduce(generated, { type: 'RENAME_SOUND', payload: { streamId: start.soundStreams[0]!.id, name: 'Kick' } });
    expect(isCandidateStale(renamed, 'r1-0')).toBe(false);
    const tempo = reduce(generated, { type: 'SET_TEMPO', payload: generated.tempo + 10 });
    expect(isCandidateStale(tempo, 'r1-0')).toBe(true);
    const muted = reduce(generated, { type: 'TOGGLE_MUTE', payload: start.soundStreams[1]!.id });
    expect(isCandidateStale(muted, 'r1-1')).toBe(true);
    // Undo puts the document back: its candidates are fresh again.
    expect(isCandidateStale(restoreDocument(muted, pickDocument(generated)), 'r1-1')).toBe(false);
    // A newer run made for the new performance is fresh.
    const rerun = reduce(tempo, run(tempo, 'r2-'));
    expect([isCandidateStale(rerun, 'r2-0'), isCandidateStale(rerun, 'r1-0')]).toEqual([false, true]);
  });
});

describe('kept candidates (T30)', () => {
  it('a candidate is kept once a variant, Active or the draft has its pads; unkept ones are listed for the leave warning', () => {
    const generated = reduce(start, run(start, 'r1-', 3));
    expect(unkeptCandidates(generated).map(c => c.id)).toEqual(['r1-0', 'r1-1', 'r1-2']);
    const kept = reduce(generated, { type: 'SAVE_AS_VARIANT', payload: { name: 'Keep A', source: 'candidate', candidateId: 'r1-0' } });
    expect(isCandidateSavedAsVariant(kept, kept.candidates[0]!)).toBe(true);
    const used = reduce(kept, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'r1-1' } });
    expect(isCandidateKept(used, used.candidates[1]!)).toBe(true);
    expect(unkeptCandidates(used).map(c => c.id)).toEqual(['r1-2']);
    // Promote takes r1-2 out of the list; it also replaces the draft that kept
    // r1-1 (still in the list, so not kept in Recovered drafts): r1-1 is unkept again.
    const promoted = reduce(used, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'r1-2' } });
    expect(promoted.candidates.map(c => c.id)).toEqual(['r1-0', 'r1-1']);
    expect(unkeptCandidates(promoted).map(c => c.id)).toEqual(['r1-1']);
  });
});
