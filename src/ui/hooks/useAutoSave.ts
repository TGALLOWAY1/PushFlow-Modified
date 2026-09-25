/**
 * useAutoSave Hook.
 *
 * Provides debounced autosave and explicit save for project state.
 * Tracks save status: 'saved' | 'saving' | 'unsaved' | 'error'.
 *
 * Truthful save (T57 slice): 'saved' is reported only after a write has
 * committed, and only for the state that was written. A failed write reports
 * 'error' and stays there until a save succeeds. An edit made while a write is
 * in flight is still 'unsaved' when the write lands, and the explicit save
 * waits for an in-flight write rather than being dropped. While anything is
 * pending, beforeunload warns and pagehide flushes a last write.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ProjectState } from '../state/projectState';
import { saveProjectAsync } from '../persistence/projectStorage';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const AUTOSAVE_DELAY_MS = 2000; // 2 seconds after last change

interface UseAutoSaveResult {
  /** Current save status. */
  saveStatus: SaveStatus;
  /** Saves now (after any write already in flight). Resolves once the save has settled. */
  saveNow: () => Promise<void>;
}

export function useAutoSave(state: ProjectState): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(state.updatedAt);
  /** The write in flight, if any; saves queue behind it. */
  const inFlightRef = useRef<Promise<void> | null>(null);
  /** updatedAt of the state that write is saving. */
  const writingRef = useRef<string | null>(null);
  const lastFailedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Writes the current state unless it is already saved. Never rejects: a
   * failure is reported through the status ('error'), and the console.
   */
  const write = useCallback(async () => {
    if (inFlightRef.current) await inFlightRef.current;
    const snapshot = stateRef.current;
    if (!snapshot.id) return;
    if (snapshot.updatedAt === lastSavedRef.current && !lastFailedRef.current) return;
    setSaveStatus('saving');
    writingRef.current = snapshot.updatedAt;
    const attempt = saveProjectAsync(snapshot)
      .then(() => {
        lastSavedRef.current = snapshot.updatedAt;
        lastFailedRef.current = false;
        // An edit made during the write is not saved yet: say so.
        setSaveStatus(stateRef.current.updatedAt === snapshot.updatedAt ? 'saved' : 'unsaved');
      })
      .catch(err => {
        console.error('Save failed:', err);
        lastFailedRef.current = true;
        setSaveStatus('error');
      })
      .finally(() => {
        if (inFlightRef.current === attempt) inFlightRef.current = null;
        if (writingRef.current === snapshot.updatedAt) writingRef.current = null;
      });
    inFlightRef.current = attempt;
    await attempt;
  }, []);

  // Explicit save (the toolbar's Save, Retry and Cmd/Ctrl+S).
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await write();
  }, [write]);

  // Detect meaningful changes and trigger autosave
  useEffect(() => {
    // Skip if no project loaded yet
    if (!state.id) return;

    // Check if state has changed since last save
    if (state.updatedAt !== lastSavedRef.current) {
      // A failed save stays red until a write succeeds; a new edit on top of it
      // is still an error the user has not recovered from.
      setSaveStatus(prev => (prev === 'error' ? 'error' : 'unsaved'));

      // Clear previous timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule autosave. write() waits for a save already in flight, so a
      // batch of edits made during a write is saved right after it.
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void write();
      }, AUTOSAVE_DELAY_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state.updatedAt, state.id, write]);

  // Save on unmount (navigating away) and on tab close/refresh. React unmount
  // does not run on browser unload, so without the pagehide flush any edit made
  // within the debounce window is silently lost on close or reload.
  useEffect(() => {
    const pending = () =>
      !!stateRef.current.id && (stateRef.current.updatedAt !== lastSavedRef.current || lastFailedRef.current);
    const flush = () => {
      if (pending()) saveProjectAsync(stateRef.current).catch(() => {});
    };
    // The browser's own "leave site?" prompt while a save is pending, so a
    // close or reload inside the debounce window (or after a failure) can be
    // cancelled instead of losing the last edits.
    const warn = (e: BeforeUnloadEvent) => {
      if (!pending()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', warn);
      // Leaving within the app (← Library saves first): a write of this very
      // state is already on its way, so don't save it, and re-stamp it, twice.
      if (writingRef.current !== null && writingRef.current === stateRef.current.updatedAt) return;
      flush();
    };
  }, []);

  return { saveStatus, saveNow };
}
