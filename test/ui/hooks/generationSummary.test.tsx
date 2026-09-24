// @vitest-environment happy-dom
/**
 * Generate reports what it did with its list (S1a.3): the generation summary
 * lands in session state, and the Layouts panel says when candidates were
 * dropped for breaking a placement lock.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { LayoutOptionsPanel } from '../../../src/ui/components/panels/LayoutOptionsPanel';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import { suggestedTestMidi1, importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  return renderHook(() => ({ project: useProject(), analysis: useAutoAnalysis() }), { wrapper });
}

describe('generation summary', () => {
  it('is stored in session state after a Beam run, with no candidate dropped for locks', async () => {
    const initial = projectReducer(await suggestedTestMidi1(), { type: 'SET_OPTIMIZER_METHOD', payload: 'beam' });
    const { result } = renderProject(initial);
    await act(async () => { await result.current.analysis.generateFull('fast'); });

    const s = result.current.project.state;
    expect(s.candidates.length).toBeGreaterThan(0);
    expect(s.generationSummary).toMatchObject({ candidatesReturned: s.candidates.length, droppedForLockViolations: 0 });
    expect(result.current.project.canUndo).toBe(false);
  }, 60_000);

  it('is cleared by a new candidate list', async () => {
    let state = await importTestMidi1();
    state = projectReducer(state, {
      type: 'SET_GENERATION_SUMMARY',
      payload: { candidatesGenerated: 3, duplicatesRemoved: 0, candidatesReturned: 0, isLowDiversity: false, droppedForLockViolations: 3 },
    });
    expect(state.generationSummary?.droppedForLockViolations).toBe(3);
    state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [] });
    expect(state.generationSummary).toBeNull();
  });
});

describe('LayoutOptionsPanel', () => {
  async function panelWithSummary(dropped: number) {
    let state = { ...(await importTestMidi1()), id: 'proj-summary' };
    state = projectReducer(state, {
      type: 'SET_GENERATION_SUMMARY',
      payload: { candidatesGenerated: 3, duplicatesRemoved: 0, candidatesReturned: 3 - dropped, isLowDiversity: false, droppedForLockViolations: dropped },
    });
    render(
      <ToastProvider>
        <ProjectProvider initialState={state}>
          <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
        </ProjectProvider>
      </ToastProvider>,
    );
  }

  it('says why candidates were dropped, even when none are left', async () => {
    await panelWithSummary(3);
    expect(screen.getByTestId('candidates-dropped-for-locks').textContent)
      .toBe('3 candidates were dropped because they moved a locked Sound.');
  });

  it('shows no such note when nothing was dropped', async () => {
    await panelWithSummary(0);
    expect(screen.queryByTestId('candidates-dropped-for-locks')).toBeNull();
  });
});
