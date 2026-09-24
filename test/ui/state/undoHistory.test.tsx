// @vitest-environment happy-dom
/**
 * Undo covers only your edits (S1a.1, T02; roadmap P1a exit criteria 1a-1f).
 *
 * Runs the real ProjectProvider (reducer + document-only history) and, where a
 * criterion says "let analysis settle", the real useAutoAnalysis.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { type ProjectState } from '../../../src/ui/state/projectState';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import {
  serializeProject,
  deserializeProject,
  validateAndMigrateRaw,
} from '../../../src/ui/persistence/projectSerializer';
import * as greedyPipeline from '../../../src/engine/optimization/greedyCandidatePipeline';
import { importTestMidi1 } from '../../helpers/testMidi1';

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  return renderHook(() => ({ project: useProject(), analysis: useAutoAnalysis() }), { wrapper });
}

type Rendered = ReturnType<typeof renderProject>['result'];

const pads = (r: Rendered) => {
  const s = r.current.project.state;
  return Object.keys((s.workingLayout ?? s.activeLayout).padToVoice).sort();
};

async function settle(r: Rendered) {
  await waitFor(() => {
    const s = r.current.project.state;
    expect(s.analysisStale).toBe(false);
    expect(s.isProcessing).toBe(false);
  }, { timeout: 30_000 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Undo covers only your edits', () => {
  it('P1a-1a: place 3 Sounds, let analysis settle, then 3 Undos empty the grid', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    const streams = initial.soundStreams;

    for (const [i, padKey] of ['3,3', '3,4', '4,3'].entries()) {
      act(() => {
        result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: streams[i] } });
      });
    }
    await settle(result);
    expect(result.current.project.state.analysisResult).not.toBeNull();
    expect(pads(result)).toEqual(['3,3', '3,4', '4,3']);

    for (let i = 0; i < 3; i++) act(() => result.current.project.undo());
    expect(pads(result)).toEqual([]);
    expect(result.current.project.state.soundStreams).toHaveLength(streams.length);
    expect(result.current.project.canUndo).toBe(false);
  }, 60_000);

  it('P1a-1d: Undo during playback keeps playing from the current time', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    act(() => {
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: initial.soundStreams[0] } });
      result.current.project.dispatch({ type: 'SET_IS_PLAYING', payload: true });
      result.current.project.dispatch({ type: 'SET_CURRENT_TIME', payload: 2.5 });
    });
    act(() => result.current.project.undo());

    const s = result.current.project.state;
    expect(pads(result)).toEqual([]);
    expect({ isPlaying: s.isPlaying, currentTime: s.currentTime }).toEqual({ isPlaying: true, currentTime: 2.5 });
  });

  it('P1a-1e: a reopened project starts with an empty history, after analysis too', async () => {
    let saved = await importTestMidi1();
    saved = { ...saved, id: 'reopen', workingLayout: null };
    const initial = deserializeProject(validateAndMigrateRaw(JSON.parse(JSON.stringify(serializeProject({
      ...saved,
      activeLayout: {
        ...saved.activeLayout,
        padToVoice: { '3,3': voiceOf(saved, 0) },
      },
    })))));
    const { result } = renderProject(initial);
    expect(result.current.project.canUndo).toBe(false);

    // What a freshly opened workspace dispatches: derived syncs, then analysis.
    act(() => {
      result.current.project.dispatch({ type: 'POPULATE_LANES_FROM_STREAMS' });
      result.current.project.dispatch({ type: 'SYNC_STREAMS_FROM_LANES' });
    });
    await settle(result);
    expect(result.current.project.state.analysisResult).not.toBeNull();
    expect({ canUndo: result.current.project.canUndo, canRedo: result.current.project.canRedo })
      .toEqual({ canUndo: false, canRedo: false });
  }, 60_000);

  it('records nothing for session-only actions', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    act(() => {
      const d = result.current.project.dispatch;
      d({ type: 'SET_OPTIMIZER_METHOD', payload: 'beam' });
      d({ type: 'SET_COST_TOGGLES', payload: { ...initial.costToggles } });
      d({ type: 'SELECT_STREAM', payload: initial.soundStreams[0].id });
      d({ type: 'SET_CANDIDATES', payload: [] });
      d({ type: 'SET_ANALYSIS_RESULT', payload: null });
      d({ type: 'MARK_ANALYSIS_STALE' });
      d({ type: 'SET_PLAYBACK_RATE', payload: 0.5 });
    });
    expect(result.current.project.canUndo).toBe(false);
  });

  it('Redo re-applies an undone edit without touching the session', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    act(() => {
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: initial.soundStreams[0] } });
    });
    act(() => result.current.project.undo());
    act(() => result.current.project.dispatch({ type: 'SET_IS_PLAYING', payload: true }));
    expect(result.current.project.canRedo).toBe(true);
    act(() => result.current.project.redo());
    expect(pads(result)).toEqual(['3,3']);
    expect(result.current.project.state.isPlaying).toBe(true);
  });
});

describe('P1a-1f: isProcessing resets after Generate', () => {
  it('is false after a successful run', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    vi.spyOn(greedyPipeline, 'generateGreedyCandidates').mockResolvedValue({ candidates: [] } as never);
    act(() => {
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: initial.soundStreams[0] } });
    });
    let count = -1;
    await act(async () => { count = await result.current.analysis.generateFull('fast'); });
    expect(count).toBe(0);
    expect(result.current.project.state.isProcessing).toBe(false);
    expect(result.current.project.state.error).toBeNull();
  });

  it('is false after a failed run, and the error is shown', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    vi.spyOn(greedyPipeline, 'generateGreedyCandidates').mockRejectedValue(new Error('solver exploded'));
    act(() => {
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: initial.soundStreams[0] } });
    });
    await act(async () => { await result.current.analysis.generateFull('fast'); });
    expect(result.current.project.state.isProcessing).toBe(false);
    expect(result.current.project.state.error).toBe('solver exploded');
    // The failed run added no undo step: one Undo still reverts the placement.
    act(() => result.current.project.undo());
    expect(pads(result)).toEqual([]);
  });
});

function voiceOf(state: ProjectState, index: number) {
  const s = state.soundStreams[index];
  return {
    id: s.id,
    name: s.name,
    sourceType: 'midi_track' as const,
    sourceFile: '',
    originalMidiNote: s.originalMidiNote,
    color: s.color,
  };
}
