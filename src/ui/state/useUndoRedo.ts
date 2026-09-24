/**
 * Undo/Redo hook.
 *
 * Wraps a reducer with past/future stacks of *document* snapshots. The state
 * also carries session data (analysis, transport, selection) that never enters
 * history: Undo and Redo swap the document back in under the current session.
 * A dispatch whose result leaves the document unchanged records nothing.
 *
 * transact(label, fn) makes every dispatch inside fn one named step, so a
 * compound gesture (an import, a grouping, a duplicate) is undone in one press.
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
  /** Runs fn's dispatches as one undo step named label (nothing if they change nothing). */
  transact: (label: string, fn: () => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Number of undo steps available. */
  undoDepth: number;
  /** Number of redo steps available. */
  redoDepth: number;
  /** Name of the step Undo would revert, or null. */
  undoLabel: string | null;
  /** Name of the step Redo would re-apply, or null. */
  redoLabel: string | null;
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
  /** Name of the step a single recorded dispatch makes. */
  labelFor?: (action: A) => string;
}

interface Step<D> {
  doc: D;
  label: string;
}

interface History<D> {
  past: Step<D>[];
  future: Step<D>[];
}

interface Transaction<D> {
  before: D;
  label: string;
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
  const transactionRef = useRef<Transaction<D> | null>(null);

  const commit = useCallback((state: S, nextHistory: History<D>) => {
    presentRef.current = state;
    setPresent(state);
    if (nextHistory !== historyRef.current) {
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }
  }, []);

  /** Records `before` as a new step if the present document differs from it. */
  const record = useCallback((before: D, label: string) => {
    const { pick, changed } = optionsRef.current;
    if (!changed(before, pick(presentRef.current))) return;
    const past = [...historyRef.current.past, { doc: before, label }];
    const next = {
      past: past.length > MAX_HISTORY_SIZE ? past.slice(-MAX_HISTORY_SIZE) : past,
      future: [],
    };
    historyRef.current = next;
    setHistory(next);
  }, []);

  const dispatch = useCallback((action: A) => {
    const { pick, isEphemeral, labelFor } = optionsRef.current;
    const prev = presentRef.current;
    const next = reducer(prev, action);
    if (next === prev) return;

    if (transactionRef.current || isEphemeral?.(action)) {
      commit(next, historyRef.current);
      return;
    }
    const before = pick(prev);
    commit(next, historyRef.current);
    record(before, labelFor?.(action) ?? action.type);
  }, [reducer, commit, record]);

  const transact = useCallback((label: string, fn: () => void) => {
    // A nested transaction joins the outer one.
    if (transactionRef.current) {
      fn();
      return;
    }
    const tx = { before: optionsRef.current.pick(presentRef.current), label };
    transactionRef.current = tx;
    try {
      fn();
    } finally {
      transactionRef.current = null;
      record(tx.before, tx.label);
    }
  }, [record]);

  const undo = useCallback(() => {
    const { pick, restore } = optionsRef.current;
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const current = presentRef.current;
    const previous = h.past[h.past.length - 1];
    commit(restore(current, previous.doc), {
      past: h.past.slice(0, -1),
      future: [{ doc: pick(current), label: previous.label }, ...h.future],
    });
  }, [commit]);

  const redo = useCallback(() => {
    const { pick, restore } = optionsRef.current;
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const current = presentRef.current;
    const [next, ...future] = h.future;
    commit(restore(current, next.doc), {
      past: [...h.past, { doc: pick(current), label: next.label }],
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
    transact,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoDepth: history.past.length,
    redoDepth: history.future.length,
    undoLabel: history.past[history.past.length - 1]?.label ?? null,
    redoLabel: history.future[0]?.label ?? null,
    clearHistory,
  };
}
