/**
 * P5-1 (S5.1): Sound identity survives the workflow, through the real reducer
 * and the real export file.
 *
 * A draft (the Active Layout cloned), Save as variant, Promote (the draft and
 * a variant), Discard, and an export/import round trip each keep every
 * Sound's id, every pad's Sound by that id, and what is keyed by it: its
 * finger preference (voiceConstraints, invariant 6; kept by Discard, decision
 * Q2), its lock and its short label. test/types/voiceIdentityRoundTrip.test.ts
 * checks cloneLayout itself.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { projectReducer, getDisplayedLayout, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { type Layout } from '../../../src/types/layout';
import { buildProjectExport, parseProjectExport } from '../../../src/ui/persistence/projectStorage';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const soundIds = (state: ProjectState) => state.soundStreams.map(s => s.id).sort();
/** A layout's pads, as pad → Sound id. */
const padSounds = (layout: Layout) => Object.fromEntries(Object.entries(layout.padToVoice).map(([k, v]) => [k, v.id]));
const padOf = (layout: Layout, soundId: string) => Object.entries(layout.padToVoice).find(([, v]) => v.id === soundId)?.[0];

/** Every layout names only Sounds that exist, each once, and its pads' voices carry their Sound's own name and colour. */
function expectLayoutsBoundToSounds(state: ProjectState) {
  const ids = new Set(soundIds(state));
  const layouts = [state.activeLayout, state.workingLayout, ...state.savedVariants, ...state.recoveredDrafts].filter(Boolean) as Layout[];
  for (const layout of layouts) {
    const voiceIds = Object.values(layout.padToVoice).map(v => v.id);
    expect(new Set(voiceIds).size).toBe(voiceIds.length);
    for (const voice of Object.values(layout.padToVoice)) {
      expect(ids.has(voice.id)).toBe(true);
      const sound = state.soundStreams.find(s => s.id === voice.id)!;
      expect({ name: voice.name, color: voice.color }).toEqual({ name: sound.name, color: sound.color });
    }
    for (const lockedId of Object.keys(layout.placementLocks)) expect(ids.has(lockedId)).toBe(true);
  }
  for (const id of Object.keys(state.voiceConstraints)) expect(ids.has(id)).toBe(true);
}

let start: ProjectState;
let ids: string[];
let kick: string, snare: string, hat: string;

beforeAll(async () => {
  start = { ...(await suggestedTestMidi1()), id: 'proj-voice-ids' };
  ids = soundIds(start);
  [kick, snare, hat] = start.soundStreams.map(s => s.id);
}, 60_000);

/** The suggested draft with a finger preference, a short label and a lock on three Sounds. */
function prepared(): ProjectState {
  const draft = getDisplayedLayout(start)!;
  return reduce(start,
    { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: kick, hand: 'left', finger: 'index' } },
    { type: 'SET_SOUND_SHORT_LABEL', payload: { streamId: snare, shortLabel: 'Snr' } },
    { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: hat, padKey: padOf(draft, hat)! } },
  );
}

describe('P5-1 · voice ids survive the workflow', () => {
  let state: ProjectState;
  beforeEach(() => { state = prepared(); });

  it('the draft is the Active Layout cloned: the same Sounds on its pads, by id', () => {
    const fresh = reduce(start, { type: 'PROMOTE_WORKING_LAYOUT' }, { type: 'CREATE_WORKING_LAYOUT' });
    expect(fresh.workingLayout!.id).not.toBe(fresh.activeLayout.id);
    expect(padSounds(fresh.workingLayout!)).toEqual(padSounds(fresh.activeLayout));
    expect(soundIds(fresh)).toEqual(ids);
    expectLayoutsBoundToSounds(fresh);
  });

  it('Save as variant keeps the draft\'s Sounds, lock and derived finger preference', () => {
    const saved = reduce(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Mine', source: 'working', variantId: 'v1' } });
    const variant = saved.savedVariants.find(v => v.id === 'v1')!;
    expect(padSounds(variant)).toEqual(padSounds(saved.workingLayout!));
    expect(variant.placementLocks[hat]).toBe(padOf(variant, hat));
    expect(variant.fingerConstraints[padOf(variant, kick)!]).toBe('L2');
    expect(soundIds(saved)).toEqual(ids);
    expectLayoutsBoundToSounds(saved);
  });

  it('Promote makes the draft Active with the same Sounds by id; so does promoting a variant', () => {
    const draftPads = padSounds(state.workingLayout!);
    const promoted = reduce(state, { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(padSounds(promoted.activeLayout)).toEqual(draftPads);
    expect(promoted.activeLayout.placementLocks[hat]).toBe(padOf(promoted.activeLayout, hat));
    expect(promoted.voiceConstraints[kick]).toEqual({ hand: 'left', finger: 'index' });
    expectLayoutsBoundToSounds(promoted);

    const moved = reduce(promoted,
      { type: 'SAVE_AS_VARIANT', payload: { name: 'Kept', source: 'working', variantId: 'v2' } },
      { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream: promoted.soundStreams.find(s => s.id === snare)! } },
      { type: 'PROMOTE_VARIANT', payload: { variantId: 'v2' } },
    );
    expect(padSounds(moved.activeLayout)).toEqual(draftPads);
    expect(soundIds(moved)).toEqual(ids);
    expectLayoutsBoundToSounds(moved);
  });

  it('Discard returns to Active with its Sounds by id, and the Sounds keep their finger preference (Q2)', () => {
    const promoted = reduce(state, { type: 'PROMOTE_WORKING_LAYOUT' });
    const edited = reduce(promoted, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream: promoted.soundStreams.find(s => s.id === snare)! } });
    expect(padSounds(edited.workingLayout!)).not.toEqual(padSounds(promoted.activeLayout));
    const discarded = reduce(edited, { type: 'DISCARD_WORKING_LAYOUT' });
    expect(padSounds(getDisplayedLayout(discarded)!)).toEqual(padSounds(promoted.activeLayout));
    expect(discarded.voiceConstraints[kick]).toEqual({ hand: 'left', finger: 'index' });
    expect(getDisplayedLayout(discarded)!.fingerConstraints[padOf(getDisplayedLayout(discarded)!, kick)!]).toBe('L2');
    expect(soundIds(discarded)).toEqual(ids);
    expectLayoutsBoundToSounds(discarded);
  });

  it('an export/import round trip keeps every id, pad, lock, preference and short label', () => {
    const full = reduce(state,
      { type: 'SAVE_AS_VARIANT', payload: { name: 'Mine', source: 'working', variantId: 'v1' } },
      { type: 'PROMOTE_WORKING_LAYOUT' },
      { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream: state.soundStreams.find(s => s.id === snare)! } },
    );
    const imported = parseProjectExport(JSON.stringify(buildProjectExport(full, null)));
    expect(imported).toMatchObject({ ok: true });
    if (!imported.ok) return;
    const back = imported.state;
    expect(soundIds(back)).toEqual(ids);
    expect(back.performanceLanes.map(l => l.id)).toEqual(full.performanceLanes.map(l => l.id));
    expect(padSounds(back.activeLayout)).toEqual(padSounds(full.activeLayout));
    expect(padSounds(back.workingLayout!)).toEqual(padSounds(full.workingLayout!));
    expect(back.savedVariants.map(padSounds)).toEqual(full.savedVariants.map(padSounds));
    expect(back.activeLayout.placementLocks).toEqual(full.activeLayout.placementLocks);
    expect(back.voiceConstraints).toEqual(full.voiceConstraints);
    expect(back.soundStreams.find(s => s.id === snare)!.shortLabel).toBe('Snr');
    expectLayoutsBoundToSounds(back);
  });
});
