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
  putBackup,
  listBackups,
  deleteBackupsForProject,
  backupKey,
  type ProjectBackup,
} from './indexedDbStore';
import { migrateWithBackup, needsMigration, type StoredRecord } from './migrations';

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
// Schema migrations (with a backup first)
// ============================================================================

/** Stores the untouched record in the backups store before it is migrated. */
async function backupBeforeMigration(record: StoredRecord, fromVersion: number): Promise<void> {
  const projectId = String(record.id);
  await putBackup({
    key: backupKey(projectId, fromVersion),
    projectId,
    fromVersion,
    createdAt: new Date().toISOString(),
    record,
  });
}

/**
 * Brings a stored record up to the current schema: backs it up first when it
 * needs migrating, then runs the migrations and fills defaults.
 */
async function migrateStoredRecord(record: unknown): Promise<PersistedProject> {
  if (!record || typeof record !== 'object') return validateAndMigrateRaw(record);
  return migrateWithBackup(record as StoredRecord, backupBeforeMigration, validateAndMigrateRaw);
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
          const persisted = await migrateStoredRecord(parsed);
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

  const stored = await getProject(id);
  if (stored) {
    const migrating = needsMigration(stored as unknown as StoredRecord);
    const persisted = await migrateStoredRecord(stored);
    // Store the migrated record so the migration runs once (its backup exists).
    if (migrating) await putProject(persisted);
    return deserializeProject(persisted);
  }

  // Fallback: try localStorage directly (for edge cases during migration)
  try {
    const json = localStorage.getItem(`${LEGACY_PROJECT_PREFIX}${id}`);
    if (json) {
      const parsed = JSON.parse(json);
      const migrated = await migrateStoredRecord(parsed);
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
  // A deleted project leaves no copy behind, and a later project that reuses
  // the id (a re-import) must not offer the old project's backup.
  await deleteBackupsForProject(id);
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
// Synchronous API (legacy localStorage fallback)
// ============================================================================

/**
 * Synchronous load — tries localStorage first.
 * Used only as the editor's fallback for pre-migration edge cases.
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

// ============================================================================
// Pre-migration backups
// ============================================================================

/** Ids of the projects that have a pre-migration backup. */
export async function listBackedUpProjectIds(): Promise<Set<string>> {
  const backups = await listBackups();
  return new Set(backups.map(b => b.projectId));
}

/** The newest pre-migration backup of a project, if any. */
export async function getLatestBackup(projectId: string): Promise<ProjectBackup | null> {
  const backups = await listBackups();
  return backups.find(b => b.projectId === projectId) ?? null;
}

/**
 * Saves a project's newest pre-migration backup as a JSON file (the user's
 * "Download backup" action; nothing downloads automatically). The file imports
 * like any exported project. Returns false when there is no backup.
 */
export async function downloadProjectBackup(projectId: string, projectName: string): Promise<boolean> {
  const backup = await getLatestBackup(projectId);
  if (!backup) return false;
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadJson(backup.record, `${safeName}.backup-v${backup.fromVersion}.pushflow.json`);
  return true;
}

function downloadJson(value: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// JSON File Export/Import
// ============================================================================

export function exportProjectToFile(state: ProjectState): void {
  const persisted = serializeProject(state);
  downloadJson(persisted, `${state.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pushflow.json`);
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
