/**
 * One Sound in the Sounds panel (S5.1, T45).
 *
 * Its colour and name (double-click, F2, Enter or the pencil renames it), where
 * it is ("To place", or its pad "R4 C4" with a lock toggle), how many hits it
 * has, its "Hand & finger preference (soft)", Solo and Mute, and a "⋯" menu.
 * A plain click arms it for click-to-place (T62); a Mod- or Shift-click selects
 * it with others. Drag the row onto a pad to place it; drag its handle to
 * reorder it or move it into a group (S5.1, T46).
 */

import { useEffect, useRef, useState } from 'react';
import { Crosshair, GripVertical, Lock, MoreHorizontal, Pencil, Unlock } from 'lucide-react';
import { type SoundStream } from '../../state/projectState';
import { type SoundPlacement } from '../../analysis/soundPlacement';
import { type PlanFingers } from '../../analysis/planFingers';
import { formatPadLocator, formatPadPosition } from '../../../utils/padPosition';
import { withoutSharedPrefix } from '../../analysis/padLabels';
import { FingerAssignmentInput, type FingerAssignmentValue } from '../shared/FingerAssignmentInput';
import { SOUND_REORDER_DRAG_TYPE } from '../dragTypes';

export type DropSide = 'before' | 'after';

export interface SoundRowProps {
  sound: SoundStream;
  /** The words every Sound's name starts with (padLabels.sharedNamePrefix): dimmed, and cut first when the row is narrow. */
  namePrefix: string;
  placement: SoundPlacement;
  /** Indented under a group heading. */
  isGrouped: boolean;
  preference: FingerAssignmentValue | null;
  fingerPlan: PlanFingers | null;
  onSetPreference: (value: FingerAssignmentValue | null) => void;
  /** Selected with others (Mod- or Shift-click), for the selection bar and Mod+G. */
  isSelected: boolean;
  /** The Sound selected across panels. */
  isGlobalSelected: boolean;
  /** Armed for click-to-place: the next click on an empty pad places it. */
  isArmed: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  isRenaming: boolean;
  onStartRename: () => void;
  /** The rename ended: `name` to apply (null for none), and whether to move on to the next or previous Sound. */
  onRenameDone: (name: string | null, move: 'next' | 'prev' | null) => void;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onSolo: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
  /** Starts dragging it onto the grid. */
  onDragStart: (e: React.DragEvent) => void;
  onReorderStart: () => void;
  onReorderEnd: () => void;
  /** A reorder drag over this row: which side it would land on, or null when it isn't one. */
  dropSide: DropSide | null;
  onReorderOver: (side: DropSide) => void;
  onReorderDrop: (side: DropSide) => void;
}

function sideOf(e: React.DragEvent<HTMLElement>): DropSide {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'before' : 'after';
}

export function SoundRow({
  sound, namePrefix, placement, isGrouped, preference, fingerPlan, onSetPreference,
  isSelected, isGlobalSelected, isArmed, onSelect,
  isRenaming, onStartRename, onRenameDone,
  onToggleLock, onToggleMute, onSolo, onOpenMenu,
  onDragStart, onReorderStart, onReorderEnd, dropSide, onReorderOver, onReorderDrop,
}: SoundRowProps) {
  const [nameDraft, setNameDraft] = useState(sound.name);
  const nameRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  // One ending per rename: Enter, Tab or Escape end it before the input's blur does.
  const renameDone = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setNameDraft(sound.name);
      renameDone.current = false;
    }
    // Only when a rename starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming]);

  const finishRename = (move: 'next' | 'prev' | null, apply: boolean, refocus: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    const trimmed = nameDraft.trim();
    onRenameDone(apply && trimmed && trimmed !== sound.name ? trimmed : null, move);
    // Ended from the keyboard without moving on: keep focus on this Sound.
    if (refocus && !move) requestAnimationFrame(() => nameRef.current?.focus());
  };

  const { padKeys, locked } = placement;
  const rest = withoutSharedPrefix(sound.name, namePrefix);
  const prefix = rest === sound.name ? '' : sound.name.slice(0, sound.name.length - rest.length);
  const placed = padKeys.length > 0;
  const hits = sound.events.length;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      data-testid="sound-row"
      data-sound-id={sound.id}
      data-armed={isArmed ? 'true' : undefined}
      data-placement={placed ? 'on-grid' : 'to-place'}
      className={`
        group relative flex items-center gap-1 py-1 pr-1.5 rounded-pf-sm text-pf-sm select-none
        border transition-colors duration-fast
        cursor-grab active:cursor-grabbing
        ${isGrouped ? 'pl-6' : 'pl-3.5'}
        ${sound.muted ? 'opacity-35' : ''}
        ${isArmed
          ? 'border-accent-primary bg-[var(--accent-muted)] ring-1 ring-accent-primary/60'
          : isGlobalSelected
          ? 'border-accent-primary/40 bg-[var(--accent-muted)] ring-1 ring-accent-primary/20'
          : isSelected
            ? 'border-accent-primary/25 bg-[var(--accent-muted)]'
            : 'border-transparent hover:bg-[var(--bg-hover)]'
        }
      `}
      draggable={!isRenaming}
      onDragStart={e => {
        // A drag from the handle reorders; it isn't a Sound on its way to a pad.
        if ((e.target as Element).closest('[data-reorder-handle]')) return;
        onDragStart(e);
      }}
      onDragOver={e => {
        if (!e.dataTransfer.types.includes(SOUND_REORDER_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onReorderOver(sideOf(e));
      }}
      onDrop={e => {
        if (!e.dataTransfer.types.includes(SOUND_REORDER_DRAG_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        onReorderDrop(sideOf(e));
      }}
      onClick={e => onSelect(sound.id, e)}
    >
      {/* Where a reorder drag would put it */}
      {dropSide && (
        <div
          data-testid="sound-drop-line"
          aria-hidden="true"
          className={`absolute left-1 right-1 h-0.5 rounded-full bg-accent-primary pointer-events-none ${dropSide === 'before' ? '-top-px' : '-bottom-px'}`}
        />
      )}

      {/* The handle: the only way to reorder (T46) */}
      <span
        data-reorder-handle=""
        data-testid="sound-reorder-handle"
        draggable
        title="Drag to reorder, or onto a group's heading"
        aria-hidden="true"
        className={`absolute ${isGrouped ? 'left-2.5' : 'left-0.5'} top-1/2 -translate-y-1/2 flex items-center text-[var(--text-tertiary)] cursor-grab opacity-0 group-hover:opacity-100 transition-opacity`}
        onDragStart={e => {
          e.stopPropagation();
          e.dataTransfer.setData(SOUND_REORDER_DRAG_TYPE, sound.id);
          e.dataTransfer.effectAllowed = 'move';
          onReorderStart();
        }}
        onDragEnd={onReorderEnd}
      >
        <GripVertical size={11} />
      </span>

      <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sound.color }} />

      {/* Name: double-click, F2, Enter or the pencil renames it (T17) */}
      {isRenaming ? (
        <input
          data-testid="sound-rename-input"
          aria-label={`Rename ${sound.name}`}
          className="pf-input flex-1 text-pf-sm font-medium min-w-0"
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={() => finishRename(null, true, false)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); finishRename('next', true, true); }
            else if (e.key === 'Tab') { e.preventDefault(); finishRename(e.shiftKey ? 'prev' : 'next', true, true); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishRename(null, false, true); }
          }}
          onClick={stop}
          onMouseDown={stop}
          autoFocus
          onFocus={e => e.currentTarget.select()}
        />
      ) : (
        <>
          <span
            ref={nameRef}
            data-testid="sound-name"
            tabIndex={0}
            className="flex-1 min-w-0 flex text-[var(--text-primary)] font-medium cursor-text text-pf-sm rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-400"
            onDoubleClick={e => { e.stopPropagation(); onStartRename(); }}
            onKeyDown={e => {
              if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onStartRename(); }
            }}
            title={`${sound.name}${sound.shortLabel ? ` · pads show "${sound.shortLabel}"` : ''} · double-click, F2 or Enter to rename`}
          >
            {/* What tells it apart stays; the words every Sound shares give way first (T17). */}
            {prefix ? (
              <>
                <span className="min-w-0 truncate text-[var(--text-tertiary)] whitespace-pre">{prefix}</span>
                <span className="flex-shrink-0 max-w-full truncate">{rest}</span>
              </>
            ) : (
              <span className="min-w-0 truncate">{sound.name}</span>
            )}
          </span>
          <button
            type="button"
            data-testid="sound-rename"
            className="hidden group-hover:flex group-focus-within:flex flex-shrink-0 w-5 h-5 items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            onClick={e => { e.stopPropagation(); onStartRename(); }}
            onMouseDown={stop}
            aria-label={`Rename ${sound.name}`}
            title="Rename"
          >
            <Pencil size={11} aria-hidden="true" />
          </button>
        </>
      )}

      {/* Armed for click-to-place (T62) */}
      {isArmed && (
        <span
          data-testid="sound-armed"
          className="flex-shrink-0 flex items-center text-accent-primary-soft"
          title={placed ? 'Armed · click an empty pad to move it there' : 'Armed · click an empty pad to place it'}
        >
          <Crosshair size={12} aria-hidden="true" />
          <span className="sr-only">Armed for placing</span>
        </span>
      )}

      {/* Where it is: its pad (and lock), or "To place" (T45: never a section label) */}
      {placed ? (
        <span className="flex-shrink-0 flex items-center">
          <button
            type="button"
            data-testid="sound-lock"
            aria-pressed={locked}
            aria-label={locked ? `Unlock ${sound.name}` : `Lock ${sound.name} to ${formatPadPosition(padKeys[0]!)}`}
            title={locked ? 'Locked · click to unlock: generation may move it' : `Lock it to ${formatPadPosition(padKeys[0]!)}: every generation method keeps it there`}
            className={`focus-ring w-5 h-5 items-center justify-center rounded-pf-sm hover:bg-[var(--bg-hover)] ${
              locked ? 'flex text-amber-400' : 'hidden group-hover:flex group-focus-within:flex text-[var(--text-tertiary)]'
            }`}
            onClick={e => { e.stopPropagation(); onToggleLock(); }}
            onMouseDown={stop}
          >
            {locked ? <Lock size={11} aria-hidden="true" /> : <Unlock size={11} aria-hidden="true" />}
          </button>
          <span
            data-testid="sound-pad-locator"
            className="text-pf-xs text-[var(--text-secondary)] font-mono tabular-nums whitespace-nowrap"
            title={padKeys.map(formatPadPosition).join(', ')}
          >
            {formatPadLocator(padKeys[0]!)}
            {padKeys.length > 1 && `+${padKeys.length - 1}`}
          </span>
        </span>
      ) : (
        <span
          data-testid="sound-to-place"
          className="flex-shrink-0 px-1.5 h-[18px] inline-flex items-center rounded-full border border-dashed border-[var(--border-strong)] text-pf-micro text-[var(--text-secondary)] whitespace-nowrap"
          title="Not on the grid yet: click it, then a pad; or drag it onto one"
        >
          To place
        </span>
      )}

      <span
        data-testid="sound-hits"
        className="flex-shrink-0 min-w-[1rem] text-right text-pf-micro text-[var(--text-tertiary)] tabular-nums"
        title={`${hits} ${hits === 1 ? 'hit' : 'hits'}`}
        aria-label={`${hits} ${hits === 1 ? 'hit' : 'hits'}`}
      >
        {hits}
      </span>

      {/* Its "Hand & finger preference (soft)": the one control (S5.1) */}
      <span className="flex-shrink-0 flex" onClick={stop} onMouseDown={stop}>
        <FingerAssignmentInput
          value={preference}
          plan={fingerPlan}
          onChange={onSetPreference}
          soundName={sound.name}
          size="md"
          testId="sound-finger"
        />
      </span>

      <button
        type="button"
        data-testid="sound-solo"
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-pf-xs transition-colors bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:bg-amber-500/15 hover:text-amber-400 border border-transparent hover:border-amber-500/20"
        onClick={e => { e.stopPropagation(); onSolo(); }}
        onMouseDown={stop}
        aria-label={`Solo ${sound.name}`}
        title="Solo"
      >
        S
      </button>
      <button
        type="button"
        data-testid="sound-mute"
        aria-pressed={sound.muted}
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-pf-xs transition-colors ${sound.muted
          ? 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
          : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`}
        onClick={e => { e.stopPropagation(); onToggleMute(); }}
        onMouseDown={stop}
        aria-label={`Mute ${sound.name}`}
        title={sound.muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>

      <button
        ref={menuRef}
        type="button"
        data-testid="sound-menu-button"
        aria-haspopup="dialog"
        aria-label={`More for ${sound.name}`}
        title="Rename, colour, group, short label, unplace, delete"
        className="focus-ring flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        onClick={e => { e.stopPropagation(); if (menuRef.current) onOpenMenu(menuRef.current); }}
        onMouseDown={stop}
      >
        <MoreHorizontal size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
