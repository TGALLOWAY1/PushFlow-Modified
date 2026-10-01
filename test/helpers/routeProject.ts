/**
 * Small projects for the Performance Route's tests, built through the app's
 * own reducer paths: groups by CREATE_LANE_GROUP, Sounds by IMPORT_LANES, and
 * placement by ASSIGN_VOICE_TO_PAD and Promote, so the Active Layout holds
 * them as it would after a user placed and promoted them.
 */

import {
  createEmptyProjectState,
  projectReducer,
  type ProjectState,
} from '../../src/ui/state/projectState';
import { type PerformanceLane } from '../../src/types/performanceLane';
import { barSeconds } from '../../src/utils/musicalTime';

export interface SoundSpec {
  id: string;
  /** Note starts, in 0-based bars (fractions allowed). */
  bars: number[];
  name?: string;
  groupId?: string;
  /** Note length in bars; a short hit when absent. */
  lengthBars?: number;
}

export interface RouteProjectSpec {
  tempo?: number;
  sounds: SoundSpec[];
  groups?: { groupId: string; name: string }[];
}

export function routeProject({ tempo = 120, sounds, groups = [] }: RouteProjectSpec): ProjectState {
  const bar = barSeconds(tempo);
  let state: ProjectState = { ...createEmptyProjectState(), id: 'route-test' };
  state = projectReducer(state, { type: 'SET_TEMPO', payload: tempo });
  groups.forEach((g, i) => {
    state = projectReducer(state, {
      type: 'CREATE_LANE_GROUP',
      payload: { groupId: g.groupId, name: g.name, color: '#888888', orderIndex: i, isCollapsed: false },
    });
  });
  const lanes: PerformanceLane[] = sounds.map((s, i) => ({
    id: s.id,
    name: s.name ?? s.id,
    sourceFileId: 'src',
    sourceFileName: 'route.mid',
    groupId: s.groupId ?? null,
    orderIndex: i,
    color: '#888888',
    colorMode: 'inherited',
    isHidden: false,
    events: s.bars.map((b, j) => ({
      eventId: `${s.id}-${j}`,
      laneId: s.id,
      startTime: b * bar,
      duration: s.lengthBars ? s.lengthBars * bar : 0.1,
      velocity: 100,
      rawPitch: 36 + i,
    })),
  }));
  return projectReducer(state, {
    type: 'IMPORT_LANES',
    payload: { lanes, sourceFile: { id: 'src', fileName: 'route.mid', importedAt: '2026-10-01T00:00:00.000Z', laneCount: lanes.length } },
  });
}

/** `soundIds` placed on pads of the bottom row and promoted to the Active Layout. */
export function placedOnActive(state: ProjectState, soundIds: string[]): ProjectState {
  let next = state;
  soundIds.forEach((id, i) => {
    const stream = next.soundStreams.find(s => s.id === id)!;
    next = projectReducer(next, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: `0,${i}`, stream } });
  });
  return projectReducer(next, { type: 'PROMOTE_WORKING_LAYOUT' });
}
