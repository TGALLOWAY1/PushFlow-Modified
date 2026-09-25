/**
 * Preset drops, refuse-first (S1b.4, T65): P1b-5a/5b/5c at the unit level.
 * The e2e C9 spec covers the same with real native drags.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyLayout } from '../../../src/types/layout';
import type { ComposerPreset, PresetPad } from '../../../src/types/composerPreset';
import type { SoundStream } from '../../../src/ui/state/projectState';
import { resolvePresetDrop, FOREIGN_PRESET_MESSAGE } from '../../../src/ui/state/presetDrop';
import { projectSoundIdForLane } from '../../../src/ui/components/workspace/composerLaneIdentity';

const stream = (id: string): SoundStream => ({ id, name: id.toUpperCase(), color: '#123456', originalMidiNote: 40, events: [], muted: false });
const pad = (laneId: string, rowOffset: number, colOffset: number, extra: Partial<PresetPad> = {}): PresetPad =>
  ({ laneId, position: { rowOffset, colOffset }, hand: null, finger: null, ...extra });

function preset(pads: PresetPad[]): ComposerPreset {
  return {
    id: 'p', name: 'P', createdAt: 0, updatedAt: 0, pads,
    config: {} as ComposerPreset['config'], lanes: [], events: [],
    handedness: 'both', mirrorEligible: true, boundingBox: { rows: 1, cols: 2 }, tags: [],
  };
}

const sounds = [stream(projectSoundIdForLane('a')), stream(projectSoundIdForLane('b')), stream('other')];
const layout = () => createEmptyLayout('active', 'Active');

describe('resolvePresetDrop', () => {
  it('places each lane on its project Sound, by id', () => {
    const r = resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('b', 0, 1)]), anchorRow: 4, anchorCol: 4, isMirrored: false, layout: layout(), soundStreams: sounds });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.fromEntries(Object.entries(r.padToVoice).map(([k, v]) => [k, v.id]))).toEqual({
      '4,4': projectSoundIdForLane('a'), '4,5': projectSoundIdForLane('b'),
    });
    expect(r.padToVoice['4,4']!.name).toBe(projectSoundIdForLane('a').toUpperCase());
  });

  it('refuses a preset whose lanes are not project Sounds, placing nothing', () => {
    const r = resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('zzz', 0, 1)]), anchorRow: 4, anchorCol: 4, isMirrored: false, layout: layout(), soundStreams: sounds });
    expect(r).toEqual({ ok: false, reason: FOREIGN_PRESET_MESSAGE });
  });

  it('refuses an occupied pad with its position', () => {
    const l = layout();
    l.padToVoice['4,5'] = { id: 'other', name: 'OTHER', sourceType: 'midi_track', sourceFile: '', originalMidiNote: null, color: '#000' };
    const r = resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('b', 0, 1)]), anchorRow: 4, anchorCol: 4, isMirrored: false, layout: l, soundStreams: sounds });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/pad \[4,5\] is occupied/) });
  });

  it('refuses a drop off the grid, and a Sound already placed elsewhere', () => {
    expect(resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('b', 0, 1)]), anchorRow: 4, anchorCol: 7, isMirrored: false, layout: layout(), soundStreams: sounds }))
      .toMatchObject({ ok: false, reason: expect.stringMatching(/outside the 8×8 grid/) });
    const l = layout();
    l.padToVoice['0,0'] = { id: projectSoundIdForLane('a'), name: 'A', sourceType: 'midi_track', sourceFile: '', originalMidiNote: null, color: '#000' };
    expect(resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('b', 0, 1)]), anchorRow: 4, anchorCol: 4, isMirrored: false, layout: l, soundStreams: sounds }))
      .toMatchObject({ ok: false, reason: expect.stringMatching(/already on pad \[0,0\]/) });
  });

  it('honours mirror: columns flip', () => {
    const r = resolvePresetDrop({ preset: preset([pad('a', 0, 0), pad('b', 0, 1)]), anchorRow: 4, anchorCol: 4, isMirrored: true, layout: layout(), soundStreams: sounds });
    expect(r.ok && r.padToVoice['4,4']!.id).toBe(projectSoundIdForLane('b'));
  });

  it('applies only verified fingering', () => {
    const r = resolvePresetDrop({
      preset: preset([
        pad('a', 0, 0, { hand: 'left', finger: 'middle', fingerSource: 'preference' }),
        pad('b', 0, 1, { hand: 'left', finger: 'index', fingerSource: 'unverified' }),
      ]),
      anchorRow: 2, anchorCol: 1, isMirrored: false, layout: layout(), soundStreams: sounds,
    });
    expect(r.ok && r.fingerConstraints).toEqual({ '2,1': 'L3' });
  });
});
