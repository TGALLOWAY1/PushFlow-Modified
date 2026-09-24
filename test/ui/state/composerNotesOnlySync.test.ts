/**
 * Composer sync writes notes only (S1a.5; T66, F9-03; roadmap P1a-12a).
 *
 * UPSERT_LANE_SOURCE with notesOnly, for a source already in the project,
 * replaces only the notes of the lanes it has: every Sound keeps its name,
 * colour, mute, solo, group and order. Lanes the payload no longer has are
 * removed, new lanes are added as given, and a payload with the same notes
 * returns the state unchanged.
 */

import { describe, it, expect } from 'vitest';
import { projectReducer, createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';
import { historyLabelFor } from '../../../src/ui/state/historyLabels';
import { type PerformanceLane, type SourceFile, type LaneGroup } from '../../../src/types/performanceLane';

const SOURCE: SourceFile = { id: 'workspace_pattern_source', fileName: 'Workspace Pattern', importedAt: '2026-09-24T00:00:00Z', laneCount: 2 };
const GROUP: LaneGroup = { groupId: 'workspace_pattern_group', name: 'Workspace Pattern', color: '#ef4444', orderIndex: 0, isCollapsed: false };

function lane(id: string, name: string, times: number[], overrides: Partial<PerformanceLane> = {}): PerformanceLane {
  return {
    id,
    name,
    sourceFileId: SOURCE.id,
    sourceFileName: SOURCE.fileName,
    groupId: GROUP.groupId,
    orderIndex: 0,
    color: '#ef4444',
    colorMode: 'inherited',
    // Fresh event ids every time, as the Composer's conversion makes them.
    events: times.map(t => ({ eventId: `evt-${Math.random()}`, laneId: id, startTime: t, duration: 0.125, velocity: 100, rawPitch: 36 })),
    isHidden: false,
    isMuted: false,
    isSolo: false,
    ...overrides,
  };
}

const sync = (lanes: PerformanceLane[]) => ({
  type: 'UPSERT_LANE_SOURCE' as const,
  payload: { lanes, sourceFile: SOURCE, group: GROUP, notesOnly: true },
});

/** The project after a first Composer sync of Lane 1 and Lane 2. */
function synced(): ProjectState {
  return projectReducer(createEmptyProjectState(), sync([
    lane('workspace_pattern_a', 'Lane 1', [0, 0.5]),
    lane('workspace_pattern_b', 'Lane 2', [0.25]),
  ]));
}

describe('UPSERT_LANE_SOURCE notesOnly', () => {
  it('the first sync adds the lanes as given', () => {
    const s = synced();
    expect(s.soundStreams.map(x => x.name)).toEqual(['Lane 1', 'Lane 2']);
    expect(s.sourceFiles.map(f => f.id)).toEqual([SOURCE.id]);
  });

  it('keeps a Sound\'s name, colour, mute and solo and replaces only its notes', () => {
    let s = synced();
    s = projectReducer(s, { type: 'RENAME_SOUND', payload: { streamId: 'workspace_pattern_a', name: 'Kick' } });
    s = projectReducer(s, { type: 'SET_SOUND_COLOR', payload: { streamId: 'workspace_pattern_a', color: '#123456' } });
    s = projectReducer(s, { type: 'TOGGLE_MUTE', payload: 'workspace_pattern_b' });

    s = projectReducer(s, sync([
      lane('workspace_pattern_a', 'Lane 1', [0, 0.5, 0.75], { color: '#ef4444' }),
      lane('workspace_pattern_b', 'Lane 2', [0.25]),
    ]));

    const a = s.soundStreams.find(x => x.id === 'workspace_pattern_a')!;
    const b = s.soundStreams.find(x => x.id === 'workspace_pattern_b')!;
    expect({ name: a.name, color: a.color, events: a.events.map(e => e.startTime) })
      .toEqual({ name: 'Kick', color: '#123456', events: [0, 0.5, 0.75] });
    expect({ name: b.name, muted: b.muted }).toEqual({ name: 'Lane 2', muted: true });
  });

  it('returns the same state when no note changed, however the event ids differ', () => {
    const s = synced();
    const next = projectReducer(s, sync([
      lane('workspace_pattern_a', 'Renamed in the Composer', [0, 0.5], { isMuted: true }),
      lane('workspace_pattern_b', 'Lane 2', [0.25]),
    ]));
    expect(next).toBe(s);
  });

  it('removes a lane the Composer deleted, and adds a new one', () => {
    const s = projectReducer(synced(), sync([
      lane('workspace_pattern_a', 'Lane 1', [0, 0.5]),
      lane('workspace_pattern_c', 'Lane 3', [1]),
    ]));
    expect(s.soundStreams.map(x => x.id)).toEqual(['workspace_pattern_a', 'workspace_pattern_c']);
    expect(s.sourceFiles.find(f => f.id === SOURCE.id)?.laneCount).toBe(2);
  });

  it('never touches lanes of other sources', () => {
    const other = lane('imported', 'Imported', [0], { sourceFileId: 'midi', groupId: null });
    let s = projectReducer(createEmptyProjectState(), {
      type: 'IMPORT_LANES',
      payload: { lanes: [other], sourceFile: { ...SOURCE, id: 'midi', laneCount: 1 } },
    });
    s = projectReducer(s, sync([lane('workspace_pattern_a', 'Lane 1', [0])]));
    s = projectReducer(s, sync([lane('workspace_pattern_a', 'Lane 1', [0.5])]));
    expect(s.performanceLanes.map(l => l.id)).toEqual(['imported', 'workspace_pattern_a']);
    expect(s.performanceLanes[0]).toEqual(other);
  });

  it('is named "Composer edit" in Undo', () => {
    expect(historyLabelFor(sync([]))).toBe('Composer edit');
    expect(historyLabelFor({ ...sync([]), payload: { ...sync([]).payload, notesOnly: false } })).toBe('Replace source file');
  });
});
