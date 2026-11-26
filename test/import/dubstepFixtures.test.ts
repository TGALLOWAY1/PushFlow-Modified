/**
 * The dubstep test-suite fixtures (test/fixtures/midi/dubstep): the committed .mid
 * files are what arrangements.mjs builds, each arrangement keeps the agreed palette,
 * and every file imports through the app's own path with the Sounds, tempo and
 * moments its source says it has.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FILES, ARRANGEMENTS, buildMidiFile, cutFile } from '../fixtures/midi/dubstep/arrangements.mjs';
import { importMidiFixture } from '../helpers/testMidi1';
import { getActivePerformance, getDisplayedLayout } from '../../src/ui/state/projectState';
import { groupIntoMoments } from '../../src/engine/structure/momentGrouping';

const DIR = path.resolve(__dirname, '../fixtures/midi/dubstep');

type Spec = (typeof FILES)[number];
const fixturePath = (spec: Spec) => path.join(DIR, spec.path);

function midiFilesIn(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return midiFilesIn(full);
    return entry.name.endsWith('.mid') ? [path.relative(DIR, full)] : [];
  });
}

describe('dubstep fixtures', () => {
  it('the committed files are exactly what arrangements.mjs builds (regenerate: node scripts/generate-dubstep-midi.mjs)', () => {
    const stale = FILES.filter((spec) => !Buffer.from(buildMidiFile(spec)).equals(fs.readFileSync(fixturePath(spec))));
    expect(stale.map((s) => s.path)).toEqual([]);
  });

  it('every .mid in the folder comes from FILES, and the README lists every file', () => {
    expect(midiFilesIn(DIR).sort()).toEqual(FILES.map((s) => s.path).sort());
    const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    expect(FILES.map((s) => s.path).filter((p) => !readme.includes(p))).toEqual([]);
  });

  it('each arrangement is 130–150 BPM with ≤6 drums, 6 bass, 4–6 melodic hits and 2 FX, all of them played', () => {
    for (const arrangement of Object.values(ARRANGEMENTS)) {
      const byFamily: Record<string, string[]> = { drums: [], bass: [], melodic: [], fx: [] };
      for (const [name, sound] of Object.entries(arrangement.sounds)) byFamily[sound.family].push(name);
      const played = new Set(cutFile({ path: arrangement.id, arrangement: arrangement.id }).notes.map((n) => n.name));

      expect(arrangement.bpm).toBeGreaterThanOrEqual(130);
      expect(arrangement.bpm).toBeLessThanOrEqual(150);
      expect(byFamily.drums.length).toBeLessThanOrEqual(6);
      expect(byFamily.bass).toHaveLength(6);
      expect(byFamily.melodic.length).toBeGreaterThanOrEqual(4);
      expect(byFamily.melodic.length).toBeLessThanOrEqual(6);
      expect(byFamily.fx).toHaveLength(2);
      expect(Object.keys(arrangement.sounds).filter((name) => !played.has(name))).toEqual([]);
    }
  });

  describe.each(FILES)('$path', (spec) => {
    it('imports through the app path: a Sound per track, named after it, tempo from the file, nothing placed', async () => {
      const state = await importMidiFixture(fixturePath(spec));
      const { arrangement, notes } = cutFile(spec);
      expect(state.tempo).toBe(arrangement.bpm);
      expect(state.soundStreams.map((s) => s.name).sort()).toEqual([...new Set(notes.map((n) => n.name))].sort());
      expect(getActivePerformance(state).events).toHaveLength(notes.length);
      // Invariants 5 and 7: pitch is metadata only, and import places nothing.
      expect(state.instrumentConfig.bottomLeftNote).toBe(36);
      expect(Object.keys(getDisplayedLayout(state)!.padToVoice)).toHaveLength(0);
    });

    it('groups into moments of at most 5 notes, each Sound at most once per moment', async () => {
      const state = await importMidiFixture(fixturePath(spec));
      for (const moment of groupIntoMoments(getActivePerformance(state).events)) {
        expect(moment.items.length).toBeLessThanOrEqual(5);
        const sounds = moment.items.map((e) => e.voiceId);
        expect(new Set(sounds).size).toBe(sounds.length);
      }
    });
  });

  it('the humanized drop groups into the same moments as its quantized twin', async () => {
    const humanized = FILES.find((s) => s.humanize)!;
    const quantized = FILES.find((s) => !s.humanize && !s.families && s.arrangement === humanized.arrangement
      && String(s.from) === String(humanized.from) && String(s.to) === String(humanized.to))!;
    const shape = async (spec: Spec) => {
      const state = await importMidiFixture(fixturePath(spec));
      const nameById = new Map(state.soundStreams.map((s) => [s.id, s.name]));
      return groupIntoMoments(getActivePerformance(state).events)
        .map((m) => m.items.map((e) => nameById.get(e.voiceId!)).sort().join('+'));
    };
    const [h, q] = await Promise.all([shape(humanized), shape(quantized)]);
    expect(h.length).toBe(q.length);
    expect(h).toEqual(q);
  });
});
