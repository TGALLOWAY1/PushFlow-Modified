/**
 * A Composer lane never matches a pad by pitch (S1a.3, T18; roadmap P1a-6).
 */

import { describe, it, expect } from 'vitest';
import {
  laneForVoice,
  projectSoundIdForLane,
  voiceForLane,
} from '../../../src/ui/components/workspace/composerLaneIdentity';

const lane = (id: string, name: string, midiNote: number | null) => ({ id, name, midiNote });
const voice = (id: string, name: string, originalMidiNote: number | null) => ({ id, name, originalMidiNote });

describe('composer lane identity', () => {
  const lanes = [lane('l1', 'Kick', 36), lane('l2', 'Snare', 38), lane('l3', 'Hat', 42)];

  it('matches a lane to its project Sound by id', () => {
    const voices = [voice(projectSoundIdForLane('l2'), 'Renamed', 99), voice('other', 'Kick', 36)];
    expect(voiceForLane(lanes[1], voices)?.id).toBe(projectSoundIdForLane('l2'));
    expect(laneForVoice(voices[0], lanes)?.id).toBe('l2');
  });

  it('never matches by pitch: a Sound that only shares the lane\'s pitch is not the lane', () => {
    const voices = [voice('imported-kick', 'Imported kick', 36), voice('imported-hat', 'Imported hat', 42)];
    expect(voiceForLane(lanes[0], voices)).toBeUndefined();
    expect(voiceForLane(lanes[2], voices)).toBeUndefined();
    expect(laneForVoice(voices[0], lanes)).toBeUndefined();
  });

  it('keeps the name fallback for pads placed before lanes carried project ids', () => {
    const voices = [voice('legacy-pad', 'Snare', 61)];
    expect(voiceForLane(lanes[1], voices)?.id).toBe('legacy-pad');
    expect(laneForVoice(voices[0], lanes)?.id).toBe('l2');
  });
});
