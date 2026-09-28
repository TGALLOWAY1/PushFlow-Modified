/**
 * What sounds in rehearsal (S4.4, T16; roadmap P4-7b): Mute and Solo are
 * independent flags, audible = anySolo ? soloed : !muted.
 */

import { describe, it, expect } from 'vitest';
import { audibleSoundIds, isAudible, silentLabel, silentReason, type Audition } from '../../../src/ui/audio/audibility';
import { audibleHits } from '../../../src/ui/audio/TransportProvider';
import { type SoundStream } from '../../../src/ui/state/projectState';

const audition = (muted: string[], soloed: string[]): Audition => ({ mutedSoundIds: muted, soloedSoundIds: soloed });

describe('audible = anySolo ? soloed : !muted (P4-7b)', () => {
  // One row per (muted?, soloed?, another Sound soloed?).
  it.each<[string, boolean, boolean, boolean, boolean]>([
    ['neither muted nor soloed, no solo anywhere', false, false, false, true],
    ['muted, no solo anywhere', true, false, false, false],
    ['soloed', false, true, false, true],
    ['soloed and muted: the solo wins', true, true, false, true],
    ['another Sound soloed', false, false, true, false],
    ['muted, another Sound soloed', true, false, true, false],
    ['soloed with another Sound soloed too', false, true, true, true],
    ['soloed and muted, another soloed too', true, true, true, true],
  ])('%s', (_name, muted, soloed, otherSoloed, audible) => {
    const a = audition(muted ? ['kick'] : [], [...(soloed ? ['kick'] : []), ...(otherSoloed ? ['snare'] : [])]);
    expect(isAudible('kick', a, ['kick', 'snare', 'hat'])).toBe(audible);
  });

  it('says why a Sound is silent', () => {
    expect(silentReason('kick', audition(['kick'], []))).toBe('muted');
    expect(silentReason('kick', audition([], ['snare']))).toBe('not-soloed');
    expect(silentReason('kick', audition(['kick'], ['kick']))).toBeNull();
    expect(silentLabel('muted')).toBe('Muted: silent in rehearsal');
    expect(silentLabel('not-soloed')).toBe('Silent in rehearsal: another Sound is soloed');
  });

  it('ending a solo leaves every earlier mute as it was', () => {
    const ids = ['kick', 'snare', 'hat'];
    expect([...audibleSoundIds(ids, audition(['hat'], ['kick']))]).toEqual(['kick']);
    expect([...audibleSoundIds(ids, audition(['hat'], []))]).toEqual(['kick', 'snare']);
  });

  it('a solo left on a Sound the project no longer has solos nothing', () => {
    expect([...audibleSoundIds(['kick', 'snare'], audition(['snare'], ['gone']))]).toEqual(['kick']);
  });
});

describe('the transport plays only what is audible', () => {
  const stream = (id: string, times: number[], extra: Partial<SoundStream> = {}): SoundStream => ({
    id, name: id, color: '#fff', originalMidiNote: 36,
    events: times.map((t, i) => ({ startTime: t, duration: 0.1, velocity: 100, eventKey: `${id}-${i}` })),
    ...extra,
  });
  const streams = [stream('kick', [0, 1]), stream('snare', [0.5]), stream('hat', [0.25], { excluded: true })];

  it('Mute and Solo silence hits; an excluded Sound still sounds (exclusion is the analysis\'s, not the ear\'s)', () => {
    const times = (a: Audition) => audibleHits(streams, a).map(h => `${h.soundId}@${h.time}`);
    expect(times(audition([], []))).toEqual(['kick@0', 'hat@0.25', 'snare@0.5', 'kick@1']);
    expect(times(audition(['kick'], []))).toEqual(['hat@0.25', 'snare@0.5']);
    expect(times(audition(['kick'], ['kick']))).toEqual(['kick@0', 'kick@1']);
  });
});
