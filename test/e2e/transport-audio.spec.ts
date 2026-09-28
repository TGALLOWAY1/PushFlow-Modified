/**
 * S4.3a · P4-5b: the opening chord sounds on every loop repeat, rendered.
 *
 * TEST MIDI 1 goes through the app's own import path in the page (the modules
 * the dev server serves, loaded by an inline module script, so nothing
 * test-only ships in the app). The look-ahead scheduler books bars 1–2,
 * looped, into an OfflineAudioContext through RehearsalAudio's own synthesis,
 * and the rendered samples are checked: every repeat starts with the opening
 * chord, within 2 ms of the loop's start, as loud as the first time.
 *
 * Before S4.3a the transport dropped anything exactly on the wrap point (its
 * windows excluded their start), so every repeat after the first began in
 * silence.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';

const TEST_MIDI_1 = fileURLToPath(new URL('../fixtures/midi/TEST MIDI 1.mid', import.meta.url));

interface Repeat { at: number; onset: number | null; peakBefore: number; peakAfter: number; energy: number }
interface Rendered { tempo: number; chordSize: number; repeats: Repeat[] }

declare global {
  interface Window {
    __pfRenderLoop?: (bytes: number[], options: { loopStart: number; loopEnd: number; passes: number; rate: number }) => Promise<Rendered>;
  }
}

const PROBE = `
import { parseMidiProject } from '/src/import/midiImport.ts';
import { buildLanesFromMidiProject } from '/src/import/midiToLanes.ts';
import { createEmptyProjectState, projectReducer } from '/src/ui/state/projectState.ts';
import { audibleHits } from '/src/ui/audio/TransportProvider.tsx';
import { LookaheadScheduler } from '/src/ui/audio/lookaheadScheduler.ts';
import { RehearsalAudio } from '/src/ui/audio/rehearsalAudio.ts';
import { playRegion, songSpan } from '/src/ui/audio/transportMath.ts';

window.__pfRenderLoop = async (bytes, { loopStart, loopEnd, passes, rate }) => {
  const name = 'TEST MIDI 1.mid';
  const data = await parseMidiProject(new Uint8Array(bytes).buffer, name);
  const { lanes, sourceFile } = buildLanesFromMidiProject(data, name, { currentMaxOrder: -1, existingNames: [], existingColors: [] });
  let state = projectReducer(createEmptyProjectState(), { type: 'IMPORT_LANES', payload: { lanes, sourceFile } });
  if (data.performance.tempo) state = projectReducer(state, { type: 'SET_TEMPO', payload: data.performance.tempo });
  const hits = audibleHits(state.soundStreams, { mutedSoundIds: state.mutedSoundIds, soloedSoundIds: state.soloedSoundIds });
  const region = playRegion(songSpan(state.soundStreams, state.tempo), { enabled: true, start: loopStart, end: loopEnd });

  const lead = 0.04;
  const passLength = (loopEnd - loopStart) / rate;
  const seconds = lead + passes * passLength + 0.3;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const audio = new RehearsalAudio({ context: ctx });
  audio.setOptions({ metronome: false, hits: true, volume: 0.6 });
  const scheduler = new LookaheadScheduler(
    { hit: (id, when, velocity) => audio.scheduleHit(id, when, velocity), click: (when, down) => audio.scheduleClick(when, down) },
    { hits, tempo: state.tempo, hitsOn: true, clicksOn: false },
  );
  // Played from the loop's start, ticking every 25 ms as the transport does.
  scheduler.start({ anchorClock: lead, startPos: loopStart, rate, region });
  for (let now = 0; now < seconds - 0.2; now += 0.025) scheduler.tick(now);
  const samples = (await ctx.startRendering()).getChannelData(0);

  const at = s => Math.round(s * sampleRate);
  const repeats = [];
  for (let k = 0; k < passes; k++) {
    const start = lead + k * passLength;
    let peakBefore = 0;
    for (let i = at(start - 0.03); i < at(start - 0.002); i++) peakBefore = Math.max(peakBefore, Math.abs(samples[i] ?? 0));
    let peakAfter = 0;
    for (let i = at(start); i < at(start + 0.02); i++) peakAfter = Math.max(peakAfter, Math.abs(samples[i]));
    // Energy over the chord's first 50 ms: the same chord sounds the same,
    // wherever it falls between two samples (a peak can differ by a sample's rounding).
    let sum = 0;
    for (let i = at(start); i < at(start + 0.05); i++) sum += samples[i] * samples[i];
    const energy = Math.sqrt(sum / (at(start + 0.05) - at(start)));
    // The first sample that rises clearly above what was already sounding.
    const threshold = Math.max(0.02, 3 * peakBefore);
    let onset = null;
    for (let i = at(start - 0.002); i < at(start + 0.02); i++) {
      if (Math.abs(samples[i]) > threshold) { onset = i / sampleRate; break; }
    }
    repeats.push({ at: start, onset, peakBefore, peakAfter, energy });
  }
  return { tempo: state.tempo, chordSize: hits.filter(h => h.time === loopStart).length, repeats };
};
`;

test.describe('S4.3a · the opening chord on every loop repeat (P4-5b, OfflineAudioContext)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.addScriptTag({ type: 'module', content: PROBE });
    await page.waitForFunction(() => !!window.__pfRenderLoop);
  });

  for (const rate of [1, 0.75]) {
    test(`bars 1–2 of TEST MIDI 1 looped four times at ${rate}x: the chord sounds at each start, within 2 ms`, async ({ page }) => {
      const bytes = [...fs.readFileSync(TEST_MIDI_1)];
      const result = await page.evaluate(
        ([b, r]) => window.__pfRenderLoop!(b, { loopStart: 0, loopEnd: 4, passes: 4, rate: r }),
        [bytes, rate] as [number[], number],
      );
      expect(result.tempo).toBe(120);
      // The opening chord: three Sounds on the first downbeat.
      expect(result.chordSize).toBe(3);
      const first = result.repeats[0]!;
      result.repeats.forEach((r, k) => {
        expect(r.onset, `repeat ${k + 1} starts with a sound`).not.toBeNull();
        expect(Math.abs(r.onset! - r.at), `repeat ${k + 1} starts on time`).toBeLessThan(0.002);
        expect(r.peakAfter, `repeat ${k + 1} is a clear onset`).toBeGreaterThan(Math.max(0.05, 3 * r.peakBefore));
        // The same chord each time, as loud as the first.
        expect(r.energy / first.energy, `repeat ${k + 1} as loud as the first`).toBeGreaterThan(0.9);
        expect(r.energy / first.energy).toBeLessThan(1.1);
      });
    });
  }
});
