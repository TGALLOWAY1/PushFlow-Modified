/**
 * Loop Editor Persistence.
 *
 * Save/load loop editor state to localStorage.
 * Handles Map<LoopCellKey, LoopEvent> serialization.
 *
 * The serialized shape is shared with the project export file (the Composer's
 * pattern travels with an exported project until P8 moves it into the project
 * itself), so serialize/deserialize are exported on their own.
 */

import { type LoopState, type LoopCellKey, type LoopEvent } from '../../types/loopEditor';

const LOOP_PREFIX = 'pushflow_loop_';

/** The Composer's pattern as stored: config, lanes and events as entries; never playback state. */
export interface SerializedLoopState {
  config: LoopState['config'];
  lanes: LoopState['lanes'];
  events: Array<[LoopCellKey, LoopEvent]>;
  isPlaying: false;
  playheadStep: 0;
  rudimentResult: LoopState['rudimentResult'] | null;
}

export function serializeLoopState(state: LoopState): SerializedLoopState {
  return {
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    // Never persist playback state
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: state.rudimentResult ?? null,
  };
}

/** Rebuilds a LoopState from its serialized form; null when the shape is not one. */
export function deserializeLoopState(parsed: unknown): LoopState | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Partial<SerializedLoopState>;
  if (!raw.config || !Array.isArray(raw.lanes) || !Array.isArray(raw.events)) return null;
  return {
    config: raw.config,
    lanes: raw.lanes,
    events: new Map<LoopCellKey, LoopEvent>(raw.events),
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: raw.rudimentResult ?? null,
  };
}

/** Save loop state to localStorage. */
export function saveLoopState(projectId: string, state: LoopState): void {
  try {
    localStorage.setItem(`${LOOP_PREFIX}${projectId}`, JSON.stringify(serializeLoopState(state)));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** The stored (serialized) pattern of a project, if any. */
export function loadSerializedLoopState(projectId: string): SerializedLoopState | null {
  try {
    const json = localStorage.getItem(`${LOOP_PREFIX}${projectId}`);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return deserializeLoopState(parsed) ? (parsed as SerializedLoopState) : null;
  } catch {
    return null;
  }
}

/** Load loop state from localStorage. Returns null if not found. */
export function loadLoopState(projectId: string): LoopState | null {
  return deserializeLoopState(loadSerializedLoopState(projectId));
}

/** Writes an already-serialized pattern (from an imported project file). */
export function saveSerializedLoopState(projectId: string, state: SerializedLoopState): void {
  try {
    localStorage.setItem(`${LOOP_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Delete loop state from localStorage. */
export function deleteLoopState(projectId: string): void {
  localStorage.removeItem(`${LOOP_PREFIX}${projectId}`);
}
