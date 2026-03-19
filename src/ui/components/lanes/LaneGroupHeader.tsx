/**
 * LaneGroupHeader.
 *
 * Group row in the lane sidebar.
 * Shows: collapse toggle, color swatch, editable name, lane count, event count.
 */

import { useState, useRef, useEffect } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type LaneGroup } from '../../../types/performanceLane';

interface LaneGroupHeaderProps {
  group: LaneGroup;
  laneCount: number;
  totalEvents: number;
}

export function LaneGroupHeader({ group, laneCount, totalEvents }: LaneGroupHeaderProps) {
  const { dispatch } = useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== group.name) {
      dispatch({ type: 'RENAME_LANE_GROUP', payload: { groupId: group.groupId, name: trimmed } });
    }
    setIsEditing(false);
  };

  return (
    <div
      className="flex items-center gap-2 px-3 bg-gray-800/50 border-b border-gray-800 hover:bg-gray-800/70 transition-colors cursor-pointer"
      style={{ height: 28 }}
      onClick={() => dispatch({ type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: group.groupId })}
    >
      {/* Collapse toggle */}
      <span className="text-[10px] text-gray-500 w-3">
        {group.isCollapsed ? '\u25B6' : '\u25BC'}
      </span>

      {/* Color swatch */}
      <span
        className="w-3 h-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: group.color }}
      />

      {/* Name */}
      {isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-gray-300 truncate"
          onDoubleClick={e => { e.stopPropagation(); setEditName(group.name); setIsEditing(true); }}
        >
          {group.name}
        </span>
      )}

      {/* Stats */}
      <span className="text-[10px] text-gray-500 flex-shrink-0">
        {laneCount} · {totalEvents}
      </span>
    </div>
  );
}
