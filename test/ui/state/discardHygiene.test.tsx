// @vitest-environment happy-dom
/**
 * Discard hygiene and the freshness slice (S1a.4; T12, T14; roadmap P1a-7, P1a-8).
 *
 * - After Discard, the Active Layout holds no lock whose Sound isn't on that pad.
 * - After Discard, Promote, Preview, Load and Restore, pad fingerConstraints
 *   equal the values derived from voiceConstraints (invariant 6), and finger
 *   preferences survive Discard (decision Q2).
 * - A lock toggle marks the analysis stale; a self-drop creates no draft and
 *   no history entry; "has changes" is a hash comparison against Active.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createEmptyLayout, type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  projectReducer,
  createEmptyProjectState,
  hasWorkingChanges,
  type ProjectState,
  type ProjectAction,
  type SoundStream,
} from '../../../src/ui/state/projectState';

function makeStream(id: string, name: string, midi: number): SoundStream {
  return { id, name, color: '#888', originalMidiNote: midi, events: [], muted: false };
}

const voiceOf = (s: SoundStream) => ({
  id: s.id, name: s.name, sourceType: 'midi_track' as const, sourceFile: '', originalMidiNote: s.originalMidiNote, color: s.color,
});

/** Kick at 0,0; Snare at 0,1 (locked, prefers L2); Hi-Hat at 0,2 (prefers R3). Analysis fresh. */
function makeState() {
  const kick = makeStream('kick', 'Kick', 36);
  const snare = makeStream('snare', 'Snare', 38);
  const hihat = makeStream('hihat', 'Hi-Hat', 42);
  const state = createEmptyProjectState();
  state.id = 'hygiene';
  state.soundStreams = [kick, snare, hihat];
  state.activeLayout = {
    ...createEmptyLayout('active-1', 'Active'),
    padToVoice: { '0,0': voiceOf(kick), '0,1': voiceOf(snare), '0,2': voiceOf(hihat) },
    fingerConstraints: { '0,1': 'L2', '0,2': 'R3' },
    placementLocks: { [snare.id]: '0,1' },
  };
  state.voiceConstraints = {
    [snare.id]: { hand: 'left', finger: 'index' },
    [hihat.id]: { hand: 'right', finger: 'middle' },
  };
  state.analysisStale = false;
  return { state, kick, snare, hihat };
}

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

/** What buildLayoutFingerConstraints derives for a layout, written out by hand. */
function derivedConstraints(layout: Layout, voiceConstraints: ProjectState['voiceConstraints']) {
  const codes: Record<string, string> = { index: '2', middle: '3', ring: '4', pinky: '5', thumb: '1' };
  const out: Record<string, string> = {};
  for (const [pad, voice] of Object.entries(layout.padToVoice)) {
    const c = voiceConstraints[voice.id];
    if (c?.hand && c.finger) out[pad] = `${c.hand === 'left' ? 'L' : 'R'}${codes[c.finger]}`;
  }
  return out;
}

function expectLocksHold(layout: Layout) {
  for (const [voiceId, pad] of Object.entries(layout.placementLocks)) {
    expect({ voiceId, soundOnPad: layout.padToVoice[pad]?.id }).toEqual({ voiceId, soundOnPad: voiceId });
  }
}

describe('P1a-7 · Discard leaves no ghost locks', () => {
  it('drops a lock made at a draft-only pad and keeps one whose Sound is on that pad in Active', () => {
    const { state, kick, hihat } = makeState();
    const drafted = reduce(state,
      // Kick moves in the draft, then gets locked there; Hi-Hat is locked where Active has it too.
      { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } },
      { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: kick.id, padKey: '2,2' } },
      { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: hihat.id, padKey: '0,2' } },
    );
    expect(drafted.workingLayout?.placementLocks).toEqual({ snare: '0,1', kick: '2,2', hihat: '0,2' });

    const discarded = projectReducer(drafted, { type: 'DISCARD_WORKING_LAYOUT' });
    expect(discarded.workingLayout).toBeNull();
    expect(Object.keys(discarded.activeLayout.padToVoice).sort()).toEqual(['0,0', '0,1', '0,2']);
    expect(discarded.activeLayout.padToVoice['0,0']?.id).toBe(kick.id);
    // The Kick lock pointed at 2,2, where Active has nothing: gone. Hi-Hat's is kept.
    expect(discarded.activeLayout.placementLocks).toEqual({ snare: '0,1', hihat: '0,2' });
    expectLocksHold(discarded.activeLayout);
  });
});

describe('P1a-7 · pad fingerConstraints re-derive from voiceConstraints on every layout switch', () => {
  it('Discard keeps the finger preferences set during the draft (Q2) and re-derives Active from them', () => {
    const { state, kick, snare } = makeState();
    const drafted = reduce(state,
      { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: kick.id, hand: 'right', finger: 'pinky' } },
      { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: snare.id, hand: null, finger: null } },
    );
    expect(drafted.workingLayout).not.toBeNull();
    // Active still carries the pre-draft projection until the switch.
    expect(drafted.activeLayout.fingerConstraints).toEqual({ '0,1': 'L2', '0,2': 'R3' });

    const discarded = projectReducer(drafted, { type: 'DISCARD_WORKING_LAYOUT' });
    expect(discarded.voiceConstraints).toEqual({ kick: { hand: 'right', finger: 'pinky' }, hihat: { hand: 'right', finger: 'middle' } });
    expect(discarded.activeLayout.fingerConstraints).toEqual({ '0,0': 'R5', '0,2': 'R3' });
    expect(discarded.activeLayout.fingerConstraints).toEqual(derivedConstraints(discarded.activeLayout, discarded.voiceConstraints));
  });

  it('Promote (working) re-derives the new Active Layout', () => {
    const { state, kick } = makeState();
    const drafted = reduce(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } });
    // A stale projection on the draft, as an older save could hold.
    const stale: ProjectState = { ...drafted, workingLayout: { ...drafted.workingLayout!, fingerConstraints: { '0,0': 'L1', '2,2': 'L1' } } };
    const promoted = projectReducer(stale, { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(promoted.activeLayout.fingerConstraints).toEqual({ '0,1': 'L2', '0,2': 'R3' });
    expect(promoted.activeLayout.fingerConstraints).toEqual(derivedConstraints(promoted.activeLayout, promoted.voiceConstraints));
    expectLocksHold(promoted.activeLayout);
  });

  function candidateOn(state: ProjectState, pads: Record<string, SoundStream>): CandidateSolution {
    const padToVoice: Layout['padToVoice'] = {};
    for (const [pad, s] of Object.entries(pads)) padToVoice[pad] = voiceOf(s);
    // Generated layouts carry no user constraints, and this one carries a lock
    // that no longer holds (its Sound is elsewhere).
    const layout: Layout = { ...createEmptyLayout('cand-layout', 'Cand', 'working'), padToVoice, placementLocks: { kick: '7,7' } };
    return {
      id: 'cand-1',
      layout,
      executionPlan: { layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' } },
      metadata: { strategy: 'test', seed: 0 },
    } as unknown as CandidateSolution;
  }

  it('Preview and a candidate Promote re-derive the candidate layout and prune its dead locks', () => {
    const { state, kick, snare, hihat } = makeState();
    const withCandidate = reduce(state, { type: 'SET_CANDIDATES', payload: [candidateOn(state, { '3,3': kick, '3,4': snare, '4,3': hihat })] });

    const previewed = projectReducer(withCandidate, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-1' } });
    expect(previewed.workingLayout?.fingerConstraints).toEqual({ '3,4': 'L2', '4,3': 'R3' });
    expect(previewed.workingLayout?.placementLocks).toEqual({});

    const promoted = projectReducer(withCandidate, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-1' } });
    expect(promoted.activeLayout.fingerConstraints).toEqual({ '3,4': 'L2', '4,3': 'R3' });
    expect(promoted.activeLayout.placementLocks).toEqual({});
    // The candidate's plan is re-bound to the layout it now describes.
    expect(promoted.analysisResult?.executionPlan.layoutBinding?.layoutHash).toBe(hashLayout(promoted.activeLayout));
  });

  it('Load Draft, a variant Promote and Restore re-derive from the current preferences', () => {
    const { state, kick, snare, hihat } = makeState();
    const staleVariant: Layout = {
      ...createEmptyLayout('variant-1', 'Old variant', 'variant'),
      padToVoice: { '5,5': voiceOf(kick), '5,6': voiceOf(snare), '6,5': voiceOf(hihat) },
      // Saved before the preferences changed, with a lock its Sound has left.
      fingerConstraints: { '5,5': 'L1', '5,6': 'R4' },
      placementLocks: { hihat: '0,2' },
    };
    const withVariant: ProjectState = { ...state, savedVariants: [staleVariant], recoveredDrafts: [{ ...staleVariant, id: 'rec-1', provenance: 'recovered' }] };
    const expected = { '5,6': 'L2', '6,5': 'R3' };

    const loaded = projectReducer(withVariant, { type: 'LOAD_SAVED_VARIANT', payload: { variantId: 'variant-1' } });
    expect(loaded.workingLayout?.fingerConstraints).toEqual(expected);
    expect(loaded.workingLayout?.placementLocks).toEqual({});

    const promoted = projectReducer(withVariant, { type: 'PROMOTE_VARIANT', payload: { variantId: 'variant-1' } });
    expect(promoted.activeLayout.fingerConstraints).toEqual(expected);
    expect(promoted.activeLayout.placementLocks).toEqual({});

    const restored = projectReducer(withVariant, { type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: 'rec-1' } });
    expect(restored.workingLayout?.fingerConstraints).toEqual(expected);
    expect(restored.workingLayout?.placementLocks).toEqual({});
  });
});

describe('P1a-8 · freshness', () => {
  it('a lock toggle marks the analysis stale, on Active and on a draft, locking and unlocking', () => {
    const { state, kick } = makeState();
    const lockedOnActive = projectReducer(state, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: kick.id, padKey: '0,0' } });
    expect(lockedOnActive.workingLayout).toBeNull();
    expect(lockedOnActive.activeLayout.placementLocks[kick.id]).toBe('0,0');
    expect(lockedOnActive.analysisStale).toBe(true);

    const drafted = { ...reduce(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } }), analysisStale: false };
    const lockedOnDraft = projectReducer(drafted, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: kick.id, padKey: '2,2' } });
    expect(lockedOnDraft.analysisStale).toBe(true);
    const unlocked = projectReducer({ ...lockedOnDraft, analysisStale: false }, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: kick.id, padKey: '2,2' } });
    expect(unlocked.workingLayout?.placementLocks[kick.id]).toBeUndefined();
    expect(unlocked.analysisStale).toBe(true);
  });

  it('a self-drop returns the same state: no draft, no stale analysis (reducer)', () => {
    const { state, kick, snare } = makeState();
    expect(projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: kick } })).toBe(state);
    expect(projectReducer(state, { type: 'SWAP_PADS', payload: { padKeyA: '0,0', padKeyB: '0,0' } })).toBe(state);
    // On a draft too, for a Sound on its draft pad and for a locked Sound on its own pad.
    const drafted = reduce(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } });
    expect(projectReducer(drafted, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } })).toBe(drafted);
    expect(projectReducer(drafted, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,1', stream: snare } })).toBe(drafted);
  });

  it('a self-drop records no history entry (ProjectProvider)', () => {
    const { state, kick } = makeState();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProjectProvider initialState={state}>{children}</ProjectProvider>
    );
    const { result } = renderHook(() => useProject(), { wrapper });
    act(() => {
      result.current.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: kick } });
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state.workingLayout).toBeNull();
    expect(result.current.state.analysisStale).toBe(false);
    // A real move still records one.
    act(() => {
      result.current.dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } });
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoLabel).toBe('Place Sound');
  });

  it('hasWorkingChanges compares the draft to Active by hash', () => {
    const { state, kick } = makeState();
    expect(hasWorkingChanges(state)).toBe(false);
    const sameAsActive = projectReducer(state, { type: 'CREATE_WORKING_LAYOUT' });
    expect(sameAsActive.workingLayout).not.toBeNull();
    expect(hasWorkingChanges(sameAsActive)).toBe(false);
    const moved = projectReducer(sameAsActive, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '2,2', stream: kick } });
    expect(hasWorkingChanges(moved)).toBe(true);
    // Locks count too (the analysis hash covers them).
    const lockedOnly = projectReducer(sameAsActive, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: kick.id, padKey: '0,0' } });
    expect(hasWorkingChanges(lockedOnly)).toBe(true);
  });
});
