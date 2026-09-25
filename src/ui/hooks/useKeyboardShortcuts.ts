/**
 * useKeyboardShortcuts.
 *
 * Global keyboard shortcuts for the project editor:
 * - Ctrl+S / Cmd+S: Save now
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Y / Cmd+Shift+Z: Redo
 * - Escape: Deselect event
 * - Arrow Left/Right: previous/next event, only while stopped
 *
 * Delete/Backspace no longer remove the selected event's pad (T28): a pad is
 * removed through its menu, its × or by dragging it off.
 */

import { useEffect } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan } from '../state/projectState';

export interface KeyboardShortcutOptions {
  /** Cmd/Ctrl+S: save now (T57). Without it the browser offers to save the page as HTML. */
  onSave?: () => void;
}

export function useKeyboardShortcuts({ onSave }: KeyboardShortcutOptions = {}) {
  const { state, dispatch, undo, redo } = useProject();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Save: Ctrl+S / Cmd+S, from an input too (the browser's own dialog
      // would otherwise open there as well).
      if (isMod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Shift+Z
      if ((isMod && e.key === 'y') || (isMod && e.shiftKey && e.key === 'z') || (isMod && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_EVENT', payload: null });
        return;
      }

      // Arrow Left/Right: Navigate through time steps (groups of simultaneous events)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // While playing, the arrows do nothing for now (T10/T61 slice; P4 makes
        // them seek by event). They used to jump the selection back to t=0.
        if (state.isPlaying) return;
        const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
        if (!assignments || assignments.length === 0) return;
        e.preventDefault();

        // Build sorted unique start times (time steps)
        const uniqueTimes = [...new Set(assignments.map(a => a.startTime))].sort((a, b) => a - b);
        if (uniqueTimes.length === 0) return;

        // Find the current time step from the selected event
        const selectedAssignment = state.selectedEventIndex !== null
          ? assignments.find(a => a.eventIndex === state.selectedEventIndex)
          : null;
        const currentTime = selectedAssignment?.startTime ?? null;

        let targetTime: number;
        if (currentTime === null) {
          targetTime = e.key === 'ArrowRight' ? uniqueTimes[0]! : uniqueTimes[uniqueTimes.length - 1]!;
        } else {
          const currentPos = uniqueTimes.indexOf(currentTime);
          if (e.key === 'ArrowRight') {
            const nextIdx = currentPos < uniqueTimes.length - 1 ? currentPos + 1 : 0;
            targetTime = uniqueTimes[nextIdx]!;
          } else {
            const prevIdx = currentPos > 0 ? currentPos - 1 : uniqueTimes.length - 1;
            targetTime = uniqueTimes[prevIdx]!;
          }
        }

        // Select the first event at the target time step
        const firstAtTime = assignments.find(a => a.startTime === targetTime);
        dispatch({ type: 'SELECT_EVENT', payload: firstAtTime?.eventIndex ?? null });
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state, dispatch, undo, redo, onSave]);
}
