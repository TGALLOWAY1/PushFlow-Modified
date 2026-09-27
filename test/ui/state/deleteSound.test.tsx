// @vitest-environment happy-dom
/**
 * Deleting a Sound (the Sounds panel's row menu, S5.1) leaves nothing that
 * names it, through the real reducer and the real Undo and Redo:
 * - no candidate that places it, since promoting one would put it back as a
 *   pad with no Sound behind it; Undo gives the candidates back with the Sound,
 *   and Redo takes them away again;
 * - no source file or group with no Sound left, so the next import into an
 *   emptied project is a first import and adopts its file's tempo;
 * - no armed or selected Sound.
 * The Sounds panel's own selection is in test/ui/components/soundsPanel.test.tsx.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { DEFAULT_PROJECT_TEMPO, projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { planMidiImport } from '../../../src/ui/state/midiImportPlan';
import { parseMidiProject } from '../../../src/import/midiImport';
import { type Layout } from '../../../src/types/layout';
import { suggestedTestMidi1, TEST_MIDI_1_PATH } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

let start: ProjectState;
let ids: string[];

beforeAll(async () => {
  start = { ...(await suggestedTestMidi1()), id: 'proj-delete-sound' };
  ids = start.soundStreams.map(s => s.id);
}, 60_000);

/** A candidate with this layout (the draft by default). */
function candidateOf(id: string, layout: Layout = start.workingLayout!): ProjectState['candidates'][number] {
  return {
    id,
    layout: { ...layout, id: `${id}-layout` },
    executionPlan: { layoutBinding: { layoutId: `${id}-layout`, layoutHash: '', layoutRole: 'working' } },
    metadata: { strategy: 'test', seed: 0 },
  } as unknown as ProjectState['candidates'][number];
}

/** The draft without the pad of this Sound. */
function without(soundId: string): Layout {
  const layout = start.workingLayout!;
  return { ...layout, padToVoice: Object.fromEntries(Object.entries(layout.padToVoice).filter(([, v]) => v.id !== soundId)) };
}

const placedIds = (layout: Layout) => Object.values(layout.padToVoice).map(v => v.id);

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  return renderHook(() => useProject(), { wrapper });
}

describe('deleting a Sound leaves no candidate that places it', () => {
  it('drops those candidates, with their inspection and Compare pick; the others stay, and Promote brings nothing back', () => {
    const x = ids[0]!;
    const shown = reduce(start,
      { type: 'SET_CANDIDATES', payload: [candidateOf('cand-a'), candidateOf('cand-b', without(x))] },
      { type: 'SET_COMPARE_CANDIDATE', payload: 'cand-a' },
    );
    expect(shown.inspectedLayout).toMatchObject({ kind: 'candidate', id: 'cand-a' });

    const deleted = reduce(shown, { type: 'DELETE_LANE', payload: x });
    expect(deleted.candidates.map(c => c.id)).toEqual(['cand-b']);
    expect(deleted.inspectedLayout).toBeNull();
    expect(deleted.compareCandidateId).toBeNull();
    for (const layout of [deleted.activeLayout, deleted.workingLayout!, ...deleted.candidates.map(c => c.layout)]) {
      expect(placedIds(layout)).not.toContain(x);
    }

    const promoted = reduce(deleted, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(placedIds(promoted.activeLayout)).not.toContain(x);
    const live = new Set(promoted.soundStreams.map(s => s.id));
    expect(placedIds(promoted.activeLayout).every(id => live.has(id))).toBe(true);
  });

  it('Undo gives the Sound and its candidates back; Redo takes them away again, and the next Undo gives them back', () => {
    const x = ids[0]!;
    const { result } = renderProject(start);
    act(() => result.current.dispatch({ type: 'SET_CANDIDATES', payload: [candidateOf('cand-a')] }));
    act(() => result.current.dispatch({ type: 'DELETE_LANE', payload: x }));
    const now = () => ({
      sound: result.current.state.soundStreams.some(s => s.id === x),
      candidates: result.current.state.candidates.map(c => c.id),
    });
    expect(now()).toEqual({ sound: false, candidates: [] });

    act(() => { result.current.undo(); });
    expect(now()).toEqual({ sound: true, candidates: ['cand-a'] });
    act(() => { result.current.redo(); });
    expect(now()).toEqual({ sound: false, candidates: [] });
    act(() => { result.current.undo(); });
    expect(now()).toEqual({ sound: true, candidates: ['cand-a'] });
  });
});

describe('deleting a Sound keeps its source file and group honest', () => {
  it('its source file counts one Sound fewer, and goes with its last: the next import adopts its file\'s tempo', async () => {
    const source = start.sourceFiles[0]!;
    expect(start.sourceFiles).toHaveLength(1);
    expect(source.laneCount).toBe(ids.length);

    const one = reduce(start, { type: 'DELETE_LANE', payload: ids[0]! });
    expect(one.sourceFiles).toEqual([{ ...source, laneCount: ids.length - 1 }]);

    const emptied = reduce(one, ...ids.slice(1).map(id => ({ type: 'DELETE_LANE', payload: id }) as ProjectAction));
    expect(emptied.performanceLanes).toEqual([]);
    expect(emptied.sourceFiles).toEqual([]);

    // A 90 BPM file imported into the emptied project is a first import.
    expect(emptied.tempo).toBe(DEFAULT_PROJECT_TEMPO);
    const buffer = fs.readFileSync(TEST_MIDI_1_PATH);
    const projectData = await parseMidiProject(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      path.basename(TEST_MIDI_1_PATH),
    );
    projectData.performance.tempo = 90;
    const plan = planMidiImport(emptied, [{ fileName: 'Ninety.mid', projectData }]);
    expect(plan.actions).toContainEqual({ type: 'SET_TEMPO', payload: 90 });
  });

  it('a group goes with its last Sound, not before', () => {
    const grouped = reduce(start,
      { type: 'CREATE_LANE_GROUP', payload: { groupId: 'grp-x', name: 'Group 1', color: '#fff', orderIndex: 0, isCollapsed: false } },
      { type: 'SET_LANE_GROUP', payload: { laneId: ids[0]!, groupId: 'grp-x' } },
      { type: 'SET_LANE_GROUP', payload: { laneId: ids[1]!, groupId: 'grp-x' } },
    );
    const one = reduce(grouped, { type: 'DELETE_LANE', payload: ids[0]! });
    expect(one.laneGroups.map(g => g.groupId)).toEqual(['grp-x']);
    const both = reduce(one, { type: 'DELETE_LANE', payload: ids[1]! });
    expect(both.laneGroups).toEqual([]);
  });

  it('deleting a Sound that isn\'t there changes nothing', () => {
    expect(reduce(start, { type: 'DELETE_LANE', payload: 'no-such-sound' })).toBe(start);
  });
});

describe('deleting a Sound leaves nothing armed or selected', () => {
  it('clears the armed and the selected Sound when it is the one deleted, and only then', () => {
    const armed = reduce(start, { type: 'ARM_SOUND', payload: ids[0]! });
    expect({ armed: armed.armedStreamId, selected: armed.selectedStreamId }).toEqual({ armed: ids[0], selected: ids[0] });

    const other = reduce(armed, { type: 'DELETE_LANE', payload: ids[1]! });
    expect({ armed: other.armedStreamId, selected: other.selectedStreamId }).toEqual({ armed: ids[0], selected: ids[0] });

    const deleted = reduce(armed, { type: 'DELETE_LANE', payload: ids[0]! });
    expect({ armed: deleted.armedStreamId, selected: deleted.selectedStreamId }).toEqual({ armed: null, selected: null });
  });
});
