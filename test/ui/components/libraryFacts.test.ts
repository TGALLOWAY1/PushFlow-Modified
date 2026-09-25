// @vitest-environment happy-dom
/**
 * S2.3 · the Library shows real data only (T52, P2-5a/P2-5b), variants get
 * names worth keeping (T29, P2-6), and view settings are remembered (T39).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { projectIndexEntry, byRecency, lastOpenedProject } from '../../../src/ui/persistence/projectIndex';
import { serializeProject } from '../../../src/ui/persistence/projectSerializer';
import { projectDates, projectFacts, relativeTime, shortDate, thumbnailLayout, variantCount } from '../../../src/ui/components/Homepage/projectFacts';
import { projectReducer, createEmptyProjectState } from '../../../src/ui/state/projectState';
import { suggestVariantName, variantBaseName, variantStamp } from '../../../src/ui/state/variantNames';
import { DEFAULT_VIEW_SETTINGS, loadViewSettings, saveViewSettings } from '../../../src/ui/state/viewSettings';
import { uniqueName } from '../../../src/utils/uniqueName';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

const NOW = Date.parse('2026-09-25T12:00:00Z');

describe('Library entries (P2-5a)', () => {
  it('TEST MIDI 1 reads 8 bars · 32 events · 7 Sounds · 120 BPM: events are moments, notes are hits', async () => {
    const state = await importTestMidi1();
    const entry = projectIndexEntry(serializeProject({ ...state, id: 'p1', name: 'TEST MIDI 1' }));
    expect(entry.durationBars).toBe(8);
    expect(entry.eventCount).toBe(32);
    expect(entry.noteCount).toBe(48);
    expect(entry.soundCount).toBe(7);
    expect(projectFacts(entry)).toBe('8 bars · 32 events · 7 Sounds · 120 BPM');
  });

  it('an empty project says so instead of "0 bars · 0 events"', () => {
    expect(projectFacts({ durationBars: 0, eventCount: 0, soundCount: 0, tempo: 96 })).toBe('No Sounds yet · 96 BPM');
  });

  it('dates read "Created Sep 20 · Opened 2h ago", and never-opened projects say so', () => {
    expect(projectDates({ createdAt: '2026-09-20T09:00:00Z', lastOpenedAt: '2026-09-25T10:00:00Z' }, NOW))
      .toBe('Created Sep 20 · Opened 2h ago');
    expect(projectDates({ createdAt: '2026-09-25T11:59:40Z', lastOpenedAt: '2026-09-25T11:59:40Z' }, NOW))
      .toBe('Created Sep 25 · Opened just now');
    expect(projectDates({ createdAt: '2026-09-20T09:00:00Z', lastOpenedAt: '' }, NOW))
      .toBe('Created Sep 20 · Not opened yet');
    expect(shortDate('2025-03-02T09:00:00Z', NOW)).toBe('Mar 2, 2025');
    expect(relativeTime('2026-09-22T12:00:00Z', NOW)).toBe('3d ago');
  });

  it('a record from before schema 4 counts as opened when it was last saved', () => {
    const entry = projectIndexEntry({ ...serializeProject({ ...createEmptyProjectState(), id: 'old', name: 'Old' }), lastOpenedAt: undefined, updatedAt: '2026-09-01T00:00:00Z' });
    expect(entry.lastOpenedAt).toBe('2026-09-01T00:00:00Z');
  });

  it('lists by last opened or created, and continues the project opened last', () => {
    const e = (id: string, createdAt: string, lastOpenedAt: string) => ({
      id, name: id, createdAt, updatedAt: createdAt, lastOpenedAt, soundCount: 0, eventCount: 0, noteCount: 0, tempo: 120, durationBars: 0,
    });
    const opened = e('opened', '2026-09-01T00:00:00Z', '2026-09-24T00:00:00Z');
    const copy = e('copy', '2026-09-25T00:00:00Z', ''); // a duplicate, never opened
    const old = e('old', '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z');
    expect([old, opened, copy].sort(byRecency).map(x => x.id)).toEqual(['copy', 'opened', 'old']);
    expect(lastOpenedProject([copy, opened, old])?.id).toBe('opened');
    expect(lastOpenedProject([copy])?.id).toBe('copy');
    expect(lastOpenedProject([])).toBeNull();
  });
});

describe('thumbnails (P2-5b, decision Q1)', () => {
  it('a draft-only project shows its draft, badged "Draft, not promoted"', async () => {
    const state = await suggestedTestMidi1();
    expect(state.workingLayout).not.toBeNull();
    const thumb = thumbnailLayout(state);
    expect(thumb.badge).toBe('Draft, not promoted');
    expect(Object.keys(thumb.layout.padToVoice)).toHaveLength(7);
  });

  it('otherwise the Active Layout, badged "Active layout"', async () => {
    const promoted = projectReducer(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
    const thumb = thumbnailLayout(promoted);
    expect(thumb.badge).toBe('Active layout');
    expect(Object.keys(thumb.layout.padToVoice)).toHaveLength(7);
    expect(variantCount(promoted)).toBe('');
  });
});

describe('variant names (T29, P2-6)', () => {
  it('offers the layout\'s base name and the time: "Default – 23 Sep 14:02"', () => {
    const at = new Date(2026, 8, 23, 14, 2);
    expect(variantStamp(at)).toBe('23 Sep 14:02');
    expect(variantBaseName('Default (suggested)')).toBe('Default');
    expect(variantBaseName('Default (draft) (draft)')).toBe('Default');
    expect(suggestVariantName('Default (draft)', [], at)).toBe('Default – 23 Sep 14:02');
  });

  it('numbers a second save in the same minute', () => {
    const at = new Date(2026, 8, 23, 14, 2);
    const first = suggestVariantName('Default', [], at);
    expect(suggestVariantName('Default', [first], at)).toBe('Default – 23 Sep 14:02 (2)');
    expect(uniqueName('a', ['A', 'a (2)'])).toBe('a (3)');
  });

  it('the reducer never keeps two variants with one name, and renames variants', async () => {
    let state = await suggestedTestMidi1();
    state = projectReducer(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Keep', source: 'working', variantId: 'v1' } });
    state = projectReducer(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Keep', source: 'working', variantId: 'v2' } });
    expect(state.savedVariants.map(v => [v.id, v.name])).toEqual([['v1', 'Keep'], ['v2', 'Keep (2)']]);
    expect(variantCount(state)).toBe('2 variants');

    state = projectReducer(state, { type: 'RENAME_LAYOUT', payload: { target: 'variant', variantId: 'v2', name: '  Wide hands ' } });
    expect(state.savedVariants.find(v => v.id === 'v2')?.name).toBe('Wide hands');
    // A rename to a taken name is numbered too; an empty one changes nothing.
    state = projectReducer(state, { type: 'RENAME_LAYOUT', payload: { target: 'variant', variantId: 'v2', name: 'Keep' } });
    expect(state.savedVariants.find(v => v.id === 'v2')?.name).toBe('Keep (2)');
    expect(projectReducer(state, { type: 'RENAME_LAYOUT', payload: { target: 'variant', variantId: 'v2', name: ' ' } })).toBe(state);
  });
});

describe('view settings are remembered per viewer (T39)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips, and falls back to the defaults for odd storage', () => {
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    saveViewSettings({ gridLabels: { ...DEFAULT_VIEW_SETTINGS.gridLabels, showNoteLabels: true } });
    expect(loadViewSettings().gridLabels.showNoteLabels).toBe(true);
    localStorage.setItem('pushflow:view-settings', '{"gridLabels":{"showNoteLabels":"yes","organize4x4Banks":true}}');
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    localStorage.setItem('pushflow:view-settings', 'not json');
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
  });

  it('"Show Finger Assignment" is on by default, so solver fingering shows', () => {
    expect(DEFAULT_VIEW_SETTINGS.gridLabels.showFingerAssignment).toBe(true);
  });
});
