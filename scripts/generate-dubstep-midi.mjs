/**
 * Writes the dubstep test-suite MIDI files from their source,
 * test/fixtures/midi/dubstep/arrangements.mjs. Run after editing a pattern:
 *
 *   node scripts/generate-dubstep-midi.mjs
 *
 * Pass --stats to also print each file's Sounds, events and densest moment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FILES, buildMidiFile, cutFile } from '../test/fixtures/midi/dubstep/arrangements.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'test/fixtures/midi/dubstep');
const stats = process.argv.includes('--stats');

for (const spec of FILES) {
  const target = path.join(outDir, spec.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buildMidiFile(spec));
  if (!stats) {
    console.log(`wrote ${spec.path}`);
    continue;
  }
  const { arrangement, notes, bars } = cutFile(spec);
  const sounds = new Set(notes.map((n) => n.name));
  const perTick = new Map();
  for (const n of notes) perTick.set(n.ticks, (perTick.get(n.ticks) ?? 0) + 1);
  const densest = Math.max(...perTick.values());
  const seconds = (bars * 4 * 60) / arrangement.bpm;
  console.log(
    `${spec.path.padEnd(42)} ${String(arrangement.bpm).padStart(3)} BPM ${String(bars).padStart(3)} bars ` +
      `${seconds.toFixed(1).padStart(6)} s ${String(sounds.size).padStart(2)} Sounds ` +
      `${String(notes.length).padStart(4)} events, densest moment ${densest}`,
  );
}
