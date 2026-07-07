import { describe, expect, it } from 'vitest';
import { createEmptyLayout, type Layout } from '../../../src/types/layout';
import { projectReducer, createEmptyProjectState, type SoundStream } from '../../../src/ui/state/projectState';
import { type CandidateSolution } from '../../../src/types/candidateSolution';

function makeStream(id: string, name: string, color: string): SoundStream {
  return { id, name, color, originalMidiNote: 36, events: [], muted: false };
}

function layoutWith(id: string, streamId: string, name: string, color: string): Layout {
  return {
    ...createEmptyLayout(id, id),
    padToVoice: {
      '0,0': { id: streamId, name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: 36, color },
    },
  };
}

/**
 * Layouts embed a display copy of each sound's name/color. Renaming or recoloring
 * a sound must propagate to EVERY layout-bearing store — including in-session
 * candidates and the analysis result — so previews and compare never show a stale
 * label. (Regression guard for the label-drift debt.)
 */
describe('projectReducer sound label propagation', () => {
  function makeStateWithCandidate() {
    const kick = makeStream('stream-kick', 'Kick', '#ef4444');
    const state = createEmptyProjectState();
    state.soundStreams = [kick];
    state.activeLayout = layoutWith('active-1', kick.id, 'Kick', '#ef4444');
    const candidate = {
      id: 'cand-1',
      layout: layoutWith('cand-layout-1', kick.id, 'Kick', '#ef4444'),
    } as unknown as CandidateSolution;
    state.candidates = [candidate];
    state.analysisResult = {
      id: 'analysis-1',
      layout: layoutWith('analysis-layout-1', kick.id, 'Kick', '#ef4444'),
    } as unknown as CandidateSolution;
    return { state, kick };
  }

  it('propagates RENAME_SOUND into candidates and analysisResult layouts', () => {
    const { state, kick } = makeStateWithCandidate();
    const next = projectReducer(state, {
      type: 'RENAME_SOUND',
      payload: { streamId: kick.id, name: 'Kick Drum' },
    });

    expect(next.soundStreams[0].name).toBe('Kick Drum');
    expect(next.activeLayout.padToVoice['0,0'].name).toBe('Kick Drum');
    expect(next.candidates[0].layout.padToVoice['0,0'].name).toBe('Kick Drum');
    expect(next.analysisResult!.layout.padToVoice['0,0'].name).toBe('Kick Drum');
  });

  it('propagates SET_SOUND_COLOR into candidates and analysisResult layouts', () => {
    const { state, kick } = makeStateWithCandidate();
    const next = projectReducer(state, {
      type: 'SET_SOUND_COLOR',
      payload: { streamId: kick.id, color: '#00ff00' },
    });

    expect(next.soundStreams[0].color).toBe('#00ff00');
    expect(next.activeLayout.padToVoice['0,0'].color).toBe('#00ff00');
    expect(next.candidates[0].layout.padToVoice['0,0'].color).toBe('#00ff00');
    expect(next.analysisResult!.layout.padToVoice['0,0'].color).toBe('#00ff00');
  });
});
