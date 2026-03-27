/**
 * One-time migration of presets and loop states from localStorage to Supabase.
 *
 * Project migration is handled in projectStorage.ts.
 * This module migrates the remaining localStorage data:
 *   - Performance presets (pushflow_user_presets)
 *   - Composer presets (pushflow_composer_presets)
 *   - Loop states (pushflow_loop_*)
 *
 * Migration runs once on app startup. Subsequent calls are no-ops.
 */

import { type PerformancePreset } from './presetStorage';
import { type ComposerPreset } from '../../types/composerPreset';
import { putAllPresets, putAllComposerPresets, putLoopState } from './supabaseStore';

const MIGRATION_KEY = 'pushflow_supabase_presets_migrated';
const PRESETS_KEY = 'pushflow_user_presets';
const COMPOSER_PRESETS_KEY = 'pushflow_composer_presets';
const LOOP_PREFIX = 'pushflow_loop_';

let migrationPromise: Promise<void> | null = null;

/**
 * Migrate all non-project localStorage data to Supabase.
 * Safe to call multiple times — only runs once.
 */
export function ensurePresetMigration(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  if (localStorage.getItem(MIGRATION_KEY) === 'true') {
    return Promise.resolve();
  }

  migrationPromise = runMigration();
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  try {
    // Migrate performance presets
    try {
      const json = localStorage.getItem(PRESETS_KEY);
      if (json) {
        const presets = JSON.parse(json) as PerformancePreset[];
        if (presets.length > 0) {
          await putAllPresets(presets);
        }
      }
    } catch (err) {
      console.warn('Failed to migrate performance presets:', err);
    }

    // Migrate composer presets
    try {
      const json = localStorage.getItem(COMPOSER_PRESETS_KEY);
      if (json) {
        const presets = JSON.parse(json) as ComposerPreset[];
        if (presets.length > 0) {
          await putAllComposerPresets(presets);
        }
      }
    } catch (err) {
      console.warn('Failed to migrate composer presets:', err);
    }

    // Migrate loop states
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOOP_PREFIX)) {
          const projectId = key.slice(LOOP_PREFIX.length);
          try {
            const json = localStorage.getItem(key);
            if (json) {
              const data = JSON.parse(json);
              await putLoopState(projectId, data);
            }
          } catch (err) {
            console.warn(`Failed to migrate loop state for ${projectId}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to migrate loop states:', err);
    }

    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch (err) {
    console.error('Preset/loop migration to Supabase failed:', err);
  }
}
