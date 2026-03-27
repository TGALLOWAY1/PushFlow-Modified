/**
 * useAutoSave Hook.
 *
 * Provides debounced autosave and explicit save for project state.
 * Tracks save status: 'saved' | 'saving' | 'unsaved'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ProjectState } from '../state/projectState';
import { saveProjectAsync } from '../persistence/projectStorage';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const AUTOSAVE_DELAY_MS = 2000; // 2 seconds after last change

interface UseAutoSaveResult {
  /** Current save status. */
  saveStatus: SaveStatus;
  /** Trigger an explicit save immediately. */
  saveNow: () => Promise<void>;
  /** Last save error message, if any. */
  saveError: string | null;
}

export function useAutoSave(state: ProjectState): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(state.updatedAt);
  const savingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Explicit save
  const saveNow = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      await saveProjectAsync(stateRef.current);
      lastSavedRef.current = stateRef.current.updatedAt;
      setSaveStatus('saved');
      setSaveError(null);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Detect meaningful changes and trigger autosave
  useEffect(() => {
    // Skip if no project loaded yet
    if (!state.id) return;

    // Check if state has changed since last save
    if (state.updatedAt !== lastSavedRef.current) {
      setSaveStatus('unsaved');

      // Clear previous timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule autosave
      timerRef.current = setTimeout(() => {
        if (!savingRef.current) {
          savingRef.current = true;
          setSaveStatus('saving');
          saveProjectAsync(stateRef.current)
            .then(() => {
              lastSavedRef.current = stateRef.current.updatedAt;
              setSaveStatus('saved');
              setSaveError(null);
            })
            .catch(err => {
              console.error('Autosave failed:', err);
              setSaveStatus('error');
              setSaveError(err instanceof Error ? err.message : 'Autosave failed');
            })
            .finally(() => {
              savingRef.current = false;
            });
        }
      }, AUTOSAVE_DELAY_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state.updatedAt, state.id]);

  // Save on unmount (navigating away)
  useEffect(() => {
    return () => {
      if (stateRef.current.id && stateRef.current.updatedAt !== lastSavedRef.current) {
        saveProjectAsync(stateRef.current).catch(() => {});
      }
    };
  }, []);

  return { saveStatus, saveNow, saveError };
}
