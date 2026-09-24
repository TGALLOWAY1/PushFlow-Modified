/**
 * Sound lookups are by identity, never by pitch (S1a.3, T18; invariant 5).
 */

import { describe, it, expect } from 'vitest';
import { buildSoundStreamLookup } from '../../../src/ui/analysis/soundStreamLookup';
import { type SoundStream } from '../../../src/ui/state/projectState';

const stream = (id: string, midi: number): SoundStream => ({
  id, name: id, color: '#444', originalMidiNote: midi, events: [], muted: false,
});

describe('buildSoundStreamLookup', () => {
  const lookup = buildSoundStreamLookup([stream('kick-a', 36), stream('kick-b', 36), stream('hat', 42)]);

  it('finds a Sound by id', () => {
    expect(lookup.forVoice({ id: 'kick-b' })?.id).toBe('kick-b');
    expect(lookup.forAssignment('hat')?.id).toBe('hat');
  });

  it('never matches by pitch: an unknown id has no Sound even when a Sound shares its pitch', () => {
    expect(lookup.forVoice({ id: 'gone' })).toBeNull();
    expect(lookup.forAssignment('gone')).toBeNull();
    expect(lookup.forAssignment(undefined)).toBeNull();
    expect(lookup.forVoice(null)).toBeNull();
  });
});
