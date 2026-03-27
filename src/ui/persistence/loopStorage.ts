/**
 * Loop Editor Persistence.
 *
 * Save/load loop editor state to Supabase PostgreSQL.
 * Handles Map<LoopCellKey, LoopEvent> serialization.
 */

import { type LoopState, type LoopCellKey, type LoopEvent } from '../../types/loopEditor';
import { putLoopState, getLoopState, deleteLoopStateFromDb } from './supabaseStore';

/** Save loop state to Supabase. */
export async function saveLoopStateAsync(projectId: string, state: LoopState): Promise<void> {
  const serializable = {
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: state.rudimentResult ?? null,
  };
  await putLoopState(projectId, serializable);
}

/** Save loop state (sync fire-and-forget wrapper). */
export function saveLoopState(projectId: string, state: LoopState): void {
  saveLoopStateAsync(projectId, state).catch(err =>
    console.error('Failed to save loop state:', err)
  );
}

/** Load loop state from Supabase. Returns null if not found. */
export async function loadLoopStateAsync(projectId: string): Promise<LoopState | null> {
  const data = await getLoopState(projectId);
  if (!data) return null;

  const parsed = data as Record<string, unknown>;
  return {
    config: parsed.config as LoopState['config'],
    lanes: parsed.lanes as LoopState['lanes'],
    events: new Map<LoopCellKey, LoopEvent>(parsed.events as [LoopCellKey, LoopEvent][]),
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: (parsed.rudimentResult as LoopState['rudimentResult']) ?? null,
  };
}

/** Load loop state (sync fallback — returns null, prefer async). */
export function loadLoopState(_projectId: string): LoopState | null {
  return null;
}

/** Delete loop state from Supabase. */
export async function deleteLoopStateAsync(projectId: string): Promise<void> {
  await deleteLoopStateFromDb(projectId);
}

/** Delete loop state (sync fire-and-forget wrapper). */
export function deleteLoopState(projectId: string): void {
  deleteLoopStateFromDb(projectId).catch(err =>
    console.error('Failed to delete loop state:', err)
  );
}
