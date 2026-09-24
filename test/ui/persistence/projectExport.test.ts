// @vitest-environment happy-dom
/**
 * Export includes the Composer's pattern, and an export/import round trip
 * keeps it (S1a.4, T57 slice; roadmap P1a-12d). The pattern lives in
 * localStorage until P8 moves it into the project, so the file carries it
 * beside the stored record, and importing writes it back under the imported
 * project's id. The stored record itself never carries it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { type LoopState, loopCellKey } from '../../../src/types/loopEditor';
import {
  buildProjectExport,
  parseProjectExport,
} from '../../../src/ui/persistence/projectStorage';
import { serializeProject, validateAndMigrateRaw } from '../../../src/ui/persistence/projectSerializer';
import {
  serializeLoopState,
  deserializeLoopState,
  saveLoopState,
  loadLoopState,
  loadSerializedLoopState,
  saveSerializedLoopState,
} from '../../../src/ui/persistence/loopStorage';
import { pickDocument } from '../../../src/ui/state/projectDocument';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { importTestMidi1 } from '../../helpers/testMidi1';

function composerPattern(): LoopState {
  const lanes = [
    { id: 'lane-k', name: 'Kick', color: '#f00', midiNote: null, orderIndex: 0, isMuted: false, isSolo: false },
    { id: 'lane-s', name: 'Snare', color: '#0f0', midiNote: 38, orderIndex: 1, isMuted: false, isSolo: false },
  ];
  const events = new Map([
    [loopCellKey('lane-k', 0), { laneId: 'lane-k', stepIndex: 0, velocity: 100 }],
    [loopCellKey('lane-k', 8), { laneId: 'lane-k', stepIndex: 8, velocity: 90 }],
    [loopCellKey('lane-s', 4), { laneId: 'lane-s', stepIndex: 4, velocity: 110 }],
  ]);
  return {
    config: { barCount: 4, subdivision: 16, bpm: 120, beatsPerBar: 4 } as LoopState['config'],
    lanes,
    events,
    isPlaying: true,
    playheadStep: 3.5,
    rudimentResult: null,
  };
}

async function projectWithDraft(): Promise<ProjectState> {
  const imported = await importTestMidi1();
  const state = { ...imported, id: 'proj-export', name: 'Export me' };
  return projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: state.soundStreams[0] } });
}

/** The document as JSON sees it (no undefined-valued keys). */
const documentOf = (state: ProjectState) => JSON.parse(JSON.stringify(pickDocument(state)));

beforeEach(() => localStorage.clear());

describe('project export and import', () => {
  it('P1a-12d: an export/import round trip keeps the project and the Composer pattern', async () => {
    const state = await projectWithDraft();
    saveLoopState(state.id, composerPattern());

    const exported = buildProjectExport(state);
    expect(exported.composerPattern).toEqual(serializeLoopState(composerPattern()));
    // Playback state never travels.
    expect(exported.composerPattern).toMatchObject({ isPlaying: false, playheadStep: 0 });

    const result = parseProjectExport(JSON.stringify(exported));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(documentOf(result.state)).toEqual(documentOf(state));
    expect(result.state.workingLayout?.padToVoice['3,3']?.id).toBe(state.soundStreams[0].id);

    // Writing it back (what the Library does after saving the project, under
    // the final id) gives the Composer the same pattern again.
    saveSerializedLoopState('proj-imported', result.composerPattern!);
    const restored = loadLoopState('proj-imported')!;
    expect(restored.lanes).toEqual(composerPattern().lanes);
    expect([...restored.events.entries()]).toEqual([...composerPattern().events.entries()]);
    expect(restored.config).toEqual(composerPattern().config);
    expect({ isPlaying: restored.isPlaying, playheadStep: restored.playheadStep }).toEqual({ isPlaying: false, playheadStep: 0 });
  });

  it('exports no pattern when the project has none, and the stored record never carries one', async () => {
    const state = await projectWithDraft();
    const exported = buildProjectExport(state);
    expect('composerPattern' in exported).toBe(false);
    expect(parseProjectExport(JSON.stringify(exported))).toMatchObject({ ok: true, composerPattern: null });

    saveLoopState(state.id, composerPattern());
    const withPattern = buildProjectExport(state);
    // The stored shape drops the file-only field.
    expect('composerPattern' in validateAndMigrateRaw(JSON.parse(JSON.stringify(withPattern)))).toBe(false);
    expect('composerPattern' in serializeProject(state)).toBe(false);
  });

  it('refuses a file that is not a project', () => {
    expect(parseProjectExport('not json')).toMatchObject({ ok: false });
    expect(parseProjectExport('{"name":"no id"}')).toMatchObject({ ok: false, error: 'Project data missing id.' });
  });
});

describe('loop storage', () => {
  it('serializes and deserializes a pattern, and reads nothing where none is stored', () => {
    const pattern = composerPattern();
    const roundTrip = deserializeLoopState(JSON.parse(JSON.stringify(serializeLoopState(pattern))))!;
    expect([...roundTrip.events.entries()]).toEqual([...pattern.events.entries()]);
    expect(deserializeLoopState(null)).toBeNull();
    expect(deserializeLoopState({ lanes: [] })).toBeNull();
    expect(loadSerializedLoopState('nobody')).toBeNull();
    expect(loadLoopState('nobody')).toBeNull();
  });
});
