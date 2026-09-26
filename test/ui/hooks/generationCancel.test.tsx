// @vitest-environment happy-dom
/**
 * Generate: progress, Cancel and one commit (S3.4, T35; roadmap P3-7a), and the
 * trace Generate leaves for MoveTracePanel (T33; the S0.2 follow-up "Toolbar
 * Generate never sets the trace").
 *
 * Runs useAutoAnalysis.generateFull inside a real ProjectProvider on TEST
 * MIDI 1, with an injected clock. Cancel is pressed from the progress store
 * the toolbar's pill reads, mid-run.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import { type GenerationProgress } from '../../../src/engine/optimization/runControl';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

// Lets one test make the greedy pipeline fail; every other call runs it for real.
const failure = vi.hoisted(() => ({ next: false }));
vi.mock('../../../src/engine/optimization/greedyCandidatePipeline', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/engine/optimization/greedyCandidatePipeline')>();
  return {
    ...actual,
    generateGreedyCandidates: (...args: Parameters<typeof actual.generateGreedyCandidates>) => {
      if (failure.next) {
        failure.next = false;
        return Promise.reject(new Error('Solver exploded'));
      }
      return actual.generateGreedyCandidates(...args);
    },
  };
});

/** A clock that moves 100 ms every time it is read. */
function steppingClock() {
  let t = 0;
  return () => (t += 100);
}

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  const now = steppingClock();
  return renderHook(() => ({ project: useProject(), analysis: useAutoAnalysis({ now }) }), { wrapper });
}

type Rendered = ReturnType<typeof renderProject>;

const withMethod = (state: ProjectState, method: 'greedy' | 'beam' | 'annealing') => projectReducer(
  projectReducer(state, { type: 'SET_OPTIMIZER_METHOD', payload: method }),
  { type: 'SET_GREEDY_STRATEGY', payload: 'natural-pose' },
);

/**
 * Runs Generate and presses Cancel once a progress report satisfies `when`;
 * returns every report. The toolbar's store shows at most four a second, so
 * the reports are read as the engine sends them, where the store receives them.
 */
async function generateAndCancel(
  rendered: Rendered,
  mode: 'fast' | 'deep',
  when: (p: GenerationProgress) => boolean,
): Promise<{ reports: GenerationProgress[]; cancelled: boolean }> {
  const { result } = rendered;
  const store = result.current.analysis.generationProgress;
  const report = store.report;
  const reports: GenerationProgress[] = [];
  let cancelled = false;
  store.report = p => {
    reports.push(p);
    report(p);
    if (!cancelled && when(p)) {
      cancelled = true;
      result.current.analysis.cancelGeneration();
    }
  };
  try {
    await act(async () => {
      await result.current.analysis.generateFull(mode);
    });
  } finally {
    store.report = report;
  }
  return { reports, cancelled };
}

describe('Generate · Cancel commits nothing (P3-7a)', () => {
  it('Cancel during Thorough annealing keeps the previous candidates and trace, resets isProcessing and records stopReason cancelled', async () => {
    const rendered = renderProject(withMethod(await suggestedTestMidi1(), 'greedy'));
    const { result } = rendered;
    // The previous run: greedy, which leaves candidates, a summary and a trace.
    await act(async () => { await result.current.analysis.generateFull('fast'); });
    const before = result.current.project.state;
    expect(before.candidates.length).toBeGreaterThan(0);
    expect(before.moveHistory?.length).toBeGreaterThan(0);

    act(() => result.current.project.dispatch({ type: 'SET_OPTIMIZER_METHOD', payload: 'annealing' }));
    const { reports, cancelled } = await generateAndCancel(
      rendered, 'deep', p => (p.iteration ?? 0) > 0,
    );

    expect(cancelled).toBe(true);
    expect(reports[0]).toMatchObject({ method: 'annealing', current: 1, total: 3, counts: 'candidates', iteration: 0 });
    // It stopped within the first candidate's search, straight after the Cancel.
    expect(reports.at(-1)!.current).toBe(1);
    const s = result.current.project.state;
    expect(s.isProcessing).toBe(false);
    expect(s.error).toBeNull();
    expect(s.lastGenerationRun).toMatchObject({ outcome: 'cancelled', stopReason: 'cancelled', method: 'annealing', candidateCount: 0 });
    // Nothing from the cancelled run: the list, its summary and the trace are the previous run's.
    expect(s.candidates).toBe(before.candidates);
    expect(s.generationSummary).toBe(before.generationSummary);
    expect(s.moveHistory).toBe(before.moveHistory);
    expect(s.iterationTrace).toBe(before.iterationTrace);
    expect(s.moveHistoryStopReason).toBe(before.moveHistoryStopReason);
    expect(result.current.analysis.generationProgress.get()).toBeNull();
    expect(result.current.analysis.analysisPhase).toBe('idle');
  }, 180_000);

  it('Cancel during greedy stops between layouts the same way', async () => {
    const rendered = renderProject(withMethod(await suggestedTestMidi1(), 'greedy'));
    const { cancelled } = await generateAndCancel(rendered, 'fast', p => p.current === 2);
    expect(cancelled).toBe(true);
    const s = rendered.result.current.project.state;
    expect(s.isProcessing).toBe(false);
    expect(s.error).toBeNull();
    expect(s.candidates).toEqual([]);
    expect(s.moveHistory).toBeNull();
    expect(s.lastGenerationRun).toMatchObject({ outcome: 'cancelled', stopReason: 'cancelled', method: 'greedy' });
  }, 180_000);

  it('a new run clears the last run’s record, and Generate never writes the draft', async () => {
    const initial = withMethod(await suggestedTestMidi1(), 'greedy');
    const rendered = renderProject(initial);
    await generateAndCancel(rendered, 'fast', () => true);
    expect(rendered.result.current.project.state.lastGenerationRun?.stopReason).toBe('cancelled');
    await act(async () => { await rendered.result.current.analysis.generateFull('fast'); });
    const s = rendered.result.current.project.state;
    expect(s.lastGenerationRun).toMatchObject({ outcome: 'completed', stopReason: 'completed', candidateCount: s.candidates.length });
    expect(hashLayout(s.workingLayout!)).toBe(hashLayout(initial.workingLayout!));
  }, 180_000);
});

describe('Generate · progress and the trace it leaves (T33, T35)', () => {
  it('reports each layout greedy tries, then sets the trace from the top candidate’s own', async () => {
    const rendered = renderProject(withMethod(await suggestedTestMidi1(), 'greedy'));
    const { reports } = await generateAndCancel(rendered, 'fast', () => false);
    const s = rendered.result.current.project.state;

    expect(new Set(reports.map(p => `${p.method} ${p.current}/${p.total} ${p.counts}`)))
      .toEqual(new Set(['greedy 1/3 layouts', 'greedy 2/3 layouts', 'greedy 3/3 layouts']));
    expect(reports.some(p => p.etaMs !== null)).toBe(true);

    const top = s.candidates[0];
    expect(top.moveHistory?.length).toBeGreaterThan(0);
    expect(s.moveHistory).toBe(top.moveHistory);
    expect(s.iterationTrace).toBe(top.iterationTrace);
    expect(s.moveHistoryStopReason).toBe(top.stopReason);
    expect(s.lastGenerationRun).toMatchObject({ outcome: 'completed', stopReason: 'completed', method: 'greedy' });
    expect(s.isProcessing).toBe(false);
  }, 180_000);

  it('a beam run leaves each candidate its stop reason and beam summary', async () => {
    const rendered = renderProject(withMethod(await suggestedTestMidi1(), 'beam'));
    await act(async () => { await rendered.result.current.analysis.generateFull('fast'); });
    const s = rendered.result.current.project.state;
    expect(s.candidates.length).toBeGreaterThan(0);
    for (const c of s.candidates) {
      expect(c.stopReason).toBe('completed');
      expect(c.beamSummary?.noteCount).toBe(48);
    }
    expect(s.moveHistoryStopReason).toBe('completed');
    expect(s.moveHistory).toBeNull();
  }, 180_000);
});

describe('Generate · a failed run', () => {
  it('shows the error, records the failure and resets isProcessing', async () => {
    const rendered = renderProject(withMethod(await suggestedTestMidi1(), 'greedy'));
    failure.next = true;
    await act(async () => { await rendered.result.current.analysis.generateFull('fast'); });
    const s = rendered.result.current.project.state;
    expect(s.error).toBe('Solver exploded');
    expect(s.isProcessing).toBe(false);
    expect(s.lastGenerationRun).toMatchObject({ outcome: 'failed', stopReason: null, candidateCount: 0 });
    expect(rendered.result.current.analysis.generationProgress.get()).toBeNull();
  }, 60_000);
});
