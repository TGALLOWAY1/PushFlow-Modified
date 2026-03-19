/**
 * Diagnostic test: Trace exactly why TEST MIDI 1 events are unplayable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Midi } from '@tonejs/midi';
import { type Performance } from '../../../src/types/performance';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type Voice } from '../../../src/types/voice';
import { type Layout } from '../../../src/types/layout';
import { type SolverConfig } from '../../../src/types/engineConfig';
import { seedLayoutFromPose0 } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { buildNoteToPadIndex, buildVoiceIdToPadIndex, resolveEventToPad } from '../../../src/engine/mapping/mappingResolver';
import { isZoneValid, allPadsInZone } from '../../../src/engine/surface/handZone';
import {
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  countHandUsage,
} from '../../helpers/testHelpers';

function loadTestMidi() {
  const midiPath = path.resolve(__dirname, '../../../archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid');
  const buffer = fs.readFileSync(midiPath);
  const midiData = new Midi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  const events: PerformanceEvent[] = [];
  midiData.tracks.forEach((track) => {
    const timeTally = new Map<string, number>();
    track.notes.forEach((note) => {
      const noteNumber = note.midi;
      const channelLabel = track.channel + 1;
      const nominalTime = note.ticks !== undefined ? note.ticks : Math.round(note.time * 10000);
      const hashKey = `${nominalTime}:${noteNumber}:${channelLabel}`;
      const ordinal = (timeTally.get(hashKey) || 0) + 1;
      timeTally.set(hashKey, ordinal);
      events.push({
        noteNumber, startTime: note.time, duration: note.duration,
        velocity: Math.round(note.velocity * 127), channel: channelLabel,
        eventKey: `${hashKey}:${ordinal}`,
      });
    });
  });
  events.sort((a, b) => a.startTime - b.startTime);

  const uniqueNotes = [...new Set(events.map(e => e.noteNumber))].sort((a, b) => a - b);
  return { events, uniqueNotes, tempo: midiData.header.tempos.length > 0 ? Math.round(midiData.header.tempos[0].bpm) : 120 };
}

describe('MIDI diagnostic', () => {
  let midi: ReturnType<typeof loadTestMidi>;
  let layout: Layout;
  let performance: Performance;

  beforeAll(() => {
    midi = loadTestMidi();
    performance = { events: midi.events, tempo: midi.tempo, name: 'TEST MIDI 1' };

    const existingVoices = new Map<number, Voice>();
    midi.uniqueNotes.forEach((n, i) => {
      existingVoices.set(n, {
        id: `stream-${n}`, name: `Note ${n}`, sourceType: 'midi_track',
        sourceFile: '', originalMidiNote: n, color: '#444',
      });
    });

    const pose0 = createDefaultPose0();
    layout = seedLayoutFromPose0(performance, pose0, 0, existingVoices);
  });

  it('diagnose event grouping and zone validity', () => {
    // Build mapping indices
    const noteIndex = buildNoteToPadIndex(layout.padToVoice);
    const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);

    // Group events by timestamp
    const EPSILON = 0.001;
    const groups: Array<{ time: number; events: PerformanceEvent[]; pads: Array<{ row: number; col: number }> }> = [];

    for (const event of midi.events) {
      const resolution = resolveEventToPad(event, voiceIdIndex, noteIndex, DEFAULT_TEST_INSTRUMENT_CONFIG, 'strict');
      const pad = resolution.source === 'mapping' ? resolution.pad : null;

      const existing = groups.find(g => Math.abs(g.time - event.startTime) < EPSILON);
      if (existing) {
        existing.events.push(event);
        if (pad) existing.pads.push(pad);
      } else {
        groups.push({ time: event.startTime, events: [event], pads: pad ? [pad] : [] });
      }
    }

    groups.sort((a, b) => a.time - b.time);

    console.log('\n  === Event Groups ===');
    for (const g of groups) {
      const noteNames = g.events.map(e => `note${e.noteNumber}`).join('+');
      const padPositions = g.pads.map(p => `(${p.row},${p.col})`).join('+');

      // Check zone validity for each hand
      const leftValid = g.pads.length > 0 && allPadsInZone(g.pads, 'left');
      const rightValid = g.pads.length > 0 && allPadsInZone(g.pads, 'right');
      const needsSplit = g.pads.length > 0 && !leftValid && !rightValid;

      console.log(`  t=${g.time.toFixed(3)} | ${noteNames.padEnd(30)} | pads=${padPositions.padEnd(30)} | L=${leftValid ? 'ok' : 'no'} R=${rightValid ? 'ok' : 'no'}${needsSplit ? ' SPLIT' : ''}`);
    }

    // Count how many groups need split-chord handling
    const splitGroups = groups.filter(g => {
      const leftValid = g.pads.length > 0 && allPadsInZone(g.pads, 'left');
      const rightValid = g.pads.length > 0 && allPadsInZone(g.pads, 'right');
      return g.pads.length > 0 && !leftValid && !rightValid;
    });

    console.log(`\n  ${groups.length} total groups, ${splitGroups.length} need split-chord`);
    console.log(`  Max simultaneous pads: ${Math.max(...groups.map(g => g.pads.length))}`);

    // Check which pads are in which zones
    console.log('\n  === Pad Zone Analysis ===');
    for (const [key, voice] of Object.entries(layout.padToVoice)) {
      const [row, col] = key.split(',').map(Number);
      const leftOk = isZoneValid({ row, col }, 'left');
      const rightOk = isZoneValid({ row, col }, 'right');
      console.log(`  Pad (${row},${col}) → ${voice.name} | L=${leftOk ? 'ok' : 'no'} R=${rightOk ? 'ok' : 'no'}`);
    }
  });

  it('diagnose solver step-by-step', async () => {
    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
    };
    const solver = createBeamSolver(solverConfig);
    const result = await solver.solve(performance, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    // Analyze which events are unplayable
    console.log('\n  === Unplayable Events ===');
    for (const fa of result.fingerAssignments) {
      if (fa.assignedHand === 'Unplayable') {
        console.log(`  Event #${fa.eventIndex} note=${fa.noteNumber} t=${fa.startTime.toFixed(3)} key=${fa.eventKey}`);
      }
    }

    // Analyze playable events to see ownership pattern
    console.log('\n  === Playable Events (with finger assignments) ===');
    for (const fa of result.fingerAssignments) {
      if (fa.assignedHand !== 'Unplayable') {
        console.log(`  Event #${fa.eventIndex} note=${fa.noteNumber} t=${fa.startTime.toFixed(3)} → ${fa.assignedHand} ${fa.finger} at (${fa.row},${fa.col})`);
      }
    }

    const usage = countHandUsage(result);
    console.log(`\n  Summary: ${usage.left}L + ${usage.right}R + ${usage.unplayable}U = ${usage.left + usage.right + usage.unplayable} total`);

    // Just report, don't assert (this is diagnostic)
    expect(true).toBe(true);
  });
});
