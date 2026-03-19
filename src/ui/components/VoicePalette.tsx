/**
 * VoicePalette.
 *
 * Lists all SoundStreams with: color swatch, name, event count, mute toggle,
 * pad location (if assigned), and drag handle for placing on grid.
 * Streams are organized by lane groups and by grid assignment status.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, type SoundStream } from '../state/projectState';
import type { LaneGroup } from '../../types/performanceLane';
import { generateId } from '../../utils/idGenerator';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6366f1',
  '#06b6d4', '#84cc16', '#a855f7', '#d946ef', '#f59e0b',
  '#10b981',
];

export function VoicePalette() {
  const { state, dispatch } = useProject();
  const layout = getDisplayedLayout(state);
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());

  // Cmd+G to group selected streams
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && selectedStreamIds.size > 0) {
        e.preventDefault();
        const group: LaneGroup = {
          groupId: generateId('grp'),
          name: `Group ${state.laneGroups.length + 1}`,
          color: COLOR_PALETTE[state.laneGroups.length % COLOR_PALETTE.length],
          orderIndex: state.laneGroups.length,
          isCollapsed: false,
        };
        dispatch({ type: 'CREATE_LANE_GROUP', payload: group });
        for (const streamId of selectedStreamIds) {
          dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: streamId, groupId: group.groupId } });
        }
        setSelectedStreamIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStreamIds, state.laneGroups.length, dispatch]);

  // Drag-to-reorder state
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  const handleStreamSelect = useCallback((streamId: string, e: React.MouseEvent) => {
    // Always dispatch global selection for cross-panel highlighting
    dispatch({ type: 'SELECT_STREAM', payload: state.selectedStreamId === streamId ? null : streamId });

    if (e.metaKey || e.ctrlKey) {
      setSelectedStreamIds(prev => {
        const next = new Set(prev);
        if (next.has(streamId)) next.delete(streamId);
        else next.add(streamId);
        return next;
      });
    } else if (e.shiftKey && selectedStreamIds.size > 0) {
      const allIds = state.soundStreams.map(s => s.id);
      const lastSelected = [...selectedStreamIds].pop()!;
      const lastIdx = allIds.indexOf(lastSelected);
      const currentIdx = allIds.indexOf(streamId);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      const next = new Set(selectedStreamIds);
      for (let i = start; i <= end; i++) next.add(allIds[i]);
      setSelectedStreamIds(next);
    } else {
      setSelectedStreamIds(prev => prev.has(streamId) && prev.size === 1 ? new Set() : new Set([streamId]));
    }
  }, [selectedStreamIds, state.soundStreams, state.selectedStreamId, dispatch]);

  // Build a map of which pads each stream occupies
  const streamPadLocations = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!layout) return map;
    for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
      const existing = map.get(voice.id) ?? [];
      existing.push(padKey);
      map.set(voice.id, existing);
    }
    return map;
  }, [layout]);

  // Build per-stream solver assignment summary from analysisResult
  const solverSummary = useMemo(() => {
    const map = new Map<string, { label: string; hand: string; finger: string }>();
    const fa = state.analysisResult?.executionPlan.fingerAssignments;
    if (!fa || fa.length === 0) return map;

    const noteToStreamId = new Map<number, string>();
    for (const s of state.soundStreams) {
      noteToStreamId.set(s.originalMidiNote, s.id);
    }

    const counts = new Map<string, Map<string, number>>();
    for (const a of fa) {
      const streamId = noteToStreamId.get(a.noteNumber);
      if (!streamId || a.assignedHand === 'Unplayable') continue;
      const handChar = a.assignedHand === 'left' ? 'L' : 'R';
      const FINGER_SHORT: Record<string, string> = {
        thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
      };
      const fingerStr = a.finger ? FINGER_SHORT[a.finger] ?? '' : '';
      const key = fingerStr ? `${handChar}${fingerStr}` : handChar;

      const streamCounts = counts.get(streamId) ?? new Map<string, number>();
      streamCounts.set(key, (streamCounts.get(key) ?? 0) + 1);
      counts.set(streamId, streamCounts);
    }

    // Also track which raw finger name is most common per stream
    const fingerCounts = new Map<string, Map<string, number>>();
    for (const a of fa) {
      const streamId = noteToStreamId.get(a.noteNumber);
      if (!streamId || a.assignedHand === 'Unplayable' || !a.finger) continue;
      const sc = fingerCounts.get(streamId) ?? new Map<string, number>();
      sc.set(a.finger, (sc.get(a.finger) ?? 0) + 1);
      fingerCounts.set(streamId, sc);
    }

    for (const [streamId, streamCounts] of counts) {
      let best = '';
      let bestCount = 0;
      for (const [key, count] of streamCounts) {
        if (count > bestCount) { best = key; bestCount = count; }
      }
      // Find most common raw finger name
      let bestFinger = '';
      let bestFingerCount = 0;
      const fc = fingerCounts.get(streamId);
      if (fc) {
        for (const [finger, count] of fc) {
          if (count > bestFingerCount) { bestFinger = finger; bestFingerCount = count; }
        }
      }
      if (best) {
        map.set(streamId, { label: best, hand: best.startsWith('L') ? 'left' : 'right', finger: bestFinger });
      }
    }
    return map;
  }, [state.analysisResult, state.soundStreams]);

  // Build streamId → groupId map from performanceLanes
  const streamGroupMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const lane of state.performanceLanes) {
      map.set(lane.id, lane.groupId);
    }
    return map;
  }, [state.performanceLanes]);

  // Organize streams by group, then by grid assignment
  const { groupedStreams, ungroupedAssigned, ungroupedUnassigned } = useMemo(() => {
    const grouped = new Map<string, SoundStream[]>();
    const uAssigned: SoundStream[] = [];
    const uUnassigned: SoundStream[] = [];

    for (const stream of state.soundStreams) {
      const groupId = streamGroupMap.get(stream.id);
      if (groupId) {
        const list = grouped.get(groupId) ?? [];
        list.push(stream);
        grouped.set(groupId, list);
      } else if (streamPadLocations.has(stream.id)) {
        uAssigned.push(stream);
      } else {
        uUnassigned.push(stream);
      }
    }
    return { groupedStreams: grouped, ungroupedAssigned: uAssigned, ungroupedUnassigned: uUnassigned };
  }, [state.soundStreams, streamGroupMap, streamPadLocations]);

  // Sort groups by orderIndex
  const sortedGroups = useMemo(() =>
    [...state.laneGroups].sort((a, b) => a.orderIndex - b.orderIndex),
    [state.laneGroups]
  );

  const handleDragStart = (e: React.DragEvent, stream: SoundStream) => {
    e.dataTransfer.setData('application/pushflow-stream', JSON.stringify({
      id: stream.id,
      name: stream.name,
      color: stream.color,
      originalMidiNote: stream.originalMidiNote,
      source: 'palette',
    }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleReorderDrop = useCallback((targetStreamId: string) => {
    if (!reorderTarget || reorderTarget === targetStreamId) return;
    const targetIdx = state.soundStreams.findIndex(s => s.id === targetStreamId);
    if (targetIdx !== -1) {
      dispatch({ type: 'REORDER_STREAMS', payload: { streamId: reorderTarget, newIndex: targetIdx } });
    }
    setReorderTarget(null);
  }, [reorderTarget, state.soundStreams, dispatch]);

  const renderStreamRow = (stream: SoundStream) => (
    <StreamRow
      key={stream.id}
      stream={stream}
      padKeys={streamPadLocations.get(stream.id) ?? []}
      voiceConstraint={state.voiceConstraints[stream.id]}
      solverAssignment={solverSummary.get(stream.id)}
      groups={state.laneGroups}
      currentGroupId={streamGroupMap.get(stream.id) ?? null}
      isSelected={selectedStreamIds.has(stream.id)}
      isGlobalSelected={state.selectedStreamId === stream.id}
      onSelect={handleStreamSelect}
      onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: stream.id })}
      onSolo={() => dispatch({ type: 'SOLO_STREAM', payload: stream.id })}
      onDragStart={handleDragStart}
      onSetConstraint={(hand, finger) => dispatch({
        type: 'SET_VOICE_CONSTRAINT',
        payload: { streamId: stream.id, hand, finger },
      })}
      onChangeColor={(color) => dispatch({
        type: 'SET_SOUND_COLOR',
        payload: { streamId: stream.id, color },
      })}
      onSetGroup={(groupId) => dispatch({
        type: 'SET_LANE_GROUP',
        payload: { laneId: stream.id, groupId },
      })}
      onRename={(name) => dispatch({
        type: 'RENAME_SOUND',
        payload: { streamId: stream.id, name },
      })}
      onReorderDragStart={() => setReorderTarget(stream.id)}
      onReorderDrop={() => handleReorderDrop(stream.id)}
      isReorderTarget={reorderTarget !== null && reorderTarget !== stream.id}
    />
  );

  const hasGroups = sortedGroups.length > 0;

  return (
    <div className="space-y-1">

      {hasGroups ? (
        <>
          {/* Grouped streams */}
          {sortedGroups.map(group => {
            const streams = groupedStreams.get(group.groupId) ?? [];
            if (streams.length === 0) return (
              <GroupHeader
                key={group.groupId}
                group={group}
                count={0}
                onToggleCollapse={() => dispatch({ type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: group.groupId })}
                onRename={(name) => dispatch({ type: 'RENAME_LANE_GROUP', payload: { groupId: group.groupId, name } })}
                onChangeColor={(color) => dispatch({ type: 'SET_LANE_GROUP_COLOR', payload: { groupId: group.groupId, color } })}
                onDelete={() => dispatch({ type: 'DELETE_LANE_GROUP', payload: group.groupId })}
              />
            );
            return (
              <div key={group.groupId} className="space-y-0.5">
                <GroupHeader
                  group={group}
                  count={streams.length}
                  onToggleCollapse={() => dispatch({ type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: group.groupId })}
                  onRename={(name) => dispatch({ type: 'RENAME_LANE_GROUP', payload: { groupId: group.groupId, name } })}
                  onChangeColor={(color) => dispatch({ type: 'SET_LANE_GROUP_COLOR', payload: { groupId: group.groupId, color } })}
                  onDelete={() => dispatch({ type: 'DELETE_LANE_GROUP', payload: group.groupId })}
                />
                {!group.isCollapsed && streams.map(renderStreamRow)}
              </div>
            );
          })}

          {/* Ungrouped unassigned streams */}
          {ungroupedUnassigned.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500">
                Unassigned ({ungroupedUnassigned.length})
              </span>
              {ungroupedUnassigned.map(renderStreamRow)}
            </div>
          )}

          {/* Ungrouped assigned streams */}
          {ungroupedAssigned.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500">
                On Grid ({ungroupedAssigned.length})
              </span>
              {ungroupedAssigned.map(renderStreamRow)}
            </div>
          )}
        </>
      ) : (
        /* No groups — flat list of all streams, no section headers */
        state.soundStreams.map(renderStreamRow)
      )}

      {state.soundStreams.length === 0 && (
        <p className="text-xs text-gray-500 py-2">No sounds loaded.</p>
      )}

      {selectedStreamIds.size > 0 && (
        <div className="text-[10px] text-blue-400 pt-1">
          {selectedStreamIds.size} selected — press <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[9px]">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+G</kbd> to group
        </div>
      )}
    </div>
  );
}

function GroupHeader({
  group,
  count,
  onToggleCollapse,
  onRename,
  onChangeColor,
  onDelete,
}: {
  group: LaneGroup;
  count: number;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onChangeColor: (color: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [showGroupColor, setShowGroupColor] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showGroupColor) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowGroupColor(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupColor]);

  const commitName = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== group.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-gray-800/40 transition-colors">
      {/* Collapse toggle */}
      <button
        className="text-[10px] text-gray-500 hover:text-gray-300 w-3 flex-shrink-0"
        onClick={onToggleCollapse}
      >
        {group.isCollapsed ? '\u25B8' : '\u25BE'}
      </button>

      {/* Group color swatch */}
      <div className="relative flex-shrink-0" ref={colorRef}>
        <button
          className="w-2.5 h-2.5 rounded-sm cursor-pointer hover:ring-1 hover:ring-gray-400 transition-all"
          style={{ backgroundColor: group.color }}
          onClick={e => { e.stopPropagation(); setShowGroupColor(!showGroupColor); }}
          title="Change group color"
        />
        {showGroupColor && (
          <div className="absolute left-0 top-full mt-1 p-1.5 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-50 grid grid-cols-4 gap-1" style={{ width: 88 }}>
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                className={`w-4 h-4 rounded-sm cursor-pointer hover:scale-125 transition-transform ${c === group.color ? 'ring-1 ring-white' : ''}`}
                style={{ backgroundColor: c }}
                onClick={e => { e.stopPropagation(); onChangeColor(c); setShowGroupColor(false); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Group name (double-click to edit) */}
      {editing ? (
        <input
          className="flex-1 text-[10px] font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-500 min-w-0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-[10px] font-medium text-gray-400 truncate cursor-pointer hover:text-gray-200"
          onDoubleClick={() => { setDraft(group.name); setEditing(true); }}
          title="Double-click to rename"
        >
          {group.name}
        </span>
      )}

      {/* Count */}
      <span className="text-[9px] text-gray-600 flex-shrink-0">{count}</span>

      {/* Delete group */}
      <button
        className="text-[10px] text-gray-600 hover:text-red-400 flex-shrink-0 transition-colors"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete group (sounds will be ungrouped)"
      >
        ×
      </button>
    </div>
  );
}

function StreamRow({
  stream,
  padKeys,
  voiceConstraint,
  solverAssignment,
  groups,
  currentGroupId,
  isSelected,
  isGlobalSelected,
  onSelect,
  onToggleMute,
  onSolo,
  onDragStart,
  onSetConstraint,
  onChangeColor,
  onSetGroup,
  onRename,
  onReorderDragStart,
  onReorderDrop,
  isReorderTarget,
}: {
  stream: SoundStream;
  padKeys: string[];
  voiceConstraint?: { hand?: 'left' | 'right'; finger?: string };
  solverAssignment?: { label: string; hand: string; finger: string };
  isSelected: boolean;
  isGlobalSelected: boolean;
  onSelect: (streamId: string, e: React.MouseEvent) => void;
  groups: LaneGroup[];
  currentGroupId: string | null;
  onToggleMute: () => void;
  onSolo: () => void;
  onDragStart: (e: React.DragEvent, stream: SoundStream) => void;
  onSetConstraint: (hand?: 'left' | 'right' | null, finger?: string | null) => void;
  onChangeColor: (color: string) => void;
  onSetGroup: (groupId: string | null) => void;
  onRename: (name: string) => void;
  onReorderDragStart: () => void;
  onReorderDrop: () => void;
  isReorderTarget: boolean;
}) {
  const solverFinger = solverAssignment?.finger ?? null;
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(stream.name);
  const colorRef = useRef<HTMLDivElement>(null);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== stream.name) onRename(trimmed);
    setEditingName(false);
  };

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs
        border hover:border-gray-700
        cursor-grab active:cursor-grabbing active:scale-95 transition-transform duration-150
        ${stream.muted ? 'opacity-40' : ''}
        ${isGlobalSelected ? 'border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/30' : isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-transparent'}
      `}
      draggable
      onDragStart={e => {
        onDragStart(e, stream);
        onReorderDragStart();
      }}
      onDragOver={isReorderTarget ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
      onDrop={isReorderTarget ? e => { e.preventDefault(); onReorderDrop(); } : undefined}
      onClick={e => onSelect(stream.id, e)}
    >
      {/* Color swatch (click to open color + group popover) */}
      <div className="relative flex-shrink-0" ref={colorRef}>
        <button
          className="w-2.5 h-2.5 rounded-sm flex-shrink-0 cursor-pointer hover:ring-1 hover:ring-gray-400 transition-all"
          style={{ backgroundColor: stream.color }}
          onClick={e => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
          onMouseDown={e => e.stopPropagation()}
          title="Color & group"
        />
        {showColorPicker && (
          <div className="absolute left-0 top-full mt-1 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-50" style={{ width: 120 }}>
            {/* Colors */}
            <div className="p-1.5 grid grid-cols-4 gap-1">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  className={`w-4 h-4 rounded-sm cursor-pointer hover:scale-125 transition-transform ${c === stream.color ? 'ring-1 ring-white' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={e => {
                    e.stopPropagation();
                    onChangeColor(c);
                    setShowColorPicker(false);
                  }}
                  onMouseDown={e => e.stopPropagation()}
                />
              ))}
            </div>
            {/* Group assignment */}
            {groups.length > 0 && (
              <div className="border-t border-gray-700 px-1.5 py-1.5">
                <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Group</div>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-[10px] text-gray-300 rounded px-1 py-1"
                  value={currentGroupId ?? ''}
                  onChange={e => {
                    e.stopPropagation();
                    onSetGroup(e.target.value === '' ? null : e.target.value);
                    setShowColorPicker(false);
                  }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <option value="">None</option>
                  {groups.map(g => (
                    <option key={g.groupId} value={g.groupId}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Name (double-click to edit) */}
      {editingName ? (
        <input
          className="flex-1 text-xs font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-500 min-w-0"
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 truncate text-gray-200 font-medium cursor-text"
          onDoubleClick={e => { e.stopPropagation(); setNameDraft(stream.name); setEditingName(true); }}
          title={stream.name}
        >
          {stream.name}
        </span>
      )}

      {/* Pad location(s) */}
      {padKeys.length > 0 && (
        <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
          [{padKeys[0]}]
          {padKeys.length > 1 && `+${padKeys.length - 1}`}
        </span>
      )}

      {/* Hand constraint (populated from solver when no user constraint set) */}
      <select
        className="bg-gray-800 border border-gray-700 text-[10px] text-gray-400 rounded px-0.5 py-0.5 w-7 flex-shrink-0"
        value={voiceConstraint?.hand ?? solverAssignment?.hand ?? ''}
        onChange={e => onSetConstraint(
          e.target.value === '' ? null : e.target.value as 'left' | 'right',
          undefined
        )}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        title="Hand assignment"
      >
        <option value="">-</option>
        <option value="left">L</option>
        <option value="right">R</option>
      </select>

      {/* Finger constraint (populated from solver when no user constraint set) */}
      <select
        className="bg-gray-800 border border-gray-700 text-[10px] text-gray-400 rounded px-0.5 py-0.5 w-9 flex-shrink-0"
        value={voiceConstraint?.finger ?? solverFinger ?? ''}
        onChange={e => onSetConstraint(
          undefined,
          e.target.value === '' ? null : e.target.value
        )}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        title="Finger assignment"
      >
        <option value="">-</option>
        <option value="thumb">1</option>
        <option value="index">2</option>
        <option value="middle">3</option>
        <option value="ring">4</option>
        <option value="pinky">5</option>
      </select>

      {/* Solo */}
      <button
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors bg-gray-800 text-gray-400 hover:bg-amber-500/20 hover:text-amber-400"
        onClick={e => {
          e.stopPropagation();
          onSolo();
        }}
        title="Solo"
      >
        S
      </button>

      {/* Mute toggle */}
      <button
        className={`
          flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
          text-[10px] transition-colors
          ${stream.muted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
        `}
        onClick={e => {
          e.stopPropagation();
          onToggleMute();
        }}
        title={stream.muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>

    </div>
  );
}

