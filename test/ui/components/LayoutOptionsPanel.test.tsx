// @vitest-environment happy-dom
/**
 * Layouts panel (S1a.2, S3.2): Inspect shows a candidate read-only and writes
 * nothing (Preview, and its auto-keep, are gone); a card-body click does
 * nothing; "Edit as draft" asks before replacing a draft that differs from
 * Active, and either choice is one undo step; a row Promote acts at once and
 * keeps the replaced draft (S3.3); every saved variant is listed.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { LayoutOptionsPanel } from '../../../src/ui/components/panels/LayoutOptionsPanel';
import { projectReducer, type ProjectState, type ProjectAction } from '../../../src/ui/state/projectState';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let latest: ProjectState;
let project: ReturnType<typeof useProject>;
function Spy() {
  project = useProject();
  latest = project.state;
  return null;
}

function renderPanel(initial: ProjectState) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={initial}>
        <Spy />
        <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
      </ProjectProvider>
    </ToastProvider>,
  );
}

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const padsOf = (layout: Layout | null) => Object.keys(layout?.padToVoice ?? {}).sort();

function candidate(id: string, state: ProjectState, pads: string[]): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i];
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  const layout: Layout = { ...state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' };
  return {
    id,
    layout,
    executionPlan: {
      layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' },
      score: 50, unplayableCount: 0, hardCount: 0, fingerAssignments: [],
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0 },
    },
    difficultyAnalysis: { overallScore: 0.1 },
    metadata: { strategy: 'test', seed: 0 },
  } as unknown as CandidateSolution;
}

const place = (state: ProjectState, padKey: string, i: number): ProjectAction =>
  ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i] } });

async function projectWithCandidatesAndHandDraft() {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-panel' };
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [candidate('cand-a', state, ['4,4', '4,5'])] });
  // Candidate A is shown read-only after Generate (S3.2, Q4): back to the draft to edit it.
  state = reduce(state, { type: 'INSPECT_LAYOUT', payload: null });
  state = reduce(state, place(state, '0,0', 0), place(state, '0,7', 1));
  return state;
}

/** A saved variant on [3,3], then a hand-made draft on other pads that differs from Active and from it. */
async function projectWithVariantAndHandDraft() {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-variant' };
  state = reduce(state, place(state, '3,3', 0), { type: 'SAVE_AS_VARIANT', payload: { name: 'Kept shape', source: 'working' } });
  state = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' }, place(state, '0,0', 1), place(state, '0,7', 2));
  return state;
}

describe('LayoutOptionsPanel', () => {
  it('a click on a candidate card body neither inspects nor writes', async () => {
    renderPanel(await projectWithCandidatesAndHandDraft());
    fireEvent.click(within(screen.getByTestId('candidate-row')).getByText('A'));
    expect(padsOf(latest.workingLayout)).toEqual(['0,0', '0,7']);
    expect(latest.inspectedLayout).toBeNull();
  });

  it('Inspect shows the candidate read-only and writes nothing: no draft change, no Recovered draft, no toast', async () => {
    renderPanel(await projectWithCandidatesAndHandDraft());
    expect(screen.getByTestId('candidates-hint').textContent).toContain('Inspect');
    const row = screen.getByTestId('candidate-row');
    fireEvent.click(within(row).getByRole('button', { name: 'Inspect' }));

    expect(latest.inspectedLayout).toEqual({ kind: 'candidate', id: 'cand-a' });
    expect(padsOf(latest.workingLayout)).toEqual(['0,0', '0,7']);
    expect(latest.recoveredDrafts).toEqual([]);
    expect(project.canUndo).toBe(false);
    expect(screen.queryByTestId('toast')).toBeNull();
    expect(row.dataset.inspected).toBe('true');
    expect(within(row).getByRole('button', { name: 'Inspect' }).getAttribute('aria-current')).toBe('true');
  });

  it('Inspect on the Active, variant and recovered rows shows each read-only while the draft differs', async () => {
    let state = await projectWithVariantAndHandDraft();
    // Promote the draft, then make another: Active, a variant and a replaced draft all exist.
    state = reduce(state, { type: 'PROMOTE_WORKING_LAYOUT' }, place(state, '5,5', 3));
    state = reduce(state, { type: 'LOAD_SAVED_VARIANT', payload: { variantId: state.savedVariants[0]!.id } });
    state = reduce(state, place(state, '6,6', 4));
    expect(state.recoveredDrafts).toHaveLength(1);
    renderPanel(state);
    const draftHash = hashLayout(latest.workingLayout!);

    fireEvent.click(screen.getByTestId('active-inspect'));
    expect(latest.inspectedLayout?.kind).toBe('active');
    fireEvent.click(screen.getAllByTestId('variant-inspect')[0]!);
    expect(latest.inspectedLayout?.kind).toBe('variant');
    fireEvent.click(screen.getByTestId('recovered-inspect'));
    expect(latest.inspectedLayout?.kind).toBe('recovered');
    expect(hashLayout(latest.workingLayout!)).toBe(draftHash);
    expect(project.canUndo).toBe(false);
  });

  it('Edit as draft asks before replacing a differing draft; Replace keeps it recoverable, and one Undo brings it back', async () => {
    renderPanel(await projectWithVariantAndHandDraft());
    const draftPads = padsOf(latest.workingLayout);
    fireEvent.click(within(screen.getByTestId('variant-row')).getByRole('button', { name: 'Edit as draft' }));
    // Nothing yet: it asks.
    expect(padsOf(latest.workingLayout)).toEqual(draftPads);
    const popover = screen.getByTestId('use-as-draft-popover');
    expect(within(popover).getByRole('button', { name: 'Save my draft as a variant first' })).toBeTruthy();
    fireEvent.click(within(popover).getByRole('button', { name: 'Replace (undoable)' }));

    expect(padsOf(latest.workingLayout)).toEqual(['3,3']);
    expect(latest.recoveredDrafts.map(l => padsOf(l))).toEqual([draftPads]);
    expect(project.undoLabel).toBe('Use as my draft');
    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('Kept shape is now your draft');
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(padsOf(latest.workingLayout)).toEqual(draftPads);
    expect(latest.recoveredDrafts).toEqual([]);
  });

  it('Edit as draft, "Save my draft as a variant first": one undo step saves it and replaces it', async () => {
    renderPanel(await projectWithVariantAndHandDraft());
    const draftPads = padsOf(latest.workingLayout);
    fireEvent.click(within(screen.getByTestId('variant-row')).getByRole('button', { name: 'Edit as draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my draft as a variant first' }));

    expect(padsOf(latest.workingLayout)).toEqual(['3,3']);
    expect(latest.savedVariants.map(v => padsOf(v))).toEqual([['3,3'], draftPads]);
    // Saved as a variant, so not also kept as a recovered draft.
    expect(latest.recoveredDrafts).toEqual([]);
    expect(screen.getByTestId('toast').textContent).toMatch(/your draft was saved as "Default – /);
    act(() => project.undo());
    expect(padsOf(latest.workingLayout)).toEqual(draftPads);
    expect(latest.savedVariants).toHaveLength(1);
  });

  it('with no differing draft, Edit as draft applies at once, as one undo step', async () => {
    let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-at-once' };
    state = reduce(state, place(state, '3,3', 0), { type: 'SAVE_AS_VARIANT', payload: { name: 'Kept shape', source: 'working' } });
    state = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' });
    renderPanel(state);
    fireEvent.click(screen.getByRole('button', { name: 'Edit as draft' }));
    expect(screen.queryByTestId('use-as-draft-popover')).toBeNull();
    expect(padsOf(latest.workingLayout)).toEqual(['3,3']);
    expect(project.undoLabel).toBe('Use as my draft');
  });

  // S3.3: the one Promote acts at once (no timed "Confirm?"), as one undo step,
  // and its toast says the replaced draft is in Recovered drafts.
  it('a candidate row Promote acts at once: the replaced draft is recovered, the toast says so, and one Undo brings it all back', async () => {
    renderPanel(await projectWithCandidatesAndHandDraft());
    fireEvent.click(within(screen.getByTestId('candidate-row')).getByRole('button', { name: 'Promote' }));

    expect(padsOf(latest.activeLayout)).toEqual(['4,4', '4,5']);
    expect(project.undoLabel).toBe('Promote');
    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('Promoted Candidate A to Active Layout');
    expect(toast.textContent).toContain('your draft is in Recovered drafts');
    expect(screen.getAllByTestId('recovered-row')).toHaveLength(1);
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(padsOf(latest.workingLayout)).toEqual(['0,0', '0,7']);
    expect(padsOf(latest.activeLayout)).toEqual([]);
    expect(screen.queryAllByTestId('recovered-row')).toHaveLength(0);
    // Undo gives the promoted candidate back, under its letter.
    expect(within(screen.getByTestId('candidate-row')).getByTestId('candidate-letter').textContent).toBe('A');
  });

  it('lists every saved variant', async () => {
    let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-variants' };
    for (let i = 0; i < 6; i++) {
      state = reduce(state,
        { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: `1,${i}`, stream: state.soundStreams[i] } },
        { type: 'SAVE_AS_VARIANT', payload: { name: `Variant ${i + 1}`, source: 'working' } },
      );
    }
    renderPanel(state);
    expect(screen.getAllByTestId('variant-row')).toHaveLength(6);
  });
});
