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
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';
import { projectReducer } from '../../../src/ui/state/projectState';

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

describe('one undo step per user intent', () => {
  it('P1a-1b: one Undo after Suggest restores the pre-Suggest grid', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    act(() => {
      result.current.project.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: initial.soundStreams[0] } });
    });
    const before = pads(result);
    act(() => result.current.project.dispatch({ type: 'SUGGEST_STARTING_LAYOUT' }));
    expect(pads(result)).toHaveLength(initial.soundStreams.length);
    expect(result.current.project.undoLabel).toBe('Suggest layout');
    act(() => result.current.project.undo());
    expect(pads(result)).toEqual(before);
    expect(result.current.project.undoLabel).toBe('Place Sound');
    expect(result.current.project.redoLabel).toBe('Suggest layout');
  });

  it('transact makes a compound gesture one named step', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    const [a, b, c] = initial.soundStreams;
    act(() => {
      const { dispatch, transact } = result.current.project;
      transact('Group', () => {
        dispatch({ type: 'CREATE_LANE_GROUP', payload: { groupId: 'g1', name: 'Group 1', color: '#fff', orderIndex: 0, isCollapsed: false } });
        for (const s of [a, b, c]) dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: s.id, groupId: 'g1' } });
      });
    });
    expect(result.current.project.state.laneGroups).toHaveLength(1);
    expect(result.current.project.undoLabel).toBe('Group');
    act(() => result.current.project.undo());
    const s = result.current.project.state;
    expect({ groups: s.laneGroups.length, grouped: s.performanceLanes.filter(l => l.groupId).length, canUndo: result.current.project.canUndo })
      .toEqual({ groups: 0, grouped: 0, canUndo: false });
  });

  it('a transaction that changes nothing records nothing, and nesting joins the outer step', async () => {
    const initial = await importTestMidi1();
    const { result } = renderProject(initial);
    act(() => {
      result.current.project.transact('Nothing', () => {
        result.current.project.dispatch({ type: 'SELECT_EVENT', payload: 3 });
      });
    });
    expect(result.current.project.canUndo).toBe(false);
    act(() => {
      const { dispatch, transact } = result.current.project;
      transact('Outer', () => {
        dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '1,1', stream: initial.soundStreams[0] } });
        transact('Inner', () => {
          dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '1,2', stream: initial.soundStreams[1] } });
        });
      });
    });
    expect(result.current.project.undoLabel).toBe('Outer');
    act(() => result.current.project.undo());
    expect({ pads: pads(result), canUndo: result.current.project.canUndo }).toEqual({ pads: [], canUndo: false });
  });

  it('an import (lanes plus tempo) is one step', async () => {
    const imported = await importTestMidi1();
    const { result } = renderProject(projectReducer(imported, { type: 'RESET' }));
    act(() => {
      const { dispatch, transact } = result.current.project;
      transact('Import', () => {
        dispatch({ type: 'IMPORT_LANES', payload: { lanes: imported.performanceLanes, sourceFile: imported.sourceFiles[0] } });
        dispatch({ type: 'SET_TEMPO', payload: imported.tempo + 7 });
      });
    });
    expect(result.current.project.state.soundStreams).toHaveLength(imported.soundStreams.length);
    act(() => result.current.project.undo());
    const s = result.current.project.state;
    expect({ sounds: s.soundStreams.length, tempo: s.tempo, canUndo: result.current.project.canUndo })
      .toEqual({ sounds: 0, tempo: 120, canUndo: false });
  });

  it('Discard and Promote are one named step each', async () => {
    const initial = await suggestedTestMidi1();
    const { result } = renderProject(initial);
    const suggested = pads(result);
    act(() => result.current.project.dispatch({ type: 'PROMOTE_WORKING_LAYOUT' }));
    expect(result.current.project.undoLabel).toBe('Promote');
    act(() => result.current.project.dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: suggested[0] } }));
    act(() => result.current.project.dispatch({ type: 'DISCARD_WORKING_LAYOUT' }));
    expect(result.current.project.undoLabel).toBe('Discard');
    act(() => result.current.project.undo());
    expect(pads(result)).toEqual(suggested.slice(1));
    expect(result.current.project.state.workingLayout).not.toBeNull();
    act(() => { result.current.project.undo(); result.current.project.undo(); });
    const s = result.current.project.state;
    expect({ active: Object.keys(s.activeLayout.padToVoice).length, draft: s.workingLayout !== null })
      .toEqual({ active: 0, draft: true });
  });

  it('P1a-1c: after Generate, Undo keeps the candidate list and the trace and undoes the previous user edit', async () => {
    let initial = await suggestedTestMidi1();
    initial = projectReducer(initial, { type: 'SET_OPTIMIZER_METHOD', payload: 'greedy' });
    initial = projectReducer(initial, { type: 'SET_GREEDY_STRATEGY', payload: 'natural-pose' });
    const { result } = renderProject(initial);
    act(() => {
      result.current.project.dispatch({ type: 'SWAP_PADS', payload: { padKeyA: pads(result)[0], padKeyB: '7,7' } });
    });
    const draft = pads(result);
    await act(async () => { await result.current.analysis.generateFull('fast'); });

    const after = result.current.project.state;
    expect(after.candidates.length).toBeGreaterThan(0);
    // Generate only proposes: it records no step, and the draft is untouched.
    expect(pads(result)).toEqual(draft);
    expect(result.current.project.undoLabel).toBe('Swap pads');
    act(() => result.current.project.undo());
    const undone = result.current.project.state;
    expect({
      pads: pads(result),
      candidates: undone.candidates.map(c => c.id),
      trace: undone.moveHistory,
      iterationTraces: undone.candidates.map(c => c.iterationTrace?.length ?? null),
      // The swap was the only step (history starts empty when the project opens).
      canUndo: result.current.project.canUndo,
    }).toEqual({
      // The swap is undone: back to the Suggested layout.
      pads: Object.keys(initial.workingLayout!.padToVoice).sort(),
      candidates: after.candidates.map(c => c.id),
      trace: after.moveHistory,
      iterationTraces: after.candidates.map(c => c.iterationTrace?.length ?? null),
      canUndo: false,
    });
  }, 120_000);
});

describe('Undo never loses a generated candidate', () => {
  it('undoing a candidate Promote puts the candidate back in the list', async () => {
    const initial = await suggestedTestMidi1();
    const { result } = renderProject(initial);
    const layout = initial.workingLayout!;
    const candidate = {
      id: 'cand-a',
      layout: { ...layout, id: 'cand-a-layout', padToVoice: { '7,7': Object.values(layout.padToVoice)[0] } },
      executionPlan: { layoutBinding: { layoutId: 'cand-a-layout', layoutHash: '', layoutRole: 'working' } },
      metadata: { strategy: 'test', seed: 0 },
    } as unknown as ProjectState['candidates'][number];
    act(() => result.current.project.dispatch({ type: 'SET_CANDIDATES', payload: [candidate] }));
    act(() => result.current.project.dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-a' } }));
    expect(result.current.project.state.candidates).toHaveLength(0);
    expect(Object.keys(result.current.project.state.activeLayout.padToVoice)).toEqual(['7,7']);

    act(() => result.current.project.undo());
    const s = result.current.project.state;
    expect({ candidates: s.candidates.map(c => c.id), activePads: Object.keys(s.activeLayout.padToVoice) })
      .toEqual({ candidates: ['cand-a'], activePads: [] });
    expect(pads(result)).toEqual(Object.keys(layout.padToVoice).sort());
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
