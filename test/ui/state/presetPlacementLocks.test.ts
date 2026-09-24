/**
 * Preset placement respects locks (S1a.5; S1a.3's follow-up; canon section 11).
 *
 * MERGE_ASSIGN_PADS (placing or mirroring a Composer preset) never displaces a
 * locked Sound and never puts a locked Sound on another pad: the whole
 * placement is refused and the state comes back unchanged (no draft, no undo
 * step). Placements that touch no lock go through as before.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyLayout } from '../../../src/types/layout';
import { projectReducer, createEmptyProjectState, placementDisturbsLock, type SoundStream } from '../../../src/ui/state/projectState';

const stream = (id: string): SoundStream => ({ id, name: id, color: '#888', originalMidiNote: null, events: [], muted: false });
const voice = (id: string) => ({ id, name: id, sourceType: 'midi_track' as const, sourceFile: '', originalMidiNote: null, color: '#888' });

function lockedState() {
  const state = createEmptyProjectState();
  state.soundStreams = [stream('kick'), stream('snare')];
  state.activeLayout = {
    ...createEmptyLayout('active', 'Active'),
    padToVoice: { '0,0': voice('kick'), '0,1': voice('snare') },
    placementLocks: { kick: '0,0' },
  };
  return state;
}

describe('MERGE_ASSIGN_PADS and locks', () => {
  it('refuses a placement over a locked pad', () => {
    const state = lockedState();
    expect(projectReducer(state, { type: 'MERGE_ASSIGN_PADS', payload: { '0,0': voice('preset-a'), '3,3': voice('preset-b') } })).toBe(state);
  });

  it('refuses a placement that would put a locked Sound on another pad', () => {
    const state = lockedState();
    expect(projectReducer(state, { type: 'MERGE_ASSIGN_PADS', payload: { '5,5': voice('kick') } })).toBe(state);
  });

  it('places over an unlocked pad as before, keeping the lock', () => {
    const next = projectReducer(lockedState(), { type: 'MERGE_ASSIGN_PADS', payload: { '0,1': voice('preset-a'), '3,3': voice('preset-b') } });
    expect(next.workingLayout?.padToVoice['0,0']?.id).toBe('kick');
    expect(next.workingLayout?.padToVoice['0,1']?.id).toBe('preset-a');
    expect(next.workingLayout?.placementLocks).toEqual({ kick: '0,0' });
  });

  it('placementDisturbsLock is the check the drop handler runs before recording anything', () => {
    const layout = lockedState().activeLayout;
    expect(placementDisturbsLock(layout, { '0,0': voice('preset-a') })).toBe(true);
    expect(placementDisturbsLock(layout, { '5,5': voice('kick') })).toBe(true);
    expect(placementDisturbsLock(layout, { '0,1': voice('preset-a'), '5,5': voice('snare') })).toBe(false);
  });
});
