import { describe, expect, it } from 'vitest';
import { createEmptyLayout } from '../../../src/types/layout';
import { projectReducer, createEmptyProjectState, type SoundStream } from '../../../src/ui/state/projectState';

function makeStream(id: string, name: string, midi: number, color: string): SoundStream {
  return {
    id,
    name,
    color,
    originalMidiNote: midi,
    events: [],
    muted: false,
  };
}

function makeState() {
  const kick = makeStream('stream-kick', 'Kick', 36, '#ef4444');
  const snare = makeStream('stream-snare', 'Snare', 38, '#3b82f6');
  const hihat = makeStream('stream-hihat', 'Hi-Hat', 42, '#22c55e');

  const state = createEmptyProjectState();
  state.soundStreams = [kick, snare, hihat];
  state.activeLayout = {
    ...createEmptyLayout('active-1', 'Active'),
    padToVoice: {
      '0,0': { id: kick.id, name: kick.name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: kick.originalMidiNote, color: kick.color },
      '0,1': { id: snare.id, name: snare.name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: snare.originalMidiNote, color: snare.color },
      '0,2': { id: hihat.id, name: hihat.name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: hihat.originalMidiNote, color: hihat.color },
    },
    fingerConstraints: {
      '0,1': 'L2',
      '0,2': 'R3',
    },
    placementLocks: {
      [snare.id]: '0,1',
      [hihat.id]: '0,2',
    },
  };
  state.voiceConstraints = {
    [snare.id]: { hand: 'left', finger: 'index' },
    [hihat.id]: { hand: 'right', finger: 'middle' },
  };

  return { state, kick, snare, hihat };
}

describe('projectReducer constraint sync', () => {
  it('moves pad constraints and locks with the voice when assigning to a new pad', () => {
    const { state, snare } = makeState();

    const next = projectReducer(state, {
      type: 'ASSIGN_VOICE_TO_PAD',
      payload: { padKey: '2,2', stream: snare },
    });

    expect(next.workingLayout?.padToVoice['2,2']?.id).toBe(snare.id);
    expect(next.workingLayout?.padToVoice['0,1']).toBeUndefined();
    expect(next.workingLayout?.fingerConstraints).toEqual({
      '0,2': 'R3',
      '2,2': 'L2',
    });
    expect(next.workingLayout?.placementLocks).toEqual({
      [snare.id]: '2,2',
      'stream-hihat': '0,2',
    });
  });

  it('clears stale pad constraints and locks when removing a voice from a pad', () => {
    const { state, snare } = makeState();

    const next = projectReducer(state, {
      type: 'REMOVE_VOICE_FROM_PAD',
      payload: { padKey: '0,1' },
    });

    expect(next.workingLayout?.padToVoice['0,1']).toBeUndefined();
    expect(next.workingLayout?.fingerConstraints).toEqual({
      '0,2': 'R3',
    });
    expect(next.workingLayout?.placementLocks).toEqual({
      'stream-hihat': '0,2',
    });
    expect(next.voiceConstraints[snare.id]).toEqual({ hand: 'left', finger: 'index' });
  });

  it('derives pad constraints from a voice preference set via SET_VOICE_CONSTRAINT', () => {
    const { state, kick } = makeState();

    // Kick has no finger preference yet and sits on pad 0,0.
    const next = projectReducer(state, {
      type: 'SET_VOICE_CONSTRAINT',
      payload: { streamId: kick.id, hand: 'right', finger: 'pinky' },
    });

    // voiceConstraints is the source of truth...
    expect(next.voiceConstraints[kick.id]).toEqual({ hand: 'right', finger: 'pinky' });
    // ...and the pad constraint is derived from it, alongside the existing ones.
    expect(next.workingLayout?.fingerConstraints).toEqual({
      '0,0': 'R5',
      '0,1': 'L2',
      '0,2': 'R3',
    });
  });

  it('removes the derived pad constraint when a voice preference is cleared (no drift)', () => {
    const { state, snare } = makeState();

    // Snare starts with L2 on pad 0,1. Clear its preference.
    const next = projectReducer(state, {
      type: 'SET_VOICE_CONSTRAINT',
      payload: { streamId: snare.id, hand: null, finger: null },
    });

    expect(next.voiceConstraints[snare.id]).toBeUndefined();
    // The derived pad constraint for the snare's pad is gone — no stale entry.
    expect(next.workingLayout?.fingerConstraints).toEqual({
      '0,2': 'R3',
    });
  });

  it('does not fork a working layout when a preference targets an unplaced sound', () => {
    const { state } = makeState();
    // Add an unplaced sound (not in any padToVoice).
    const ghost = makeStream('stream-ghost', 'Ghost', 50, '#a855f7');
    state.soundStreams = [...state.soundStreams, ghost];

    const next = projectReducer(state, {
      type: 'SET_VOICE_CONSTRAINT',
      payload: { streamId: ghost.id, hand: 'left', finger: 'ring' },
    });

    expect(next.voiceConstraints[ghost.id]).toEqual({ hand: 'left', finger: 'ring' });
    // No pad holds the ghost, so no derived constraint changed → no draft created.
    expect(next.workingLayout).toBeNull();
  });

  it('swaps derived constraints and lock targets with the swapped voices', () => {
    const { state, snare, hihat } = makeState();

    const next = projectReducer(state, {
      type: 'SWAP_PADS',
      payload: { padKeyA: '0,1', padKeyB: '0,2' },
    });

    expect(next.workingLayout?.padToVoice['0,1']?.id).toBe(hihat.id);
    expect(next.workingLayout?.padToVoice['0,2']?.id).toBe(snare.id);
    expect(next.workingLayout?.fingerConstraints).toEqual({
      '0,1': 'R3',
      '0,2': 'L2',
    });
    expect(next.workingLayout?.placementLocks).toEqual({
      [snare.id]: '0,2',
      [hihat.id]: '0,1',
    });
  });
});
