/**
 * LaneInspector.
 *
 * Right panel showing metadata for the selected lane.
 * Allows editing name, group, color, and color mode.
 */

import { useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type PerformanceLane, countLaneTimeSlices, countTimeSlices } from '../../../types/performanceLane';

interface LaneInspectorProps {
  lane: PerformanceLane;
  lanes?: PerformanceLane[];
  onClose: () => void;
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

export function LaneInspector({ lane, lanes, onClose }: LaneInspectorProps) {
  const { state, dispatch } = useProject();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const isMulti = lanes && lanes.length > 1;

  const group = useMemo(
    () => state.laneGroups.find(g => g.groupId === lane.groupId) ?? null,
    [state.laneGroups, lane.groupId]
  );

  const duration = useMemo(() => {
    if (lane.events.length === 0) return 0;
    const last = lane.events[lane.events.length - 1];
    return last.startTime + last.duration - lane.events[0].startTime;
  }, [lane.events]);

  const handleNameChange = (name: string) => {
    dispatch({ type: 'RENAME_LANE', payload: { laneId: lane.id, name } });
  };

  const targetLanes = isMulti ? lanes : [lane];

  const handleGroupChange = (value: string) => {
    if (value === '__new__') {
      setNewGroupName('');
      setIsCreatingGroup(true);
      return;
    }
    for (const l of targetLanes) {
      dispatch({
        type: 'SET_LANE_GROUP',
        payload: { laneId: l.id, groupId: value || null },
      });
    }
  };

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) { setIsCreatingGroup(false); return; }
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dispatch({
      type: 'CREATE_LANE_GROUP',
      payload: {
        groupId,
        name: trimmed,
        color: lane.color,
        orderIndex: state.laneGroups.length,
        isCollapsed: false,
      },
    });
    for (const l of targetLanes) {
      dispatch({
        type: 'SET_LANE_GROUP',
        payload: { laneId: l.id, groupId },
      });
    }
    setIsCreatingGroup(false);
  };

  const handleColorChange = (color: string) => {
    for (const l of targetLanes) {
      dispatch({
        type: 'SET_LANE_COLOR',
        payload: { laneId: l.id, color, colorMode: 'overridden' },
      });
    }
  };

  const handleResetColor = () => {
    if (group) {
      dispatch({
        type: 'SET_LANE_COLOR',
        payload: { laneId: lane.id, color: group.color, colorMode: 'inherited' },
      });
    }
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-700 bg-gray-900/30 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {isMulti ? `${lanes.length} Lanes Selected` : 'Inspector'}
        </span>
        <button
          className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Lane Name — only for single selection */}
        {!isMulti && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Lane Name</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              value={lane.name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
        )}

        {/* Multi-select lane list */}
        {isMulti && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Selected Lanes</label>
            <div className="space-y-1">
              {lanes.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                  <span className="truncate">{l.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Group</label>
          {isCreatingGroup ? (
            <div className="flex gap-1">
              <input
                autoFocus
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                placeholder="Group name..."
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateGroup();
                  if (e.key === 'Escape') setIsCreatingGroup(false);
                }}
                onBlur={handleCreateGroup}
              />
            </div>
          ) : (
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              value={lane.groupId ?? ''}
              onChange={e => handleGroupChange(e.target.value)}
            >
              <option value="">None</option>
              {state.laneGroups.map(g => (
                <option key={g.groupId} value={g.groupId}>{g.name}</option>
              ))}
              <option value="__new__">+ New Group</option>
            </select>
          )}
        </div>

        {/* Color */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Color</label>
            {lane.colorMode === 'overridden' && group && (
              <button
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                onClick={handleResetColor}
              >
                Reset to group
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                className={`w-6 h-6 rounded-sm transition-all ${
                  lane.color === c ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorChange(c)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="w-5 h-5 rounded-sm border border-gray-700"
              style={{ backgroundColor: lane.color }}
            />
            <span className="text-xs text-gray-400 font-mono">{lane.color}</span>
            <span className="text-[10px] text-gray-600">
              ({lane.colorMode})
            </span>
          </div>
        </div>

        {/* Metadata — single lane only */}
        {!isMulti && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Events</span>
              <span className="text-gray-300">{countLaneTimeSlices(lane)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Duration</span>
              <span className="text-gray-300">{duration.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Imported From</span>
              <span className="text-gray-300 truncate ml-2">{lane.sourceFileName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Mode</span>
              <span className="text-gray-300">Timing Only</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Pitch Semantics</span>
              <span className="text-gray-300">Ignored</span>
            </div>
          </div>
        )}
        {isMulti && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Events</span>
              <span className="text-gray-300">{countTimeSlices(lanes)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
