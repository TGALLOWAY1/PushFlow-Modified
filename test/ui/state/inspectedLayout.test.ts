/**
 * S3.2 · the inspected layout (T01): one selector for what the screen shows,
 * looking never writes, and a reducer-level guard refuses every layout edit
 * while a read-only layout (or a trace replay) is on screen. Undo and Redo
 * still work, and show the layout they changed.
 */

import { describe, it, expect } from 'vitest';
import {
  getActiveTrace,
  getDisplayedCandidate,
  getInspectedLayout,
  isInspectedReadOnly,
  isLayoutEditAction,
  isReplayingTrace,
  isShownLayoutReadOnly,
  projectReducer,
  resolveInspectedLayout,
  type InspectedLayoutRef,
  type ProjectAction,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { pickDocument, documentChanged, restoreDocument } from '../../../src/ui/state/projectDocument';
import {
  candidateLetter,
  candidateLetterFor,
  inspectedSubject,
  shownLayoutDiff,
} from '../../../src/ui/state/layoutSubject';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const place = (state: ProjectState, padKey: string, i: number): ProjectAction =>
  ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });
const inspect = (ref: InspectedLayoutRef | null): ProjectAction => ({ type: 'INSPECT_LAYOUT', payload: ref });

function fakeCandidate(id: string, state: ProjectState, pads: string[], strategy = 'pose0-offset-0'): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i]!;
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  const layout: Layout = { ...state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' };
  return {
    id,
    layout,
    executionPlan: { layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' }, fingerAssignments: [] },
    metadata: { strategy, seed: 0 },
    iterationTrace: [{ stateBefore: { layout } }, { stateBefore: { layout } }],
  } as unknown as CandidateSolution;
}

/**
 * Active on [3,3]+[3,4]; a variant on [0,0]; candidates A and B; a recovered
 * draft; and a hand-made draft on [7,0]+[7,1] that differs from all of them.
 */
async function fullProject(): Promise<ProjectState> {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-inspect' };
  state = reduce(state, place(state, '3,3', 0), place(state, '3,4', 1), { type: 'PROMOTE_WORKING_LAYOUT' });
  state = reduce(state, place(state, '0,0', 0), { type: 'SAVE_AS_VARIANT', payload: { name: 'Corner', source: 'working', variantId: 'var-1' } });
  state = reduce(state, place(state, '5,5', 2));
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [fakeCandidate('cand-a', state, ['4,4', '4,5']), fakeCandidate('cand-b', state, ['5,5', '5,6'], 'compact-right')] });
  // Replacing the [0,0]+[5,5] draft keeps it as a recovered draft.
  state = reduce(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
  state = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' }, place(state, '7,0', 0), place(state, '7,1', 1));
  expect(state.recoveredDrafts).toHaveLength(1);
  expect(state.inspectedLayout).toBeNull();
  return state;
}

const EDITS = (state: ProjectState): Array<[string, ProjectAction]> => [
  ['ASSIGN_VOICE_TO_PAD', place(state, '6,6', 3)],
  ['BULK_ASSIGN_PADS', { type: 'BULK_ASSIGN_PADS', payload: {} }],
  ['MERGE_ASSIGN_PADS', { type: 'MERGE_ASSIGN_PADS', payload: { '6,6': state.workingLayout!.padToVoice['7,0']! } }],
  ['REMOVE_VOICE_FROM_PAD', { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: '7,0' } }],
  ['SWAP_PADS', { type: 'SWAP_PADS', payload: { padKeyA: '7,0', padKeyB: '6,6' } }],
  ['SET_FINGER_CONSTRAINT', { type: 'SET_FINGER_CONSTRAINT', payload: { padKey: '7,0', constraint: 'L2' } }],
  ['TOGGLE_PLACEMENT_LOCK', { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: state.soundStreams[0]!.id, padKey: '7,0' } }],
  ['SUGGEST_STARTING_LAYOUT', { type: 'SUGGEST_STARTING_LAYOUT' }],
];

describe('resolveInspectedLayout', () => {
  it('shows the layout edits go to by default: the draft (Working/Test) or, with none, Active', async () => {
    const state = await fullProject();
    expect(resolveInspectedLayout(state)).toMatchObject({ role: 'working', layout: state.workingLayout, readOnly: false, candidate: null });
    const discarded = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' });
    expect(resolveInspectedLayout(discarded)).toMatchObject({ role: 'active', layout: discarded.activeLayout, readOnly: false });
  });

  it('shows a draft identical to Active as Active (S1a.4 follow-up)', async () => {
    const state = reduce(await fullProject(), { type: 'DISCARD_WORKING_LAYOUT' }, { type: 'CREATE_WORKING_LAYOUT' });
    expect(state.workingLayout).not.toBeNull();
    expect(resolveInspectedLayout(state)).toMatchObject({ role: 'active', layout: state.workingLayout, readOnly: false });
    expect(inspectedSubject(state)).toEqual({ role: 'active', chip: 'Active', name: 'Default' });
  });

  it('shows Active read-only only while a differing draft exists; with none, Active is simply edited', async () => {
    const state = await fullProject();
    const onActive = reduce(state, inspect({ kind: 'active', id: state.activeLayout.id }));
    expect(resolveInspectedLayout(onActive)).toMatchObject({ role: 'active', layout: state.activeLayout, readOnly: true });
    const noDraft = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' }, inspect({ kind: 'active', id: state.activeLayout.id }));
    expect(noDraft.inspectedLayout).toBeNull();
    expect(isInspectedReadOnly(noDraft)).toBe(false);
  });

  it('shows a candidate, a variant or a recovered draft read-only; an unknown id falls back to the draft', async () => {
    const state = await fullProject();
    const recoveredId = state.recoveredDrafts[0]!.id;
    for (const [ref, layout] of [
      [{ kind: 'candidate', id: 'cand-b' }, state.candidates[1]!.layout],
      [{ kind: 'variant', id: 'var-1' }, state.savedVariants[0]!],
      [{ kind: 'recovered', id: recoveredId }, state.recoveredDrafts[0]!],
    ] as const) {
      const next = reduce(state, inspect(ref));
      expect(resolveInspectedLayout(next)).toMatchObject({ role: ref.kind, layout, readOnly: true });
      expect(getInspectedLayout(next)).toBe(layout);
    }
    const unknown = { ...state, inspectedLayout: { kind: 'candidate' as const, id: 'gone' } };
    expect(resolveInspectedLayout(unknown)).toMatchObject({ role: 'working', layout: state.workingLayout, readOnly: false });
  });

  it('names the subject and its difference from Active and from the draft', async () => {
    const state = await fullProject();
    expect(inspectedSubject(state)).toEqual({ role: 'working', chip: 'Working/Test', name: 'Draft of Default' });
    expect(shownLayoutDiff(state)).toBe('4 pads vs Active');
    const onB = reduce(state, inspect({ kind: 'candidate', id: 'cand-b' }));
    expect(inspectedSubject(onB)).toEqual({ role: 'candidate', chip: 'Candidate B', name: 'Compact, right hand' });
    expect(shownLayoutDiff(onB)).toBe('4 pads vs Active · 4 vs your draft');
    const onVariant = reduce(state, inspect({ kind: 'variant', id: 'var-1' }));
    expect(inspectedSubject(onVariant)).toEqual({ role: 'variant', chip: 'Saved variant', name: 'Corner' });
    const onActive = reduce(state, inspect({ kind: 'active', id: state.activeLayout.id }));
    expect(inspectedSubject(onActive)).toEqual({ role: 'active', chip: 'Active', name: 'Default' });
    expect(shownLayoutDiff(onActive)).toBe('4 pads vs your draft');
  });
});

describe('INSPECT_LAYOUT writes nothing', () => {
  it('inspecting every layout 20 times leaves the document, and so the draft hash, unchanged', async () => {
    const state = await fullProject();
    const draftHash = hashLayout(state.workingLayout!);
    const refs: InspectedLayoutRef[] = [
      { kind: 'active', id: state.activeLayout.id },
      { kind: 'candidate', id: 'cand-a' },
      { kind: 'candidate', id: 'cand-b' },
      { kind: 'variant', id: 'var-1' },
      { kind: 'recovered', id: state.recoveredDrafts[0]!.id },
      { kind: 'working', id: state.workingLayout!.id },
    ];
    let s = state;
    for (let round = 0; round < 20; round++) {
      for (const ref of refs) {
        s = projectReducer(s, inspect(ref));
        expect(hashLayout(s.workingLayout!)).toBe(draftHash);
      }
    }
    expect(documentChanged(pickDocument(state), pickDocument(s))).toBe(false);
  });

  it('drops the pad selection and a replay step, disarms a Sound on a read-only layout, and keeps the event selection', async () => {
    const state = { ...(await fullProject()), selectedPadKey: '7,0', moveHistoryIndex: 1, selectedEventIndex: 3 };
    const armed = projectReducer(state, { type: 'ARM_SOUND', payload: state.soundStreams[2]!.id });
    const next = projectReducer({ ...armed, selectedPadKey: '7,0', moveHistoryIndex: 1 }, inspect({ kind: 'candidate', id: 'cand-a' }));
    expect({ pad: next.selectedPadKey, replay: next.moveHistoryIndex, armed: next.armedStreamId, sound: next.selectedStreamId, event: next.selectedEventIndex })
      .toEqual({ pad: null, replay: null, armed: null, sound: null, event: 3 });
    // Showing what is already shown is no change at all.
    expect(projectReducer(next, inspect({ kind: 'candidate', id: 'cand-a' }))).toBe(next);
  });

  it('after Generate, candidate A is shown read-only, even on an empty grid (Q4), and nothing is written', async () => {
    const empty = await importTestMidi1();
    const generated = projectReducer(empty, { type: 'SET_CANDIDATES', payload: [fakeCandidate('cand-a', empty, ['4,4']), fakeCandidate('cand-b', empty, ['5,5'])] });
    expect(generated.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-a' });
    expect(resolveInspectedLayout(generated)).toMatchObject({ role: 'candidate', readOnly: true });
    expect(generated.workingLayout).toBeNull();
    expect(documentChanged(pickDocument(empty), pickDocument(generated))).toBe(false);
    // An empty run while a candidate is shown returns to the layout being edited.
    expect(projectReducer(generated, { type: 'SET_CANDIDATES', payload: [] }).inspectedLayout).toBeNull();
  });
});

describe('the optimizer trace follows the inspected candidate', () => {
  it("B's trace while B is inspected, A's while A is, the top-ranked one's with none; a replay step is read-only", async () => {
    const state = await fullProject();
    const [a, b] = state.candidates as [CandidateSolution, CandidateSolution];
    expect(getActiveTrace(reduce(state, inspect({ kind: 'candidate', id: 'cand-b' })))).toBe(b.iterationTrace);
    expect(getActiveTrace(reduce(state, inspect({ kind: 'candidate', id: 'cand-a' })))).toBe(a.iterationTrace);
    expect(getActiveTrace(state)).toBe(a.iterationTrace);
    // A trace the run kept of its own yields to the inspected candidate's.
    const runTrace = [...b.iterationTrace!];
    const withRunTrace: ProjectState = { ...state, iterationTrace: runTrace };
    expect(getActiveTrace(withRunTrace)).toBe(runTrace);
    expect(getActiveTrace(reduce(withRunTrace, inspect({ kind: 'candidate', id: 'cand-a' })))).toBe(a.iterationTrace);

    // Stepping through B's trace shows its steps read-only; inspecting A starts afresh.
    const replaying = reduce(state, inspect({ kind: 'candidate', id: 'cand-b' }), { type: 'SET_MOVE_HISTORY_INDEX', payload: 1 });
    expect(isReplayingTrace(replaying)).toBe(true);
    expect(isShownLayoutReadOnly(replaying)).toBe(true);
    expect(reduce(replaying, inspect({ kind: 'candidate', id: 'cand-a' })).moveHistoryIndex).toBeNull();
  });
});

describe('the guard: no layout edit while a read-only layout is on screen', () => {
  const readOnlyViews = (state: ProjectState): Array<[string, ProjectState]> => [
    ['Active over the draft', reduce(state, inspect({ kind: 'active', id: state.activeLayout.id }))],
    ['a candidate', reduce(state, inspect({ kind: 'candidate', id: 'cand-a' }))],
    ['a variant', reduce(state, inspect({ kind: 'variant', id: 'var-1' }))],
    ['a recovered draft', reduce(state, inspect({ kind: 'recovered', id: state.recoveredDrafts[0]!.id }))],
    ['a trace replay step', { ...state, moveHistoryIndex: 1 }],
  ];

  it('every layout-edit action is refused: the same state comes back', async () => {
    const state = await fullProject();
    for (const [view, shown] of readOnlyViews(state)) {
      expect(isShownLayoutReadOnly(shown), view).toBe(true);
      for (const [name, action] of EDITS(state)) {
        expect(isLayoutEditAction(action), name).toBe(true);
        expect(projectReducer(shown, action), `${name} on ${view}`).toBe(shown);
      }
      expect(projectReducer(reduce(shown, { type: 'DISCARD_WORKING_LAYOUT' }, inspect({ kind: 'candidate', id: 'cand-a' })), { type: 'CREATE_WORKING_LAYOUT' }).workingLayout, `CREATE_WORKING_LAYOUT on ${view}`).toBeNull();
    }
  });

  it('the same edits apply once the draft is shown again', async () => {
    const state = reduce(await fullProject(), inspect({ kind: 'candidate', id: 'cand-a' }), inspect(null));
    for (const [name, action] of EDITS(state)) {
      expect(projectReducer(state, action), name).not.toBe(state);
    }
  });

  it('named role actions still run, and show their result: Use as my draft, Edit as draft, Promote, Discard', async () => {
    const state = reduce(await fullProject(), inspect({ kind: 'candidate', id: 'cand-b' }));
    const used = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-b' } });
    expect(Object.keys(used.workingLayout!.padToVoice).sort()).toEqual(['5,5', '5,6']);
    expect(used.inspectedLayout).toBeNull();
    const loaded = projectReducer(reduce(state, inspect({ kind: 'variant', id: 'var-1' })), { type: 'LOAD_SAVED_VARIANT', payload: { variantId: 'var-1' } });
    expect(Object.keys(loaded.workingLayout!.padToVoice).sort()).toEqual(['0,0', '3,4']);
    expect(loaded.inspectedLayout).toBeNull();
    const promoted = projectReducer(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(Object.keys(promoted.activeLayout.padToVoice).sort()).toEqual(['5,5', '5,6']);
    expect(promoted.inspectedLayout).toBeNull();
    expect(projectReducer(state, { type: 'DISCARD_WORKING_LAYOUT' }).inspectedLayout).toBeNull();
    // Keep as variant saves the candidate and keeps it on screen.
    const kept = projectReducer(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Compact, right hand', source: 'candidate', candidateId: 'cand-b' } });
    expect(kept.savedVariants.map(v => v.name)).toContain('Compact, right hand');
    expect(kept.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-b' });
  });

  it('a Sound\'s own finger preference is not a layout edit: it applies, and the inspection stays', async () => {
    const state = reduce(await fullProject(), inspect({ kind: 'candidate', id: 'cand-a' }));
    const next = projectReducer(state, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: state.soundStreams[0]!.id, hand: 'left', finger: 'index' } });
    expect(next.voiceConstraints[state.soundStreams[0]!.id]).toEqual({ hand: 'left', finger: 'index' });
    expect(next.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-a' });
  });

  it('deleting the inspected candidate, variant or recovered draft shows the draft again', async () => {
    const state = await fullProject();
    const recoveredId = state.recoveredDrafts[0]!.id;
    expect(reduce(state, inspect({ kind: 'candidate', id: 'cand-a' }), { type: 'DELETE_CANDIDATE', payload: { candidateId: 'cand-a' } }).inspectedLayout).toBeNull();
    expect(reduce(state, inspect({ kind: 'variant', id: 'var-1' }), { type: 'DELETE_VARIANT', payload: { variantId: 'var-1' } }).inspectedLayout).toBeNull();
    expect(reduce(state, inspect({ kind: 'recovered', id: recoveredId }), { type: 'DELETE_RECOVERED_DRAFT', payload: { layoutId: recoveredId } }).inspectedLayout).toBeNull();
    // Deleting another one keeps the inspection.
    expect(reduce(state, inspect({ kind: 'candidate', id: 'cand-a' }), { type: 'DELETE_CANDIDATE', payload: { candidateId: 'cand-b' } }).inspectedLayout)
      .toEqual({ kind: 'candidate', id: 'cand-a' });
  });

  it('Undo and Redo still work while a candidate is inspected, and show the layout they changed', async () => {
    const before = await fullProject();
    const edited = projectReducer(before, place(before, '6,6', 3));
    const inspecting = projectReducer(edited, inspect({ kind: 'candidate', id: 'cand-a' }));
    // Undo: the document goes back, and the screen shows the draft it restored.
    const undone = restoreDocument(inspecting, pickDocument(before));
    expect(Object.keys(undone.workingLayout!.padToVoice).sort()).toEqual(['7,0', '7,1']);
    expect(undone.inspectedLayout).toBeNull();
    // Redo, from a candidate inspected again.
    const redone = restoreDocument(projectReducer(undone, inspect({ kind: 'candidate', id: 'cand-a' })), pickDocument(edited));
    expect(Object.keys(redone.workingLayout!.padToVoice).sort()).toEqual(['6,6', '7,0', '7,1']);
    expect(redone.inspectedLayout).toBeNull();
  });
});

describe('the plan on screen', () => {
  it('is the draft\'s fresh analysis, or a read-only layout\'s own plan (its mirror) when fresh, never a candidate\'s optimizer plan', async () => {
    const state = reduce(await fullProject(), inspect({ kind: 'candidate', id: 'cand-a' }));
    const candidate = state.candidates[0]!;
    // No mirror yet: no plan, although the candidate carries its optimizer plan.
    expect(getDisplayedCandidate(state)).toBeNull();
    const mirror = { ...candidate, id: 'plan-of-a' };
    const mirrored = projectReducer(state, { type: 'SET_INSPECTED_ANALYSIS', payload: mirror });
    expect(getDisplayedCandidate(mirrored)).toBe(mirror);
    // A mirror bound to another layout is ignored.
    const onB = projectReducer(mirrored, inspect({ kind: 'candidate', id: 'cand-b' }));
    expect(getDisplayedCandidate(onB)).toBeNull();
    // The mirror is session state: it is no edit.
    expect(documentChanged(pickDocument(state), pickDocument(mirrored))).toBe(false);
  });
});

describe('candidateLetter', () => {
  it('names candidates A, B, … Z, then AA, AB', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(candidateLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
    expect(candidateLetterFor([{ id: 'x' }, { id: 'y' }] as CandidateSolution[], 'y')).toBe('B');
    expect(candidateLetterFor([], 'y')).toBe('?');
  });
});
