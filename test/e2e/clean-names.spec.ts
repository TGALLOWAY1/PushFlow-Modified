/**
 * S3.2 · clean names (T32; roadmap P3-10a), in the browser.
 *
 * - Suggest, an edit and Promote never write a role word into a layout name:
 *   the Layout Summary reads "Draft of Default", the Active Layout "Default",
 *   and the Active a Promote replaces is kept as "Default – 25 Sep 14:02".
 * - A project stored at schema 4 with "(draft) (draft)", "(suggested)" and
 *   "(replaced …)" names is backed up untouched, then stored with clean names
 *   (schema 5); opening it again migrates nothing.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { newProject, openTestMidi1, suggestStartingLayout, waitForSaved } from './project';

const ROLE_FIXTURE = fileURLToPath(new URL('../fixtures/projects/role-suffixes.json', import.meta.url));
const ROLE_WORD = /\((draft|suggested)\)|\(replaced/;
const DATED_NAME = /^Default – \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2}$/;

type StoredLayout = { id: string; name: string; provenance?: string };
type StoredProject = {
  id: string;
  schemaVersion: number;
  activeLayout: StoredLayout;
  workingLayout: StoredLayout | null;
  savedVariants: StoredLayout[];
  recoveredDrafts?: StoredLayout[];
};

const projectIdOf = (page: Page) => new URL(page.url()).pathname.split('/').pop()!;
const namesOf = (p: StoredProject) =>
  [p.activeLayout, p.workingLayout, ...p.savedVariants, ...(p.recoveredDrafts ?? [])].filter(Boolean).map(l => l!.name);

/** A record from one of the app's IndexedDB stores ('projects' or 'backups'). */
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

test.describe('S3.2 · clean names (T32)', () => {
  test('Suggest, an edit and Promote keep every layout name clean', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const summaryName = page.getByTestId('layout-summary-name');
    await expect(summaryName).toHaveText('Default');

    await suggestStartingLayout(page, pf);
    await expect(summaryName).toHaveText('Draft of Default');
    await page.getByTitle('Make this layout the new Active Layout').click();
    await expect(summaryName).toHaveText('Default');

    // The next edit is a draft of Default again ("Default (draft) (draft)" before T32).
    const streams = (await pf.call('state')).soundStreams;
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream: streams[0] } });
    await expect(summaryName).toHaveText('Draft of Default');
    await page.getByTitle('Make this layout the new Active Layout').click();
    await expect(summaryName).toHaveText('Default');

    // The replaced Active is kept under a clean, dated name.
    await expect.poll(async () => (await pf.call('state')).savedVariants.length).toBe(1);
    const state = await pf.call('state');
    expect(state.activeLayout).toMatchObject({ name: 'Default', provenance: 'manual' });
    expect(state.savedVariants[0]!.name).toMatch(DATED_NAME);
    expect(state.savedVariants[0]!.provenance).toBe('replaced-active');

    // And that is what is stored.
    await page.getByTitle('Save project').click();
    await waitForSaved(page);
    const id = projectIdOf(page);
    await expect.poll(async () => (await stored<StoredProject>(page, 'projects', id))?.savedVariants.length).toBe(1);
    const record = (await stored<StoredProject>(page, 'projects', id))!;
    expect(record.schemaVersion).toBe(5);
    expect(namesOf(record).filter(n => ROLE_WORD.test(n))).toEqual([]);
    expect(namesOf(record)).toEqual(['Default', state.savedVariants[0]!.name]);
  });

  test('P3-10a: a schema-4 project with role words in its layout names is backed up, then stored clean; a second open changes nothing', async ({ page, pf }) => {
    // A project first, so the app has created its database.
    await newProject(page, pf);
    const fixture = JSON.parse(fs.readFileSync(ROLE_FIXTURE, 'utf8')) as StoredProject;
    expect(fixture.schemaVersion).toBe(4);
    expect(namesOf(fixture).filter(n => ROLE_WORD.test(n))).toHaveLength(7);
    await page.evaluate(record => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pushflow');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(record);
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), fixture);

    await page.goto(`/project/${fixture.id}`);
    await pf.ready();
    await expect(page.getByTestId('layout-summary-name')).toHaveText('Draft of Default');

    // Backed up untouched, then written back at schema 5 with clean names.
    await expect.poll(async () => (await stored<StoredProject>(page, 'projects', fixture.id))?.schemaVersion).toBe(5);
    const backup = await stored<{ fromVersion: number; record: StoredProject }>(page, 'backups', `${fixture.id}@v4`);
    expect(backup?.fromVersion).toBe(4);
    expect(backup?.record).toEqual(fixture);
    const migrated = (await stored<StoredProject>(page, 'projects', fixture.id))!;
    const names = namesOf(migrated);
    expect(names.filter(n => ROLE_WORD.test(n) || !n.trim())).toEqual([]);
    expect(migrated.activeLayout).toMatchObject({ name: 'Default', provenance: 'suggested' });
    expect(migrated.savedVariants.filter(v => v.provenance === 'replaced-active').map(v => v.name))
      .toEqual([expect.stringMatching(/^Default – \d{1,2} Sep \d{2}:\d{2}$/), expect.stringMatching(/^Default – \d{1,2} Sep \d{2}:\d{2} \(2\)$/)]);

    // Opening it again migrates nothing: same schema, same names, still one backup.
    await page.reload();
    await pf.ready();
    await expect(page.getByTestId('layout-summary-name')).toHaveText('Draft of Default');
    const again = (await stored<StoredProject>(page, 'projects', fixture.id))!;
    expect(again.schemaVersion).toBe(5);
    expect(namesOf(again)).toEqual(names);
    expect(await stored(page, 'backups', `${fixture.id}@v5`)).toBeNull();
  });
});
