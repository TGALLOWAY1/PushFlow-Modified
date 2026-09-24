/**
 * Migrations for the Composer preset store.
 *
 * Composer presets are not part of any project: they live in one global
 * localStorage list (composerPresetStorage), so they carry their own schema
 * version (a separate key) and run through the same migration runner as stored
 * projects. As with projects, the untouched list is backed up before any step
 * runs, and every step is idempotent.
 */

import { type Migration, type StoredRecord } from './migrations';

/** The preset store's current schema version. */
export const PRESET_STORE_VERSION = 1;

export const PRESET_MIGRATIONS: readonly Migration[] = [
  {
    // S1a.5 (F9-12): Save Preset used to invent fingering for pads with no
    // finger preference (hand from the column, index finger), and placing the
    // preset then applied it as a constraint. A stored preset does not say
    // which pads were invented, so every pad saved before this is flagged
    // unverified; unverified fingering is shown as such and never applied.
    from: 0,
    to: 1,
    name: 'flag-preset-fingering-unverified',
    up: record => ({
      ...record,
      presets: Array.isArray(record.presets) ? (record.presets as unknown[]).map(flagPresetFingering) : [],
    }),
  },
];

/** The preset with every pad whose fingering is not a recorded preference flagged unverified. */
function flagPresetFingering(preset: unknown): unknown {
  if (!preset || typeof preset !== 'object') return preset;
  const p = preset as StoredRecord & { pads?: unknown };
  if (!Array.isArray(p.pads)) return preset;
  return {
    ...p,
    pads: p.pads.map(pad => {
      if (!pad || typeof pad !== 'object') return pad;
      const padRecord = pad as StoredRecord;
      return padRecord.fingerSource === 'preference' ? pad : { ...padRecord, fingerSource: 'unverified' };
    }),
  };
}
