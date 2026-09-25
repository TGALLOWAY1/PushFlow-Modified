/**
 * VoicePalette.
 *
 * Lists all SoundStreams with: color swatch, name, event count, mute toggle,
 * pad location (if assigned), and drag handle for placing on grid.
 * Streams are organized by lane groups and by grid assignment status.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { gmDrumName, gmDrumRenames } from '../../utils/gmDrumMap';
import { DisabledReason, useDisabledReason } from './shared/DisabledReason';
import { getDisplayedCandidate, getDisplayedLayout, type SoundStream } from '../state/projectState';
import type { LaneGroup } from '../../types/performanceLane';
import { buildSoundStreamLookup } from '../analysis/soundStreamLookup';
import { LOCKED_SOUND_DRAG_TYPE } from './dragTypes';
import { generateId } from '../../utils/idGenerator';
import { formatPadLocator, formatPadPosition } from '../../utils/padPosition';
import { FingerAssignmentInput, type FingerAssignmentValue } from './shared/FingerAssignmentInput';
import { type FingerType, type HandSide } from '../../types/fingerModel';

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6366f1',
  '#06b6d4', '#84cc16', '#a855f7', '#d946ef', '#f59e0b',
  '#10b981',
];

export function VoicePalette() {
  const { state, dispatch, transact } = useProject();
  const layout = getDisplayedLayout(state);
  const displayedCandidate = getDisplayedCandidate(state);
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const soundStreamLookup = useMemo(
    () => buildSoundStreamLookup(state.soundStreams),
    [state.soundStreams],
  );

  // Cmd+G to group/ungroup selected streams
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && selectedStreamIds.size > 0) {
        e.preventDefault();
        // Check if all selected streams are in the same group → ungroup
        const groupIds = new Set<string | null>();
        for (const streamId of selectedStreamIds) {
          const lane = state.performanceLanes.find(l => l.id === streamId);
          groupIds.add(lane?.groupId ?? null);
        }
        const allInSameGroup = groupIds.size === 1 && !groupIds.has(null);

        if (allInSameGroup) {
          // Ungroup: remove streams from their group
          transact('Ungroup', () => {
            for (const streamId of selectedStreamIds) {
              dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: streamId, groupId: null } });
            }
          });
        } else {
          // Group: create a new group and assign all selected streams
          const group: LaneGroup = {
            groupId: generateId('grp'),
            name: `Group ${state.laneGroups.length + 1}`,
            color: COLOR_PALETTE[state.laneGroups.length % COLOR_PALETTE.length],
            orderIndex: state.laneGroups.length,
            isCollapsed: false,
          };
          transact('Group', () => {
            dispatch({ type: 'CREATE_LANE_GROUP', payload: group });
            for (const streamId of selectedStreamIds) {
              dispatch({ type: 'SET_LANE_GROUP', payload: { laneId: streamId, groupId: group.groupId } });
            }
          });
        }
        setSelectedStreamIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStreamIds, state.laneGroups.length, state.performanceLanes, dispatch, transact]);

  // Drag-to-reorder state
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  // Rename (T17): one Sound at a time; Enter or Tab moves on to the next one.
  const [renamingId, setRenamingId] = useState<string | null>(null);

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
      const stream = soundStreamLookup.forVoice(voice);
      if (!stream) continue;
      const existing = map.get(stream.id) ?? [];
      existing.push(padKey);
      map.set(stream.id, existing);
    }
    return map;
  }, [layout, soundStreamLookup]);

  // Build a map of which group each stream belongs to
  const streamGroupMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const lane of state.performanceLanes) {
      map.set(lane.id, lane.groupId);
    }
    return map;
  }, [state.performanceLanes]);
  
  // Build solver finger summary
  const solverSummary = useMemo(() => {
    const map = new Map<string, { label: string; hand: string; finger: string }>();
    const { fingerAssignments } = displayedCandidate?.executionPlan ?? {};
    if (!fingerAssignments) return map;
    // Map voiceId to its first assignment's finger info
    for (const fa of fingerAssignments) {
      const stream = soundStreamLookup.forAssignment(fa.voiceId);
      if (!stream || map.has(stream.id) || fa.assignedHand === 'Unplayable' || !fa.finger) continue;
      map.set(stream.id, {
          label: `${fa.assignedHand[0].toUpperCase()}${FINGER_ABBREV[fa.finger] ?? fa.finger}`,
          hand: fa.assignedHand,
          finger: fa.finger,
      });
    }
    return map;
  }, [displayedCandidate, soundStreamLookup]);
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

  // Sounds in the order the rows are shown, for moving from one rename to the next.
  const visibleOrder = useMemo(() => {
    if (sortedGroups.length === 0) return state.soundStreams.map(s => s.id);
    const ids: string[] = [];
    for (const group of sortedGroups) {
      if (group.isCollapsed) continue;
      for (const s of groupedStreams.get(group.groupId) ?? []) ids.push(s.id);
    }
    for (const s of ungroupedUnassigned) ids.push(s.id);
    for (const s of ungroupedAssigned) ids.push(s.id);
    return ids;
  }, [sortedGroups, groupedStreams, ungroupedUnassigned, ungroupedAssigned, state.soundStreams]);

  const handleRenameDone = useCallback((streamId: string, name: string | null, move: 'next' | 'prev' | null) => {
    if (name) dispatch({ type: 'RENAME_SOUND', payload: { streamId, name } });
    const i = visibleOrder.indexOf(streamId);
    const neighbour = move === 'next' ? visibleOrder[i + 1] : move === 'prev' ? visibleOrder[i - 1] : undefined;
    setRenamingId(neighbour ?? null);
  }, [dispatch, visibleOrder]);

  // "Name from GM drum map" is offered only when it would rename something,
  // and otherwise says why not (T31).
  const gmRenameCount = useMemo(() => Object.keys(gmDrumRenames(state.soundStreams)).length, [state.soundStreams]);
  const gmDisabledReason = gmRenameCount > 0 ? null
    : state.soundStreams.some(s => gmDrumName(s.originalMidiNote)) ? 'Every GM drum Sound already has its name'
    : 'No Sound has a GM drum pitch (35–81)';
  const gmReason = useDisabledReason(gmDisabledReason);

  const handleDragStart = (e: React.DragEvent, stream: SoundStream) => {
    e.dataTransfer.setData('application/pushflow-stream', JSON.stringify({
      id: stream.id,
      name: stream.name,
      color: stream.color,
      originalMidiNote: stream.originalMidiNote,
      source: 'palette',
    }));
    // A locked Sound stays on its pad: the grid refuses to drop it elsewhere.
    const lockedPad = layout?.placementLocks[stream.id];
    if (lockedPad) e.dataTransfer.setData(LOCKED_SOUND_DRAG_TYPE, lockedPad);
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

  const renderStreamRow = (stream: SoundStream, isGrouped?: boolean) => (
    <StreamRow
      key={stream.id}
      stream={stream}
      isGrouped={!!isGrouped}
      padKeys={streamPadLocations.get(stream.id) ?? []}
      isLocked={!!layout?.placementLocks[stream.id] && (streamPadLocations.get(stream.id) ?? []).includes(layout.placementLocks[stream.id])}
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
      isRenaming={renamingId === stream.id}
      onStartRename={() => setRenamingId(stream.id)}
      onRenameDone={(name, move) => handleRenameDone(stream.id, name, move)}
      onReorderDragStart={() => setReorderTarget(stream.id)}
      onReorderDrop={() => handleReorderDrop(stream.id)}
      isReorderTarget={reorderTarget !== null && reorderTarget !== stream.id}
    />
  );

  const hasGroups = sortedGroups.length > 0;

  return (
    <div className="space-y-0.5">
      {state.soundStreams.length > 0 && (
        <div data-testid="sounds-header" className="px-2 pb-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-pf-xs text-[var(--text-tertiary)]">
              {state.soundStreams.length} {state.soundStreams.length === 1 ? 'Sound' : 'Sounds'}
            </span>
            <button
              type="button"
              data-testid="name-from-gm"
              className="pf-btn pf-btn-ghost text-pf-xs px-2 py-1"
              disabled={gmRenameCount === 0}
              aria-describedby={gmReason.describedBy}
              onClick={() => dispatch({ type: 'APPLY_GM_DRUM_NAMES' })}
              title={gmRenameCount > 0
                ? `Rename ${gmRenameCount} ${gmRenameCount === 1 ? 'Sound' : 'Sounds'} from the General MIDI drum map (36 → Kick, 38 → Snare …) · one undo step`
                : gmDisabledReason ?? undefined}
            >
              Name from GM drum map
            </button>
          </div>
          <DisabledReason id={gmReason.id} reason={gmDisabledReason} className="block text-right" />
        </div>
      )}

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
                {!group.isCollapsed && streams.map(s => renderStreamRow(s, true))}
              </div>
            );
          })}

          {/* Ungrouped unassigned streams */}
          {ungroupedUnassigned.length > 0 && (
            <div className="space-y-0.5 mt-2">
              <span className="section-header px-2">
                Unassigned ({ungroupedUnassigned.length})
              </span>
              {ungroupedUnassigned.map(s => renderStreamRow(s))}
            </div>
          )}

          {/* Ungrouped assigned streams (no section header) */}
          {ungroupedAssigned.length > 0 && (
            <div className="space-y-0.5 mt-2">
              <span className="section-header px-2">
                Ungrouped ({ungroupedAssigned.length})
              </span>
              {ungroupedAssigned.map(s => renderStreamRow(s))}
            </div>
          )}
        </>
      ) : (
        /* No groups — flat list of all streams, no section headers */
        state.soundStreams.map(s => renderStreamRow(s))
      )}

      {state.soundStreams.length === 0 && (
        <p className="text-pf-sm text-[var(--text-tertiary)] py-3 px-3 text-center">No Sounds yet. Import MIDI or build a pattern to add some.</p>
      )}

      {selectedStreamIds.size > 0 && (
        <div className="text-pf-xs text-accent-primary-soft pt-2 px-2">
          {selectedStreamIds.size} selected — press <kbd className="px-1 py-0.5 rounded-pf-sm bg-[var(--bg-card)] text-[var(--text-secondary)] font-mono text-pf-micro border border-[var(--border-subtle)]">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+G</kbd> to group/ungroup
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
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-pf-sm hover:bg-[var(--bg-hover)] transition-colors">
      {/* Collapse toggle */}
      <button
        className="text-pf-micro text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] w-3 flex-shrink-0 transition-colors"
        onClick={onToggleCollapse}
      >
        {group.isCollapsed ? '\u25B8' : '\u25BE'}
      </button>

      {/* Group color swatch */}
      <div className="relative flex-shrink-0" ref={colorRef}>
        <button
          className="w-2.5 h-2.5 rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30 transition-all"
          style={{ backgroundColor: group.color }}
          onClick={e => { e.stopPropagation(); setShowGroupColor(!showGroupColor); }}
          title="Change group color"
        />
        {showGroupColor && (
          <div className="absolute left-0 top-full mt-1 p-1.5 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl z-50 grid grid-cols-4 gap-1" style={{ width: 88 }}>
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                className={`w-4 h-4 rounded-sm cursor-pointer hover:scale-110 transition-transform ${c === group.color ? 'ring-1 ring-white' : ''}`}
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
          className="pf-input flex-1 text-pf-xs font-medium min-w-0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-pf-xs font-medium text-[var(--text-secondary)] truncate editable-field"
          onDoubleClick={() => { setDraft(group.name); setEditing(true); }}
          title="Double-click to rename"
        >
          {group.name}
        </span>
      )}

      {/* Count */}
      <span className="text-pf-micro text-[var(--text-tertiary)] flex-shrink-0">{count}</span>

      {/* Delete group */}
      <button
        className="text-pf-xs text-[var(--text-tertiary)] hover:text-red-400 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
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
  isLocked,
  voiceConstraint,
  solverAssignment,
  groups,
  currentGroupId,
  isSelected,
  isGlobalSelected,
  isGrouped,
  onSelect,
  onToggleMute,
  onSolo,
  onDragStart,
  onSetConstraint,
  onChangeColor,
  onSetGroup,
  isRenaming,
  onStartRename,
  onRenameDone,
  onReorderDragStart,
  onReorderDrop,
  isReorderTarget,
}: {
  stream: SoundStream;
  padKeys: string[];
  isLocked: boolean;
  voiceConstraint?: { hand?: 'left' | 'right'; finger?: string };
  solverAssignment?: { label: string; hand: string; finger: string };
  isSelected: boolean;
  isGlobalSelected: boolean;
  isGrouped: boolean;
  onSelect: (streamId: string, e: React.MouseEvent) => void;
  groups: LaneGroup[];
  currentGroupId: string | null;
  onToggleMute: () => void;
  onSolo: () => void;
  onDragStart: (e: React.DragEvent, stream: SoundStream) => void;
  onSetConstraint: (hand?: 'left' | 'right' | null, finger?: string | null) => void;
  onChangeColor: (color: string) => void;
  onSetGroup: (groupId: string | null) => void;
  isRenaming: boolean;
  onStartRename: () => void;
  /** The rename ended: `name` to apply (null for none), and whether to move on to the next or previous Sound. */
  onRenameDone: (name: string | null, move: 'next' | 'prev' | null) => void;
  onReorderDragStart: () => void;
  onReorderDrop: () => void;
  isReorderTarget: boolean;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [nameDraft, setNameDraft] = useState(stream.name);
  const colorRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  // One ending per rename: Enter, Tab or Escape end it before the input's blur does.
  const renameDone = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setNameDraft(stream.name);
      renameDone.current = false;
    }
    // Only when a rename starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming]);

  const finishRename = (move: 'next' | 'prev' | null, apply: boolean, refocus: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    const trimmed = nameDraft.trim();
    onRenameDone(apply && trimmed && trimmed !== stream.name ? trimmed : null, move);
    // Ended from the keyboard without moving on: keep focus on this Sound.
    if (refocus && !move) requestAnimationFrame(() => nameRef.current?.focus());
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
      data-testid="sound-row"
      data-sound-id={stream.id}
      className={`
        group flex items-center gap-1.5 py-1.5 rounded-pf-sm text-pf-sm
        border transition-all duration-fast
        cursor-grab active:cursor-grabbing active:scale-[0.98]
        ${isGrouped ? 'pl-6 pr-2' : 'px-2'}
        ${stream.muted ? 'opacity-35' : ''}
        ${isGlobalSelected
          ? 'border-accent-primary/40 bg-[var(--accent-muted)] ring-1 ring-accent-primary/20'
          : isSelected
            ? 'border-accent-primary/25 bg-[var(--accent-muted)]'
            : 'border-transparent hover:bg-[var(--bg-hover)]'
        }
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
          className="w-2.5 h-2.5 rounded-sm flex-shrink-0 cursor-pointer hover:ring-1 hover:ring-white/30 transition-all"
          style={{ backgroundColor: stream.color }}
          onClick={e => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
          onMouseDown={e => e.stopPropagation()}
          title="Color & group"
        />
        {showColorPicker && (
          <div className="absolute left-0 top-full mt-1 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl z-50" style={{ width: 120 }}>
            {/* Colors */}
            <div className="p-1.5 grid grid-cols-4 gap-1">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  className={`w-4 h-4 rounded-sm cursor-pointer hover:scale-110 transition-transform ${c === stream.color ? 'ring-1 ring-white' : ''}`}
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
              <div className="border-t border-[var(--border-subtle)] px-1.5 py-1.5">
                <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Group</div>
                <select
                  className="pf-select w-full text-pf-xs"
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

      {/* Name: double-click, F2, Enter or the pencil renames it (T17) */}
      {isRenaming ? (
        <input
          data-testid="sound-rename-input"
          aria-label={`Rename ${stream.name}`}
          className="pf-input flex-1 text-pf-sm font-medium min-w-0"
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={() => finishRename(null, true, false)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); finishRename('next', true, true); }
            else if (e.key === 'Tab') { e.preventDefault(); finishRename(e.shiftKey ? 'prev' : 'next', true, true); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishRename(null, false, true); }
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          autoFocus
          onFocus={e => e.currentTarget.select()}
        />
      ) : (
        <>
          <span
            ref={nameRef}
            data-testid="sound-name"
            tabIndex={0}
            className="flex-1 min-w-0 truncate text-[var(--text-primary)] font-medium cursor-text text-pf-sm rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-400"
            onDoubleClick={e => { e.stopPropagation(); onStartRename(); }}
            onKeyDown={e => {
              if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onStartRename(); }
            }}
            title={`${stream.name} · double-click, F2 or Enter to rename`}
          >
            {stream.name}
          </span>
          <button
            type="button"
            data-testid="sound-rename"
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onStartRename(); }}
            onMouseDown={e => e.stopPropagation()}
            aria-label={`Rename ${stream.name}`}
            title="Rename"
          >
            <Pencil size={11} aria-hidden="true" />
          </button>
        </>
      )}

      {/* Pad location(s) + lock indicator */}
      {padKeys.length > 0 && (
        <span
          data-testid="sound-pad-locator"
          className="text-pf-xs text-[var(--text-secondary)] font-mono flex-shrink-0 flex items-center gap-0.5 tabular-nums"
          title={padKeys.map(formatPadPosition).join(', ')}
        >
          {isLocked && <span className="text-pf-micro text-amber-400" title="Locked · Unlock to move" aria-label="Locked · Unlock to move">&#x1F512;</span>}
          {formatPadLocator(padKeys[0])}
          {padKeys.length > 1 && `+${padKeys.length - 1}`}
        </span>
      )}

      {/* Finger assignment — show user constraint or solver suggestion */}
      <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <FingerAssignmentInput
          value={
            voiceConstraint?.hand && voiceConstraint?.finger
              ? { hand: voiceConstraint.hand, finger: voiceConstraint.finger as FingerType }
              : solverAssignment
                ? { hand: solverAssignment.hand as HandSide, finger: solverAssignment.finger as FingerType }
                : null
          }
          isSuggestion={!(voiceConstraint?.hand && voiceConstraint?.finger) && !!solverAssignment}
          onChange={(assignment: FingerAssignmentValue | null) => {
            if (assignment) {
              onSetConstraint(assignment.hand, assignment.finger);
            } else {
              onSetConstraint(null, null);
            }
          }}
          size="md"
        />
      </div>

      {/* Solo */}
      <button
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-pf-xs transition-colors bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:bg-amber-500/15 hover:text-amber-400 border border-transparent hover:border-amber-500/20"
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
          flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm
          text-pf-xs transition-colors
          ${stream.muted
            ? 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
            : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}
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
