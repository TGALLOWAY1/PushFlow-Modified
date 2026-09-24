/**
 * IndexedDB Store.
 *
 * Low-level IndexedDB access for project persistence.
 * Provides typed get/put/delete/list operations.
 * All methods are async and handle DB lifecycle internally.
 */

import { type PersistedProject, type ProjectIndexEntry } from './persistedProject';

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
 * List all projects as lightweight index entries.
 * Returns entries sorted by updatedAt (most recent first).
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
          const soundStreams = Array.isArray(p.soundStreams) ? p.soundStreams : [];
          let eventCount = 0;
          let maxTime = 0;
          for (const s of soundStreams) {
            const events = Array.isArray(s.events) ? s.events : [];
            eventCount += events.length;
            for (const e of events) {
              const end = e.startTime + e.duration;
              if (end > maxTime) maxTime = end;
            }
          }
          const beatDuration = 60 / (p.bpm || 120);
          const barDuration = beatDuration * 4;
          const durationBars = barDuration > 0 ? Math.ceil(maxTime / barDuration) : 0;
          entries.push({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            soundCount: soundStreams.length,
            eventCount,
            tempo: p.bpm || 120,
            durationBars,
          });
        } catch (err) {
          console.warn(`Skipping unreadable project record ${p?.id ?? '(unknown)'}:`, err);
          if (p && typeof p.id === 'string') {
            entries.push({
              id: p.id,
              name: typeof p.name === 'string' ? p.name : 'Unreadable project',
              createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
              updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
              soundCount: 0,
              eventCount: 0,
              tempo: 120,
              durationBars: 0,
            });
          }
        }
      }
      // Sort by updatedAt descending
      entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
