/**
 * IndexedDB Store.
 *
 * Low-level IndexedDB access for project persistence.
 * Provides typed get/put/delete/list operations.
 * All methods are async and handle DB lifecycle internally.
 */

import { type PersistedProject, type ProjectIndexEntry } from './persistedProject';
import { byRecency, projectIndexEntry, unreadableIndexEntry } from './projectIndex';

const DB_NAME = 'pushflow';
/** 2 adds the backups store (S1a.2 migration runner). */
const DB_VERSION = 2;
const PROJECTS_STORE = 'projects';
const BACKUPS_STORE = 'backups';

/**
 * A stored project exactly as it was before a migration ran, kept so a damaged
 * migration can be undone by hand ("Download backup" in the Library).
 */
export interface ProjectBackup {
  /** `${projectId}@v${fromVersion}`: one backup per project and starting version. */
  key: string;
  projectId: string;
  fromVersion: number;
  createdAt: string;
  /** The untouched stored record. */
  record: unknown;
}

// ============================================================================
// Database Lifecycle
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
        db.createObjectStore(BACKUPS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab opening a newer DB_VERSION (a new store for a migration)
      // waits for this connection to close; close it rather than block that tab.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Save or update a project in IndexedDB.
 *
 * Resolves when the transaction commits, not when the put request succeeds: a
 * page reload between the two aborts the transaction, so resolving early let
 * the toolbar say "Saved" for a write that was then lost.
 */
export async function putProject(project: PersistedProject): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Load a project by ID from IndexedDB.
 */
export async function getProject(id: string): Promise<PersistedProject | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a project by ID from IndexedDB.
 */
export async function deleteProjectFromDb(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all projects as lightweight index entries (projectIndex.ts), most
 * recently opened or created first.
 */
export async function listAllProjects(): Promise<ProjectIndexEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const projects = request.result as PersistedProject[];
      // Map each record defensively: one corrupt/partial record must degrade
      // to a placeholder entry, not throw and hide the user's entire library.
      const entries: ProjectIndexEntry[] = [];
      for (const p of projects) {
        try {
          entries.push(projectIndexEntry(p));
        } catch (err) {
          console.warn(`Skipping unreadable project record ${p?.id ?? '(unknown)'}:`, err);
          if (p && typeof p.id === 'string') entries.push(unreadableIndexEntry(p));
        }
      }
      entries.sort(byRecency);
      resolve(entries);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load the full persisted state for a project (for thumbnails etc).
 */
export async function getFullProject(id: string): Promise<PersistedProject | null> {
  return getProject(id);
}

// ============================================================================
// Pre-migration backups
// ============================================================================

export function backupKey(projectId: string, fromVersion: number): string {
  return `${projectId}@v${fromVersion}`;
}

/**
 * Writes a pre-migration backup. Resolves only once the transaction commits,
 * so a migration never runs ahead of its backup.
 */
export async function putBackup(backup: ProjectBackup): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, 'readwrite');
    tx.objectStore(BACKUPS_STORE).put(backup);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Deletes every pre-migration backup of a project (with the project itself). */
export async function deleteBackupsForProject(projectId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, 'readwrite');
    const store = tx.objectStore(BACKUPS_STORE);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if ((cursor.value as ProjectBackup).projectId === projectId) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Every backup, newest first. */
export async function listBackups(): Promise<ProjectBackup[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, 'readonly');
    const request = tx.objectStore(BACKUPS_STORE).getAll();
    request.onsuccess = () => {
      const backups = request.result as ProjectBackup[];
      backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(backups);
    };
    request.onerror = () => reject(request.error);
  });
}
