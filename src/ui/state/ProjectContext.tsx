/**
 * Project Context.
 *
 * Provides project state + undo/redo to the component tree.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  type ProjectState,
  type ProjectAction,
  projectReducer,
  isEphemeralAction,
  createEmptyProjectState,
} from './projectState';
import { pickDocument, documentChanged, restoreDocument, candidatesRemovedBy } from './projectDocument';
import { historyLabelFor } from './historyLabels';
import { useUndoRedo, type UndoRedoOptions } from './useUndoRedo';
import { installE2EHook } from '../testing/e2eHook';
import { useToast } from '../components/shared/Toast';

interface ProjectContextValue {
  state: ProjectState;
  dispatch: (action: ProjectAction) => void;
  /**
   * Runs fn's dispatches as one undo step named label. Use it for every gesture
   * that dispatches more than once (an import, a grouping, a duplicate).
   */
  transact: (label: string, fn: () => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** What Undo would revert ("Discard"), or null. */
  undoLabel: string | null;
  /** What Redo would re-apply, or null. */
  redoLabel: string | null;
  /**
   * Runs `edit` (dispatches, or a transact) and, if it made an undo step,
   * shows `message` with an Undo that reverts that step and nothing else
   * ("Deleted Kick · Undo"). The toast goes as soon as another step is the one
   * Undo would revert, even after whatever showed it has closed (T28).
   */
  undoable: (message: string, edit: () => void) => void;
}

const HISTORY_OPTIONS: UndoRedoOptions<ProjectState, ReturnType<typeof pickDocument>, ProjectAction> = {
  pick: pickDocument,
  changed: documentChanged,
  restore: restoreDocument,
  returnOnUndo: candidatesRemovedBy,
  isEphemeral: isEphemeralAction,
  labelFor: historyLabelFor,
};

const ProjectContext = createContext<ProjectContextValue>({
  state: createEmptyProjectState(),
  dispatch: () => {},
  transact: (_label, fn) => fn(),
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  undoable: (_message, edit) => edit(),
});

export function ProjectProvider({
  initialState,
  children,
}: {
  initialState: ProjectState;
  children: React.ReactNode;
}) {
  const {
    state, dispatch, transact, undo: undoStep, redo: redoStep,
    canUndo, canRedo, undoDepth, redoDepth, undoLabel, redoLabel, undoStepId, lastStepId,
  } = useUndoRedo(
    projectReducer,
    initialState,
    HISTORY_OPTIONS,
  );

  // Undo and Redo say what they did. Only the latest undo toast keeps its Redo
  // button, so a Redo from a toast always re-applies the step that toast names.
  const toast = useToast();
  const undoToastRef = useRef<number | null>(null);
  const redo = useCallback(() => {
    const label = redoStep();
    if (!label) return;
    if (undoToastRef.current !== null) toast.dismiss(undoToastRef.current);
    undoToastRef.current = null;
    toast.show({ message: `Redone: ${label}` });
  }, [redoStep, toast]);
  const undo = useCallback(() => {
    const label = undoStep();
    if (!label) return;
    if (undoToastRef.current !== null) toast.dismiss(undoToastRef.current);
    undoToastRef.current = toast.show({ message: `Undone: ${label}`, action: { label: 'Redo', onClick: redo } });
  }, [undoStep, redo, toast]);

  // The toasts whose Undo reverts one step: toast id → the step's id. They are
  // kept here, not by the menu or bar that showed them, which often closes at
  // once; so a later edit still withdraws them, and a stale one never undoes
  // a step it doesn't name, even one with the same label.
  const stepToastsRef = useRef(new Map<number, number>());
  const undoable = useCallback((message: string, edit: () => void) => {
    const before = lastStepId();
    edit();
    const step = lastStepId();
    if (step === null || step === before) return;
    const id = toast.show({
      message,
      action: { label: 'Undo', onClick: () => { if (lastStepId() === step) undo(); } },
    });
    stepToastsRef.current.set(id, step);
  }, [lastStepId, toast, undo]);
  useEffect(() => {
    for (const [id, step] of stepToastsRef.current) {
      if (step === undoStepId) continue;
      toast.dismiss(id);
      stepToastsRef.current.delete(id);
    }
  }, [undoStepId, toast]);

  // E2E test hook (window.__pf). The env check is a build-time constant, so
  // production builds drop the hook module entirely.
  const e2eSourceRef = useRef({
    state: state as ProjectState,
    dispatch: dispatch as (action: ProjectAction) => void,
    undo: undoStep, redo: redoStep, undoDepth, redoDepth,
  });
  e2eSourceRef.current = {
    state: state as ProjectState,
    dispatch: dispatch as (action: ProjectAction) => void,
    undo: undoStep, redo: redoStep, undoDepth, redoDepth,
  };
  useEffect(() => {
    if (!import.meta.env.VITE_E2E) return;
    return installE2EHook(() => e2eSourceRef.current);
  }, []);

  const value = useMemo(
    () => ({
      state: state as ProjectState,
      dispatch: dispatch as (action: ProjectAction) => void,
      transact,
      undo,
      redo,
      canUndo,
      canRedo,
      undoLabel,
      redoLabel,
      undoable,
    }),
    [state, dispatch, transact, undo, redo, canUndo, canRedo, undoLabel, redoLabel, undoable],
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
