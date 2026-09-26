/**
 * Removing a Sound from a pad, with an Undo toast (T28 slice).
 *
 * Delete/Backspace no longer remove anything; removal is an explicit gesture
 * (the pad menu or the pad's ×), confirmed by "Removed Kick from [3,3] · Undo".
 * The toast's Undo is withdrawn once another step becomes the one Undo would
 * revert, so it can never undo something else.
 */

import { formatPadPosition } from '../../utils/padPosition';
import { useCallback, useEffect, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { useToast } from '../components/shared/Toast';
import { getDisplayedLayout, isPadLocked } from '../state/projectState';
import { historyLabelFor } from '../state/historyLabels';
import { useReadOnlyHint } from './useReadOnlyHint';

const REMOVE_LABEL = historyLabelFor({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: '' } });

export function useRemovePadWithUndo(): (padKey: string) => void {
  const { state, dispatch, undo, undoLabel } = useProject();
  const toast = useToast();
  const { refuse: refuseEdit } = useReadOnlyHint();
  const toastRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (toastRef.current !== null && undoLabel !== REMOVE_LABEL) {
      toast.dismiss(toastRef.current);
      toastRef.current = null;
    }
  }, [undoLabel, toast]);

  return useCallback((padKey: string) => {
    // The layout on screen is read-only (S3.2): say how to edit it; nothing is removed.
    if (refuseEdit()) return;
    const layout = getDisplayedLayout(stateRef.current);
    const voice = layout?.padToVoice[padKey];
    if (!layout || !voice || isPadLocked(layout, padKey)) return;
    dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey } });
    if (toastRef.current !== null) toast.dismiss(toastRef.current);
    toastRef.current = toast.show({
      message: `Removed ${voice.name} from ${formatPadPosition(padKey)}`,
      action: { label: 'Undo', onClick: undo },
    });
  }, [dispatch, toast, undo, refuseEdit]);
}
