import { describe, expect, it } from 'vitest';
import { createEmptyLayout } from '../../../src/types/layout';
import { createEmptyProjectState, projectReducer } from '../../../src/ui/state/projectState';

function makeVariant() {
  return {
    ...createEmptyLayout('variant-1', 'Saved Groove', 'variant'),
    padToVoice: {
      '1,1': {
        id: 'stream-kick',
        name: 'Kick',
        sourceType: 'midi_track' as const,
        sourceFile: '',
        originalMidiNote: 36,
        color: '#ef4444',
      },
    },
    savedAt: '2026-03-22T12:00:00.000Z',
    baselineId: 'active-1',
  };
}

describe('projectReducer saved variant loading', () => {
  it('loads a saved variant into working without mutating active', () => {
    const state = createEmptyProjectState();
    state.activeLayout = {
      ...createEmptyLayout('active-1', 'Active'),
      padToVoice: {
        '0,0': {
          id: 'stream-snare',
          name: 'Snare',
          sourceType: 'midi_track' as const,
          sourceFile: '',
          originalMidiNote: 38,
          color: '#3b82f6',
        },
      },
    };
    state.savedVariants = [makeVariant()];

    const next = projectReducer(state, {
      type: 'LOAD_SAVED_VARIANT',
      payload: { variantId: 'variant-1' },
    });

    expect(next.activeLayout.id).toBe('active-1');
    expect(next.activeLayout.padToVoice['0,0']?.id).toBe('stream-snare');
    expect(next.workingLayout).not.toBeNull();
    expect(next.workingLayout?.name).toBe('Saved Groove');
    expect(next.workingLayout?.role).toBe('working');
    expect(next.workingLayout?.padToVoice['1,1']?.id).toBe('stream-kick');
  });

  it('clears candidate-driven inspection state when loading a saved variant', () => {
    const state = createEmptyProjectState();
    state.savedVariants = [makeVariant()];
    state.selectedCandidateId = 'candidate-1';
    state.compareCandidateId = 'candidate-2';
    state.selectedEventIndex = 4;
    state.selectedMomentIndex = 2;
    state.analysisStale = false;

    const next = projectReducer(state, {
      type: 'LOAD_SAVED_VARIANT',
      payload: { variantId: 'variant-1' },
    });

    expect(next.selectedCandidateId).toBeNull();
    expect(next.compareCandidateId).toBeNull();
    expect(next.selectedEventIndex).toBeNull();
    expect(next.selectedMomentIndex).toBeNull();
    expect(next.analysisStale).toBe(true);
  });
});
