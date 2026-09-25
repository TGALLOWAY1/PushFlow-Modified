/**
 * S2.2a · Sounds you can tell apart (T17): the palette, the opt-in GM drum
 * naming, and existing colours left alone.
 */

import * as fs from 'fs';
import * as path from 'path';
import chroma from 'chroma-js';
import { describe, expect, it } from 'vitest';
import { SOUND_PALETTE, nextSoundColors } from '../../../src/utils/soundPalette';
import { GM_DRUM_NAMES, gmDrumName, gmDrumRenames } from '../../../src/utils/gmDrumMap';
import { projectReducer } from '../../../src/ui/state/projectState';
import { historyLabelFor } from '../../../src/ui/state/historyLabels';
import { deserializeProject } from '../../../src/ui/persistence/projectSerializer';
import { importTestMidi1 } from '../../helpers/testMidi1';

describe('the Sound palette', () => {
  it('has 16 distinct colours, and the first 7 are pairwise more than 20 CIEDE2000 apart', () => {
    expect(SOUND_PALETTE).toHaveLength(16);
    expect(new Set(SOUND_PALETTE.map(c => c.toUpperCase())).size).toBe(16);
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        expect(chroma.deltaE(SOUND_PALETTE[i]!, SOUND_PALETTE[j]!), `${SOUND_PALETTE[i]} vs ${SOUND_PALETTE[j]}`).toBeGreaterThan(20);
      }
    }
  });

  it('matches the --sound-1…16 tokens in index.css', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8');
    const tokens = [...css.matchAll(/--sound-(\d+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [Number(m[1]), m[2]!.toUpperCase()]);
    expect(tokens).toEqual(SOUND_PALETTE.map((c, i) => [i + 1, c.toUpperCase()]));
  });

  it('new Sounds take colours not yet used, continuing where the project left off', () => {
    expect(nextSoundColors([], 3)).toEqual(SOUND_PALETTE.slice(0, 3));
    expect(nextSoundColors([SOUND_PALETTE[0]!.toLowerCase(), SOUND_PALETTE[2]!], 2)).toEqual([SOUND_PALETTE[1], SOUND_PALETTE[3]]);
    expect(nextSoundColors([...SOUND_PALETTE], 2)).toEqual(SOUND_PALETTE.slice(0, 2));
    expect(nextSoundColors(SOUND_PALETTE.slice(0, 15), 3)).toEqual([SOUND_PALETTE[15], SOUND_PALETTE[0], SOUND_PALETTE[1]]);
  });

  it('a TEST MIDI 1 import gives 7 Sounds 7 distinct palette colours, each its own (not its group\'s)', async () => {
    const state = await importTestMidi1();
    const colors = state.soundStreams.map(s => s.color.toUpperCase());
    expect(colors).toEqual(SOUND_PALETTE.slice(0, 7));
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) expect(chroma.deltaE(colors[i]!, colors[j]!)).toBeGreaterThan(20);
    }
    expect(state.performanceLanes.every(l => l.colorMode === 'overridden')).toBe(true);
  });

  it('opening a project saved before S2.2a keeps every custom colour and name', () => {
    const stored = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/projects/saved-by-main.json'), 'utf8'));
    const loaded = deserializeProject(structuredClone(stored));
    const byId = new Map<string, { color: string; name: string }>(
      stored.soundStreams.map((s: { id: string; color: string; name: string }) => [s.id, s]),
    );
    expect(loaded.soundStreams.length).toBeGreaterThan(0);
    for (const s of loaded.soundStreams) {
      expect(s.color).toBe(byId.get(s.id)!.color);
      expect(s.name).toBe(byId.get(s.id)!.name);
    }
  });
});

describe('Name from GM drum map', () => {
  it('covers GM percussion 35–81 and nothing else', () => {
    expect(Object.keys(GM_DRUM_NAMES).map(Number)).toEqual(Array.from({ length: 47 }, (_, i) => 35 + i));
    expect(gmDrumName(36)).toBe('Kick');
    expect(gmDrumName(38)).toBe('Snare');
    expect(gmDrumName(42)).toBe('Closed Hat');
    expect(gmDrumName(34)).toBeNull();
    expect(gmDrumName(0)).toBeNull();
  });

  it('renames GM pitches only, and numbers a name that would repeat', () => {
    const renames = gmDrumRenames([
      { id: 'a', name: 'Groove A', originalMidiNote: 36 },
      { id: 'b', name: 'Groove B', originalMidiNote: 38 },
      { id: 'c', name: 'Groove C', originalMidiNote: 12 },
      { id: 'd', name: 'Other', originalMidiNote: 36 },
      { id: 'e', name: 'Snare', originalMidiNote: 38 },
    ]);
    expect(renames).toEqual({ a: 'Kick', b: 'Snare (2)', d: 'Kick (2)' });
  });

  it('is one reducer step, one undo step named after the action, and a no-op when nothing maps', async () => {
    const tm1 = await importTestMidi1();
    // TEST MIDI 1's pitches (0–14) are not GM drums: nothing to rename, same state back.
    expect(projectReducer(tm1, { type: 'APPLY_GM_DRUM_NAMES' })).toBe(tm1);

    // Give three Sounds GM pitches through their lanes (as a GM file would import).
    const gmPitch = [36, 38, 42];
    const lanes = tm1.performanceLanes.map((l, i) => i < 3
      ? { ...l, events: l.events.map(e => ({ ...e, rawPitch: gmPitch[i]! })) }
      : l);
    let state = projectReducer({ ...tm1, performanceLanes: lanes }, { type: 'SYNC_STREAMS_FROM_LANES' });
    state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: state.soundStreams[0]! } });
    const named = projectReducer(state, { type: 'APPLY_GM_DRUM_NAMES' });
    expect(named.soundStreams.slice(0, 4).map(s => s.name)).toEqual(['Kick', 'Snare', 'Closed Hat', 'TEST MIDI 1 D']);
    // Every copy follows: lanes, the placed pad.
    expect(named.performanceLanes[0]!.name).toBe('Kick');
    expect((named.workingLayout ?? named.activeLayout).padToVoice['0,0']!.name).toBe('Kick');
    expect(historyLabelFor({ type: 'APPLY_GM_DRUM_NAMES' })).toBe('Name from GM drum map');
    // A second time changes nothing.
    expect(projectReducer(named, { type: 'APPLY_GM_DRUM_NAMES' })).toBe(named);
  });
});
