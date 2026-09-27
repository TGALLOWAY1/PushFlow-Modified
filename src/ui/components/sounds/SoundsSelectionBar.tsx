/**
 * The Sounds panel's selection bar (S5.1, T45): with Sounds selected by Mod-
 * or Shift-click, Group (or Ungroup, as Mod+G), Colour and Unplace act on all
 * of them, each as one undo step.
 */

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { getInspectedLayout, isPadLocked } from '../../state/projectState';
import { useReadOnlyHint } from '../../hooks/useReadOnlyHint';
import { Popover } from '../shared/Overlay';
import { ColorSwatches } from './ColorSwatches';
import { allInOneGroup, useSoundGrouping } from './soundGroups';

const ACTION = 'focus-ring h-6 px-2 rounded-pf-sm border border-[var(--border-default)] text-pf-micro font-semibold text-[var(--text-secondary)] enabled:hover:bg-[var(--bg-hover)] enabled:hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed';

export function SoundsSelectionBar({ ids, onClear }: { ids: readonly string[]; onClear: () => void }) {
  const { state, dispatch, transact, undoable } = useProject();
  const grouping = useSoundGrouping();
  const { refuse } = useReadOnlyHint();
  const colorRef = useRef<HTMLButtonElement>(null);
  const [colorAt, setColorAt] = useState<{ x: number; y: number } | null>(null);

  const layout = getInspectedLayout(state);
  // The pads of the selected Sounds that can come off: placed and not locked.
  const unplaceable = Object.entries(layout.padToVoice)
    .filter(([padKey, voice]) => ids.includes(voice.id) && !isPadLocked(layout, padKey))
    .map(([padKey]) => padKey);
  const ungroup = allInOneGroup(state, ids);
  const mod = typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

  return (
    <div
      role="toolbar"
      aria-label={`${ids.length} selected Sounds`}
      data-testid="sounds-selection-bar"
      className="sticky bottom-0 z-10 -mx-2.5 -mb-2.5 mt-2 px-2.5 py-2 bg-[var(--bg-panel)] border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-1.5"
    >
      <span className="text-pf-xs text-[var(--accent-primary-soft)] mr-auto">{ids.length} selected</span>
      <button
        type="button"
        data-testid="sounds-selection-group"
        className={ACTION}
        title={`${ungroup ? 'Take them out of their group' : 'Put them in a new group'} (${mod}+G)`}
        onClick={() => { grouping.toggleGroup(ids); onClear(); }}
      >
        {ungroup ? 'Ungroup' : 'Group'}
      </button>
      <button
        ref={colorRef}
        type="button"
        data-testid="sounds-selection-color"
        aria-haspopup="dialog"
        className={ACTION}
        onClick={() => {
          if (colorAt) { setColorAt(null); return; }
          const r = colorRef.current?.getBoundingClientRect();
          if (r) setColorAt({ x: r.left, y: r.top - 8 - 68 });
        }}
      >
        Colour
      </button>
      <button
        type="button"
        data-testid="sounds-selection-unplace"
        className={ACTION}
        disabled={unplaceable.length === 0}
        title={unplaceable.length === 0 ? 'None of them is on the grid unlocked' : 'Take them off the grid, back to To place (with Undo)'}
        onClick={() => {
          if (refuse()) return;
          undoable(`Unplaced ${unplaceable.length} ${unplaceable.length === 1 ? 'Sound' : 'Sounds'}`, () => transact('Unplace Sounds', () => {
            for (const padKey of unplaceable) dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey } });
          }));
          onClear();
        }}
      >
        Unplace
      </button>
      <button
        type="button"
        data-testid="sounds-selection-clear"
        className="focus-ring w-6 h-6 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        aria-label="Clear the selection"
        title="Clear the selection (Esc)"
        onClick={onClear}
      >
        <X size={12} aria-hidden="true" />
      </button>

      {colorAt && (
        <Popover
          x={colorAt.x}
          y={colorAt.y}
          role="dialog"
          ariaLabel="Colour the selected Sounds"
          anchor={colorRef.current}
          returnFocusTo={colorRef.current}
          onClose={() => setColorAt(null)}
          className="p-2 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl"
        >
          <ColorSwatches
            onPick={color => {
              transact('Sound color', () => {
                for (const id of ids) dispatch({ type: 'SET_SOUND_COLOR', payload: { streamId: id, color } });
              });
              setColorAt(null);
            }}
          />
        </Popover>
      )}
    </div>
  );
}
