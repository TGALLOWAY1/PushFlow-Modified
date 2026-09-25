/**
 * PadContextMenu.
 *
 * Right-click context menu for grid pads.
 * Options: set finger constraint, remove voice, view reachability.
 */

import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout } from '../state/projectState';
import { Popover, useOverlayTitleId } from './shared/Overlay';
import { useRemovePadWithUndo } from '../hooks/useRemovePadWithUndo';
import { formatPadPosition } from '../../utils/padPosition';

interface PadContextMenuProps {
  padKey: string;
  x: number;
  y: number;
  onClose: () => void;
  /** The pad that opened the menu; focus returns to it on close. */
  returnFocusTo?: HTMLElement | null;
}

const FINGER_OPTIONS = [
  { label: 'L1 (Thumb)', value: 'L1' },
  { label: 'L2 (Index)', value: 'L2' },
  { label: 'L3 (Middle)', value: 'L3' },
  { label: 'L4 (Ring)', value: 'L4' },
  { label: 'L5 (Pinky)', value: 'L5' },
  { label: 'R1 (Thumb)', value: 'R1' },
  { label: 'R2 (Index)', value: 'R2' },
  { label: 'R3 (Middle)', value: 'R3' },
  { label: 'R4 (Ring)', value: 'R4' },
  { label: 'R5 (Pinky)', value: 'R5' },
];

export function PadContextMenu({ padKey, x, y, onClose, returnFocusTo }: PadContextMenuProps) {
  const { state, dispatch } = useProject();
  const layout = getDisplayedLayout(state);
  const titleId = useOverlayTitleId();
  const removePad = useRemovePadWithUndo();

  const voice = layout?.padToVoice[padKey];
  const currentConstraint = layout?.fingerConstraints[padKey];
  const isLocked = !!voice && layout?.placementLocks[voice.id] === padKey;

  // Portalled to <body> and clamped inside the viewport by Popover (T06): it
  // opens at the cursor however the grid is scaled or filtered.
  return (
    <Popover
      x={x}
      y={y}
      onClose={onClose}
      role="menu"
      labelledBy={titleId}
      returnFocusTo={returnFocusTo}
      testId="pad-menu"
      className="flex flex-col bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl py-1 min-w-[160px]"
    >
      {/* Header */}
      <div id={titleId} className="px-3 py-1.5 text-pf-xs text-[var(--text-tertiary)] border-b border-[var(--border-subtle)]">
        {formatPadPosition(padKey)} {voice ? `· ${voice.name}` : '· empty'}
      </div>

      {/* Remove voice; refused while the Sound is locked to this pad (canon section 11) */}
      {voice && (
        <button
          role="menuitem"
          className="w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            removePad(padKey);
            onClose();
          }}
          disabled={isLocked}
          aria-disabled={isLocked}
          title={isLocked ? 'Locked \u00b7 Unlock to remove' : undefined}
        >
          Remove from pad
        </button>
      )}

      {/* Placement lock */}
      {voice && (
        <button
          role="menuitem"
          className="w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={() => {
            dispatch({ type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: voice.id, padKey } });
            onClose();
          }}
        >
          {isLocked ? 'Unlock placement' : 'Lock to this pad'}
        </button>
      )}

      {/* Finger constraint */}
      {voice && (
        <>
          <div className="px-3 py-1 text-pf-xs text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] mt-1">
            Finger Constraint {currentConstraint && `(${currentConstraint})`}
          </div>
          {FINGER_OPTIONS.map(opt => (
            <button
              role="menuitem"
              key={opt.value}
              className={`w-full px-3 py-1 text-left text-pf-sm hover:bg-[var(--bg-hover)] transition-colors ${
                currentConstraint === opt.value ? 'text-purple-300' : 'text-[var(--text-secondary)]'
              }`}
              onClick={() => {
                dispatch({
                  type: 'SET_FINGER_CONSTRAINT',
                  payload: {
                    padKey,
                    constraint: currentConstraint === opt.value ? null : opt.value,
                  },
                });
                onClose();
              }}
            >
              {currentConstraint === opt.value ? '* ' : '  '}{opt.label}
            </button>
          ))}
          {currentConstraint && (
            <button
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-pf-sm text-amber-400 hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border-subtle)]"
              onClick={() => {
                dispatch({
                  type: 'SET_FINGER_CONSTRAINT',
                  payload: { padKey, constraint: null },
                });
                onClose();
              }}
            >
              Clear constraint
            </button>
          )}
        </>
      )}
    </Popover>
  );
}
