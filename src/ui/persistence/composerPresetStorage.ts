/**
 * Composer Preset Storage.
 *
 * CRUD for ComposerPresets in localStorage.
 * Presets are stored globally (not per-project) so they are
 * accessible from any project and session.
 */

import { type ComposerPreset } from '../../types/composerPreset';
import { generateId } from '../../utils/idGenerator';
import { needsMigration, runMigrations } from './migrations';
import { PRESET_MIGRATIONS, PRESET_STORE_VERSION } from './presetMigrations';

const STORAGE_KEY = 'pushflow_composer_presets';
/** The store's schema version (absent = 0, from before versioning). */
const VERSION_KEY = 'pushflow_composer_presets_version';
/** The untouched list, written before a migration: `${BACKUP_KEY_PREFIX}${fromVersion}`. */
export const PRESET_BACKUP_KEY_PREFIX = 'pushflow_composer_presets_backup_v';

/**
 * Load all composer presets from localStorage, migrating the store first when
 * it is older than PRESET_STORE_VERSION: the untouched list is backed up, then
 * the migrated list is written. If the backup cannot be written, the store is
 * left as it is and the migrated list is returned without being saved, so old
 * fingering is still never applied.
 */
export function loadComposerPresets(): ComposerPreset[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const presets = JSON.parse(json) as unknown;
    const record = { schemaVersion: Number(localStorage.getItem(VERSION_KEY) ?? 0), presets };
    if (!needsMigration(record, PRESET_STORE_VERSION)) return presets as ComposerPreset[];
    const migrated = runMigrations(record, PRESET_MIGRATIONS).record.presets as ComposerPreset[];
    try {
      localStorage.setItem(`${PRESET_BACKUP_KEY_PREFIX}${record.schemaVersion}`, json);
    } catch {
      return migrated;
    }
    writePresets(migrated);
    return migrated;
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
    localStorage.setItem(VERSION_KEY, String(PRESET_STORE_VERSION));
  } catch {
    // localStorage full — silently fail
    console.warn('Failed to save composer presets: localStorage may be full');
  }
}
