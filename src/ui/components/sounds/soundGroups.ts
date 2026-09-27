/**
 * Grouping Sounds (S5.1, T45): Mod+G and the selection bar's Group toggle, the
 * row menu's Group, and a drag onto a group's heading all go through here.
 *
 * A move that leaves a group with no Sound deletes it in the same undo step,
 * so no empty heading is left behind (the P2 audit's follow-up: ungrouping
 * with Mod+G left "Group 1 (0)").
 */

import { useCallback } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type ProjectState } from '../../state/projectState';
import { type LaneGroup } from '../../../types/performanceLane';
import { generateId } from '../../../utils/idGenerator';
import { SOUND_PALETTE } from '../../../utils/soundPalette';

type GroupState = Pick<ProjectState, 'performanceLanes' | 'laneGroups'>;

/** The groups that had Sounds and have none once `ids` move into `target` (null: no group). */
export function groupsEmptiedBy(state: GroupState, ids: readonly string[], target: string | null): string[] {
  const moving = new Set(ids);
  return state.laneGroups
    .filter(g => g.groupId !== target)
    .filter(g => {
      const members = state.performanceLanes.filter(l => l.groupId === g.groupId);
      return members.length > 0 && members.every(l => moving.has(l.id));
    })
    .map(g => g.groupId);
}

/** Whether the Sounds are all in one group (then the toggle ungroups them). */
export function allInOneGroup(state: GroupState, ids: readonly string[]): boolean {
  const groups = new Set(ids.map(id => state.performanceLanes.find(l => l.id === id)?.groupId ?? null));
  return groups.size === 1 && !groups.has(null);
}

/** A new group, named and coloured after the ones there are. */
export function newGroup(state: GroupState): LaneGroup {
  return {
    groupId: generateId('grp'),
    name: `Group ${state.laneGroups.length + 1}`,
    color: SOUND_PALETTE[state.laneGroups.length % SOUND_PALETTE.length]!,
    orderIndex: state.laneGroups.length,
    isCollapsed: false,
  };
}

export interface SoundGrouping {
  /** Moves the Sounds into a group (null: no group), as one undo step "Group". */
  moveToGroup: (ids: readonly string[], groupId: string | null) => void;
  /** Puts the Sounds in a new group, as one undo step "Group". */
  groupInNew: (ids: readonly string[]) => void;
  /** Mod+G: groups the Sounds in a new group, or ungroups them if they are all in one. */
  toggleGroup: (ids: readonly string[]) => void;
}

export function useSoundGrouping(): SoundGrouping {
  const { state, dispatch, transact } = useProject();

  const moveToGroup = useCallback((ids: readonly string[], groupId: string | null) => {
    const moving = ids.filter(id => (state.performanceLanes.find(l => l.id === id)?.groupId ?? null) !== groupId);
    if (moving.length === 0) return;
    transact(groupId ? 'Group' : 'Ungroup', () => {
      for (const id of moving) dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: id, groupId } });
      for (const emptied of groupsEmptiedBy(state, moving, groupId)) dispatch({ type: 'DELETE_LANE_GROUP', payload: emptied });
    });
  }, [state, dispatch, transact]);

  const groupInNew = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const group = newGroup(state);
    transact('Group', () => {
      dispatch({ type: 'CREATE_LANE_GROUP', payload: group });
      for (const id of ids) dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: id, groupId: group.groupId } });
      for (const emptied of groupsEmptiedBy(state, ids, group.groupId)) dispatch({ type: 'DELETE_LANE_GROUP', payload: emptied });
    });
  }, [state, dispatch, transact]);

  const toggleGroup = useCallback((ids: readonly string[]) => {
    if (allInOneGroup(state, ids)) moveToGroup(ids, null);
    else groupInNew(ids);
  }, [state, moveToGroup, groupInNew]);

  return { moveToGroup, groupInNew, toggleGroup };
}
