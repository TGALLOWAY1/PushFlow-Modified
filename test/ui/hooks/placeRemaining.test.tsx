// @vitest-environment happy-dom
/**
 * S3.3 · Explicit fill-in (T37, decision Q4).
 *
 * "Place remaining N Sounds" never places anything itself: it proposes one
 * candidate, "Remaining placed", with every placed Sound exactly where it is
 * (locks held) and the rest placed as Suggest a starting layout would. The
 * candidate is added as a run and shown read-only, the draft and the undo
 * history untouched, and its plan is the per-layout cache's. "Use as my draft"
 * applies it in one click (it keeps all of the draft, so nothing asks first),
 * as one undo step. On an empty grid, Generate reads "Generate layouts from
 * scratch".
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { usePlaceRemaining } from '../../../src/ui/hooks/usePlaceRemaining';
import { REMAINING_PLACED_STRATEGY, runLabel } from '../../../src/ui/state/candidateRuns';
import { peekLayoutAnalysis } from '../../../src/ui/analysis/layoutAnalysis';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { WorkspaceToolbar } from '../../../src/ui/components/workspace/WorkspaceToolbar';
import { UseAsDraftButton } from '../../../src/ui/components/workspace/UseAsDraftButton';
import { extendsDraft } from '../../../src/ui/hooks/useUseAsDraft';
import { ViewSettingsProvider } from '../../../src/ui/state/viewSettings';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

/** Three Sounds placed by hand, one of them locked. */
async function partlyPlaced(): Promise<ProjectState> {
  const start = await importTestMidi1();
  const placed = reduce(start, ...['0,0', '7,7', '3,6'].map((padKey, i): ProjectAction => ({
    type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: start.soundStreams[i]! },
  })));
  return reduce(placed, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: start.soundStreams[0]!.id, padKey: '0,0' } });
}

function mount(state: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => <ProjectProvider initialState={state}>{children}</ProjectProvider>;
  return renderHook(() => ({ project: useProject(), fill: usePlaceRemaining() }), { wrapper }).result;
}

describe('Place remaining N Sounds (T37, Q4)', () => {
  it('proposes one candidate that keeps every placed Sound and lock and places the rest; it writes nothing', async () => {
    const state = await partlyPlaced();
    const result = mount(state);
    expect(result.current.fill.count).toBe(4);
    const draft = state.workingLayout!;
    expect(result.current.project.canUndo).toBe(false);

    await act(async () => { await result.current.fill.placeRemaining(); });
    const s = result.current.project.state;
    expect(s.candidates).toHaveLength(1);
    const candidate = s.candidates[0]!;
    expect(candidate.metadata.strategy).toBe(REMAINING_PLACED_STRATEGY);
    expect(runLabel(s.candidates)).toBe('Place remaining');
    // Shown read-only, like Generate's candidate A; the draft is untouched and nothing entered the history.
    expect(s.inspectedLayout).toEqual({ kind: 'candidate', id: candidate.id });
    expect(hashLayout(s.workingLayout!)).toBe(hashLayout(draft));
    expect(result.current.project.canUndo).toBe(false);
    // Placed Sounds stay exactly where they are, the lock holds, and every Sound is placed.
    for (const [padKey, voice] of Object.entries(draft.padToVoice)) expect(candidate.layout.padToVoice[padKey]?.id).toBe(voice.id);
    expect(candidate.layout.placementLocks).toEqual(draft.placementLocks);
    expect(new Set(Object.values(candidate.layout.padToVoice).map(v => v.id)).size).toBe(7);
    // Its plan is the per-layout cache's (the numbers it shows as the draft).
    expect(candidate.executionPlan.fingerAssignments).toEqual(peekLayoutAnalysis(s, candidate.layout)!.analysis.executionPlan.fingerAssignments);
    expect(result.current.fill.count).toBe(4);

    // "Use as my draft" applies it, as one undo step.
    act(() => result.current.project.dispatch({ type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidate.id } }));
    expect(new Set(Object.values(result.current.project.state.workingLayout!.padToVoice).map(v => v.id)).size).toBe(7);
    expect(result.current.fill.count).toBe(0);
    act(() => { result.current.project.undo(); });
    expect(hashLayout(result.current.project.state.workingLayout!)).toBe(hashLayout(draft));
  }, 60_000);

  it('"Use as my draft" on it is one click: it keeps all of the draft, so nothing asks first (Q4)', async () => {
    const state = await partlyPlaced();
    const result = mount(state);
    await act(async () => { await result.current.fill.placeRemaining(); });
    const withCandidate = result.current.project.state;
    const candidate = withCandidate.candidates[0]!;
    expect(extendsDraft(withCandidate, { kind: 'candidate', id: candidate.id })).toBe(true);
    // A candidate that moves one of the placed Sounds would ask.
    const [padKey, voice] = Object.entries(state.workingLayout!.padToVoice)[1]!;
    const padToVoice = { ...candidate.layout.padToVoice };
    delete padToVoice[padKey];
    const moving = { ...candidate, id: 'moving', layout: { ...candidate.layout, padToVoice: { ...padToVoice, '6,6': voice } } };
    expect(extendsDraft({ ...withCandidate, candidates: [moving] }, { kind: 'candidate', id: 'moving' })).toBe(false);

    let api!: ReturnType<typeof useProject>;
    function Spy() {
      api = useProject();
      return null;
    }
    render(
      <ToastProvider>
        <ProjectProvider initialState={withCandidate}>
          <Spy />
          <UseAsDraftButton source={{ kind: 'candidate', id: candidate.id }} testId="use" />
        </ProjectProvider>
      </ToastProvider>,
    );
    const button = screen.getByTestId('use');
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    act(() => { fireEvent.click(button); });
    expect(screen.queryByTestId('use-as-draft-popover')).toBeNull();
    expect(new Set(Object.values(api.state.workingLayout!.padToVoice).map(v => v.id)).size).toBe(7);
    expect(api.undoLabel).toBe('Use as my draft');
    act(() => { api.undo(); });
    expect(api.canUndo).toBe(false);
    expect(hashLayout(api.state.workingLayout!)).toBe(hashLayout(state.workingLayout!));
  }, 60_000);

  it('does nothing when every Sound in scope is placed', async () => {
    const start = await importTestMidi1();
    const all = reduce(start, { type: 'SUGGEST_STARTING_LAYOUT' });
    const result = mount(all);
    expect(result.current.fill.count).toBe(0);
    await act(async () => { await result.current.fill.placeRemaining(); });
    expect(result.current.project.state.candidates).toEqual([]);
  });
});

describe('Generate on an empty grid (T37)', () => {
  function toolbar(state: ProjectState) {
    render(
      <ToastProvider>
        <ProjectProvider initialState={state}>
          <ViewSettingsProvider>
            <WorkspaceToolbar
              onNavigateLibrary={() => {}}
              generateFull={async () => {}}
              generationProgress={null}
              analysisPhase="idle"
              canGenerate
              generateDisabledReason={null}
              compareCount={0}
              onCompare={() => {}}
            />
          </ViewSettingsProvider>
        </ProjectProvider>
      </ToastProvider>,
    );
  }

  it('reads "Generate layouts from scratch" with nothing placed, and "Generate" once something is', async () => {
    const start = await importTestMidi1();
    toolbar(start);
    expect(screen.getByRole('button', { name: 'Generate layouts from scratch' })).toBeTruthy();
    cleanup();
    toolbar(await partlyPlaced());
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });
});
