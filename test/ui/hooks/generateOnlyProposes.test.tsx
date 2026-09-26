// @vitest-environment happy-dom
/**
 * Generate only proposes (S1a.2; roadmap P1a exit criteria 2a and 4).
 *
 * Generate fills the candidate list and leaves the Working/Test Layout, the grid
 * and the history alone, so Generate on an empty grid places nothing
 * (invariant 7). Since S3.2 candidate A is shown read-only afterwards (Q4),
 * even on an empty grid: looking writes nothing.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, resolveInspectedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  return renderHook(() => ({ project: useProject(), analysis: useAutoAnalysis() }), { wrapper });
}

const greedyNaturalPose = (state: ProjectState) => projectReducer(
  projectReducer(state, { type: 'SET_OPTIMIZER_METHOD', payload: 'greedy' }),
  { type: 'SET_GREEDY_STRATEGY', payload: 'natural-pose' },
);

describe('Generate only proposes', () => {
  it('P1a-2a: useAutoAnalysis never dispatches APPLY_GENERATION_TO_LAYOUT', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/ui/hooks/useAutoAnalysis.ts'), 'utf8');
    expect(source).not.toMatch(/type:\s*['"]APPLY_GENERATION_TO_LAYOUT['"]/);
  });

  it('P1a-4: Generate on an empty grid leaves the draft empty', async () => {
    const initial = greedyNaturalPose(await importTestMidi1());
    expect(Object.keys(initial.activeLayout.padToVoice)).toHaveLength(0);
    const { result } = renderProject(initial);
    await act(async () => { await result.current.analysis.generateFull('fast'); });

    const s = result.current.project.state;
    expect(s.candidates.length).toBeGreaterThan(0);
    expect(Object.keys(s.workingLayout?.padToVoice ?? {})).toEqual([]);
    expect(Object.keys(s.activeLayout.padToVoice)).toEqual([]);
    // Candidate A is shown read-only (Q4, S3.2), and nothing was written.
    expect(s.inspectedLayout).toEqual({ kind: 'candidate', id: s.candidates[0]!.id });
    expect(resolveInspectedLayout(s).readOnly).toBe(true);
    expect(result.current.project.canUndo).toBe(false);
  }, 120_000);

  it('P1a-2a: after Generate the draft hash is unchanged and candidate A is shown read-only', async () => {
    const initial = greedyNaturalPose(await suggestedTestMidi1());
    const { result } = renderProject(initial);
    const draftHash = hashLayout(result.current.project.state.workingLayout!);
    await act(async () => { await result.current.analysis.generateFull('fast'); });

    const s = result.current.project.state;
    expect(s.candidates.length).toBeGreaterThan(0);
    expect(hashLayout(s.workingLayout!)).toBe(draftHash);
    expect(s.inspectedLayout).toEqual({ kind: 'candidate', id: s.candidates[0]!.id });
    expect(resolveInspectedLayout(s)).toMatchObject({ role: 'candidate', readOnly: true, layout: s.candidates[0]!.layout });
    expect(s.isProcessing).toBe(false);
  }, 120_000);
});
