/**
 * Project Context.
 *
 * Provides project state + undo/redo to the component tree.
 */

import { createContext, useContext, useMemo } from 'react';
import {
  type ProjectState,
  type ProjectAction,
  projectReducer,
  isEphemeralAction,
  createEmptyProjectState,
} from './projectState';
import { useUndoRedo } from './useUndoRedo';

interface ProjectContextValue {
  state: ProjectState;
  dispatch: (action: ProjectAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

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
  const { state, dispatch, undo, redo, canUndo, canRedo } = useUndoRedo(
    projectReducer,
    initialState,
    isEphemeralAction,
  );

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
