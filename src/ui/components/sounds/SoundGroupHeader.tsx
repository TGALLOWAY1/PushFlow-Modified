/**
 * A section heading in the Sounds panel (S5.1, T45): a group (collapse, its
 * colour, its name, how many Sounds, delete) or "Ungrouped" for the Sounds in
 * none. Section labels are only these: placement is a filter and a row pill,
 * never a section (CLAUDE.md Sound Grouping rules).
 *
 * A Sound dragged by its handle onto a heading joins that group, or leaves
 * every group on "Ungrouped".
 */

import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { type LaneGroup } from '../../../types/performanceLane';
import { Popover } from '../shared/Overlay';
import { ColorSwatches } from './ColorSwatches';
import { SOUND_REORDER_DRAG_TYPE } from '../dragTypes';

export function SoundGroupHeader({ group, count, onToggleCollapse, onRename, onChangeColor, onDelete, dropActive, onReorderOver, onReorderLeave, onReorderDrop }: {
  /** The group, or null for "Ungrouped". */
  group: LaneGroup | null;
  count: number;
  onToggleCollapse?: () => void;
  onRename?: (name: string) => void;
  onChangeColor?: (color: string) => void;
  onDelete?: () => void;
  /** A Sound is being dragged onto it by its handle. */
  dropActive: boolean;
  onReorderOver: () => void;
  onReorderLeave: () => void;
  onReorderDrop: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group?.name ?? '');
  const swatchRef = useRef<HTMLButtonElement>(null);
  const [colorAt, setColorAt] = useState<{ x: number; y: number } | null>(null);

  const commitName = () => {
    const trimmed = draft.trim();
    if (group && trimmed && trimmed !== group.name) onRename?.(trimmed);
    setEditing(false);
  };
  const label = group ? group.name : 'Ungrouped';

  return (
    <div
      data-testid="sound-group-header"
      data-group-id={group?.groupId ?? 'ungrouped'}
      data-drop-active={dropActive ? 'true' : undefined}
      className={`group flex items-center gap-1.5 px-2 py-1 mt-1.5 rounded-pf-sm transition-colors ${
        dropActive ? 'bg-accent-primary/15 ring-1 ring-accent-primary/60' : 'hover:bg-[var(--bg-hover)]'
      }`}
      onDragOver={e => {
        if (!e.dataTransfer.types.includes(SOUND_REORDER_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onReorderOver();
      }}
      onDragLeave={onReorderLeave}
      onDrop={e => {
        if (!e.dataTransfer.types.includes(SOUND_REORDER_DRAG_TYPE)) return;
        e.preventDefault();
        onReorderDrop();
      }}
    >
      {group && (
        <button
          type="button"
          className="focus-ring w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex-shrink-0"
          onClick={onToggleCollapse}
          aria-expanded={!group.isCollapsed}
          aria-label={group.isCollapsed ? `Show ${group.name}` : `Hide ${group.name}`}
        >
          {group.isCollapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        </button>
      )}

      {group && (
        <button
          ref={swatchRef}
          type="button"
          className="focus-ring w-2.5 h-2.5 rounded-sm flex-shrink-0 hover:ring-1 hover:ring-white/30"
          style={{ backgroundColor: group.color }}
          aria-label={`${group.name}'s colour`}
          title="Group colour: its Sounds without a colour of their own take it"
          onClick={() => {
            if (colorAt) { setColorAt(null); return; }
            const r = swatchRef.current?.getBoundingClientRect();
            if (r) setColorAt({ x: r.left, y: r.bottom + 4 });
          }}
        />
      )}

      {group && editing ? (
        <input
          className="pf-input flex-1 text-pf-xs font-medium min-w-0"
          aria-label={`Rename ${group.name}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span
          data-testid="sounds-section-label"
          role="heading"
          aria-level={4}
          tabIndex={group ? 0 : undefined}
          className={`flex-1 min-w-0 truncate text-pf-xs font-medium text-[var(--text-secondary)] ${group ? 'editable-field' : 'uppercase tracking-wider text-pf-micro'}`}
          onDoubleClick={group ? () => { setDraft(group.name); setEditing(true); } : undefined}
          onKeyDown={group ? e => { if (e.key === 'F2') { e.preventDefault(); setDraft(group.name); setEditing(true); } } : undefined}
          title={group ? 'Double-click or F2 to rename; drag a Sound\'s handle here to add it' : 'Sounds in no group; drag a Sound\'s handle here to take it out of its group'}
        >
          {label}
        </span>
      )}

      <span data-testid="sounds-section-count" className="text-pf-micro text-[var(--text-tertiary)] tabular-nums flex-shrink-0">{count}</span>

      {group && onDelete && (
        <button
          type="button"
          data-testid="sound-group-delete"
          className="focus-ring w-5 h-5 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${group.name} (its Sounds stay, ungrouped)`}
          title="Delete the group (its Sounds stay, ungrouped)"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}

      {group && colorAt && (
        <Popover
          x={colorAt.x}
          y={colorAt.y}
          role="dialog"
          ariaLabel={`${group.name}'s colour`}
          anchor={swatchRef.current}
          returnFocusTo={swatchRef.current}
          onClose={() => setColorAt(null)}
          className="p-2 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl"
        >
          <ColorSwatches value={group.color} onPick={color => { onChangeColor?.(color); setColorAt(null); }} />
        </Popover>
      )}
    </div>
  );
}
