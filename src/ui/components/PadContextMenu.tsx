/**
 * PadContextMenu.
 *
 * Right-click context menu for grid pads: remove, lock, and the Sound's
 * "Hand & finger preference (soft)". The preference item opens the one
 * control's panel (S5.1, T19) in place of the menu, where the menu was; the
 * menu's own ten "L1 (Thumb)" items and its "(L2)" header are gone.
 */

import { useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout } from '../state/projectState';
import { Popover, useOverlayTitleId } from './shared/Overlay';
import { FingerPreferencePanel, fingerAssignmentLabel } from './shared/FingerAssignmentInput';
import { useRemovePadWithUndo } from '../hooks/useRemovePadWithUndo';
import { useFingerPreference } from '../hooks/useFingerPreference';
import { formatPadPosition } from '../../utils/padPosition';

interface PadContextMenuProps {
  padKey: string;
  x: number;
  y: number;
  onClose: () => void;
  /** The pad that opened the menu; focus returns to it on close. */
  returnFocusTo?: HTMLElement | null;
}

const ITEM = 'w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function PadContextMenu({ padKey, x, y, onClose, returnFocusTo }: PadContextMenuProps) {
  const { state, dispatch } = useProject();
  const layout = getDisplayedLayout(state);
  const titleId = useOverlayTitleId();
  const fingerTitleId = useOverlayTitleId();
  const removePad = useRemovePadWithUndo();
  const [showFinger, setShowFinger] = useState(false);

  const voice = layout?.padToVoice[padKey];
  const isLocked = !!voice && layout?.placementLocks[voice.id] === padKey;
  const finger = useFingerPreference(voice?.id);

  if (showFinger && voice) {
    return (
      <Popover
        x={x}
        y={y}
        role="dialog"
        labelledBy={fingerTitleId}
        onClose={onClose}
        returnFocusTo={returnFocusTo}
        testId="finger-preference-popover"
        className="rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl"
      >
        <FingerPreferencePanel {...finger} onDone={onClose} soundName={voice.name} titleId={fingerTitleId} />
      </Popover>
    );
  }

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
          className={ITEM}
          onClick={() => {
            removePad(padKey);
            onClose();
          }}
          disabled={isLocked}
          aria-disabled={isLocked}
          title={isLocked ? 'Locked · Unlock to remove' : undefined}
        >
          Remove from pad
        </button>
      )}

      {/* Placement lock */}
      {voice && (
        <button
          role="menuitem"
          className={ITEM}
          onClick={() => {
            dispatch({ type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: voice.id, padKey } });
            onClose();
          }}
        >
          {isLocked ? 'Unlock placement' : 'Lock to this pad'}
        </button>
      )}

      {/* The Sound's finger preference: the one control's panel */}
      {voice && (
        <button
          role="menuitem"
          data-testid="pad-menu-finger"
          className={`${ITEM} flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] mt-1`}
          onClick={() => setShowFinger(true)}
        >
          <span>Hand &amp; finger preference…</span>
          <span className="text-pf-xs font-mono text-[var(--text-tertiary)]">
            {finger.value ? fingerAssignmentLabel(finger.value) : 'Auto'}
          </span>
        </button>
      )}
    </Popover>
  );
}
