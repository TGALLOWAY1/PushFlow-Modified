/**
 * LaneRow.
 *
 * Individual lane row in the sidebar.
 * Shows: drag handle, color swatch, name, group badge, event count, mute/solo/hide controls.
 */

import { useState, useRef, useEffect } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type PerformanceLane, countLaneTimeSlices } from '../../../types/performanceLane';

interface LaneRowProps {
  lane: PerformanceLane;
  isSelected: boolean;
  onSelect: (multiSelect?: boolean) => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function LaneRow({ lane, isSelected, onSelect, onDragStart }: LaneRowProps) {
  const { dispatch } = useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lane.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== lane.name) {
      dispatch({ type: 'RENAME_LANE', payload: { laneId: lane.id, name: trimmed } });
    }
    setIsEditing(false);
  };

  const opacity = lane.isMuted ? 0.4 : 1;

  return (
    <div
      className={`flex items-center gap-2 px-3 border-b border-gray-800/50 cursor-pointer transition-colors group
        ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/30 border-l-2 border-l-transparent'}`}
      style={{ opacity, height: 32 }}
      onClick={e => onSelect(e.metaKey || e.ctrlKey)}
      draggable
      onDragStart={onDragStart}
    >
      {/* Drag handle */}
      <span className="text-gray-600 text-[10px] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
        ⠿
      </span>

      {/* Color swatch */}
      <span
        className="w-3 h-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: lane.color }}
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
          className="flex-1 text-sm text-gray-200 truncate"
          onDoubleClick={e => {
            e.stopPropagation();
            setEditName(lane.name);
            setIsEditing(true);
          }}
        >
          {lane.name}
        </span>
      )}

      {/* Event count (unique time slices) */}
      <span className="text-[10px] text-gray-500 w-10 text-right flex-shrink-0">
        {countLaneTimeSlices(lane)}
      </span>

      {/* Controls: mute, solo, hide */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-colors
            ${lane.isMuted ? 'bg-red-500/20 text-red-400' : 'text-gray-600 hover:text-gray-400'}`}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LANE_MUTE', payload: lane.id }); }}
          title="Mute"
        >
          M
        </button>
        <button
          className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-colors
            ${lane.isSolo ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LANE_SOLO', payload: lane.id }); }}
          title="Solo"
        >
          S
        </button>
        <button
          className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-colors
            ${lane.isHidden ? 'bg-gray-500/20 text-gray-400' : 'text-gray-600 hover:text-gray-400'}`}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LANE_HIDDEN', payload: lane.id }); }}
          title="Hide"
        >
          H
        </button>
      </div>
    </div>
  );
}
