/**
 * LaneSidebar.
 *
 * Left panel displaying performance lanes organized by groups.
 * Supports selection, mute/solo/hide, inline rename, and drag reorder.
 */

import { useMemo, useState, useCallback } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type PerformanceLane, type LaneGroup, countTimeSlices } from '../../../types/performanceLane';
import { LaneGroupHeader } from './LaneGroupHeader';
import { LaneRow } from './LaneRow';

interface LaneSidebarProps {
  selectedLaneIds: Set<string>;
  onSelectLane: (id: string | null, multiSelect?: boolean) => void;
  searchQuery: string;
  showInactive: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

/** Sorted list of groups and their child lanes, plus ungrouped lanes. */
interface GroupedLanes {
  groups: Array<{ group: LaneGroup; lanes: PerformanceLane[] }>;
  ungrouped: PerformanceLane[];
}

export function LaneSidebar({ selectedLaneIds, onSelectLane, searchQuery, showInactive, scrollRef }: LaneSidebarProps) {
  const { state, dispatch } = useProject();
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Group and filter lanes
  const grouped = useMemo((): GroupedLanes => {
    const query = searchQuery.toLowerCase();
    const filteredLanes = state.performanceLanes.filter(l => {
      if (!showInactive && l.isHidden) return false;
      if (query && !l.name.toLowerCase().includes(query)) return false;
      return true;
    });

    const sortedGroups = [...state.laneGroups].sort((a, b) => a.orderIndex - b.orderIndex);
    const groups = sortedGroups.map(group => ({
      group,
      lanes: filteredLanes
        .filter(l => l.groupId === group.groupId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    }));

    const ungrouped = filteredLanes
      .filter(l => l.groupId === null)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return { groups, ungrouped };
  }, [state.performanceLanes, state.laneGroups, searchQuery, showInactive]);

  // Drag-and-drop for reordering lanes between groups
  const handleDragStart = useCallback((e: React.DragEvent, laneId: string) => {
    e.dataTransfer.setData('application/pushflow-lane', laneId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOverGroup = useCallback((e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  }, []);

  const handleDropOnGroup = useCallback((e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    setDragOverGroupId(null);
    const laneId = e.dataTransfer.getData('application/pushflow-lane');
    if (laneId) {
      dispatch({ type: 'SET_LANE_GROUP', payload: { laneId, groupId } });
    }
  }, [dispatch]);

  const handleDragLeave = useCallback(() => {
    setDragOverGroupId(null);
  }, []);

  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-700 flex flex-col overflow-hidden bg-gray-900/30">
      {/* Column header — matches timeline time axis height (h-6 = 24px) */}
      <div className="flex items-center justify-between px-3 h-6 border-b border-gray-700 text-[10px] text-gray-500 uppercase tracking-wider flex-shrink-0">
        <span>Lane Name</span>
        <span className="w-10 text-right">Events</span>
      </div>

      {/* Scrollable lane list — scroll synced with timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Grouped lanes */}
        {grouped.groups.map(({ group, lanes }) => (
          <div
            key={group.groupId}
            onDragOver={e => handleDragOverGroup(e, group.groupId)}
            onDrop={e => handleDropOnGroup(e, group.groupId)}
            onDragLeave={handleDragLeave}
            className={dragOverGroupId === group.groupId ? 'bg-blue-500/5' : ''}
          >
            <LaneGroupHeader
              group={group}
              laneCount={lanes.length}
              totalEvents={countTimeSlices(lanes)}
            />
            {!group.isCollapsed && lanes.map(lane => (
              <LaneRow
                key={lane.id}
                lane={lane}
                isSelected={selectedLaneIds.has(lane.id)}
                onSelect={(multiSelect) => onSelectLane(lane.id, multiSelect)}
                onDragStart={e => handleDragStart(e, lane.id)}
              />
            ))}
          </div>
        ))}

        {/* Ungrouped lanes */}
        {grouped.ungrouped.length > 0 && (
          <div
            onDragOver={e => handleDragOverGroup(e, null)}
            onDrop={e => handleDropOnGroup(e, null)}
            onDragLeave={handleDragLeave}
            className={dragOverGroupId === null && grouped.groups.length > 0 ? 'bg-blue-500/5' : ''}
          >
            {grouped.groups.length > 0 && (
              <div className="px-3 text-[10px] text-gray-600 uppercase tracking-wider border-t border-gray-800" style={{ height: 28, lineHeight: '28px' }}>
                Ungrouped
              </div>
            )}
            {grouped.ungrouped.map(lane => (
              <LaneRow
                key={lane.id}
                lane={lane}
                isSelected={selectedLaneIds.has(lane.id)}
                onSelect={(multiSelect) => onSelectLane(lane.id, multiSelect)}
                onDragStart={e => handleDragStart(e, lane.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state within sidebar */}
        {grouped.groups.length === 0 && grouped.ungrouped.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-600">
            No lanes match filter
          </div>
        )}
      </div>
    </div>
  );
}
