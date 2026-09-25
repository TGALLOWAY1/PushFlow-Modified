/**
 * useKeyboardShortcuts.
 *
 * The editor's handlers for the input table's key rows (src/ui/input/
 * inputTable.ts), bound through the one listener (inputRegistry.ts):
 * - Mod+S saves now; Mod+Z undoes; Mod+Shift+Z or Mod+Y redoes;
 * - Space plays and stops (the Composer binds its own while its tab is open);
 * - ←/→ select the previous or next event while stopped, stopping at the ends;
 * - Escape steps back one layer: the armed Sound, then the pad selection, then
 *   the event (an open overlay closes itself first);
 * - Delete/Backspace take the selected pad's Sound off the grid, with Undo;
 *   with no pad selected they do nothing (T28);
 * - '?' opens the shortcut sheet.
 */

import { useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan, getDisplayedLayout, isPadLocked } from '../state/projectState';
import { useInputHandler } from '../input/inputRegistry';
import { useRemovePadWithUndo } from './useRemovePadWithUndo';
import { useToast } from '../components/shared/Toast';

export interface KeyboardShortcutOptions {
  /** Cmd/Ctrl+S: save now (T57). Without it the browser offers to save the page as HTML. */
  onSave?: () => void;
  /** '?': the shortcut sheet. */
  onOpenShortcuts?: () => void;
}

export function useKeyboardShortcuts({ onSave, onOpenShortcuts }: KeyboardShortcutOptions = {}) {
  const { state, dispatch, undo, redo } = useProject();
  const removePad = useRemovePadWithUndo();
  const toast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;

  useInputHandler('save', () => {
    // Handled even without onSave, so the browser never offers to save the page.
    onSave?.();
  });

  useInputHandler('undo', () => undo());
  useInputHandler('redo', () => redo());

  useInputHandler('space', () => {
    dispatch({ type: 'TOGGLE_PLAYING' });
  });

  useInputHandler('step-events', e => {
    const s = stateRef.current;
    // While playing, the arrows do nothing for now (T10/T61 slice; P4 makes
    // them seek by event).
    if (s.isPlaying) return false;
    const assignments = getDisplayedExecutionPlan(s)?.fingerAssignments;
    if (!assignments || assignments.length === 0) return false;

    // Events are the distinct start times (everything struck at one instant).
    const times = [...new Set(assignments.map(a => a.startTime))].sort((a, b) => a - b);
    const selected = s.selectedEventIndex !== null
      ? assignments.find(a => a.eventIndex === s.selectedEventIndex)
      : undefined;
    const position = selected ? times.indexOf(selected.startTime) : -1;
    const forward = e.key === 'ArrowRight';
    const target = position < 0
      ? (forward ? 0 : times.length - 1)
      : Math.min(times.length - 1, Math.max(0, position + (forward ? 1 : -1)));
    // At the first or last event the selection stays put: no wrapping.
    const first = assignments.find(a => a.startTime === times[target]);
    dispatch({ type: 'SELECT_EVENT', payload: first?.eventIndex ?? null });
  });

  useInputHandler('escape', () => {
    const s = stateRef.current;
    if (s.armedStreamId !== null) {
      dispatch({ type: 'ARM_SOUND', payload: null });
      return;
    }
    if (s.selectedPadKey !== null || s.selectedStreamId !== null) {
      dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } });
      return;
    }
    if (s.selectedEventIndex !== null) {
      dispatch({ type: 'SELECT_EVENT', payload: null });
      return;
    }
    return false;
  });

  useInputHandler('delete', () => {
    const s = stateRef.current;
    const padKey = s.selectedPadKey;
    const layout = getDisplayedLayout(s);
    const voice = padKey ? layout?.padToVoice[padKey] : undefined;
    if (!padKey || !layout || !voice) return false;
    if (isPadLocked(layout, padKey)) {
      toast.show({ message: `${voice.name} is locked · Unlock it to remove it`, durationMs: 4000 });
      return;
    }
    removePad(padKey);
    dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } });
  });

  useInputHandler('shortcut-sheet', () => {
    if (!onOpenShortcuts) return false;
    onOpenShortcuts();
  });
}
