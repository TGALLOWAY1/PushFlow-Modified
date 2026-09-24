// @vitest-environment happy-dom
/**
 * Layouts panel (S1a.2): only the Preview button previews, a replaced draft is
 * announced with a Restore toast, and every saved variant is listed.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
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
function Spy() {
  latest = useProject().state;
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

async function projectWithCandidatesAndHandDraft() {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-panel' };
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [candidate('cand-a', state, ['4,4', '4,5'])] });
  state = reduce(state,
    { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: state.soundStreams[0] } },
    { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,7', stream: state.soundStreams[1] } },
  );
  return state;
}

describe('LayoutOptionsPanel', () => {
  it('a click on a candidate card body does not preview', async () => {
    const initial = await projectWithCandidatesAndHandDraft();
    renderPanel(initial);
    fireEvent.click(within(screen.getByTestId('candidate-row')).getByText('#1'));
    expect(padsOf(latest.workingLayout)).toEqual(['0,0', '0,7']);
    expect(latest.selectedCandidateId).toBeNull();
  });

  it('Preview keeps the replaced draft and the toast Restore brings it back', async () => {
    const initial = await projectWithCandidatesAndHandDraft();
    renderPanel(initial);
    expect(screen.getByTestId('candidates-hint').textContent).toContain('Preview #1');
    fireEvent.click(within(screen.getByTestId('candidate-row')).getByRole('button', { name: 'Preview' }));

    expect(padsOf(latest.workingLayout)).toEqual(['4,4', '4,5']);
    expect(screen.getByTestId('toast').textContent).toContain('Your draft was kept');
    expect(screen.getAllByTestId('recovered-row')).toHaveLength(1);

    fireEvent.click(within(screen.getByTestId('toast')).getByRole('button', { name: 'Restore' }));
    expect(padsOf(latest.workingLayout)).toEqual(['0,0', '0,7']);
    expect(screen.queryAllByTestId('recovered-row')).toHaveLength(0);
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
