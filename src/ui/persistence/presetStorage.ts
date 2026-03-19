/**
 * Performance Preset Storage.
 *
 * CRUD for user-saved performance presets in localStorage.
 * A preset captures the full loop state (config, lanes, events)
 * plus optional analysis data (finger assignments, pad assignments).
 */

import { type LoopState, type LoopCellKey, type LoopEvent } from '../../types/loopEditor';
import { type RudimentResult } from '../../types/rudiment';
import { type PatternResult } from '../../types/patternRecipe';
import { generateId } from '../../utils/idGenerator';

const PRESETS_KEY = 'pushflow_user_presets';

export interface PerformancePreset {
  id: string;
  name: string;
  createdAt: number;
  config: LoopState['config'];
  lanes: LoopState['lanes'];
  /** Serialized as [key, event][] for JSON compatibility. */
  events: [LoopCellKey, LoopEvent][];
  rudimentResult: RudimentResult | null;
  patternResult: PatternResult | null;
}

/** Load all presets from localStorage. */
export function loadPresets(): PerformancePreset[] {
  try {
    const json = localStorage.getItem(PRESETS_KEY);
    if (!json) return [];
    return JSON.parse(json) as PerformancePreset[];
  } catch {
    return [];
  }
}

/** Save a new preset from current loop state. Returns the new preset. */
export function savePreset(name: string, state: LoopState): PerformancePreset {
  const preset: PerformancePreset = {
    id: generateId('preset'),
    name,
    createdAt: Date.now(),
    config: state.config,
    lanes: state.lanes,
    events: Array.from(state.events.entries()),
    rudimentResult: state.rudimentResult ?? null,
    patternResult: state.patternResult ?? null,
  };

  const presets = loadPresets();
  presets.unshift(preset);

  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // localStorage full — silently fail
  }

  return preset;
}

/** Delete a preset by ID. */
export function deletePreset(presetId: string): void {
  const presets = loadPresets().filter(p => p.id !== presetId);
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // silently fail
  }
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
    patternResult: preset.patternResult,
  };
}
