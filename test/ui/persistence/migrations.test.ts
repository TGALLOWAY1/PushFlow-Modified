/**
 * Migration runner (S1a.2; roadmap P1a "Migration runner").
 *
 * Session check: the backup is written before any migration, migrations run
 * in order, and a second run changes nothing.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  MIGRATIONS,
  runMigrations,
  migrateWithBackup,
  needsMigration,
  type Migration,
  type StoredRecord,
} from '../../../src/ui/persistence/migrations';
import { PERSISTED_SCHEMA_VERSION } from '../../../src/ui/persistence/persistedProject';
import { validateAndMigrateRaw } from '../../../src/ui/persistence/projectSerializer';

const FIXTURE = path.resolve(__dirname, '../../fixtures/projects/saved-by-main.json');
const savedByMain = (): StoredRecord => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const GHOST_FIXTURE = path.resolve(__dirname, '../../fixtures/projects/ghost-locks.json');
const withGhostLocks = (): StoredRecord => JSON.parse(fs.readFileSync(GHOST_FIXTURE, 'utf8'));

type StoredLayout = { padToVoice: Record<string, { id: string }>; placementLocks: Record<string, string> };
const layoutsOf = (record: StoredRecord): StoredLayout[] => [
  record.activeLayout as StoredLayout,
  record.workingLayout as StoredLayout,
  ...(record.savedVariants as StoredLayout[]),
  ...(record.recoveredDrafts as StoredLayout[]),
];
const onlyStep = (name: string) => MIGRATIONS.filter(m => m.name === name);

/** Three fake steps that log when they run. */
function loggingMigrations(log: string[]): Migration[] {
  return [3, 1, 2].map(from => ({
    from,
    to: from + 1,
    name: `m${from}`,
    up: (r: StoredRecord) => {
      log.push(`m${from}`);
      return { ...r, [`touched${from}`]: true };
    },
  }));
}

describe('runMigrations', () => {
  it('runs the migrations a record needs, in version order, whatever the list order', () => {
    const log: string[] = [];
    const { record, fromVersion, applied } = runMigrations({ id: 'p', schemaVersion: 1 }, loggingMigrations(log));
    expect(log).toEqual(['m1', 'm2', 'm3']);
    expect(applied).toEqual(['m1', 'm2', 'm3']);
    expect(fromVersion).toBe(1);
    expect(record.schemaVersion).toBe(4);
  });

  it('skips migrations the record is already past', () => {
    const log: string[] = [];
    runMigrations({ id: 'p', schemaVersion: 3 }, loggingMigrations(log));
    expect(log).toEqual(['m3']);
  });

  it('a second run changes nothing', () => {
    const once = runMigrations(savedByMain()).record;
    const twice = runMigrations(structuredClone(once));
    expect(twice.applied).toEqual([]);
    expect(twice.record).toEqual(once);
  });

  it('does not mutate its input', () => {
    const input = savedByMain();
    const copy = structuredClone(input);
    runMigrations(input);
    expect(input).toEqual(copy);
  });

  it('every migration is idempotent on its own output', () => {
    let record = savedByMain();
    for (const migration of MIGRATIONS) {
      const once = migration.up(record);
      expect(migration.up(once)).toEqual(once);
      record = { ...once, schemaVersion: migration.to };
    }
  });

  it('the last migration reaches PERSISTED_SCHEMA_VERSION, one version at a time', () => {
    for (const m of MIGRATIONS) expect(m.to).toBe(m.from + 1);
    expect(Math.max(...MIGRATIONS.map(m => m.to))).toBe(PERSISTED_SCHEMA_VERSION);
  });
});

describe('recovered-drafts-store (schema 1 → 2)', () => {
  it('adds an empty Recovered drafts list to a project saved before it existed', () => {
    const saved = savedByMain();
    expect(saved.schemaVersion).toBe(1);
    expect('recoveredDrafts' in saved).toBe(false);
    const { record, applied } = runMigrations(saved, onlyStep('recovered-drafts-store'));
    expect(applied).toEqual(['recovered-drafts-store']);
    expect(record.schemaVersion).toBe(2);
    expect(record.recoveredDrafts).toEqual([]);
    // Nothing else changes.
    const { schemaVersion: _a, recoveredDrafts: _b, ...rest } = record;
    const { schemaVersion: _c, ...savedRest } = saved;
    expect(rest).toEqual(savedRest);
  });

  it('marks any recovered drafts with provenance "recovered"', () => {
    const { record } = runMigrations({ id: 'p', schemaVersion: 1, recoveredDrafts: [{ id: 'd1', padToVoice: {} }] }, onlyStep('recovered-drafts-store'));
    expect(record.recoveredDrafts).toEqual([{ id: 'd1', padToVoice: {}, provenance: 'recovered' }]);
  });

  it('a schema-1 project runs every later step too and lands on the current schema', () => {
    const { record, applied } = runMigrations(savedByMain());
    expect(applied).toEqual(['recovered-drafts-store', 'prune-ghost-locks']);
    expect(record.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
  });

  it('a legacy (unversioned) record is converted and migrated to the current schema', () => {
    const legacy = { id: 'old', name: 'Old', version: 2, activeLayout: { id: 'a', padToVoice: {} }, savedVariants: [] };
    expect(needsMigration(legacy)).toBe(true);
    const persisted = validateAndMigrateRaw(legacy);
    expect(persisted.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
    expect(persisted.recoveredDrafts).toEqual([]);
  });
});

// S1a.4 (T12, F10-V02; roadmap P1a-13a): locks whose Sound is not on the
// locked pad are removed from every stored layout.
describe('prune-ghost-locks (schema 2 → 3)', () => {
  it('the fixture has ghost locks in Active, the draft, a variant and a recovered draft', () => {
    const saved = withGhostLocks();
    expect(saved.schemaVersion).toBe(2);
    const ghosts = layoutsOf(saved).map(l =>
      Object.entries(l.placementLocks).filter(([id, pad]) => l.padToVoice[pad]?.id !== id).length);
    expect(ghosts).toEqual([2, 1, 0, 1, 1]);
  });

  it('removes every ghost lock, keeps every lock whose Sound is on its pad, and changes nothing else', () => {
    const saved = withGhostLocks();
    const { record, applied } = runMigrations(saved);
    expect(applied).toEqual(['prune-ghost-locks']);
    expect(record.schemaVersion).toBe(3);

    const active = record.activeLayout as StoredLayout;
    expect(active.placementLocks).toEqual({ 'lane_1790212333742_q33d4p': '3,3' });
    const working = record.workingLayout as StoredLayout;
    expect(working.placementLocks).toEqual({ 'lane_1790212333742_50fyvz': '2,4' });
    const variant = (record.savedVariants as StoredLayout[]).find(v => (v as { id: string }).id === 'variant-ghost')!;
    expect(variant.placementLocks).toEqual({ 'lane_1790212333742_jm0lqi': '4,1' });
    expect((record.recoveredDrafts as StoredLayout[])[0].placementLocks).toEqual({});
    for (const layout of layoutsOf(record)) {
      for (const [voiceId, pad] of Object.entries(layout.placementLocks)) {
        expect(layout.padToVoice[pad]?.id).toBe(voiceId);
      }
    }

    // Only placementLocks changed.
    const stripLocks = (r: StoredRecord) => JSON.parse(JSON.stringify(r, (key, value) =>
      key === 'placementLocks' || key === 'schemaVersion' ? undefined : value));
    expect(stripLocks(record)).toEqual(stripLocks(saved));
  });

  it('running it again changes nothing', () => {
    const once = runMigrations(withGhostLocks()).record;
    const twice = runMigrations(structuredClone(once));
    expect(twice.applied).toEqual([]);
    expect(twice.record).toEqual(once);
    const step = onlyStep('prune-ghost-locks')[0];
    expect(step.up(structuredClone(once))).toEqual(once);
  });

  it('leaves a layout with no locks map, or no layout at all, as it is', () => {
    const { record } = runMigrations({ id: 'p', schemaVersion: 2, activeLayout: { id: 'a', padToVoice: {} }, savedVariants: 'not-a-list' });
    expect(record).toEqual({ id: 'p', schemaVersion: 3, activeLayout: { id: 'a', padToVoice: {} }, savedVariants: 'not-a-list' });
  });
});

describe('migrateWithBackup', () => {
  it('writes the backup, with the untouched record, before any migration step runs', async () => {
    const log: string[] = [];
    const saved = savedByMain();
    const untouched = structuredClone(saved);
    let backedUp: StoredRecord | null = null;
    const result = await migrateWithBackup(
      saved,
      async (record, fromVersion) => {
        await Promise.resolve();
        log.push(`backup v${fromVersion}`);
        backedUp = record;
      },
      record => runMigrations(record, [...MIGRATIONS.map(m => ({ ...m, up: (r: StoredRecord) => { log.push(m.name); return m.up(r); } }))]),
    );
    expect(log).toEqual(['backup v1', 'recovered-drafts-store', 'prune-ghost-locks']);
    expect(backedUp).toEqual(untouched);
    expect(result.record.schemaVersion).toBe(3);
  });

  it('writes no backup when nothing needs migrating', async () => {
    const current = runMigrations(savedByMain()).record;
    let backups = 0;
    await migrateWithBackup(current, async () => { backups++; }, runMigrations);
    expect(backups).toBe(0);
  });

  it('migrates nothing when the backup fails', async () => {
    let migrated = false;
    await expect(migrateWithBackup(
      savedByMain(),
      async () => { throw new Error('quota'); },
      record => { migrated = true; return record; },
    )).rejects.toThrow('quota');
    expect(migrated).toBe(false);
  });
});
