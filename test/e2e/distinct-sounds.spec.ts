/**
 * S2.2a · Tell Sounds apart (T17), P2-3: a TEST MIDI 1 import gives 7
 * pairwise-distinct colours (CIEDE2000 > 20) and 7 distinct visible pad labels,
 * and no note names appear unless "Name from GM drum map" was used.
 */

import { fileURLToPath } from 'url';
import chroma from 'chroma-js';
import { test, expect } from './fixtures';
import { newProject, openTestMidi1, suggestStartingLayout, waitForAnalysis } from './project';

const FOUR_BARS = fileURLToPath(new URL('../fixtures/midi/four-bars-120.mid', import.meta.url));

/** A note name (C1, D#2, C-2) as a word, or a pitch in parentheses. */
const NOTE_NAME = /(^|\s)[A-G]#?-?\d+(\s|$)|\(\d+\)/;

test.describe('S2.2a · distinct Sounds (P2-3)', () => {
  test('TEST MIDI 1: 7 distinct colours, 7 distinct visible pad labels, no note names', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await suggestStartingLayout(page, pf);
    await waitForAnalysis(pf);

    const sounds = (await pf.call('state')).soundStreams;
    expect(sounds).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const d = chroma.deltaE(sounds[i]!.color, sounds[j]!.color);
        expect(d, `${sounds[i]!.name} ${sounds[i]!.color} vs ${sounds[j]!.name} ${sounds[j]!.color}`).toBeGreaterThan(20);
      }
    }

    const labels = page.getByTestId('pad-label');
    await expect(labels).toHaveCount(7);
    for (const label of await labels.all()) await expect(label).toBeVisible();
    const texts = await labels.allTextContents();
    expect(new Set(texts).size).toBe(7);
    expect(texts.every(t => t.trim().length > 0 && !t.includes('…'))).toBe(true);

    // No note names: the Sounds, the Sounds panel, the timeline's lane names and the pads.
    expect(sounds.filter(s => NOTE_NAME.test(s.name)).map(s => s.name)).toEqual([]);
    const visible = [
      ...(await page.getByTestId('sound-name').allTextContents()),
      ...texts,
    ];
    expect(visible.filter(t => NOTE_NAME.test(t))).toEqual([]);
  });

  test('Name from GM drum map, from the import toast, renames GM Sounds as one undo step', async ({ page, pf }) => {
    await newProject(page, pf);
    await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(FOUR_BARS);
    await expect.poll(async () => (await pf.call('status')).soundCount).toBe(3);
    const namesNow = async () => (await pf.call('state')).soundStreams.map(s => s.name);
    expect(await namesNow()).toEqual(['Four Bars 120 A', 'Four Bars 120 B', 'Four Bars 120 C']);

    const toast = page.getByTestId('toast').filter({ hasText: 'Imported 3 Sounds' });
    await toast.getByRole('button', { name: 'Name from GM drum map' }).click();
    await expect.poll(namesNow).toEqual(['Kick', 'Snare', 'Closed Hat']);
    await expect(page.getByTestId('undo-button')).toHaveAttribute('title', /Name from GM drum map/);

    await page.getByTestId('undo-button').click();
    await expect.poll(namesNow).toEqual(['Four Bars 120 A', 'Four Bars 120 B', 'Four Bars 120 C']);
  });

  test('rename from the keyboard: F2, then Tab moves on to the next Sound', async ({ page, pf }) => {
    await openTestMidi1(page, pf);
    await page.getByTestId('sound-name').first().focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('Kick');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Snare');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    const names = (await pf.call('state')).soundStreams.map(s => s.name);
    expect(names.slice(0, 3)).toEqual(['Kick', 'Snare', 'TEST MIDI 1 C']);
  });
});
