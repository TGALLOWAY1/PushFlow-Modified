/**
 * Undo/Redo hook.
 *
 * Wraps a React reducer with past/present/future state stacks.
 * Ported from Version1/src/hooks/useProjectHistory.ts.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_HISTORY_SIZE = 50;

export interface UndoRedoControls<S> {
  state: S;
  dispatch: (action: { type: string; [key: string]: unknown }, skipHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

/**
 * Wraps a reducer with undo/redo history.
 *
 * @param reducer The reducer function
 * @param initialState Initial state
 * @param isEphemeral Predicate: actions returning true skip the history stack
 */
export function useUndoRedo<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  isEphemeral?: (action: A) => boolean,
): UndoRedoControls<S> {
  const [past, setPast] = useState<S[]>([]);
  const [present, setPresent] = useState<S>(initialState);
  const [future, setFuture] = useState<S[]>([]);

  const isUndoingRef = useRef(false);
  const isRedoingRef = useRef(false);
  const presentRef = useRef(present);
  presentRef.current = present;

  const dispatch = useCallback((action: A, skipHistory = false) => {
    const shouldSkip = skipHistory || isUndoingRef.current || isRedoingRef.current || (isEphemeral?.(action) ?? false);

    if (shouldSkip) {
      setPresent(prev => reducer(prev, action));
      return;
    }

    const currentPresent = presentRef.current;
    setPast(prevPast => {
      const newPast = [...prevPast, currentPresent];
      return newPast.length > MAX_HISTORY_SIZE ? newPast.slice(-MAX_HISTORY_SIZE) : newPast;
    });
    setFuture([]);
    setPresent(prev => reducer(prev, action));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducer, isEphemeral]);

  const undo = useCallback(() => {
    setPast(prevPast => {
      if (prevPast.length === 0) return prevPast;

      isUndoingRef.current = true;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, -1);

      const currentPresent = presentRef.current;
      setFuture(prevFuture => [currentPresent, ...prevFuture]);
      setPresent(previous);

      setTimeout(() => { isUndoingRef.current = false; }, 0);
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;

      isRedoingRef.current = true;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      const currentPresent = presentRef.current;
      setPast(prevPast => [...prevPast, currentPresent]);
      setPresent(next);

      setTimeout(() => { isRedoingRef.current = false; }, 0);
      return newFuture;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Reset when initialState changes externally (e.g., loading a different project)
  useEffect(() => {
    if (!isUndoingRef.current && !isRedoingRef.current) {
      setPresent(initialState);
      clearHistory();
    }
  }, [initialState, clearHistory]);

  return {
    state: present,
    dispatch: dispatch as UndoRedoControls<S>['dispatch'],
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearHistory,
  };
}
