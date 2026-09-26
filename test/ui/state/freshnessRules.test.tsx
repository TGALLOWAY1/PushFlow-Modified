// @vitest-environment happy-dom
/**
 * S3.3 · Freshness rules (T14), criterion P3-5 at reducer level.
 *
 * Analysis goes stale only when something it reads changes: notes, scope
 * (mute, solo), tempo, placements, locks and finger preferences. Renaming,
 * recolouring, grouping and reordering Sounds leave it fresh, and so does
 * undoing them; the candidates' and plans' copies of a Sound's name follow an
 * undone rename (the S1a.1 follow-up). A draft whose pads return to Active's
 * is dropped.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { type LaneGroup } from '../../../src/types/performanceLane';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

/** TEST MIDI 1, suggested and promoted, with a fresh analysis (analysisStale false). */
let fresh: ProjectState;
beforeAll(async () => {
  const promoted = reduce(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
  fresh = { ...promoted, analysisStale: false };
});

const sound = (i: number) => fresh.soundStreams[i]!;
const group: LaneGroup = { groupId: 'g1', name: 'Drums', color: '#ff0000', orderIndex: 0, isCollapsed: false };

describe('what marks the analysis stale (T14)', () => {
  it.each<[string, (s: ProjectState) => ProjectAction[]]>([
    ['renaming a Sound', () => [{ type: 'RENAME_SOUND', payload: { streamId: sound(0).id, name: 'Kick' } }]],
    ['renaming a lane', () => [{ type: 'RENAME_LANE', payload: { laneId: sound(0).id, name: 'Kick' } }]],
    ['recolouring a Sound', () => [{ type: 'SET_SOUND_COLOR', payload: { streamId: sound(0).id, color: '#123456' } }]],
    ['recolouring a lane', () => [{ type: 'SET_LANE_COLOR', payload: { laneId: sound(0).id, color: '#123456', colorMode: 'custom' } }]],
    ['grouping Sounds', () => [
      { type: 'CREATE_LANE_GROUP', payload: group },
      { type: 'SET_LANE_GROUP', payload: { laneId: sound(0).id, groupId: 'g1' } },
      { type: 'SET_LANE_GROUP_COLOR', payload: { groupId: 'g1', color: '#00ff00' } },
    ]],
    ['reordering Sounds', s => [{ type: 'REORDER_STREAMS', payload: { streamId: sound(0).id, newIndex: 3 } }, { type: 'REORDER_LANES', payload: { orderedIds: [...s.performanceLanes].reverse().map(l => l.id) } }]],
    ['renaming the project or the layout', () => [{ type: 'RENAME_PROJECT', payload: 'Groove' }, { type: 'RENAME_LAYOUT', payload: { target: 'active', name: 'Main' } }]],
  ])('%s leaves it fresh', (_name, actions) => {
    const next = reduce(fresh, ...actions(fresh));
    expect(next).not.toBe(fresh);
    expect(next.analysisStale).toBe(false);
  });

  it.each<[string, (s: ProjectState) => ProjectAction[]]>([
    ['a mute', () => [{ type: 'TOGGLE_MUTE', payload: sound(0).id }]],
    ['a lane mute', () => [{ type: 'TOGGLE_LANE_MUTE', payload: sound(0).id }]],
    ['a solo', () => [{ type: 'SOLO_STREAM', payload: sound(0).id }]],
    ['a tempo change', s => [{ type: 'SET_TEMPO', payload: s.tempo + 5 }]],
    ['a placement', () => [{ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: sound(0) } }]],
    ['a lock', s => {
      const [padKey, voice] = Object.entries(s.activeLayout.padToVoice)[0]!;
      return [{ type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: voice.id, padKey } }];
    }],
    ['a finger preference of a placed Sound', () => [{ type: 'SET_VOICE_CONSTRAINT', payload: { streamId: sound(0).id, hand: 'left', finger: 'index' } }]],
    ['a note removed', s => [{ type: 'UPSERT_LANE_SOURCE', payload: {
      lanes: s.performanceLanes.map((l, i) => (i === 0 ? { ...l, events: l.events.slice(1) } : l)),
      sourceFile: s.sourceFiles[0]!,
      notesOnly: true,
    } }]],
  ])('%s marks it stale', (_name, actions) => {
    expect(reduce(fresh, ...actions(fresh)).analysisStale).toBe(true);
  });
});

describe('undo and redo keep it fresh when nothing it reads changed', () => {
  function mount(state: ProjectState) {
    const wrapper = ({ children }: { children: ReactNode }) => <ProjectProvider initialState={state}>{children}</ProjectProvider>;
    return renderHook(() => useProject(), { wrapper }).result;
  }

  it('an undone rename leaves the analysis fresh, and the candidates and plan take the old name back', () => {
    const candidate = { id: 'cand-a', layout: fresh.activeLayout, executionPlan: { fingerAssignments: [] }, metadata: { strategy: 'test', seed: 0 } } as unknown as CandidateSolution;
    const withCandidate = { ...reduce(fresh, { type: 'SET_CANDIDATES', payload: [candidate] }, { type: 'INSPECT_LAYOUT', payload: null }), analysisResult: candidate, analysisStale: false };
    const result = mount(withCandidate);
    const id = sound(0).id;
    const nameIn = (s: ProjectState, layoutOf: (s: ProjectState) => { padToVoice: Record<string, { id: string; name: string }> }) =>
      Object.values(layoutOf(s).padToVoice).find(v => v.id === id)!.name;

    act(() => result.current.dispatch({ type: 'RENAME_SOUND', payload: { streamId: id, name: 'Kick' } }));
    expect(nameIn(result.current.state, s => s.candidates[0]!.layout)).toBe('Kick');
    expect(result.current.state.analysisStale).toBe(false);

    act(() => { result.current.undo(); });
    const s = result.current.state;
    expect(s.analysisStale).toBe(false);
    expect(s.soundStreams.find(x => x.id === id)!.name).toBe(sound(0).name);
    expect(nameIn(s, x => x.candidates[0]!.layout)).toBe(sound(0).name);
    expect(nameIn(s, x => x.analysisResult!.layout)).toBe(sound(0).name);
  });

  it('an undone placement marks it stale, as the layout changed', () => {
    const result = mount(fresh);
    act(() => result.current.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: sound(0) } }));
    act(() => result.current.dispatch({ type: 'SET_ANALYSIS_RESULT', payload: null }));
    expect(result.current.state.analysisStale).toBe(false);
    act(() => { result.current.undo(); });
    expect(result.current.state.analysisStale).toBe(true);
  });
});

describe('an identical draft is dropped (T14)', () => {
  it('a Sound moved away and back leaves no draft; so does a lock made and removed on a draft', () => {
    const [padKey, voice] = Object.entries(fresh.activeLayout.padToVoice)[0]!;
    const stream = fresh.soundStreams.find(s => s.id === voice.id)!;
    const moved = reduce(fresh, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream } });
    expect(moved.workingLayout).not.toBeNull();
    const back = reduce(moved, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream } });
    expect(back.workingLayout).toBeNull();

    // A draft with a lock, then the lock undone by hand: Active again, no draft.
    const other = Object.entries(moved.workingLayout!.padToVoice).find(([k]) => k !== '0,0')!;
    const locked = reduce(moved, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: other[1].id, padKey: other[0] } });
    const movedBack = reduce(locked, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream } });
    expect(movedBack.workingLayout).not.toBeNull();
    const unlocked = reduce(movedBack, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: other[1].id, padKey: other[0] } });
    expect(unlocked.workingLayout).toBeNull();
  });

  it('a preference set and cleared again leaves no draft', () => {
    const id = sound(0).id;
    const set = reduce(fresh, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: id, hand: 'left', finger: 'index' } });
    expect(set.workingLayout).not.toBeNull();
    const cleared = reduce(set, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: id, hand: null, finger: null } });
    expect(cleared.workingLayout).toBeNull();
  });
});
