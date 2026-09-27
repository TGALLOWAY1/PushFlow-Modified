/**
 * "Deleted Kick · Undo" (S5.1): a toast for the edit just made, whose Undo
 * reverts exactly that edit. The Undo is withdrawn once another step becomes
 * the one Undo would revert, so it can never undo something else (T28, as
 * useRemovePadWithUndo does for Remove).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { useToast } from '../components/shared/Toast';

/**
 * Returns show(message, label): call it right after recording a step named
 * `label` (its history label, or the transact() name).
 */
export function useUndoToast(): (message: string, label: string) => void {
  const { undo, undoLabel } = useProject();
  const toast = useToast();
  const shown = useRef<{ id: number; label: string } | null>(null);

  useEffect(() => {
    if (shown.current && undoLabel !== shown.current.label) {
      toast.dismiss(shown.current.id);
      shown.current = null;
    }
  }, [undoLabel, toast]);

  return useCallback((message: string, label: string) => {
    if (shown.current) toast.dismiss(shown.current.id);
    shown.current = { id: toast.show({ message, action: { label: 'Undo', onClick: undo } }), label };
  }, [toast, undo]);
}
