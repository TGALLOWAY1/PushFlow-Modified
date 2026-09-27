/**
 * VoicePalette: the Sounds panel (S5.1, T45).
 *
 * - The header: search, the placement filters with counts (All · To place ·
 *   On grid · Locked), how many are on the grid, "Place remaining N" and
 *   "Name from GM drum map" (SoundsHeader).
 * - The Sounds in the one order the timeline shares (soundOrder.ts): with
 *   groups, a section per group and "Ungrouped" for the rest; with none, a
 *   flat list. Placement is each row's pill or locator, never a section.
 * - Each row (SoundRow): its pad and lock, hit count, finger preference, Solo,
 *   Mute and a "⋯" menu (SoundRowMenu). A plain click arms it for
 *   click-to-place; Mod- or Shift-click selects several, for Mod+G and the
 *   selection bar (SoundsSelectionBar).
 * - Reordering only by a row's handle, which can also drop a Sound into a
 *   group's section (T46).
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { useInputHandler } from '../input/inputRegistry';
import { getInspectedLayout, type SoundStream } from '../state/projectState';
import { orderSounds, soundGroupIds, sortedGroups } from '../state/soundOrder';
import { filterCounts, matchesFilter, matchesSearch, soundPlacements, type SoundFilter } from '../analysis/soundPlacement';
import { preferenceOf, usePlanFingers, useSetFingerPreference } from '../hooks/useFingerPreference';
import { sharedNamePrefix } from '../analysis/padLabels';
import { useReadOnlyHint } from '../hooks/useReadOnlyHint';
import { setSoundDragData } from './dragTypes';
import { SoundsHeader } from './sounds/SoundsHeader';
import { SoundRow, type DropSide } from './sounds/SoundRow';
import { SoundGroupHeader } from './sounds/SoundGroupHeader';
import { SoundRowMenu } from './sounds/SoundRowMenu';
import { SoundsSelectionBar } from './sounds/SoundsSelectionBar';
import { useSoundGrouping } from './sounds/soundGroups';

/** Where a handle drag would land: beside a row, or in a section (a group, or null for "Ungrouped"). */
type ReorderTarget = { kind: 'row'; id: string; side: DropSide } | { kind: 'section'; groupId: string | null };

export function VoicePalette() {
  const { state, dispatch, transact } = useProject();
  // Where each Sound is, on the layout on screen (S3.2): an inspected
  // candidate's pads, not the draft's behind it.
  const layout = getInspectedLayout(state);
  const { refuse } = useReadOnlyHint();
  const grouping = useSoundGrouping();
  const planFingers = usePlanFingers();
  const setPreference = useSetFingerPreference();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SoundFilter>('all');
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; anchor: HTMLElement } | null>(null);
  // The Sound being dragged by its handle, and where it would land. Cleared
  // on dragend, wherever the drag ends (T46: it used to stick).
  const [reordering, setReordering] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<ReorderTarget | null>(null);
  const endReorder = useCallback(() => { setReordering(null); setReorderTarget(null); }, []);

  const ordered = useMemo(
    () => orderSounds(state.soundStreams, state.performanceLanes, state.laneGroups),
    [state.soundStreams, state.performanceLanes, state.laneGroups],
  );
  const groupOf = useMemo(() => soundGroupIds(state.performanceLanes, state.laneGroups), [state.performanceLanes, state.laneGroups]);
  const groups = useMemo(() => sortedGroups(state.laneGroups), [state.laneGroups]);
  const placements = useMemo(() => soundPlacements(state.soundStreams, layout), [state.soundStreams, layout]);
  const namePrefix = useMemo(() => sharedNamePrefix(state.soundStreams.map(s => s.name)), [state.soundStreams]);
  const counts = useMemo(() => filterCounts(placements), [placements]);
  const narrowed = filter !== 'all' || query.trim() !== '';
  const visible = useMemo(
    () => ordered.filter(s => matchesFilter(placements.get(s.id), filter) && matchesSearch(s.name, query)),
    [ordered, placements, filter, query],
  );
  // The rows in the order shown (collapsed groups hide theirs), for Shift-click ranges and renames.
  const shownIds = useMemo(() => {
    const collapsed = new Set(groups.filter(g => g.isCollapsed).map(g => g.groupId));
    return visible.filter(s => !collapsed.has(groupOf.get(s.id) ?? '')).map(s => s.id);
  }, [visible, groups, groupOf]);

  // Mod+G groups the selected Sounds, or ungroups them if they are all in one
  // group (the input table's group-sounds row).
  useInputHandler('group-sounds', () => {
    grouping.toggleGroup([...selectedStreamIds]);
    setSelectedStreamIds(new Set());
  }, { enabled: selectedStreamIds.size > 0 });

  // A one-Sound selection made by an arming click follows the armed Sound: it
  // moves on with the auto-advance and ends when placing ends (Escape), so the
  // grouping hint never lingers on a Sound the user has moved past.
  const lastArmedRef = useRef<string | null>(state.armedStreamId);
  useEffect(() => {
    const was = lastArmedRef.current;
    const armed = state.armedStreamId;
    lastArmedRef.current = armed;
    if (was === null || was === armed) return;
    setSelectedStreamIds(prev => (prev.size === 1 && prev.has(was) ? new Set(armed ? [armed] : []) : prev));
  }, [state.armedStreamId]);

  const handleSelect = useCallback((streamId: string, e: React.MouseEvent) => {
    const multiSelect = e.metaKey || e.ctrlKey || (e.shiftKey && selectedStreamIds.size > 0);
    if (multiSelect) {
      // Selecting several Sounds (for Mod+G) is not placing: disarm, and
      // toggle the cross-panel highlight as before.
      if (state.armedStreamId !== null) dispatch({ type: 'ARM_SOUND', payload: null });
      dispatch({ type: 'SELECT_STREAM', payload: state.selectedStreamId === streamId ? null : streamId });
    } else {
      // A plain click arms the Sound for click-to-place (T62), and selects it.
      // Clicking it again keeps it armed, so it never undoes the auto-advance.
      dispatch({ type: 'ARM_SOUND', payload: streamId });
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedStreamIds(prev => {
        const next = new Set(prev);
        if (next.has(streamId)) next.delete(streamId);
        else next.add(streamId);
        return next;
      });
    } else if (e.shiftKey && selectedStreamIds.size > 0) {
      const lastSelected = [...selectedStreamIds].pop()!;
      const lastIdx = shownIds.indexOf(lastSelected);
      const currentIdx = shownIds.indexOf(streamId);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      const next = new Set(selectedStreamIds);
      for (let i = Math.max(0, start); i <= end; i++) next.add(shownIds[i]!);
      setSelectedStreamIds(next);
    } else {
      setSelectedStreamIds(new Set([streamId]));
    }
  }, [selectedStreamIds, shownIds, state.selectedStreamId, state.armedStreamId, dispatch]);

  const handleRenameDone = useCallback((streamId: string, name: string | null, move: 'next' | 'prev' | null) => {
    if (name) dispatch({ type: 'RENAME_SOUND', payload: { streamId, name } });
    const i = shownIds.indexOf(streamId);
    const neighbour = move === 'next' ? shownIds[i + 1] : move === 'prev' ? shownIds[i - 1] : undefined;
    setRenamingId(neighbour ?? null);
  }, [dispatch, shownIds]);

  /** Moves the Sound being reordered beside a row (joining that row's group) or into a section. */
  const dropReorder = useCallback((target: ReorderTarget) => {
    const id = reordering;
    endReorder();
    if (!id) return;
    const from = groupOf.get(id) ?? null;
    if (target.kind === 'section') {
      if (target.groupId !== from) grouping.moveToGroup([id], target.groupId);
      return;
    }
    if (target.id === id) return;
    const to = groupOf.get(target.id) ?? null;
    const rest = state.soundStreams.filter(s => s.id !== id);
    const at = rest.findIndex(s => s.id === target.id);
    if (at < 0) return;
    const newIndex = target.side === 'before' ? at : at + 1;
    transact('Reorder Sounds', () => {
      if (to !== from) grouping.moveToGroup([id], to);
      dispatch({ type: 'REORDER_STREAMS', payload: { streamId: id, newIndex } });
    });
  }, [reordering, endReorder, groupOf, grouping, state.soundStreams, transact, dispatch]);

  const renderRow = (sound: SoundStream) => {
    const placement = placements.get(sound.id) ?? { padKeys: [], locked: false };
    const dropSide = reorderTarget?.kind === 'row' && reorderTarget.id === sound.id && reordering !== sound.id ? reorderTarget.side : null;
    return (
      <SoundRow
        key={sound.id}
        sound={sound}
        namePrefix={namePrefix}
        placement={placement}
        isGrouped={groups.length > 0 && groupOf.get(sound.id) != null}
        preference={preferenceOf(state.voiceConstraints[sound.id])}
        fingerPlan={planFingers.get(sound.id) ?? null}
        onSetPreference={value => setPreference(sound.id, value)}
        isSelected={selectedStreamIds.has(sound.id)}
        isGlobalSelected={state.selectedStreamId === sound.id}
        isArmed={state.armedStreamId === sound.id}
        onSelect={handleSelect}
        isRenaming={renamingId === sound.id}
        onStartRename={() => setRenamingId(sound.id)}
        onRenameDone={(name, move) => handleRenameDone(sound.id, name, move)}
        onToggleLock={() => {
          if (refuse() || placement.padKeys.length === 0) return;
          dispatch({ type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: sound.id, padKey: placement.padKeys[0]! } });
        }}
        onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: sound.id })}
        onSolo={() => dispatch({ type: 'SOLO_STREAM', payload: sound.id })}
        onOpenMenu={anchor => {
          const r = anchor.getBoundingClientRect();
          setMenu(current => (current?.id === sound.id ? null : { id: sound.id, x: r.right - 236, y: r.bottom + 4, anchor }));
        }}
        onDragStart={e => setSoundDragData(e.dataTransfer, sound, layout.placementLocks[sound.id])}
        onReorderStart={() => setReordering(sound.id)}
        onReorderEnd={endReorder}
        dropSide={dropSide}
        onReorderOver={side => setReorderTarget(prev => (prev?.kind === 'row' && prev.id === sound.id && prev.side === side ? prev : { kind: 'row', id: sound.id, side }))}
        onReorderDrop={side => dropReorder({ kind: 'row', id: sound.id, side })}
      />
    );
  };

  const sectionProps = (groupId: string | null) => ({
    dropActive: reordering !== null && reorderTarget?.kind === 'section' && reorderTarget.groupId === groupId,
    onReorderOver: () => setReorderTarget(prev => (prev?.kind === 'section' && prev.groupId === groupId ? prev : { kind: 'section', groupId })),
    onReorderLeave: () => setReorderTarget(prev => (prev?.kind === 'section' && prev.groupId === groupId ? null : prev)),
    onReorderDrop: () => dropReorder({ kind: 'section', groupId }),
  });

  // A click on the list's empty space clears the Sound selection (T42), as
  // Escape does: placing stops, and a multi-selection for Mod+G ends.
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setSelectedStreamIds(new Set());
    if (state.armedStreamId !== null) dispatch({ type: 'ARM_SOUND', payload: null });
    else if (state.selectedStreamId !== null || state.selectedPadKey !== null) {
      dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } });
    }
  };

  const menuSound = menu ? state.soundStreams.find(s => s.id === menu.id) ?? null : null;
  const hasGroups = groups.length > 0;
  const ungroupedVisible = visible.filter(s => !groupOf.get(s.id));

  return (
    <div data-testid="sounds-list" className="flex flex-col gap-0.5 min-h-full" onClick={handleBackgroundClick} onDragEnd={endReorder}>
      {state.soundStreams.length > 0 && (
        <SoundsHeader counts={counts} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
      )}

      {hasGroups ? (
        <>
          {groups.map(group => {
            const sounds = visible.filter(s => groupOf.get(s.id) === group.groupId);
            // A narrowed list leaves out groups with nothing to show.
            if (narrowed && sounds.length === 0) return null;
            return (
              <div key={group.groupId} className="flex flex-col gap-0.5" data-testid="sounds-section">
                <SoundGroupHeader
                  group={group}
                  count={sounds.length}
                  onToggleCollapse={() => dispatch({ type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: group.groupId })}
                  onRename={name => dispatch({ type: 'RENAME_LANE_GROUP', payload: { groupId: group.groupId, name } })}
                  onChangeColor={color => dispatch({ type: 'SET_LANE_GROUP_COLOR', payload: { groupId: group.groupId, color } })}
                  onDelete={() => dispatch({ type: 'DELETE_LANE_GROUP', payload: group.groupId })}
                  {...sectionProps(group.groupId)}
                />
                {!group.isCollapsed && sounds.map(renderRow)}
              </div>
            );
          })}
          {/* Every Sound in no group, placed or not (CLAUDE.md: "Ungrouped", never "On grid") */}
          {(ungroupedVisible.length > 0 || reordering !== null) && (
            <div className="flex flex-col gap-0.5" data-testid="sounds-section">
              <SoundGroupHeader group={null} count={ungroupedVisible.length} {...sectionProps(null)} />
              {ungroupedVisible.map(renderRow)}
            </div>
          )}
        </>
      ) : (
        /* No groups: a flat list, no section labels */
        visible.map(renderRow)
      )}

      {state.soundStreams.length === 0 && (
        <p className="text-pf-sm text-[var(--text-tertiary)] py-3 px-3 text-center">No Sounds yet. Import MIDI or build a pattern to add some.</p>
      )}
      {state.soundStreams.length > 0 && visible.length === 0 && (
        <p data-testid="sounds-none-match" className="text-pf-xs text-[var(--text-tertiary)] py-3 px-3 text-center">
          No Sounds {query.trim() ? `match "${query.trim()}"` : 'here'}{filter !== 'all' ? ' with this filter' : ''}.
        </p>
      )}

      {selectedStreamIds.size > 0 && (
        <SoundsSelectionBar ids={[...selectedStreamIds]} onClear={() => setSelectedStreamIds(new Set())} />
      )}

      {menu && menuSound && (
        <SoundRowMenu
          sound={menuSound}
          padKeys={placements.get(menuSound.id)?.padKeys ?? []}
          locked={placements.get(menuSound.id)?.locked ?? false}
          groupId={groupOf.get(menuSound.id) ?? null}
          x={menu.x}
          y={menu.y}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onRename={() => setRenamingId(menuSound.id)}
        />
      )}
    </div>
  );
}
