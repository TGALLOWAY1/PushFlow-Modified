/**
 * S9.1 · the performance-route migration (P9-1a), in the browser.
 *
 * A project stored at schema 8 (before the Performance Route existed) is
 * backed up untouched, then stored at the current schema with no route
 * (null: the Route will show the detected one). Opening it again migrates
 * nothing and backs nothing up.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { newProject, waitForSaved } from './project';
import { PERSISTED_SCHEMA_VERSION } from '../../src/ui/persistence/persistedProject';
import { MIGRATIONS, runMigrations } from '../../src/ui/persistence/migrations';

const FIXTURE = fileURLToPath(new URL('../fixtures/projects/saved-by-main.json', import.meta.url));

type StoredProject = { id: string; name: string; schemaVersion: number; performanceRoute?: unknown };

async function stored<T>(page: Page, store: 'projects' | 'backups', key: string): Promise<T | null> {
  return page.evaluate(([s, k]) => new Promise<T | null>(resolve => {
    const open = indexedDB.open('pushflow');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const get = open.result.transaction(s).objectStore(s).get(k);
      get.onerror = () => { open.result.close(); resolve(null); };
      get.onsuccess = () => { open.result.close(); resolve((get.result as T) ?? null); };
    };
  }), [store, key] as const);
}

test.describe('S9.1 · performance-route migration (P9-1a)', () => {
  test('a schema-8 project is backed up, then stored with no Performance Route; a second open migrates nothing', async ({ page, pf }) => {
    await newProject(page, pf);
    const record = runMigrations(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), MIGRATIONS.filter(m => m.to <= 8)).record as unknown as StoredProject;
    expect(record.schemaVersion).toBe(8);
    expect('performanceRoute' in record).toBe(false);
    await page.evaluate(r => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pushflow');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(r);
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), record);

    await page.goto(`/project/${record.id}`);
    await pf.ready();
    expect((await pf.call('state')).performanceRoute).toBeNull();

    // Backed up untouched, then written at the current schema with no route.
    const backup = await stored<{ fromVersion: number; record: StoredProject }>(page, 'backups', `${record.id}@v8`);
    expect(backup?.record).toEqual(record);
    await waitForSaved(page);
    await expect.poll(async () => {
      const r = await stored<StoredProject>(page, 'projects', record.id);
      return r && { schemaVersion: r.schemaVersion, performanceRoute: r.performanceRoute };
    }).toEqual({ schemaVersion: PERSISTED_SCHEMA_VERSION, performanceRoute: null });

    // Opening it again: no migration, no backup.
    await page.reload();
    await pf.ready();
    expect((await pf.call('state')).performanceRoute).toBeNull();
    expect(await stored(page, 'backups', `${record.id}@v${PERSISTED_SCHEMA_VERSION}`)).toBeNull();
  });
});
