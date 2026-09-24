/**
 * Project Context.
 *
 * Provides project state + undo/redo to the component tree.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import {
  type ProjectState,
  type ProjectAction,
  projectReducer,
  isEphemeralAction,
  createEmptyProjectState,
} from './projectState';
import { pickDocument, documentChanged, restoreDocument } from './projectDocument';
import { useUndoRedo, type UndoRedoOptions } from './useUndoRedo';
import { installE2EHook } from '../testing/e2eHook';

interface ProjectContextValue {
  state: ProjectState;
  dispatch: (action: ProjectAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HISTORY_OPTIONS: UndoRedoOptions<ProjectState, ReturnType<typeof pickDocument>, ProjectAction> = {
  pick: pickDocument,
  changed: documentChanged,
  restore: restoreDocument,
  isEphemeral: isEphemeralAction,
};

const ProjectContext = createContext<ProjectContextValue>({
  state: createEmptyProjectState(),
  dispatch: () => {},
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
});

export function ProjectProvider({
  initialState,
  children,
}: {
  initialState: ProjectState;
  children: React.ReactNode;
}) {
  const { state, dispatch, undo, redo, canUndo, canRedo, undoDepth, redoDepth } = useUndoRedo(
    projectReducer,
    initialState,
    HISTORY_OPTIONS,
  );

  // E2E test hook (window.__pf). The env check is a build-time constant, so
  // production builds drop the hook module entirely.
  const e2eSourceRef = useRef({
    state: state as ProjectState,
    dispatch: dispatch as (action: ProjectAction) => void,
    undo, redo, undoDepth, redoDepth,
  });
  e2eSourceRef.current = {
    state: state as ProjectState,
    dispatch: dispatch as (action: ProjectAction) => void,
    undo, redo, undoDepth, redoDepth,
  };
  useEffect(() => {
    if (!import.meta.env.VITE_E2E) return;
    return installE2EHook(() => e2eSourceRef.current);
  }, []);

  const value = useMemo(
    () => ({
      state: state as ProjectState,
      dispatch: dispatch as (action: ProjectAction) => void,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [state, dispatch, undo, redo, canUndo, canRedo],
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
