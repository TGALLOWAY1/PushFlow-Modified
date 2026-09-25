// @vitest-environment happy-dom
/**
 * S3.1 · "Cap and fully key the cache, and show 'Scoring…' per row": with more
 * layouts on screen than the cache holds, every row is scored once, keeps its
 * result after the cache drops its entry, and never flips back to "Scoring…"
 * or re-solves because other rows filled the cache.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import type { Dispatch } from 'react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { useLayoutAnalysis, analysisKeyFor } from '../../../src/ui/analysis/layoutAnalysis';
import { ANALYSIS_CACHE_CAPACITY, analysisCacheSize, peekAnalysis } from '../../../src/ui/analysis/analysisCache';
import { type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import type { ScoredLayoutAnalysis } from '../../../src/ui/analysis/scoreLayout';
import type { Layout } from '../../../src/types/layout';
import { importTestMidi1 } from '../../helpers/testMidi1';

vi.mock('../../../src/ui/analysis/scoreLayout', () => ({
  analyseAndScoreLayout: vi.fn(async (request: { layout: Layout }) => ({
    analysis: { id: `analysis-${request.layout.id}`, layout: request.layout, executionPlan: { fingerAssignments: [] } },
    score: { evaluatorId: 'canonical-v1', playability: 50, events: 32, hardEvents: 0, unplayableEvents: 0 },
  }) as unknown as ScoredLayoutAnalysis),
}));
import { analyseAndScoreLayout } from '../../../src/ui/analysis/scoreLayout';

afterEach(cleanup);

function Row({ layout }: { layout: Layout }) {
  const scored = useLayoutAnalysis(layout);
  return <div data-testid="row" data-status={scored.status}>{scored.status === 'ready' ? scored.analysis.id : scored.status}</div>;
}

let dispatch: Dispatch<ProjectAction>;
let latest: ProjectState;
function Spy() {
  const project = useProject();
  dispatch = project.dispatch;
  latest = project.state;
  return null;
}

/** `count` distinct layouts of this project's Sounds. */
function distinctLayouts(state: ProjectState, count: number): Layout[] {
  const voice = (i: number) => {
    const s = state.soundStreams[i]!;
    return { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track' as const, sourceFile: '' };
  };
  const pad = (n: number) => `${Math.floor(n / 8) % 8},${n % 8}`;
  return Array.from({ length: count }, (_, i) => ({
    ...state.activeLayout,
    id: `layout-${i}`,
    padToVoice: i < 64 ? { [pad(i)]: voice(0) } : { [pad(i)]: voice(0), [pad(i + 1)]: voice(1) },
  }));
}

describe('useLayoutAnalysis with more rows than the cache holds', () => {
  it('scores each row once, and no row flips back to "Scoring…" or re-solves when the cache is full', async () => {
    const initial = await importTestMidi1();
    const layouts = distinctLayouts(initial, ANALYSIS_CACHE_CAPACITY + 8);
    const screenWith = (shown: Layout[]) => (
      <ToastProvider>
        <ProjectProvider initialState={initial}>
          <Spy />
          {shown.map(layout => <Row key={layout.id} layout={layout} />)}
        </ProjectProvider>
      </ToastProvider>
    );
    const statuses = () => screen.getAllByTestId('row').map(row => row.getAttribute('data-status'));

    // A full cache's worth of rows, each scored and read from the cache...
    const { rerender } = render(screenWith(layouts.slice(0, ANALYSIS_CACHE_CAPACITY)));
    expect(statuses().every(s => s === 'analysing')).toBe(true);
    await waitFor(() => expect(statuses().every(s => s === 'ready')).toBe(true), { timeout: 15_000 });
    expect(analysisCacheSize()).toBe(ANALYSIS_CACHE_CAPACITY);

    // ...then more rows (a new Generate run, say), whose entries push the
    // least recently used ones out.
    rerender(screenWith(layouts));
    await waitFor(() => expect(statuses().every(s => s === 'ready')).toBe(true), { timeout: 15_000 });
    expect(analysisCacheSize()).toBe(ANALYSIS_CACHE_CAPACITY);
    const evicted = layouts.filter(l => !peekAnalysis(analysisKeyFor(latest, l)));
    expect(evicted).toHaveLength(8);

    // Renders driven by other state: every row still shows its own result, and
    // nothing is solved again (a row that re-solved when its entry went would
    // push another row's out, and so on).
    for (const payload of ['a', 'b', null, 'c']) {
      await act(async () => { dispatch({ type: 'SELECT_STREAM', payload }); });
      expect(statuses()).toEqual(layouts.map(() => 'ready'));
    }
    expect(screen.getAllByTestId('row').map(row => row.textContent)).toEqual(layouts.map(l => `analysis-${l.id}`));
    expect(analyseAndScoreLayout).toHaveBeenCalledTimes(layouts.length);
  });

  it('a row whose key changes is scored again', async () => {
    const initial = await importTestMidi1();
    const [layout] = distinctLayouts(initial, 1);
    const { rerender } = render(
      <ToastProvider>
        <ProjectProvider initialState={initial}>
          <Row layout={layout!} />
        </ProjectProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('row').getAttribute('data-status')).toBe('ready'), { timeout: 15_000 });
    const calls = vi.mocked(analyseAndScoreLayout).mock.calls.length;
    const moved = { ...layout!, padToVoice: { '7,7': Object.values(layout!.padToVoice)[0]! } };
    rerender(
      <ToastProvider>
        <ProjectProvider initialState={initial}>
          <Row layout={moved} />
        </ProjectProvider>
      </ToastProvider>,
    );
    expect(screen.getByTestId('row').getAttribute('data-status')).toBe('analysing');
    await waitFor(() => expect(screen.getByTestId('row').getAttribute('data-status')).toBe('ready'), { timeout: 15_000 });
    expect(vi.mocked(analyseAndScoreLayout).mock.calls.length).toBe(calls + 1);
  });
});
