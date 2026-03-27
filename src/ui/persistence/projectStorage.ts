/**
 * Project Storage.
 *
 * Public API for project persistence. Uses Supabase PostgreSQL as the primary store.
 * Migrates existing IndexedDB/localStorage projects on first access.
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
} from './supabaseStore';
import {
  listAllProjects as listAllProjectsIdb,
  getProject as getProjectIdb,
} from './indexedDbStore';

// ============================================================================
// Legacy localStorage keys (for migration)
// ============================================================================

const LEGACY_INDEX_KEY = 'pushflow_projects';
const LEGACY_PROJECT_PREFIX = 'pushflow_project_';
const MIGRATION_DONE_KEY = 'pushflow_supabase_migrated';

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
// Migration: IndexedDB + localStorage → Supabase
// ============================================================================

let migrationPromise: Promise<void> | null = null;

/**
 * Migrate all projects from IndexedDB and localStorage to Supabase.
 * Runs once; subsequent calls are no-ops.
 */
async function ensureMigration(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
    return;
  }

  migrationPromise = (async () => {
    try {
      // Phase 1: Migrate from IndexedDB
      try {
        const idbEntries = await listAllProjectsIdb();
        for (const entry of idbEntries) {
          try {
            const project = await getProjectIdb(entry.id);
            if (project) {
              await putProject(project);
            }
          } catch (err) {
            console.warn(`Failed to migrate project ${entry.id} from IndexedDB:`, err);
          }
        }
      } catch {
        // IndexedDB may not be available or may be empty
      }

      // Phase 2: Migrate from localStorage (older projects not yet in IndexedDB)
      try {
        const indexJson = localStorage.getItem(LEGACY_INDEX_KEY);
        if (indexJson) {
          const entries = JSON.parse(indexJson) as Array<{ id: string }>;
          for (const entry of entries) {
            try {
              const projectJson = localStorage.getItem(`${LEGACY_PROJECT_PREFIX}${entry.id}`);
              if (!projectJson) continue;

              const parsed = JSON.parse(projectJson);
              const persisted = validateAndMigrateRaw(parsed);
              await putProject(persisted);
            } catch (err) {
              console.warn(`Failed to migrate project ${entry.id} from localStorage:`, err);
            }
          }
        }
      } catch {
        // localStorage may not be available
      }

      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    } catch (err) {
      console.error('Migration to Supabase failed:', err);
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
 */
export async function loadProjectAsync(id: string): Promise<ProjectState | null> {
  await ensureMigration();

  const persisted = await getProject(id);
  if (persisted) {
    return deserializeProject(persisted);
  }

  return null;
}

/**
 * Save a project to Supabase.
 * Strips all computed/ephemeral data; only durable state is stored.
 */
export async function saveProjectAsync(state: ProjectState): Promise<void> {
  const persisted = serializeProject(state);
  await putProject(persisted);
}

/**
 * Delete a project from Supabase.
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
 * Synchronous save — fires an async Supabase write and returns immediately.
 * Use for backward compatibility with existing sync call sites.
 */
export function saveProject(state: ProjectState): void {
  saveProjectAsync(state).catch(err =>
    console.error('Failed to save project:', err)
  );
}

/**
 * Synchronous project listing — returns empty while async listing loads.
 * Prefer listProjectsAsync() for new code.
 */
export function listProjects(): ProjectLibraryEntry[] {
  // Sync listing no longer possible with Supabase.
  // Callers should migrate to listProjectsAsync().
  return [];
}

/**
 * Synchronous load — no longer possible with Supabase.
 * Prefer loadProjectAsync() for new code.
 */
export function loadProject(_id: string): ProjectState | null {
  return null;
}

/**
 * Synchronous delete.
 */
export function deleteProject(id: string): void {
  deleteProjectAsync(id).catch(err =>
    console.error('Failed to delete project:', err)
  );
}

/** Remove a project from the library. */
export function removeFromIndex(id: string): void {
  deleteProjectAsync(id).catch(() => {});
}

/** Clear the entire project library index (legacy). */
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
