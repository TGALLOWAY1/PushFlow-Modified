/**
 * Lanes Reducer.
 *
 * Pure reducer logic for all performance lane and lane group actions.
 * Delegated from the main projectReducer.
 */

import { type PerformanceLane, type LaneGroup, type SourceFile, type LaneColorMode } from '../../types/performanceLane';
import { type ProjectState } from './projectState';
import { buildSoundStreamsFromLanes } from './lanesToStreams';
import { buildLegacySourceFile, buildPerformanceLanesFromStreams } from './streamsToLanes';

// ============================================================================
// Action Types
// ============================================================================

export type LaneAction =
  // Lane operations
  | { type: 'IMPORT_LANES'; payload: { lanes: PerformanceLane[]; sourceFile: SourceFile; group?: LaneGroup } }
  | { type: 'UPSERT_LANE_SOURCE'; payload: { lanes: PerformanceLane[]; sourceFile: SourceFile; group?: LaneGroup | null } }
  | { type: 'REMOVE_LANE_SOURCE'; payload: { sourceFileId: string; groupId?: string | null } }
  | { type: 'RENAME_LANE'; payload: { laneId: string; name: string } }
  | { type: 'SET_LANE_COLOR'; payload: { laneId: string; color: string; colorMode: LaneColorMode } }
  | { type: 'REORDER_LANES'; payload: { orderedIds: string[] } }
  | { type: 'SET_LANE_GROUP'; payload: { laneId: string; groupId: string | null } }
  | { type: 'TOGGLE_LANE_MUTE'; payload: string }
  | { type: 'TOGGLE_LANE_SOLO'; payload: string }
  | { type: 'TOGGLE_LANE_HIDDEN'; payload: string }
  | { type: 'DELETE_LANE'; payload: string }
  // Group operations
  | { type: 'CREATE_LANE_GROUP'; payload: LaneGroup }
  | { type: 'RENAME_LANE_GROUP'; payload: { groupId: string; name: string } }
  | { type: 'SET_LANE_GROUP_COLOR'; payload: { groupId: string; color: string } }
  | { type: 'REORDER_LANE_GROUPS'; payload: { orderedGroupIds: string[] } }
  | { type: 'TOGGLE_LANE_GROUP_COLLAPSE'; payload: string }
  | { type: 'DELETE_LANE_GROUP'; payload: string }
  // Sync
  | { type: 'SYNC_STREAMS_FROM_LANES' }
  | { type: 'POPULATE_LANES_FROM_STREAMS' };

/** Check if an action type belongs to the lanes reducer. */
export function isLaneAction(type: string): boolean {
  return LANE_ACTION_TYPES.has(type);
}

const LANE_ACTION_TYPES = new Set<string>([
  'IMPORT_LANES',
  'UPSERT_LANE_SOURCE',
  'REMOVE_LANE_SOURCE',
  'RENAME_LANE',
  'SET_LANE_COLOR',
  'REORDER_LANES',
  'SET_LANE_GROUP',
  'TOGGLE_LANE_MUTE',
  'TOGGLE_LANE_SOLO',
  'TOGGLE_LANE_HIDDEN',
  'DELETE_LANE',
  'CREATE_LANE_GROUP',
  'RENAME_LANE_GROUP',
  'SET_LANE_GROUP_COLOR',
  'REORDER_LANE_GROUPS',
  'TOGGLE_LANE_GROUP_COLLAPSE',
  'DELETE_LANE_GROUP',
  'SYNC_STREAMS_FROM_LANES',
  'POPULATE_LANES_FROM_STREAMS',
]);

// ============================================================================
// Reducer
// ============================================================================

/**
 * After any lane-modifying action, rebuild soundStreams so that VoicePalette
 * and EventsPanel always reflect the current lanes — regardless of which
 * UI components are mounted.
 */
function withSyncedStreams(next: ProjectState): ProjectState {
  if (next.performanceLanes.length === 0) {
    return { ...next, soundStreams: [], analysisStale: true };
  }
  return {
    ...next,
    soundStreams: buildSoundStreamsFromLanes(next.performanceLanes),
    analysisStale: true,
  };
}

export function lanesReducer(state: ProjectState, action: LaneAction): ProjectState {
  const now = new Date().toISOString();

  switch (action.type) {
    // ---- Lane Operations ----

    case 'IMPORT_LANES': {
      const { lanes, sourceFile, group } = action.payload;
      const newGroups = group
        ? [...state.laneGroups, group]
        : state.laneGroups;

      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: [...state.performanceLanes, ...lanes],
        laneGroups: newGroups,
        sourceFiles: [...state.sourceFiles, sourceFile],
      });
    }

    case 'UPSERT_LANE_SOURCE': {
      const { lanes, sourceFile, group } = action.payload;
      const nextLanes = [
        ...state.performanceLanes.filter(l => l.sourceFileId !== sourceFile.id),
        ...lanes,
      ];
      const nextSourceFiles = [
        ...state.sourceFiles.filter(sf => sf.id !== sourceFile.id),
        sourceFile,
      ];
      const nextGroups = group
        ? [...state.laneGroups.filter(g => g.groupId !== group.groupId), group]
        : state.laneGroups;

      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: nextLanes,
        laneGroups: nextGroups,
        sourceFiles: nextSourceFiles,
      });
    }

    case 'REMOVE_LANE_SOURCE': {
      const { sourceFileId, groupId } = action.payload;
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.filter(l => l.sourceFileId !== sourceFileId),
        sourceFiles: state.sourceFiles.filter(sf => sf.id !== sourceFileId),
        laneGroups: groupId
          ? state.laneGroups.filter(g => g.groupId !== groupId)
          : state.laneGroups,
      });
    }

    case 'RENAME_LANE':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload.laneId ? { ...l, name: action.payload.name } : l
        ),
      });

    case 'SET_LANE_COLOR':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload.laneId
            ? { ...l, color: action.payload.color, colorMode: action.payload.colorMode }
            : l
        ),
      });

    case 'REORDER_LANES': {
      const { orderedIds } = action.payload;
      const laneMap = new Map(state.performanceLanes.map(l => [l.id, l]));
      const reordered = orderedIds
        .map((id, i) => {
          const lane = laneMap.get(id);
          return lane ? { ...lane, orderIndex: i } : null;
        })
        .filter((l): l is PerformanceLane => l !== null);

      // Include any lanes not in the ordered list (shouldn't happen, but safe)
      const orderedSet = new Set(orderedIds);
      const remaining = state.performanceLanes
        .filter(l => !orderedSet.has(l.id))
        .map((l, i) => ({ ...l, orderIndex: reordered.length + i }));

      return {
        ...state,
        updatedAt: now,
        performanceLanes: [...reordered, ...remaining],
      };
    }

    case 'SET_LANE_GROUP': {
      const { laneId, groupId } = action.payload;
      const targetGroup = groupId
        ? state.laneGroups.find(g => g.groupId === groupId)
        : null;

      return {
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l => {
          if (l.id !== laneId) return l;
          const updated: PerformanceLane = { ...l, groupId };
          // If moving into a group and color is inherited, adopt group color
          if (targetGroup && l.colorMode === 'inherited') {
            updated.color = targetGroup.color;
          }
          return updated;
        }),
      };
    }

    case 'TOGGLE_LANE_MUTE':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload ? { ...l, isMuted: !l.isMuted } : l
        ),
      });

    case 'TOGGLE_LANE_SOLO':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload ? { ...l, isSolo: !l.isSolo } : l
        ),
      });

    case 'TOGGLE_LANE_HIDDEN':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload ? { ...l, isHidden: !l.isHidden } : l
        ),
      });

    case 'DELETE_LANE':
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        performanceLanes: state.performanceLanes.filter(l => l.id !== action.payload),
      });

    // ---- Group Operations ----

    case 'CREATE_LANE_GROUP':
      return {
        ...state,
        updatedAt: now,
        laneGroups: [...state.laneGroups, action.payload],
      };

    case 'RENAME_LANE_GROUP':
      return {
        ...state,
        updatedAt: now,
        laneGroups: state.laneGroups.map(g =>
          g.groupId === action.payload.groupId ? { ...g, name: action.payload.name } : g
        ),
      };

    case 'SET_LANE_GROUP_COLOR': {
      const { groupId, color } = action.payload;
      return withSyncedStreams({
        ...state,
        updatedAt: now,
        laneGroups: state.laneGroups.map(g =>
          g.groupId === groupId ? { ...g, color } : g
        ),
        // Cascade color to lanes with inherited color mode
        performanceLanes: state.performanceLanes.map(l =>
          l.groupId === groupId && l.colorMode === 'inherited'
            ? { ...l, color }
            : l
        ),
      });
    }

    case 'REORDER_LANE_GROUPS': {
      const { orderedGroupIds } = action.payload;
      const groupMap = new Map(state.laneGroups.map(g => [g.groupId, g]));
      const reordered = orderedGroupIds
        .map((id, i) => {
          const group = groupMap.get(id);
          return group ? { ...group, orderIndex: i } : null;
        })
        .filter((g): g is LaneGroup => g !== null);

      const orderedSet = new Set(orderedGroupIds);
      const remaining = state.laneGroups
        .filter(g => !orderedSet.has(g.groupId))
        .map((g, i) => ({ ...g, orderIndex: reordered.length + i }));

      return {
        ...state,
        updatedAt: now,
        laneGroups: [...reordered, ...remaining],
      };
    }

    case 'TOGGLE_LANE_GROUP_COLLAPSE':
      return {
        ...state,
        laneGroups: state.laneGroups.map(g =>
          g.groupId === action.payload ? { ...g, isCollapsed: !g.isCollapsed } : g
        ),
      };

    case 'DELETE_LANE_GROUP': {
      const groupId = action.payload;
      return {
        ...state,
        updatedAt: now,
        laneGroups: state.laneGroups.filter(g => g.groupId !== groupId),
        // Ungroup child lanes (don't delete them)
        performanceLanes: state.performanceLanes.map(l =>
          l.groupId === groupId ? { ...l, groupId: null } : l
        ),
      };
    }

    // ---- Sync ----

    case 'SYNC_STREAMS_FROM_LANES': {
      if (state.performanceLanes.length === 0) return state;

      const soundStreams = buildSoundStreamsFromLanes(state.performanceLanes);
      return {
        ...state,
        updatedAt: now,
        soundStreams,
        analysisStale: true,
      };
    }

    case 'POPULATE_LANES_FROM_STREAMS': {
      if (state.performanceLanes.length > 0 || state.soundStreams.length === 0) {
        return state;
      }
      const lanes = buildPerformanceLanesFromStreams(state.soundStreams);
      const sourceFiles = state.sourceFiles.length > 0
        ? state.sourceFiles
        : [buildLegacySourceFile(state.soundStreams)];

      return {
        ...state,
        updatedAt: now,
        performanceLanes: lanes,
        sourceFiles,
      };
    }

    default:
      return state;
  }
}
