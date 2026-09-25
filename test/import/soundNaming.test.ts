/**
 * S2.2a · default Sound names follow decision Q3 (T17): the track or the file
 * name plus a sequence letter, never the pitch. Built through the app's own
 * import path (parseMidiProject → buildLanesFromMidiProject).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiProject } from '../../src/import/midiImport';
import { buildLanesFromMidiProject } from '../../src/import/midiToLanes';
import { defaultSoundNames, sequenceLetter, fileNameToDisplayName } from '../../src/import/soundNaming';

const FIXTURES = path.resolve(__dirname, '../fixtures/midi');

function toArrayBuffer(buf: Buffer | Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function importFile(fileName: string, existingNames: string[] = []) {
  const data = await parseMidiProject(toArrayBuffer(fs.readFileSync(path.join(FIXTURES, fileName))), fileName);
  return buildLanesFromMidiProject(data, fileName, { currentMaxOrder: -1, existingNames, existingColors: [] }).lanes;
}

/** A MIDI file in memory: each track a name and its pitches (four notes each). */
async function importTracks(fileName: string, tracks: Array<{ name: string; pitches: number[] }>) {
  const midi = new Midi();
  for (const t of tracks) {
    const track = midi.addTrack();
    track.name = t.name;
    t.pitches.forEach((p, i) => {
      for (let k = 0; k < 4; k++) track.addNote({ midi: p, time: k * 0.5 + i * 0.1, duration: 0.1 });
    });
  }
  const data = await parseMidiProject(toArrayBuffer(midi.toArray()), fileName);
  return buildLanesFromMidiProject(data, fileName, { currentMaxOrder: -1 }).lanes;
}

/** Note names such as C1, D#2 or C-2, alone or in parentheses with the pitch. */
const NOTE_NAME = /(^|\s)[A-G]#?-?\d+(\s|$)|\(\d+\)/;

describe('default Sound names (Q3)', () => {
  it('TEST MIDI 1: the file name plus A to G, in pitch order', async () => {
    const lanes = await importFile('TEST MIDI 1.mid');
    expect(lanes.map(l => l.name)).toEqual(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(letter => `TEST MIDI 1 ${letter}`),
    );
    expect(lanes.every(l => !NOTE_NAME.test(l.name))).toBe(true);
    // Pitch stays provenance on the events.
    expect(lanes.map(l => l.events[0]!.rawPitch)).toEqual([0, 1, 4, 5, 12, 13, 14]);
  });

  it('a one-track file uses the file name, not the track name', async () => {
    const lanes = await importFile('four-bars-120.mid');
    expect(lanes.map(l => l.name)).toEqual(['Four Bars 120 A', 'Four Bars 120 B', 'Four Bars 120 C']);
  });

  it('several tracks: a one-pitch track takes its name; a busier one gives "<track> A", "<track> B"', async () => {
    const lanes = await importTracks('kit.mid', [
      { name: 'Kick', pitches: [36] },
      { name: 'Perc', pitches: [60, 61, 62] },
      { name: '', pitches: [70, 71] },
    ]);
    expect(lanes.map(l => [l.events[0]!.rawPitch, l.name])).toEqual([
      [36, 'Kick'],
      [60, 'Perc A'],
      [61, 'Perc B'],
      [62, 'Perc C'],
      [70, 'Kit A'],
      [71, 'Kit B'],
    ]);
  });

  it('a file with one pitch is named after the file', async () => {
    const lanes = await importTracks('shaker_loop.mid', [{ name: 'Track 1', pitches: [70] }]);
    expect(lanes.map(l => l.name)).toEqual(['Shaker Loop']);
  });

  it('a second import continues the letters instead of repeating names', async () => {
    const first = await importFile('TEST MIDI 1.mid');
    const second = await importFile('TEST MIDI 1.mid', first.map(l => l.name));
    expect(second.map(l => l.name)).toEqual(
      ['H', 'I', 'J', 'K', 'L', 'M', 'N'].map(letter => `TEST MIDI 1 ${letter}`),
    );
    const again = await importTracks('kick.mid', [{ name: 'Kick', pitches: [36] }]);
    expect(again[0]!.name).toBe('Kick');
    expect(defaultSoundNames('kick.mid', [], [36], ['Kick'])).toEqual(['Kick 2']);
  });

  it('parseMidiProject voices carry the same names, never note names', async () => {
    const data = await parseMidiProject(toArrayBuffer(fs.readFileSync(path.join(FIXTURES, 'TEST MIDI 1.mid'))), 'TEST MIDI 1.mid');
    expect(data.voices.map(v => v.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(l => `TEST MIDI 1 ${l}`));
    expect(data.tracks).toEqual([{ name: 'TEST MIDI', noteCounts: expect.any(Map) }]);
  });

  it('sequence letters run A…Z, then AA, AB…', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(sequenceLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  it('file names read as words', () => {
    expect(fileNameToDisplayName('lead_chops.mid')).toBe('Lead Chops');
    expect(fileNameToDisplayName('BASS.midi')).toBe('BASS');
    expect(fileNameToDisplayName('four-bars-120.mid')).toBe('Four Bars 120');
  });
});
