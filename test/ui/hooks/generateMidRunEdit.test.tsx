// @vitest-environment happy-dom
/**
 * C2 (S1a.2 case) · An edit made while Generate runs is kept.
 *
 * Runs useAutoAnalysis.generateFull inside a real ProjectProvider and makes a
 * pad edit at the run's first yield, the way a drag during a run would. In the
 * browser this can't be an e2e case: with an edit mid-run, greedy Generate did
 * not finish within 10 minutes (see Follow-ups in UI_ROADMAP_PROGRESS.md).
 *
 * Expected to fail until S1a.2: Generate dispatches APPLY_GENERATION_TO_LAYOUT
 * after the run, replacing the draft and losing the edit.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer } from '../../../src/ui/state/projectState';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

describe('C2 · Generate and a mid-run edit', () => {
  it.fails('keeps an edit made while Generate runs (fails until S1a.2)', async () => {
    let initial = await suggestedTestMidi1();
    initial = projectReducer(initial, { type: 'SET_OPTIMIZER_METHOD', payload: 'greedy' });
    initial = projectReducer(initial, { type: 'SET_GREEDY_STRATEGY', payload: 'natural-pose' });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProjectProvider initialState={initial}>{children}</ProjectProvider>
    );
    const { result } = renderHook(() => ({ project: useProject(), analysis: useAutoAnalysis() }), { wrapper });

    const moved = result.current.project.state.soundStreams[0];
    let finished = false;
    let editedBeforeRunFinished = false;
    await act(async () => {
      const run = result.current.analysis.generateFull('fast').then(() => { finished = true; });
      // generateFull has returned at its first await, so the run is in flight.
      editedBeforeRunFinished = !finished;
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream: moved } });
      await run;
    });
    expect(editedBeforeRunFinished).toBe(true);

    const s = result.current.project.state;
    expect(s.candidates.length).toBeGreaterThan(0);
    expect((s.workingLayout ?? s.activeLayout).padToVoice['7,7']?.id).toBe(moved.id);
  }, 120_000);
});
