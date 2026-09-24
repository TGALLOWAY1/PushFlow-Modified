/**
 * Pose0 seeding by Sound identity with placement locks (S1a.3, T11/T18).
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type Performance } from '../../../src/types/performance';
import { seedLayoutFromPose0, orderSoundsByUsage } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import {
  applicableLocks,
  describeDroppedForLocks,
  findLockViolations,
  holdsLocks,
} from '../../../src/engine/mapping/placementLocks';

const voice = (id: string, midi: number): Voice => ({
  id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444',
});

/** Four Sounds; hat is busiest, kick and snare tie, tom is rarest. */
function performance(): Performance {
  const hits = (id: string, midi: number, times: number[]) =>
    times.map((t, i) => ({ noteNumber: midi, voiceId: id, startTime: t, duration: 0.1, velocity: 100, eventKey: `${id}-${i}` }));
  return {
    name: 'seed', tempo: 120,
    events: [
      ...hits('hat', 42, [0, 0.5, 1, 1.5, 2, 2.5]),
      ...hits('kick', 36, [0, 1, 2]),
      ...hits('snare', 38, [0.5, 1.5, 2.5]),
      ...hits('tom', 45, [2.75]),
    ].sort((a, b) => a.startTime - b.startTime),
  };
}

const layoutWith = (padToVoice: Layout['padToVoice'], placementLocks: Record<string, string> = {}): Layout => ({
  id: 'L', name: 'L', role: 'active', scoreCache: null, padToVoice, fingerConstraints: {}, placementLocks,
});

describe('orderSoundsByUsage', () => {
  it('orders busiest first, ties by the given order, then by first appearance', () => {
    expect(orderSoundsByUsage(performance())).toEqual(['hat', 'kick', 'snare', 'tom']);
    expect(orderSoundsByUsage(performance(), ['snare', 'kick'])).toEqual(['hat', 'snare', 'kick', 'tom']);
  });
});

describe('seedLayoutFromPose0', () => {
  it('places every Sound by identity, busiest on the strongest anchor pads', () => {
    const layout = seedLayoutFromPose0(performance(), createDefaultPose0(), 0);
    const ids = Object.values(layout.padToVoice).map(v => v.id).sort();
    expect(ids).toEqual(['hat', 'kick', 'snare', 'tom']);
    // Default pose0: the index fingers sit on (3,3) and (3,4); the busiest Sound takes the first.
    expect(['3,3', '3,4']).toContain(Object.entries(layout.padToVoice).find(([, v]) => v.id === 'hat')![0]);
    expect(layout.placementLocks).toEqual({});
  });

  it('places locked Sounds first, on their locked pads, and carries the locks', () => {
    const base = layoutWith({ '7,0': voice('hat', 42), '1,1': voice('kick', 36) }, { hat: '7,0' });
    const layout = seedLayoutFromPose0(performance(), createDefaultPose0(), 0, { baseLayout: base });
    expect(layout.padToVoice['7,0']?.id).toBe('hat');
    expect(Object.values(layout.padToVoice).filter(v => v.id === 'hat')).toHaveLength(1);
    expect(layout.placementLocks).toEqual({ hat: '7,0' });
    expect(Object.values(layout.padToVoice).map(v => v.id).sort()).toEqual(['hat', 'kick', 'snare', 'tom']);
  });

  it('keeps a locked Sound that has no events on its pad', () => {
    const base = layoutWith({ '0,7': voice('crash', 49) }, { crash: '0,7' });
    const layout = seedLayoutFromPose0(performance(), createDefaultPose0(), 0, { baseLayout: base });
    expect(layout.padToVoice['0,7']?.id).toBe('crash');
    expect(layout.placementLocks).toEqual({ crash: '0,7' });
  });

  it('ignores a lock whose Sound no longer exists', () => {
    const base = layoutWith({}, { ghost: '0,0' });
    const layout = seedLayoutFromPose0(performance(), createDefaultPose0(), 0, { baseLayout: base });
    expect(layout.padToVoice['0,0']).toBeUndefined();
    expect(layout.placementLocks).toEqual({});
  });

  it('uses the given voices and never invents a pitch-named Sound for a known id', () => {
    const voices = new Map<string, Voice>([
      ['hat', { ...voice('hat', 42), name: 'Closed hat', color: '#0f0' }],
    ]);
    const layout = seedLayoutFromPose0(performance(), createDefaultPose0(), 0, { voices });
    // Only the voices given are placed; unknown Sounds are left for the caller.
    expect(Object.values(layout.padToVoice).map(v => v.name)).toEqual(['Closed hat']);
  });
});

describe('placement lock helpers', () => {
  it('reports every lock a layout breaks', () => {
    const layout = layoutWith({ '2,2': voice('hat', 42), '1,1': voice('kick', 36) });
    expect(findLockViolations({ hat: '2,2' }, layout)).toEqual([]);
    expect(findLockViolations({ hat: '7,0', snare: '0,0' }, layout)).toEqual([
      { voiceId: 'hat', lockedPadKey: '7,0', actualPadKey: '2,2' },
      { voiceId: 'snare', lockedPadKey: '0,0', actualPadKey: null },
    ]);
    expect(holdsLocks({ kick: '1,1' }, layout)).toBe(true);
    expect(holdsLocks({ kick: '1,2' }, layout)).toBe(false);
  });

  it('keeps only locks whose Sound is known', () => {
    expect(applicableLocks({ hat: '7,0', ghost: '0,0' }, new Set(['hat']))).toEqual({ hat: '7,0' });
    expect(applicableLocks(undefined, new Set(['hat']))).toEqual({});
  });

  it('words the dropped-candidate note', () => {
    expect(describeDroppedForLocks(0)).toBe('');
    expect(describeDroppedForLocks(1)).toBe('1 candidate was dropped because it moved a locked Sound.');
    expect(describeDroppedForLocks(2)).toBe('2 candidates were dropped because they moved a locked Sound.');
  });
});
