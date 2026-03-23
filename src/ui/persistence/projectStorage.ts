/**
 * Project Storage.
 *
 * Public API for project persistence. Uses IndexedDB as the primary store.
 * Migrates existing localStorage projects on first access.
 *
 * Candidates and analysis results are persisted so they survive refresh.
 */

import { type ProjectState } from '../state/projectState';
import { type PersistedProject, type ProjectIndexEntry } from './persistedProject';
import {
  serializeProject,
  deserializeProject,
  validateAndMigrateRaw,
} from './projectSerializer';
import {
  putProject,
  getProject,
  deleteProjectFromDb,
  listAllProjects,
  getFullProject,
} from './indexedDbStore';

// ============================================================================
// Legacy localStorage keys (for migration)
// ============================================================================

const LEGACY_INDEX_KEY = 'pushflow_projects';
const LEGACY_PROJECT_PREFIX = 'pushflow_project_';
const MIGRATION_DONE_KEY = 'pushflow_idb_migrated';

// ============================================================================
// Re-export types for compatibility
// ============================================================================

export type { ProjectIndexEntry };

/**
 * Backward-compatible library entry type.
 * Adds optional difficulty field for callers that used it.
 */
export interface ProjectLibraryEntry extends ProjectIndexEntry {
  difficulty: string | null;
}

// ============================================================================
// Migration: localStorage → IndexedDB
// ============================================================================

let migrationPromise: Promise<void> | null = null;

/**
 * Migrate all projects from localStorage to IndexedDB.
 * Runs once; subsequent calls are no-ops.
 */
async function ensureMigration(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
    return;
  }

  migrationPromise = (async () => {
    try {
      const indexJson = localStorage.getItem(LEGACY_INDEX_KEY);
      if (!indexJson) {
        localStorage.setItem(MIGRATION_DONE_KEY, 'true');
        return;
      }
      const entries = JSON.parse(indexJson) as Array<{ id: string }>;

      for (const entry of entries) {
        try {
          const projectJson = localStorage.getItem(`${LEGACY_PROJECT_PREFIX}${entry.id}`);
          if (!projectJson) continue;

          const parsed = JSON.parse(projectJson);
          const persisted = validateAndMigrateRaw(parsed);
          await putProject(persisted);
        } catch (err) {
          console.warn(`Failed to migrate project ${entry.id}:`, err);
        }
      }

      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    } catch (err) {
      console.error('localStorage → IndexedDB migration failed:', err);
    }
  })();

  return migrationPromise;
}

// ============================================================================
// Public API: Async
// ============================================================================

/**
 * List all projects (lightweight index entries).
 * Returns most-recently-updated first.
 */
export async function listProjectsAsync(): Promise<ProjectLibraryEntry[]> {
  await ensureMigration();
  const entries = await listAllProjects();
  return entries.map(e => ({ ...e, difficulty: null }));
}

/**
 * Load a project by ID and return a full ProjectState.
 * Costs and analysis are NOT loaded — they are recomputed as needed.
 */
export async function loadProjectAsync(id: string): Promise<ProjectState | null> {
  await ensureMigration();

  const persisted = await getProject(id);
  if (persisted) {
    return deserializeProject(persisted);
  }

  // Fallback: try localStorage directly (for edge cases during migration)
  try {
    const json = localStorage.getItem(`${LEGACY_PROJECT_PREFIX}${id}`);
    if (json) {
      const parsed = JSON.parse(json);
      const migrated = validateAndMigrateRaw(parsed);
      await putProject(migrated); // Save to IndexedDB for next time
      return deserializeProject(migrated);
    }
  } catch {
    // Ignore localStorage fallback failures
  }

  return null;
}

/**
 * Save a project to IndexedDB.
 * Strips all computed/ephemeral data; only durable state is stored.
 */
export async function saveProjectAsync(state: ProjectState): Promise<void> {
  const persisted = serializeProject(state);
  await putProject(persisted);
}

/**
 * Delete a project from IndexedDB.
 */
export async function deleteProjectAsync(id: string): Promise<void> {
  await deleteProjectFromDb(id);
  // Also clean up localStorage if present
  try {
    localStorage.removeItem(`${LEGACY_PROJECT_PREFIX}${id}`);
  } catch {
    // Ignore
  }
}

/**
 * Load the full persisted project for thumbnail rendering etc.
 */
export async function getFullPersistedProject(id: string): Promise<PersistedProject | null> {
  await ensureMigration();
  return getFullProject(id);
}

// ============================================================================
// Synchronous API (backward compatible, fire-and-forget saves)
// ============================================================================

/**
 * Synchronous save — fires an async IndexedDB write and returns immediately.
 * Use for backward compatibility with existing sync call sites.
 */
export function saveProject(state: ProjectState): void {
  saveProjectAsync(state).catch(err =>
    console.error('Failed to save project:', err)
  );
}

/**
 * Synchronous project listing — reads from localStorage as fallback
 * while IndexedDB migration may be in progress.
 * Prefer listProjectsAsync() for new code.
 */
export function listProjects(): ProjectLibraryEntry[] {
  try {
    const json = localStorage.getItem(LEGACY_INDEX_KEY);
    if (!json) return [];
    const entries = JSON.parse(json) as ProjectLibraryEntry[];
    return entries.map(e => ({ ...e, difficulty: e.difficulty ?? null }));
  } catch {
    return [];
  }
}

/**
 * Synchronous load — tries localStorage first.
 * Prefer loadProjectAsync() for new code.
 */
export function loadProject(id: string): ProjectState | null {
  try {
    const json = localStorage.getItem(`${LEGACY_PROJECT_PREFIX}${id}`);
    if (!json) return null;
    const parsed = JSON.parse(json);
    const persisted = validateAndMigrateRaw(parsed);
    return deserializeProject(persisted);
  } catch (err) {
    console.error('Failed to load project:', err);
    return null;
  }
}

/**
 * Synchronous delete.
 */
export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(`${LEGACY_PROJECT_PREFIX}${id}`);
    const entries = listProjects().filter(e => e.id !== id);
    localStorage.setItem(LEGACY_INDEX_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
  deleteProjectAsync(id).catch(err =>
    console.error('Failed to delete project from IndexedDB:', err)
  );
}

/** Remove a project from the localStorage library index. */
export function removeFromIndex(id: string): void {
  try {
    const entries = listProjects().filter(e => e.id !== id);
    localStorage.setItem(LEGACY_INDEX_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to remove from index:', err);
  }
  deleteProjectAsync(id).catch(() => {});
}

/** Clear the entire project library index. */
export function clearProjectIndex(): void {
  try {
    localStorage.setItem(LEGACY_INDEX_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear project index:', err);
  }
}

// ============================================================================
// JSON File Export/Import
// ============================================================================

export function exportProjectToFile(state: ProjectState): void {
  const persisted = serializeProject(state);
  const json = JSON.stringify(persisted, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pushflow.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; state: ProjectState }
  | { ok: false; error: string };

export async function importProjectFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const persisted = validateAndMigrateRaw(parsed);
    const state = deserializeProject(persisted);
    return { ok: true, state };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid project file';
    return { ok: false, error: message };
  }
}
