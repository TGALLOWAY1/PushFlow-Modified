/**
 * Undo/Redo hook.
 *
 * Wraps a reducer with past/future stacks of *document* snapshots. The state
 * also carries session data (analysis, transport, selection) that never enters
 * history: Undo and Redo swap the document back in under the current session.
 * A dispatch whose result leaves the document unchanged records nothing.
 *
 * The present state lives in a ref updated synchronously on every dispatch, so
 * several dispatches in one handler compose, and the stacks always pair with
 * the state they were taken from.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_HISTORY_SIZE = 50;

export interface UndoRedoControls<S> {
  state: S;
  dispatch: (action: { type: string; [key: string]: unknown }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Number of undo steps available. */
  undoDepth: number;
  /** Number of redo steps available. */
  redoDepth: number;
  clearHistory: () => void;
}

export interface UndoRedoOptions<S, D, A> {
  /** The undoable slice of a state. */
  pick: (state: S) => D;
  /** Whether two slices differ; equal slices record no history entry. */
  changed: (a: D, b: D) => boolean;
  /** Puts a slice back under the current state's session (Undo, Redo). */
  restore: (state: S, doc: D) => S;
  /**
   * Actions that never record an entry of their own. Any document change they
   * make folds into the current step (e.g. a derived sync after an edit).
   */
  isEphemeral?: (action: A) => boolean;
}

interface History<D> {
  past: D[];
  future: D[];
}

/**
 * Wraps a reducer with document-only undo/redo history.
 *
 * @param reducer The reducer function
 * @param initialState Initial state; a new value resets the history
 * @param options How to pick, compare and restore the undoable slice
 */
export function useUndoRedo<S, D, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  options: UndoRedoOptions<S, D, A>,
): UndoRedoControls<S> {
  const [present, setPresent] = useState<S>(initialState);
  const [history, setHistory] = useState<History<D>>({ past: [], future: [] });

  const presentRef = useRef(present);
  const historyRef = useRef(history);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const commit = useCallback((state: S, nextHistory: History<D>) => {
    presentRef.current = state;
    setPresent(state);
    if (nextHistory !== historyRef.current) {
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }
  }, []);

  const dispatch = useCallback((action: A) => {
    const { pick, changed, isEphemeral } = optionsRef.current;
    const prev = presentRef.current;
    const next = reducer(prev, action);
    if (next === prev) return;

    const h = historyRef.current;
    if (isEphemeral?.(action)) {
      commit(next, h);
      return;
    }
    const before = pick(prev);
    if (!changed(before, pick(next))) {
      commit(next, h);
      return;
    }
    const past = [...h.past, before];
    commit(next, {
      past: past.length > MAX_HISTORY_SIZE ? past.slice(-MAX_HISTORY_SIZE) : past,
      future: [],
    });
  }, [reducer, commit]);

  const undo = useCallback(() => {
    const { pick, restore } = optionsRef.current;
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const current = presentRef.current;
    const previous = h.past[h.past.length - 1];
    commit(restore(current, previous), {
      past: h.past.slice(0, -1),
      future: [pick(current), ...h.future],
    });
  }, [commit]);

  const redo = useCallback(() => {
    const { pick, restore } = optionsRef.current;
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const current = presentRef.current;
    const [next, ...future] = h.future;
    commit(restore(current, next), {
      past: [...h.past, pick(current)],
      future,
    });
  }, [commit]);

  const clearHistory = useCallback(() => {
    const empty = { past: [], future: [] };
    historyRef.current = empty;
    setHistory(empty);
  }, []);

  // Reset when initialState changes externally (e.g., loading a different project)
  const initialRef = useRef(initialState);
  useEffect(() => {
    if (initialRef.current === initialState) return;
    initialRef.current = initialState;
    presentRef.current = initialState;
    setPresent(initialState);
    clearHistory();
  }, [initialState, clearHistory]);

  return {
    state: present,
    dispatch: dispatch as UndoRedoControls<S>['dispatch'],
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoDepth: history.past.length,
    redoDepth: history.future.length,
    clearHistory,
  };
}
