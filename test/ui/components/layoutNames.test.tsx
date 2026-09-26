// @vitest-environment happy-dom
/**
 * S3.2 · clean names (T32), where the UI shows them: the Layout Summary, the
 * Layouts panel's Active card and Recovered drafts read labels built from role
 * and base name (layoutLabel), and a rename edits the base name. Before T32 a
 * promoted draft read "Default (draft)" next to the Active badge (F2-V04), and
 * the next edit made "Default (draft) (draft)" (F10-13).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { ActiveLayoutSummary } from '../../../src/ui/components/panels/ActiveLayoutSummary';
import { LayoutOptionsPanel } from '../../../src/ui/components/panels/LayoutOptionsPanel';
import { type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { variantStamp } from '../../../src/ui/state/variantNames';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let api: ReturnType<typeof useProject>;
function Grab() {
  api = useProject();
  return null;
}

function renderPanels(initial: ProjectState) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={initial}>
        <Grab />
        <ActiveLayoutSummary />
        <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
      </ProjectProvider>
    </ToastProvider>,
  );
}

const dispatch = (...actions: ProjectAction[]) => act(() => { actions.forEach(a => api.dispatch(a)); });
const place = (padKey: string, i: number): ProjectAction =>
  ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: api.state.soundStreams[i]! } });
const summaryName = () => screen.getByTestId('layout-summary-name').textContent;

function candidate(id: string, pads: string[]): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = api.state.soundStreams[i]!;
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  const layout: Layout = { ...api.state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' };
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

describe('layout names on screen (T32)', () => {
  it('a draft reads "Draft of Default"; after Promote the Active reads "Default", never "(draft)"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-09-25T14:02:00.000Z');
    vi.setSystemTime(now);
    renderPanels(await importTestMidi1());
    expect(summaryName()).toBe('Default');

    dispatch({ type: 'SUGGEST_STARTING_LAYOUT' });
    expect(summaryName()).toBe('Draft of Default');
    dispatch({ type: 'PROMOTE_WORKING_LAYOUT' });
    expect(summaryName()).toBe('Default');
    expect(screen.getByTestId('active-layout-name').textContent).toBe('Default');

    // The next edit is a draft of Default again, not "Default (draft) (draft)".
    dispatch(place('7,7', 0));
    expect(summaryName()).toBe('Draft of Default');
    dispatch({ type: 'PROMOTE_WORKING_LAYOUT' });
    expect(screen.getByTestId('active-layout-name').textContent).toBe('Default');
    // The replaced Active is kept under a clean, dated name.
    expect(screen.getAllByTestId('variant-name').map(el => el.textContent)).toEqual([`Default – ${variantStamp(now)}`]);
  });

  it('a recovered draft reads "Draft of Default"', async () => {
    renderPanels(await importTestMidi1());
    dispatch(place('0,0', 0), place('0,7', 1));
    dispatch({ type: 'SET_CANDIDATES', payload: [candidate('cand-a', ['4,4', '4,5'])] });
    dispatch({ type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    expect(screen.getAllByTestId('recovered-name').map(el => el.textContent)).toEqual(['Draft of Default']);
  });

  it('a rename edits the base name, not the label', async () => {
    renderPanels(await importTestMidi1());
    dispatch(place('0,0', 0));
    fireEvent.doubleClick(screen.getByTestId('layout-summary-name'));
    const input = screen.getByDisplayValue('Default') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Groove idea' } });
    fireEvent.blur(input);
    expect(api.state.workingLayout!.name).toBe('Groove idea');
    expect(summaryName()).toBe('Draft of Groove idea');
    // Promote keeps the base name.
    dispatch({ type: 'PROMOTE_WORKING_LAYOUT' });
    expect(api.state.activeLayout.name).toBe('Groove idea');
    expect(summaryName()).toBe('Groove idea');
  });
});
