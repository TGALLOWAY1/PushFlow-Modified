/**
 * Loop Editor Persistence.
 *
 * Save/load loop editor state to localStorage.
 * Handles Map<LoopCellKey, LoopEvent> serialization.
 * Handles Map<LoopCellKey, LoopEvent> serialization for localStorage.
 */

import { type LoopState, type LoopCellKey, type LoopEvent } from '../../types/loopEditor';

const LOOP_PREFIX = 'pushflow_loop_';

/** Save loop state to localStorage. */
export function saveLoopState(projectId: string, state: LoopState): void {
  const serializable = {
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    // Never persist playback state
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: state.rudimentResult ?? null,
  };
  try {
    localStorage.setItem(`${LOOP_PREFIX}${projectId}`, JSON.stringify(serializable));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Load loop state from localStorage. Returns null if not found. */
export function loadLoopState(projectId: string): LoopState | null {
  try {
    const json = localStorage.getItem(`${LOOP_PREFIX}${projectId}`);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return {
      config: parsed.config,
      lanes: parsed.lanes,
      events: new Map<LoopCellKey, LoopEvent>(parsed.events),
      isPlaying: false,
      playheadStep: 0,
      rudimentResult: parsed.rudimentResult ?? null,
    };
  } catch {
    return null;
  }
}

/** Delete loop state from localStorage. */
export function deleteLoopState(projectId: string): void {
  localStorage.removeItem(`${LOOP_PREFIX}${projectId}`);
}
