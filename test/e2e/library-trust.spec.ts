/**
 * S2.3 · a Library you can trust, variants worth keeping, guidance and gear
 * cleanup (T51, T52, T53, T29, T44, T39).
 *
 * P2-5a cards show real data; P2-5b a draft-only project shows its pads;
 * P2-5c Import MIDI from the Library places nothing, and the demo opens
 * unplaced; P2-6 variant names are distinct and survive a rename and a reload,
 * and each card is scored; P2-7 Delete then Undo within 10 s restores the
 * project exactly.
 */

import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { TEST_MIDI_1, newProject, openTestMidi1, saveAndReload, suggestStartingLayout, waitForAnalysis } from './project';

const projectIdOf = (page: Page) => new URL(page.url()).pathname.split('/').pop()!;

async function backToLibrary(page: Page) {
  await page.getByRole('button', { name: /Library/ }).first().click();
  await page.waitForURL(url => !url.pathname.includes('/project/'));
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible();
}

/** The stored record, straight from IndexedDB. */
async function storedRecord(page: Page, id: string): Promise<Record<string, unknown> | null> {
  return page.evaluate(projectId => new Promise<Record<string, unknown> | null>(resolve => {
    const open = indexedDB.open('pushflow');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const get = open.result.transaction('projects').objectStore('projects').get(projectId);
      get.onerror = () => resolve(null);
      get.onsuccess = () => { open.result.close(); resolve(get.result ?? null); };
    };
  }), id);
}

async function waitStored(page: Page, id: string, check: (r: Record<string, unknown>) => boolean) {
  await expect.poll(async () => { const r = await storedRecord(page, id); return !!r && check(r); }, { timeout: 15_000 }).toBe(true);
}

test.describe('S2.3 · the Library', () => {
  test('cards show real data, and a draft-only project shows its pads (P2-5a, P2-5b)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    const id = projectIdOf(page);
    await backToLibrary(page);
    await waitStored(page, id, r => !!r.workingLayout);
    // Another project, opened later, takes the hero, so the first one is a card.
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await pf.ready();
    await backToLibrary(page);

    const card = page.locator(`[data-testid="project-card"][data-project-id="${id}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId('project-facts')).toHaveText('8 bars · 32 events · 7 Sounds · 120 BPM');
    await expect(card.getByTestId('project-dates')).toHaveText(/^Created [A-Z][a-z]{2} \d{1,2} · Opened (just now|\d+m ago)$/);
    await expect(card.getByTestId('layout-badge')).toHaveText('Draft, not promoted');
    await expect(card.locator('[data-occupied="true"]')).toHaveCount(7);

    // The hero is the project opened last, with the same real data.
    const hero = page.getByTestId('project-hero');
    await expect(hero).not.toHaveAttribute('data-project-id', id);
    await expect(hero.getByTestId('project-facts')).toHaveText('No Sounds yet · 120 BPM');
  });

  test('looking at a project does not make it look edited', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const id = projectIdOf(page);
    await backToLibrary(page);
    await waitStored(page, id, r => Array.isArray(r.soundStreams) && (r.soundStreams as unknown[]).length === 7);
    const before = await storedRecord(page, id);
    await page.locator(`[data-project-id="${id}"]`).getByTestId('project-name').click();
    await pf.ready();
    await backToLibrary(page);
    await waitStored(page, id, r => r.lastOpenedAt !== before!.lastOpenedAt);
    const after = await storedRecord(page, id);
    expect(after!.updatedAt).toBe(before!.updatedAt);
  });

  test('Import MIDI creates "TEST MIDI 1" with nothing placed, and the demo opens unplaced (P2-5c)', async ({ page, pf }) => {
    await page.goto('/');
    await page.getByTestId('library-import-input').setInputFiles(TEST_MIDI_1);
    await page.waitForURL('**/project/**');
    await pf.ready();
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(7);
    const imported = await pf.call('state');
    expect(imported.name).toBe('TEST MIDI 1');
    expect(Object.keys(imported.activeLayout.padToVoice)).toEqual([]);
    expect(imported.workingLayout).toBeNull();
    expect(imported.instrumentConfig.bottomLeftNote).toBe(36);
    // The grid says how to place them, and places nothing by itself.
    await expect(page.getByTestId('grid-place-hint')).toContainText('Place your 7 Sounds: click one, then a pad');

    await backToLibrary(page);
    await page.getByRole('button', { name: 'Open the demo' }).click();
    await page.waitForURL(url => url.pathname.includes('/project/') && !url.pathname.endsWith(imported.id));
    await pf.ready();
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(7);
    const demo = await pf.call('state');
    expect(demo.name).toBe('Demo · TEST MIDI 1');
    expect(Object.keys((demo.workingLayout ?? demo.activeLayout).padToVoice)).toEqual([]);
    expect(demo.instrumentConfig.bottomLeftNote).toBe(36);
  });

  test('a file that is neither MIDI nor a project is refused in plain words', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('library-import-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert')).toContainText('"notes.txt" isn\'t a MIDI file');
  });

  test('Delete, then Undo within 10 s, restores the project exactly (P2-7)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await pf.call('dispatch', { type: 'SAVE_AS_VARIANT', payload: { name: 'Keep this', source: 'working' } });
    const id = projectIdOf(page);
    await backToLibrary(page);
    await waitStored(page, id, r => Array.isArray(r.savedVariants) && (r.savedVariants as unknown[]).length === 1);
    const before = await storedRecord(page, id);

    const hero = page.getByTestId('project-hero');
    await expect(hero).toHaveAttribute('data-project-id', id);
    await hero.getByTestId('project-menu-button').click();
    await page.getByTestId('project-menu').getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.locator(`[data-project-id="${id}"]`)).toHaveCount(0);
    expect(await storedRecord(page, id)).toBeNull();

    await page.getByTestId('toast').filter({ hasText: 'Deleted' }).getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator(`[data-project-id="${id}"]`).first()).toBeVisible();
    expect(await storedRecord(page, id)).toEqual(before);
  });

  test('Rename and Duplicate from the menu', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    const id = projectIdOf(page);
    await backToLibrary(page);
    const hero = page.getByTestId('project-hero');
    await hero.getByTestId('project-menu-button').click();
    await page.getByTestId('project-menu').getByRole('menuitem', { name: 'Rename' }).click();
    await hero.getByTestId('project-rename').fill('Groove sketch');
    await hero.getByTestId('project-rename').press('Enter');
    await expect(hero.getByTestId('project-name')).toHaveText('Groove sketch');

    await hero.getByTestId('project-menu-button').click();
    await page.getByTestId('project-menu').getByRole('menuitem', { name: 'Duplicate' }).click();
    const copy = page.locator('[data-testid="project-card"]', { hasText: 'Groove sketch (copy)' });
    await expect(copy).toBeVisible();
    await expect(copy.getByTestId('project-dates')).toContainText('Not opened yet');
    await expect(copy.getByTestId('project-facts')).toHaveText('8 bars · 32 events · 7 Sounds · 120 BPM');
    expect(await copy.getAttribute('data-project-id')).not.toBe(id);
  });
});

test.describe('S2.3 · variants worth keeping', () => {
  /** Saves a variant under the offered name ("Default – 25 Sep 14:02", numbered when taken). */
  async function saveVariant(page: Page) {
    await page.getByTestId('save-variant').click();
    await expect(page.getByTestId('save-variant-name')).toHaveValue(/^Default – \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2}( \(\d+\))?$/);
    await page.getByTestId('save-variant-confirm').click();
  }

  async function variantNames(pf: PfHandle): Promise<string[]> {
    return (await pf.call('state')).savedVariants.map(v => v.name);
  }

  test('distinct names in the same minute; a rename survives a reload; each card is scored (P2-6)', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);

    await saveVariant(page);
    await saveVariant(page);
    const names = await variantNames(pf);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    // Saved within the same minute, the second is numbered (unless the clock just turned).
    if (names[0]!.slice(-5) === names[1]!.slice(-9, -4)) expect(names[1]).toBe(`${names[0]} (2)`);
    await expect(page.getByTestId('toast').filter({ hasText: `Saved variant "${names[1]}"` })).toBeVisible();

    const rows = page.getByTestId('variant-row');
    await expect(rows).toHaveCount(2);
    const variantId = await rows.filter({ hasText: names[1]! }).getAttribute('data-variant-id');
    const renamed = page.locator(`[data-variant-id="${variantId}"]`);
    await renamed.getByTestId('variant-rename').click();
    await renamed.getByTestId('variant-name-input').fill('Wide hands');
    await renamed.getByTestId('variant-name-input').press('Enter');
    await expect.poll(() => variantNames(pf)).toEqual([names[0], 'Wide hands']);

    await saveAndReload(page, pf);
    expect(await variantNames(pf)).toEqual([names[0], 'Wide hands']);
    for (const row of await page.getByTestId('variant-row').all()) {
      await expect(row.getByTestId('variant-score')).toHaveText(/^Score \d+% · \d+ hard · \d+ unplayable$/, { timeout: 30_000 });
    }
  });
});

test.describe('S2.3 · guidance and gear', () => {
  test('an empty project offers Import MIDI or the Composer at the grid, and takes a dropped .mid', async ({ page, pf }) => {
    await newProject(page, pf);
    const start = page.getByTestId('grid-start');
    await expect(start).toBeVisible();
    await start.getByTestId('grid-start-composer').click();
    await expect(page.getByTestId('drawer-panel-composer')).toBeVisible();

    // Drop TEST MIDI 1 on the grid, as a file from the desktop would arrive.
    const bytes = [...(await import('fs')).readFileSync(TEST_MIDI_1)];
    await start.evaluate((el, data) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], 'TEST MIDI 1.mid', { type: 'audio/midi' }));
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, bytes);
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(7);
    await expect(start).toHaveCount(0);
    await expect(page.getByTestId('grid-place-hint')).toBeVisible();
    await expect(page.getByTestId('summary-nothing-placed')).toBeVisible();
  });

  test('the gear has no dead toggle or hidden duplicate, and view settings are remembered', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByRole('button', { name: 'View settings' }).click();
    await expect(page.getByText('Organize by 4x4 Banks')).toHaveCount(0);
    await expect(page.getByText('Duplicate Layout')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show Note Labels' }).click();
    await page.keyboard.press('Escape');
    await page.reload();
    await pf.ready();
    await page.getByRole('button', { name: 'View settings' }).click();
    await expect(page.getByRole('button', { name: 'Show Note Labels' }).locator('svg')).toHaveCount(1);
  });

  test('the editor\'s title menu exports the project file', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByTestId('project-title-menu').click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export project file' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pushflow\.json$/);
  });
});
