/**
 * Composer Preset Storage.
 *
 * CRUD for ComposerPresets backed by Supabase PostgreSQL.
 * Presets are stored globally (not per-project) so they are
 * accessible from any project and session.
 *
 * All async methods throw on failure. Sync wrappers are provided
 * for backward compatibility but prefer async versions.
 */

import { type ComposerPreset } from '../../types/composerPreset';
import { generateId } from '../../utils/idGenerator';
import {
  loadComposerPresetsFromDb,
  putComposerPreset,
  deleteComposerPresetFromDb,
} from './supabaseStore';

/** Load all composer presets from Supabase. */
export async function loadComposerPresetsAsync(): Promise<ComposerPreset[]> {
  return loadComposerPresetsFromDb();
}

/** Load all composer presets (sync fallback — returns empty, prefer async). */
export function loadComposerPresets(): ComposerPreset[] {
  return [];
}

/** Save a new composer preset. Returns the saved preset. */
export async function saveComposerPresetAsync(
  preset: Omit<ComposerPreset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ComposerPreset> {
  const now = Date.now();
  const saved: ComposerPreset = {
    ...preset,
    id: generateId('cpreset'),
    createdAt: now,
    updatedAt: now,
  };

  await putComposerPreset(saved);
  return saved;
}

/** Save a new composer preset (sync fire-and-forget wrapper). */
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

  putComposerPreset(saved).catch(err =>
    console.error('Failed to save composer preset:', err)
  );
  return saved;
}

/** Update an existing preset by ID. Returns the updated preset or null if not found. */
export async function updateComposerPresetAsync(
  presetId: string,
  updates: Partial<Omit<ComposerPreset, 'id' | 'createdAt'>>
): Promise<ComposerPreset | null> {
  const presets = await loadComposerPresetsFromDb();
  const existing = presets.find(p => p.id === presetId);
  if (!existing) return null;

  const updated: ComposerPreset = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  await putComposerPreset(updated);
  return updated;
}

/** Update an existing preset (sync wrapper). */
export function updateComposerPreset(
  presetId: string,
  updates: Partial<Omit<ComposerPreset, 'id' | 'createdAt'>>
): ComposerPreset | null {
  // Fire-and-forget — returns null synchronously. Prefer async version.
  updateComposerPresetAsync(presetId, updates).catch(err =>
    console.error('Failed to update composer preset:', err)
  );
  return null;
}

/** Duplicate a preset with a new name. Returns the new preset or null if source not found. */
export async function duplicateComposerPresetAsync(
  presetId: string,
  newName?: string
): Promise<ComposerPreset | null> {
  const presets = await loadComposerPresetsFromDb();
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
  await putComposerPreset(duplicate);
  return duplicate;
}

/** Duplicate a preset (sync wrapper). */
export function duplicateComposerPreset(
  presetId: string,
  newName?: string
): ComposerPreset | null {
  duplicateComposerPresetAsync(presetId, newName).catch(err =>
    console.error('Failed to duplicate composer preset:', err)
  );
  return null;
}

/** Delete a preset by ID. */
export async function deleteComposerPresetAsync(presetId: string): Promise<void> {
  await deleteComposerPresetFromDb(presetId);
}

/** Delete a preset (sync fire-and-forget wrapper). */
export function deleteComposerPreset(presetId: string): void {
  deleteComposerPresetFromDb(presetId).catch(err =>
    console.error('Failed to delete composer preset:', err)
  );
}

/** Rename a preset. Returns the updated preset or null if not found. */
export async function renameComposerPresetAsync(
  presetId: string,
  newName: string
): Promise<ComposerPreset | null> {
  return updateComposerPresetAsync(presetId, { name: newName });
}

/** Rename a preset (sync wrapper). */
export function renameComposerPreset(
  presetId: string,
  newName: string
): ComposerPreset | null {
  renameComposerPresetAsync(presetId, newName).catch(err =>
    console.error('Failed to rename composer preset:', err)
  );
  return null;
}
