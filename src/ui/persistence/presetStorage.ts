/**
 * Performance Preset Storage.
 *
 * CRUD for user-saved performance presets backed by Supabase PostgreSQL.
 * A preset captures the full loop state (config, lanes, events)
 * plus optional analysis data (finger assignments, pad assignments).
 *
 * All async methods throw on failure. Sync wrappers are provided
 * for backward compatibility but prefer async versions.
 */

import { type LoopState, type LoopCellKey, type LoopEvent } from '../../types/loopEditor';
import { type RudimentResult } from '../../types/rudiment';
import { generateId } from '../../utils/idGenerator';
import {
  loadPresetsFromDb,
  putPreset,
  deletePresetFromDb,
} from './supabaseStore';

export interface PerformancePreset {
  id: string;
  name: string;
  createdAt: number;
  config: LoopState['config'];
  lanes: LoopState['lanes'];
  /** Serialized as [key, event][] for JSON compatibility. */
  events: [LoopCellKey, LoopEvent][];
  rudimentResult: RudimentResult | null;
}

/** Load all presets from Supabase. */
export async function loadPresetsAsync(): Promise<PerformancePreset[]> {
  return loadPresetsFromDb();
}

/** Load all presets (sync fallback — returns empty, prefer loadPresetsAsync). */
export function loadPresets(): PerformancePreset[] {
  return [];
}

/** Save a new preset from current loop state. Returns the new preset. */
export async function savePresetAsync(name: string, state: LoopState): Promise<PerformancePreset> {
  const preset: PerformancePreset = {
    id: generateId('preset'),
    name,
    createdAt: Date.now(),
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    rudimentResult: state.rudimentResult ?? null,
  };

  await putPreset(preset);
  return preset;
}

/** Save a new preset (sync fire-and-forget wrapper). */
export function savePreset(name: string, state: LoopState): PerformancePreset {
  const preset: PerformancePreset = {
    id: generateId('preset'),
    name,
    createdAt: Date.now(),
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    rudimentResult: state.rudimentResult ?? null,
  };

  putPreset(preset).catch(err => console.error('Failed to save preset:', err));
  return preset;
}

/** Delete a preset by ID. */
export async function deletePresetAsync(presetId: string): Promise<void> {
  await deletePresetFromDb(presetId);
}

/** Delete a preset (sync fire-and-forget wrapper). */
export function deletePreset(presetId: string): void {
  deletePresetFromDb(presetId).catch(err =>
    console.error('Failed to delete preset:', err)
  );
}

/** Convert a preset back to a LoopState for loading. */
export function presetToLoopState(preset: PerformancePreset): LoopState {
  return {
    config: preset.config,
    lanes: preset.lanes,
    events: new Map<LoopCellKey, LoopEvent>(preset.events),
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: preset.rudimentResult,
  };
}
