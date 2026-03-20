/**
 * Composer Preset Storage.
 *
 * CRUD for ComposerPresets in localStorage.
 * Presets are stored globally (not per-project) so they are
 * accessible from any project and session.
 */

import { type ComposerPreset } from '../../types/composerPreset';
import { generateId } from '../../utils/idGenerator';

const STORAGE_KEY = 'pushflow_composer_presets';

/** Load all composer presets from localStorage. */
export function loadComposerPresets(): ComposerPreset[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as ComposerPreset[];
  } catch {
    return [];
  }
}

/** Save a new composer preset. Returns the saved preset. */
export function saveComposerPreset(
  preset: Omit<ComposerPreset, 'id' | 'createdAt' | 'updatedAt'>
): ComposerPreset {
  const now = Date.now();
  const saved: ComposerPreset = {
    ...preset,
    id: generateId('cpreset'),
    createdAt: now,
    updatedAt: now,
  };

  const presets = loadComposerPresets();
  presets.unshift(saved);
  writePresets(presets);
  return saved;
}

/** Update an existing preset by ID. Returns the updated preset or null if not found. */
export function updateComposerPreset(
  presetId: string,
  updates: Partial<Omit<ComposerPreset, 'id' | 'createdAt'>>
): ComposerPreset | null {
  const presets = loadComposerPresets();
  const index = presets.findIndex(p => p.id === presetId);
  if (index === -1) return null;

  const updated: ComposerPreset = {
    ...presets[index],
    ...updates,
    updatedAt: Date.now(),
  };
  presets[index] = updated;
  writePresets(presets);
  return updated;
}

/** Duplicate a preset with a new name. Returns the new preset or null if source not found. */
export function duplicateComposerPreset(
  presetId: string,
  newName?: string
): ComposerPreset | null {
  const presets = loadComposerPresets();
  const source = presets.find(p => p.id === presetId);
  if (!source) return null;

  const now = Date.now();
  const duplicate: ComposerPreset = {
    ...source,
    id: generateId('cpreset'),
    name: newName ?? `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  presets.unshift(duplicate);
  writePresets(presets);
  return duplicate;
}

/** Delete a preset by ID. */
export function deleteComposerPreset(presetId: string): void {
  const presets = loadComposerPresets().filter(p => p.id !== presetId);
  writePresets(presets);
}

/** Rename a preset. Returns the updated preset or null if not found. */
export function renameComposerPreset(
  presetId: string,
  newName: string
): ComposerPreset | null {
  return updateComposerPreset(presetId, { name: newName });
}

// ============================================================================
// Internal
// ============================================================================

function writePresets(presets: ComposerPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage full — silently fail
    console.warn('Failed to save composer presets: localStorage may be full');
  }
}
