/**
 * Removing a Sound from a pad, with an Undo toast (T28 slice).
 *
 * Delete/Backspace no longer remove anything; removal is an explicit gesture
 * (the pad menu or the pad's ×), confirmed by "Removed Kick from [3,3] · Undo".
 * The toast's Undo reverts that removal only, and is withdrawn once another
 * step becomes the one Undo would revert (ProjectContext's undoable), even
 * after the menu that removed it has closed.
 */

import { formatPadPosition } from '../../utils/padPosition';
import { useCallback, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, isPadLocked } from '../state/projectState';
import { useReadOnlyHint } from './useReadOnlyHint';

export function useRemovePadWithUndo(): (padKey: string) => void {
  const { state, dispatch, undoable } = useProject();
  const { refuse: refuseEdit } = useReadOnlyHint();
  const stateRef = useRef(state);
  stateRef.current = state;

  return useCallback((padKey: string) => {
    // The layout on screen is read-only (S3.2): say how to edit it; nothing is removed.
    if (refuseEdit()) return;
    const layout = getDisplayedLayout(stateRef.current);
    const voice = layout?.padToVoice[padKey];
    if (!layout || !voice || isPadLocked(layout, padKey)) return;
    undoable(`Removed ${voice.name} from ${formatPadPosition(padKey)}`, () => {
      dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey } });
    });
  }, [dispatch, undoable, refuseEdit]);
}
