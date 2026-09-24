/**
 * Migration runner for stored projects.
 *
 * A stored project carries a schemaVersion. On load, every migration whose
 * `from` is at or above the record's version runs in order, each taking the
 * record one version up. Every migration is idempotent: running it on a record
 * it has already migrated changes nothing, so a second run of the whole runner
 * is a no-op.
 *
 * Before any step runs, the untouched record is handed to a backup callback
 * (projectStorage writes it to the IndexedDB "backups" store, keyed by project
 * id and fromVersion; the Library's "Download backup" action saves it as a
 * file). If the backup fails, nothing is migrated.
 *
 * Records from before schemaVersion existed (the old localStorage format) are
 * version 0; projectSerializer converts them to version 1 before this runner
 * sees them.
 *
 * Later phases add their migrations to MIGRATIONS, bumping
 * PERSISTED_SCHEMA_VERSION with each. The global Composer preset store is not
 * part of a project and runs its own list through the same runner
 * (presetMigrations.ts, S1a.5 preset fingerings).
 */

import { PERSISTED_SCHEMA_VERSION } from './persistedProject';

/** A stored project record, as parsed JSON. */
export type StoredRecord = Record<string, unknown>;

export interface Migration {
  /** The version this migration reads. */
  from: number;
  /** The version it writes; always from + 1. */
  to: number;
  /** Short name, for logs and tests. */
  name: string;
  /** Returns the migrated record. Must not mutate its input, and must be idempotent. */
  up: (record: StoredRecord) => StoredRecord;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    // S1a.2: Working/Test Layouts kept automatically when an explicit action
    // replaces them get their own list, separate from savedVariants.
    from: 1,
    to: 2,
    name: 'recovered-drafts-store',
    up: record => ({
      ...record,
      recoveredDrafts: Array.isArray(record.recoveredDrafts)
        ? (record.recoveredDrafts as StoredRecord[]).map(layout => ({ ...layout, provenance: 'recovered' }))
        : [],
    }),
  },
  {
    // S1a.4 (T12, F10-V02): a lock only ever means "this Sound is on this
    // pad". Discards before S1a.4 merged draft locks into the Active Layout
    // without checking, leaving locks that point at pads the Sound does not
    // occupy: invisible in the UI (lock glyphs draw only on the Sound's pad),
    // yet still pulling the Sound back on the next Generate. Every stored
    // layout drops them; a lock whose Sound is on its pad is kept.
    from: 2,
    to: 3,
    name: 'prune-ghost-locks',
    up: record => {
      const next: StoredRecord = { ...record };
      for (const key of ['activeLayout', 'workingLayout'] as const) {
        if (key in record) next[key] = pruneGhostLocks(record[key]);
      }
      for (const key of ['savedVariants', 'recoveredDrafts'] as const) {
        if (Array.isArray(record[key])) next[key] = (record[key] as unknown[]).map(pruneGhostLocks);
      }
      return next;
    },
  },
];

/** The layout with only the locks whose Sound sits on the locked pad. Non-layouts pass through. */
function pruneGhostLocks(layout: unknown): unknown {
  if (!layout || typeof layout !== 'object') return layout;
  const l = layout as {
    padToVoice?: Record<string, { id?: unknown } | null | undefined>;
    placementLocks?: Record<string, unknown>;
  };
  if (!l.placementLocks || typeof l.placementLocks !== 'object') return layout;
  const pads = l.padToVoice && typeof l.padToVoice === 'object' ? l.padToVoice : {};
  const kept: Record<string, string> = {};
  for (const [voiceId, padKey] of Object.entries(l.placementLocks)) {
    if (typeof padKey === 'string' && pads[padKey]?.id === voiceId) kept[voiceId] = padKey;
  }
  return { ...l, placementLocks: kept };
}

/** A record's schema version; 0 for records from before versioning. */
export function schemaVersionOf(record: StoredRecord): number {
  return typeof record.schemaVersion === 'number' ? record.schemaVersion : 0;
}

/** Whether loading this record will migrate it (and so back it up first). */
export function needsMigration(
  record: StoredRecord,
  targetVersion: number = PERSISTED_SCHEMA_VERSION,
): boolean {
  return schemaVersionOf(record) < targetVersion;
}

export interface MigrationResult {
  record: StoredRecord;
  fromVersion: number;
  /** Names of the migrations that ran, in order. */
  applied: string[];
}

/**
 * Runs every migration the record needs, in order. Synchronous and pure.
 * A record already at (or past) the last migration's version is returned as is.
 */
export function runMigrations(
  record: StoredRecord,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationResult {
  const fromVersion = schemaVersionOf(record);
  const ordered = [...migrations].sort((a, b) => a.from - b.from);
  let current = record;
  const applied: string[] = [];
  for (const migration of ordered) {
    if (schemaVersionOf(current) !== migration.from) continue;
    current = { ...migration.up(current), schemaVersion: migration.to };
    applied.push(migration.name);
  }
  return { record: current, fromVersion, applied };
}

/**
 * Backs the record up, then migrates it: the backup callback receives the
 * untouched record and must finish before `migrate` runs. Records that need no
 * migration are passed straight to `migrate` without a backup.
 */
export async function migrateWithBackup<T>(
  record: StoredRecord,
  backup: (record: StoredRecord, fromVersion: number) => Promise<void>,
  migrate: (record: StoredRecord) => T,
  targetVersion: number = PERSISTED_SCHEMA_VERSION,
): Promise<T> {
  if (needsMigration(record, targetVersion)) {
    await backup(structuredClone(record), schemaVersionOf(record));
  }
  return migrate(record);
}
