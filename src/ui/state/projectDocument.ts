/**
 * Project document slice.
 *
 * Undo and Redo cover the document (what the user authors: layouts, locks,
 * Sounds, voiceConstraints, lanes, tempo, names, variants) and never the session
 * (analysis, candidates, trace, transport, selection, isProcessing, errors).
 * These helpers are the only place that knows which fields are which; the
 * ProjectDocument and ProjectSession types in projectState.ts are the other half.
 */

import { type ProjectDocument, type ProjectState } from './projectState';
import { deepEqual } from '../../utils/deepEqual';

/**
 * Every document field. A Record over keyof ProjectDocument, so adding a field to
 * the type without classifying it here is a compile error.
 */
const DOCUMENT_FIELD_SET: Record<keyof ProjectDocument, true> = {
  version: true,
  id: true,
  name: true,
  createdAt: true,
  soundStreams: true,
  tempo: true,
  instrumentConfig: true,
  sections: true,
  voiceProfiles: true,
  activeLayout: true,
  workingLayout: true,
  savedVariants: true,
  layouts: true,
  activeLayoutId: true,
  voiceConstraints: true,
  performanceLanes: true,
  laneGroups: true,
  sourceFiles: true,
};

export const DOCUMENT_FIELDS = Object.keys(DOCUMENT_FIELD_SET) as (keyof ProjectDocument)[];

/** The document slice of a project state (fields are shared, not copied). */
export function pickDocument(state: ProjectState): ProjectDocument {
  const doc = {} as Record<string, unknown>;
  for (const key of DOCUMENT_FIELDS) {
    if (key in state) doc[key] = state[key];
  }
  return doc as unknown as ProjectDocument;
}

/**
 * Whether two document slices differ.
 *
 * Fields are compared by reference first, then structurally, so a reducer that
 * rebuilds an equal value (SYNC_STREAMS_FROM_LANES rebuilding the same Sounds, a
 * self-drop re-creating the same layout) still counts as no change.
 */
export function documentChanged(a: ProjectDocument, b: ProjectDocument): boolean {
  return DOCUMENT_FIELDS.some(key => a[key] !== b[key] && !deepEqual(a[key], b[key]));
}

/**
 * Puts a document slice back under the current session (Undo and Redo).
 *
 * The session is kept, so playback, selection, candidates and the trace carry
 * on. The layout may have changed under the analysis, so it is marked stale and
 * re-resolves by layout hash (getAnalysisForLayout rejects a plan bound to
 * another layout). updatedAt moves forward so autosave writes the restored
 * document even when it matches an older save.
 *
 * Selections that would now describe something else are cleared, as the
 * edit reducers do: a selected candidate when the layouts change (the grid
 * shows the restored layout, so the panels must too), and the event selection
 * when the Sounds change (its index may point at a different event).
 */
export function restoreDocument(state: ProjectState, doc: ProjectDocument): ProjectState {
  const next = { ...state } as Record<string, unknown>;
  for (const key of DOCUMENT_FIELDS) {
    if (key in doc) next[key] = doc[key];
    else delete next[key];
  }
  const restored = next as unknown as ProjectState;
  const layoutsChanged = restored.activeLayout !== state.activeLayout
    || restored.workingLayout !== state.workingLayout;
  const soundsChanged = restored.soundStreams !== state.soundStreams;
  return {
    ...restored,
    updatedAt: new Date().toISOString(),
    analysisStale: true,
    ...(layoutsChanged ? { selectedCandidateId: null } : {}),
    ...(soundsChanged ? { selectedEventIndex: null, selectedMomentIndex: null } : {}),
  };
}
