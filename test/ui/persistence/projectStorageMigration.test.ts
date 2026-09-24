// @vitest-environment happy-dom
/**
 * Loading a stored project runs the migration runner behind a backup (S1a.2).
 *
 * indexedDbStore is replaced by an in-memory fake so the order of writes can be
 * checked: the pre-migration backup is committed before the migrated record is
 * written back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE = path.resolve(__dirname, '../../fixtures/projects/saved-by-main.json');

const log: string[] = [];
const projects = new Map<string, unknown>();
const backups = new Map<string, { key: string; projectId: string; fromVersion: number; createdAt: string; record: unknown }>();
let failBackup = false;

vi.mock('../../../src/ui/persistence/indexedDbStore', () => ({
  putProject: vi.fn(async (p: { id: string; schemaVersion: number }) => {
    log.push(`putProject v${p.schemaVersion}`);
    projects.set(p.id, structuredClone(p));
  }),
  getProject: vi.fn(async (id: string) => structuredClone(projects.get(id) ?? null)),
  deleteProjectFromDb: vi.fn(),
  listAllProjects: vi.fn(async () => []),
  getFullProject: vi.fn(async (id: string) => projects.get(id) ?? null),
  backupKey: (id: string, v: number) => `${id}@v${v}`,
  putBackup: vi.fn(async (b: { key: string; fromVersion: number }) => {
    if (failBackup) throw new Error('backup write failed');
    log.push(`putBackup v${b.fromVersion}`);
    backups.set(b.key, structuredClone(b) as never);
  }),
  listBackups: vi.fn(async () => [...backups.values()]),
}));

import { loadProjectAsync, listBackedUpProjectIds, getLatestBackup } from '../../../src/ui/persistence/projectStorage';

beforeEach(() => {
  log.length = 0;
  projects.clear();
  backups.clear();
  failBackup = false;
  localStorage.setItem('pushflow_idb_migrated', 'true');
});

describe('loadProjectAsync migrates behind a backup', () => {
  it('backs up the schema-1 record before writing the migrated one, then migrates only once', async () => {
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    projects.set(saved.id, saved);

    const state = await loadProjectAsync(saved.id);
    expect(state?.recoveredDrafts).toEqual([]);
    expect(log).toEqual(['putBackup v1', 'putProject v2']);

    const backup = await getLatestBackup(saved.id);
    expect(backup?.key).toBe(`${saved.id}@v1`);
    expect(backup?.record).toEqual(saved);
    expect(await listBackedUpProjectIds()).toEqual(new Set([saved.id]));

    // The stored record is now schema 2: a second load neither backs up nor rewrites.
    log.length = 0;
    await loadProjectAsync(saved.id);
    expect(log).toEqual([]);
  });

  it('when the backup fails, the stored record is left as it was', async () => {
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    projects.set(saved.id, saved);
    failBackup = true;
    await expect(loadProjectAsync(saved.id)).rejects.toThrow('backup write failed');
    expect(log).toEqual([]);
    expect(projects.get(saved.id)).toEqual(saved);
  });
});
