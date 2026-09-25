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
import { FALLBACK_LAYOUT_NAME, legacyRoleWords, withoutLegacyRoleWords } from '../state/layoutLabels';
import { variantStamp } from '../state/variantNames';
import { uniqueName } from '../../utils/uniqueName';

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
  {
    // S2.3 (T52): the Library shows when a project was last opened and offers
    // the last-opened one to continue. A project opened before this version
    // was last opened no later than its last save, so it starts there.
    from: 3,
    to: 4,
    name: 'last-opened-at',
    up: record => ({
      ...record,
      lastOpenedAt: typeof record.lastOpenedAt === 'string' ? record.lastOpenedAt : record.updatedAt,
    }),
  },
  {
    // S3.2 (T32): layout names carry no role words. Earlier versions wrote
    // " (draft)", " (suggested)" and " (replaced <date>)" into names, which
    // piled up ("Default (draft) (draft)") and mislabelled a promoted Active.
    // They come out of every stored name, and where the last one says where the
    // layout came from it moves into provenance. A replaced Active's date
    // becomes the " – 24 Sep 14:02" stamp new ones get (from its savedAt), and
    // a variant renamed here is numbered if its new name is taken.
    from: 4,
    to: 5,
    name: 'clean-layout-names',
    up: record => {
      const next: StoredRecord = { ...record };
      for (const key of ['activeLayout', 'workingLayout'] as const) {
        if (key in record) next[key] = cleanLayoutName(record[key], false);
      }
      if (Array.isArray(record.recoveredDrafts)) {
        next.recoveredDrafts = (record.recoveredDrafts as unknown[]).map(layout => cleanLayoutName(layout, false));
      }
      if (Array.isArray(record.savedVariants)) next.savedVariants = cleanVariantNames(record.savedVariants as unknown[]);
      return next;
    },
  },
];

type StoredLayout = { name?: unknown; provenance?: unknown; savedAt?: unknown };

/**
 * A stored layout whose name has no role words and isn't empty, with the
 * provenance its last role word gives ('suggested'; 'replaced-active' for a
 * saved variant) unless it has one. "(draft)" says nothing reliable: a manual
 * edit and an applied candidate both wrote it. Clean layouts and non-layouts
 * are returned as they are.
 */
function cleanLayoutName(layout: unknown, isVariant: boolean): unknown {
  if (!layout || typeof layout !== 'object') return layout;
  const l = layout as StoredLayout;
  const name = typeof l.name === 'string' ? l.name : '';
  const words = legacyRoleWords(name);
  if (words.length === 0) return name.trim() ? layout : { ...l, name: FALLBACK_LAYOUT_NAME };

  const last = words[words.length - 1];
  const replacedActive = isVariant && last === 'replaced';
  const savedAt = typeof l.savedAt === 'string' ? new Date(l.savedAt) : null;
  const base = withoutLegacyRoleWords(name);
  const cleaned = replacedActive && savedAt && !Number.isNaN(savedAt.getTime())
    ? `${base} – ${variantStamp(savedAt)}`
    : base;
  const inferred = last === 'suggested' ? 'suggested' : replacedActive ? 'replaced-active' : undefined;
  const provenance = l.provenance ?? inferred;
  return { ...l, name: cleaned, ...(provenance !== undefined ? { provenance } : {}) };
}

/** Every saved variant cleaned; one renamed here takes a free name, so no two share one (T29). */
function cleanVariantNames(variants: unknown[]): unknown[] {
  const cleaned = variants.map(v => cleanLayoutName(v, true));
  const nameOf = (v: unknown) => ((v as StoredLayout | null)?.name as string | undefined) ?? '';
  // Names that stay as they were are taken first; renamed ones fit around them.
  const taken = cleaned.filter((v, i) => v === variants[i]).map(nameOf);
  return cleaned.map((v, i) => {
    if (v === variants[i]) return v;
    const name = uniqueName(nameOf(v), taken);
    taken.push(name);
    return name === nameOf(v) ? v : { ...(v as object), name };
  });
}

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
