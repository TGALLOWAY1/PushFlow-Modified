// @vitest-environment happy-dom
/**
 * S3.2 · the layout-state bar (T03): the role chip, the name, the diff against
 * Active (and the draft), freshness ("Updating…" only after ~1.5 s pending),
 * and only the role's own actions: the draft's Promote, Save variant and
 * Discard; a candidate's Use as my draft, Promote, Keep as variant and Back to
 * my draft; Active over the draft's "Viewing Active · your draft is kept". A
 * one-time note explains "Use as my draft" on the first candidate shown.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { LayoutStateBar, UPDATING_AFTER_MS } from '../../../src/ui/components/workspace/LayoutStateBar';
import {
  getActivePerformance,
  projectReducer,
  type ProjectAction,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

let api: ReturnType<typeof useProject>;
function Spy() {
  api = useProject();
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const place = (state: ProjectState, padKey: string, i: number): ProjectAction =>
  ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });

function fakeCandidate(id: string, state: ProjectState, pads: string[], strategy: string): CandidateSolution {
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
  } as unknown as CandidateSolution;
}

/** Active on [3,3]+[3,4], two candidates, then a hand-made draft on [7,0]. */
async function project(): Promise<ProjectState> {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-bar' };
  state = reduce(state, place(state, '3,3', 0), place(state, '3,4', 1), { type: 'PROMOTE_WORKING_LAYOUT' });
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [fakeCandidate('cand-a', state, ['4,4', '4,5'], 'pose0-offset-0'), fakeCandidate('cand-b', state, ['5,5'], 'compact-right')] });
  return reduce(state, { type: 'INSPECT_LAYOUT', payload: null }, place(state, '7,0', 0));
}

function mount(state: ProjectState, scoring: Parameters<typeof LayoutStateBar>[0]['scoring'] = { status: 'empty' }) {
  const onVariantSaved = vi.fn();
  render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Spy />
        <LayoutStateBar scoring={scoring} onVariantSaved={onVariantSaved} />
      </ProjectProvider>
    </ToastProvider>,
  );
  return { onVariantSaved };
}

const bar = () => screen.getByTestId('state-bar');
const actionNames = () => within(bar()).queryAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent);

describe('the layout-state bar', () => {
  it('your draft: Working/Test, its name, the diff against Active, and only Promote, Save variant and Discard', async () => {
    mount(await project());
    expect(bar().dataset).toMatchObject({ role: 'working', chip: 'Working/Test', name: 'Draft of Default' });
    expect(within(bar()).getByTestId('role-chip').textContent).toBe('Working/Test');
    // Sound 0 moved from [3,3] to [7,0]: two pads differ.
    expect(within(bar()).getByTestId('state-bar-diff').textContent).toBe('2 pads vs Active');
    expect(actionNames()).toEqual(['Promote', 'Save variant', 'Discard']);
    expect(bar().dataset.readOnly).toBeUndefined();
  });

  it('Active with no draft: its name and no actions; the placing hint when nothing is placed', async () => {
    mount(reduce(await project(), { type: 'DISCARD_WORKING_LAYOUT' }));
    expect(bar().dataset).toMatchObject({ role: 'active', chip: 'Active', name: 'Default' });
    expect(actionNames()).toEqual([]);
    cleanup();
    render(
      <ToastProvider>
        <ProjectProvider initialState={await importTestMidi1()}>
          <LayoutStateBar scoring={{ status: 'empty' }} hint={<span>Place your 7 Sounds</span>} />
        </ProjectProvider>
      </ToastProvider>,
    );
    expect(bar().dataset.role).toBe('active');
    expect(within(bar()).getByText('Place your 7 Sounds')).toBeTruthy();
  });

  it('Active over your draft: read-only, "Viewing Active · your draft is kept", and Back to my draft', async () => {
    const state = await project();
    mount(reduce(state, { type: 'INSPECT_LAYOUT', payload: { kind: 'active', id: state.activeLayout.id } }));
    expect(bar().dataset).toMatchObject({ role: 'active', name: 'Default', readOnly: 'true' });
    expect(bar().textContent).toContain('Viewing Active · your draft is kept');
    expect(actionNames()).toEqual(['Back to my draft']);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Back to my draft' }));
    expect(api.state.inspectedLayout).toBeNull();
    expect(bar().dataset.role).toBe('working');
  });

  it('a candidate: Use as my draft, Promote, Keep as variant and Back to my draft; Keep names the variant after how it was made', async () => {
    const state = await project();
    const { onVariantSaved } = mount(reduce(state, { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-b' } }));
    expect(bar().dataset).toMatchObject({ role: 'candidate', chip: 'Candidate B', name: 'Compact, right hand', readOnly: 'true' });
    // The coach note is dismissible; the role's own actions follow it.
    expect(actionNames()).toEqual(['Got it', 'Use as my draft', 'Promote', 'Keep as variant', 'Back to my draft']);

    fireEvent.click(within(bar()).getByRole('button', { name: 'Keep as variant' }));
    const kept = api.state.savedVariants.at(-1)!;
    expect(kept.name).toBe('Compact, right hand');
    expect(kept.provenance).toBe('candidate:compact-right');
    expect(api.undoLabel).toBe('Save as variant');
    expect(onVariantSaved).toHaveBeenCalledWith(kept.id);
    expect(screen.getByTestId('toast').textContent).toContain('Kept Candidate B as the variant "Compact, right hand"');
    // Still looking at the candidate.
    expect(api.state.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-b' });
  });

  it('a candidate\'s Promote: at once, one undo step, a toast with Undo, and the replaced draft is recoverable', async () => {
    const state = await project();
    mount(reduce(state, { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-a' } }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Promote' }));
    expect(Object.keys(api.state.activeLayout.padToVoice).sort()).toEqual(['4,4', '4,5']);
    expect(api.state.recoveredDrafts).toHaveLength(1);
    expect(api.undoLabel).toBe('Promote');
    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('Promoted Candidate A to Active Layout · your draft is in Recovered drafts');
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(Object.keys(api.state.activeLayout.padToVoice).sort()).toEqual(['3,3', '3,4']);
    expect(Object.keys(api.state.workingLayout!.padToVoice).sort()).toEqual(['3,4', '7,0']);
  });

  it('Use as my draft: asks while your draft differs from Active; with no such draft it applies at once; one undo step either way', async () => {
    const state = await project();
    mount(reduce(state, { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-a' } }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Use as my draft' }));
    expect(screen.getByTestId('use-as-draft-popover')).toBeTruthy();
    expect(Object.keys(api.state.workingLayout!.padToVoice).sort()).toEqual(['3,4', '7,0']);
    fireEvent.click(screen.getByRole('button', { name: 'Replace (undoable)' }));
    expect(Object.keys(api.state.workingLayout!.padToVoice).sort()).toEqual(['4,4', '4,5']);
    expect(api.state.inspectedLayout).toBeNull();
    expect(bar().dataset.role).toBe('working');
    expect(api.undoLabel).toBe('Use as my draft');
    act(() => api.undo());
    expect(Object.keys(api.state.workingLayout!.padToVoice).sort()).toEqual(['3,4', '7,0']);

    // With no draft that differs from Active, no question.
    cleanup();
    mount(reduce(state, { type: 'DISCARD_WORKING_LAYOUT' }, { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-a' } }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Use as my draft' }));
    expect(screen.queryByTestId('use-as-draft-popover')).toBeNull();
    expect(Object.keys(api.state.workingLayout!.padToVoice).sort()).toEqual(['4,4', '4,5']);
    expect(api.undoLabel).toBe('Use as my draft');
  });

  it('a saved variant: Use as my draft, Promote and Back to my draft (it is already kept)', async () => {
    const state = reduce(await project(), { type: 'SAVE_AS_VARIANT', payload: { name: 'Corner', source: 'working', variantId: 'var-1' } });
    mount(reduce(state, place(state, '6,6', 2), { type: 'INSPECT_LAYOUT', payload: { kind: 'variant', id: 'var-1' } }));
    expect(bar().dataset).toMatchObject({ role: 'variant', chip: 'Saved variant', name: 'Corner', readOnly: 'true' });
    expect(within(bar()).getByTestId('state-bar-diff').textContent).toBe('2 pads vs Active · 1 vs your draft');
    expect(actionNames()).toEqual(['Use as my draft', 'Promote', 'Back to my draft']);
  });

  it('freshness: "Up to date" with a fresh plan; "Updating…" only after the analysis has been pending ~1.5 s', async () => {
    let state = await suggestedTestMidi1();
    const analysis = await analyzeLayout({
      performance: getActivePerformance(state), layout: state.workingLayout!,
      instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
    });
    state = projectReducer(state, { type: 'SET_ANALYSIS_RESULT', payload: analysis });
    vi.useFakeTimers();
    mount(state);
    const freshness = () => within(bar()).queryByTestId('state-bar-freshness');
    expect(freshness()?.textContent).toBe('Up to date');
    // An edit makes the analysis pending: the bar keeps its word for 1.5 s…
    act(() => api.dispatch(place(api.state, '7,7', 0)));
    act(() => { vi.advanceTimersByTime(UPDATING_AFTER_MS - 100); });
    expect(freshness()?.textContent).toBe('Up to date');
    // …then says so.
    act(() => { vi.advanceTimersByTime(200); });
    expect(freshness()?.dataset.freshness).toBe('updating');
    expect(freshness()?.textContent).toBe('Updating…');
  });

  it('a read-only layout\'s freshness is its own cache entry', async () => {
    const state = reduce(await project(), { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-a' } });
    localStorage.setItem('pushflow:coach:use-as-draft', '1');
    vi.useFakeTimers();
    mount(state, { status: 'analysing' });
    act(() => { vi.advanceTimersByTime(UPDATING_AFTER_MS + 10); });
    expect(within(bar()).getByTestId('state-bar-freshness').textContent).toBe('Updating…');
  });

  it('the note on the first candidate shows once per viewer, and not at all once "Got it" is pressed', async () => {
    const state = reduce(await project(), { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-a' } });
    mount(state);
    expect(within(bar()).getByTestId('state-bar-coach').textContent).toBe('Read-only · Use as my draft to edit it; your draft stays as it is');
    fireEvent.click(within(bar()).getByRole('button', { name: 'Got it' }));
    expect(within(bar()).queryByTestId('state-bar-coach')).toBeNull();
    expect(localStorage.getItem('pushflow:coach:use-as-draft')).toBe('1');
    cleanup();
    mount(state);
    expect(within(bar()).queryByTestId('state-bar-coach')).toBeNull();
    // With storage blocked, the bar still works: the note shows and can be dismissed.
    cleanup();
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mount(state);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Got it' }));
    expect(within(bar()).queryByTestId('state-bar-coach')).toBeNull();
    expect(getItem).toHaveBeenCalled();
    expect(setItem).toHaveBeenCalled();
  });

  it('Discard, from the draft\'s actions: the toast says finger preferences are kept, with Undo', async () => {
    const state = reduce(await project(), { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: (await importTestMidi1()).soundStreams[0]!.id, hand: 'left' } });
    mount(state);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Discard' }));
    expect(api.state.workingLayout).toBeNull();
    expect(screen.getByTestId('toast').textContent).toContain('Draft discarded');
    fireEvent.click(within(screen.getByTestId('toast')).getByRole('button', { name: 'Undo' }));
    expect(api.state.workingLayout).not.toBeNull();
  });
});
