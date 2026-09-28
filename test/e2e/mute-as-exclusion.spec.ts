/**
 * S4.4 · the mute-as-exclusion migration (T15; roadmap P4-12), in the browser.
 *
 * A project stored at schema 7 with a muted Sound (mute used to leave a Sound
 * out of the analysis) is backed up untouched, then stored at the current
 * schema with that Sound excluded from analysis instead and no mute or solo
 * flags left. The editor says so once, in a toast naming the Sound, and the
 * project is saved without the notice; opening it again migrates nothing and
 * says nothing.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { newProject, waitForSaved } from './project';
import { PERSISTED_SCHEMA_VERSION } from '../../src/ui/persistence/persistedProject';
import { MIGRATIONS, runMigrations } from '../../src/ui/persistence/migrations';

const FIXTURE = fileURLToPath(new URL('../fixtures/projects/saved-by-main.json', import.meta.url));

type Item = Record<string, unknown> & { id: string; name: string };
type StoredProject = { id: string; schemaVersion: number; soundStreams: Item[]; performanceLanes: Item[]; notices?: unknown };

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

test.describe('S4.4 · mute-as-exclusion (P4-12)', () => {
  test('a schema-7 project with a muted Sound is backed up, then stored with it excluded; the notice shows once', async ({ page, pf }) => {
    await newProject(page, pf);
    const at7 = runMigrations(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), MIGRATIONS.filter(m => m.to <= 7)).record as unknown as StoredProject;
    const muted = at7.soundStreams[1]!;
    const record: StoredProject = {
      ...at7,
      soundStreams: at7.soundStreams.map(s => (s.id === muted.id ? { ...s, muted: true } : s)),
      performanceLanes: at7.performanceLanes.map(l => (l.id === muted.id ? { ...l, isMuted: true } : l)),
    };
    expect(record.schemaVersion).toBe(7);
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
    // The notice, naming the Sound as it is called now.
    const toast = page.getByText(/^Mute now only silences a Sound in rehearsal\./);
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(`${muted.name}, which you had muted, is excluded from analysis instead`);
    // The Sound is badged Excluded, not muted.
    const row = page.locator(`[data-testid="sound-row"][data-sound-id="${muted.id}"]`);
    await expect(row.getByTestId('sound-excluded')).toHaveText('Excluded');
    await expect(row.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'false');

    // Backed up untouched, then written at the current schema; the notice is saved away once shown.
    const backup = await stored<{ fromVersion: number; record: StoredProject }>(page, 'backups', `${record.id}@v7`);
    expect(backup?.record).toEqual(record);
    await waitForSaved(page);
    await expect.poll(async () => {
      const r = await stored<StoredProject>(page, 'projects', record.id);
      return r && { schemaVersion: r.schemaVersion, notices: r.notices ?? null };
    }).toEqual({ schemaVersion: PERSISTED_SCHEMA_VERSION, notices: null });
    const migrated = (await stored<StoredProject>(page, 'projects', record.id))!;
    expect(migrated.soundStreams.find(s => s.id === muted.id)!.excluded).toBe(true);
    expect(migrated.soundStreams.filter(s => 'muted' in s)).toEqual([]);
    expect(migrated.performanceLanes.filter(l => 'isMuted' in l || 'isSolo' in l)).toEqual([]);

    // Opening it again: no migration, no backup, no notice.
    await page.reload();
    await pf.ready();
    await expect(row.getByTestId('sound-excluded')).toHaveText('Excluded');
    await page.waitForTimeout(500);
    await expect(page.getByText(/^Mute now only silences a Sound in rehearsal\./)).toHaveCount(0);
    expect(await stored(page, 'backups', `${record.id}@v8`)).toBeNull();
  });
});
