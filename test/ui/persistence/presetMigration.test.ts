/**
 * The preset-fingering migration (S1a.5; F9-12; roadmap P1a-13b).
 *
 * Save Preset used to invent fingering (hand from the column, index finger)
 * for pads with no finger preference, and placing the preset applied it. Every
 * pad of a preset stored before S1a.5 is flagged unverified, after the
 * untouched list is backed up; unverified fingering is never applied.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../../../src/ui/persistence/migrations';
import { PRESET_MIGRATIONS, PRESET_STORE_VERSION } from '../../../src/ui/persistence/presetMigrations';
import {
  loadComposerPresets,
  saveComposerPreset,
  PRESET_BACKUP_KEY_PREFIX,
} from '../../../src/ui/persistence/composerPresetStorage';
import {
  type ComposerPreset,
  type PresetPad,
  presetPadFingerConstraint,
  hasUnverifiedFingering,
} from '../../../src/types/composerPreset';

const KEY = 'pushflow_composer_presets';
const VERSION_KEY = 'pushflow_composer_presets_version';

/** A preset as Save Preset stored it before S1a.5: made-up left/index fingering, no fingerSource. */
function legacyPreset(id: string): ComposerPreset {
  const pad = (col: number): PresetPad => ({ position: { rowOffset: 0, colOffset: col }, laneId: `l${col}`, finger: 'index', hand: 'left' });
  return {
    id, name: id, createdAt: 1, updatedAt: 1,
    pads: [pad(0), pad(1)],
    config: { barCount: 4, subdivision: '1/8', bpm: 120 } as ComposerPreset['config'],
    lanes: [], events: [],
    handedness: 'left', mirrorEligible: true, boundingBox: { rows: 1, cols: 2 }, tags: [],
  };
}

/** Minimal in-memory localStorage (the node environment has none). */
class MemoryStorage {
  data = new Map<string, string>();
  failOn: ((key: string) => boolean) | null = null;
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) {
    if (this.failOn?.(k)) throw new Error('QuotaExceededError');
    this.data.set(k, String(v));
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;
});

describe('flag-preset-fingering-unverified', () => {
  it('flags every pad of an old preset unverified and changes nothing else', () => {
    const presets = [legacyPreset('a'), legacyPreset('b')];
    const { record, applied } = runMigrations({ schemaVersion: 0, presets }, PRESET_MIGRATIONS);
    expect(applied).toEqual(['flag-preset-fingering-unverified']);
    expect(record.schemaVersion).toBe(PRESET_STORE_VERSION);
    const out = record.presets as ComposerPreset[];
    expect(out.flatMap(p => p.pads.map(pad => pad.fingerSource))).toEqual(['unverified', 'unverified', 'unverified', 'unverified']);
    expect(out.map(p => ({ ...p, pads: p.pads.map(({ fingerSource: _, ...rest }) => rest) }))).toEqual(presets);
  });

  it('is idempotent: running it again changes nothing', () => {
    const once = runMigrations({ schemaVersion: 0, presets: [legacyPreset('a')] }, PRESET_MIGRATIONS).record;
    expect(runMigrations(once, PRESET_MIGRATIONS).record).toEqual(once);
    // The step on its own output, too.
    expect(PRESET_MIGRATIONS[0]!.up(once)).toEqual(once);
  });

  it('keeps a pad already recorded as a preference', () => {
    const preset = legacyPreset('a');
    preset.pads[0] = { ...preset.pads[0]!, fingerSource: 'preference' };
    const out = runMigrations({ schemaVersion: 0, presets: [preset] }, PRESET_MIGRATIONS).record.presets as ComposerPreset[];
    expect(out[0]!.pads.map(p => p.fingerSource)).toEqual(['preference', 'unverified']);
  });

  it('passes odd shapes through', () => {
    const odd = [null, 3, { name: 'no pads' }, { pads: [null, 'x'] }];
    const out = runMigrations({ schemaVersion: 0, presets: odd }, PRESET_MIGRATIONS).record.presets;
    expect(out).toEqual(odd);
  });
});

describe('the preset store migrates on load, after its backup', () => {
  it('backs up the untouched list, then writes the flagged list and the version; a second load writes nothing', () => {
    const raw = JSON.stringify([legacyPreset('a')]);
    storage.setItem(KEY, raw);
    const writes: string[] = [];
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => { writes.push(k); setItem(k, v); };

    const loaded = loadComposerPresets();

    expect(writes).toEqual([`${PRESET_BACKUP_KEY_PREFIX}0`, KEY, VERSION_KEY]);
    expect(storage.getItem(`${PRESET_BACKUP_KEY_PREFIX}0`)).toBe(raw);
    expect(storage.getItem(VERSION_KEY)).toBe(String(PRESET_STORE_VERSION));
    expect(loaded[0]!.pads.every(p => p.fingerSource === 'unverified')).toBe(true);

    writes.length = 0;
    expect(loadComposerPresets()).toEqual(loaded);
    expect(writes).toEqual([]);
  });

  it('when the backup cannot be written, stores nothing but still returns the flagged list', () => {
    const raw = JSON.stringify([legacyPreset('a')]);
    storage.setItem(KEY, raw);
    storage.failOn = k => k.startsWith(PRESET_BACKUP_KEY_PREFIX);
    const loaded = loadComposerPresets();
    expect(storage.getItem(KEY)).toBe(raw);
    expect(storage.getItem(VERSION_KEY)).toBeNull();
    expect(loaded[0]!.pads.every(p => p.fingerSource === 'unverified')).toBe(true);
  });

  it('a new store is written at the current version, with no backup', () => {
    saveComposerPreset({ ...legacyPreset('new'), pads: [] });
    expect(storage.getItem(VERSION_KEY)).toBe(String(PRESET_STORE_VERSION));
    expect([...storage.data.keys()].some(k => k.startsWith(PRESET_BACKUP_KEY_PREFIX))).toBe(false);
  });
});

describe('P1a-13b · unverified fingering is flagged and not applied', () => {
  it('placing a pad applies only fingering recorded as a preference', () => {
    const [pad] = legacyPreset('a').pads;
    expect(presetPadFingerConstraint(pad!)).toBeNull();
    expect(presetPadFingerConstraint({ ...pad!, fingerSource: 'unverified' })).toBeNull();
    expect(presetPadFingerConstraint({ ...pad!, fingerSource: 'preference' })).toBe('L2');
    expect(presetPadFingerConstraint({ ...pad!, hand: 'right', finger: 'pinky', fingerSource: 'preference' })).toBe('R5');
  });

  it('a migrated preset reads as unverified', () => {
    storage.setItem(KEY, JSON.stringify([legacyPreset('a')]));
    const [preset] = loadComposerPresets();
    expect(hasUnverifiedFingering(preset!.pads)).toBe(true);
  });
});
