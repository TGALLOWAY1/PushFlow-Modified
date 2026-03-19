/**
 * Integration test: TEST MIDI 1.mid end-to-end through the engine pipeline.
 *
 * Simulates the exact user flow:
 * 1. Parse the MIDI file (like useLaneImport does)
 * 2. Build sound streams from lanes (like SYNC_STREAMS_FROM_LANES does)
 * 3. Build auto-layout from natural hand pose (like useAutoAnalysis does)
 * 4. Run the beam solver and generate candidates
 * 5. Assert that candidates have playable events (not all unplayable)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Midi } from '@tonejs/midi';
import { type Performance } from '../../../src/types/performance';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type Voice } from '../../../src/types/voice';
import { seedLayoutFromPose0 } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0, getPose0PadsWithOffset, fingerIdToHandAndFingerType } from '../../../src/engine/prior/naturalHandPose';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { type SolverConfig } from '../../../src/types/engineConfig';
import {
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  countHandUsage,
} from '../../helpers/testHelpers';

// ============================================================================
// Load and parse TEST MIDI 1.mid
// ============================================================================

interface ParsedMidiData {
  events: PerformanceEvent[];
  tempo: number;
  uniqueNotes: number[];
}

function loadTestMidi(): ParsedMidiData {
  // Navigate from test/engine/optimization/ to the archived V1 test data
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
      const eventKey = `${hashKey}:${ordinal}`;

      events.push({
        noteNumber,
        startTime: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
        channel: channelLabel,
        eventKey,
      });
    });
  });

  events.sort((a, b) => a.startTime - b.startTime);

  const tempo = midiData.header.tempos.length > 0
    ? Math.round(midiData.header.tempos[0].bpm)
    : 120;

  const uniqueNotes = [...new Set(events.map(e => e.noteNumber))].sort((a, b) => a - b);

  return { events, tempo, uniqueNotes };
}

// ============================================================================
// Tests
// ============================================================================

describe('TEST MIDI 1.mid end-to-end', () => {
  let midiData: ParsedMidiData;

  beforeAll(() => {
    midiData = loadTestMidi();
  });

  it('should parse the MIDI file successfully', () => {
    expect(midiData.events.length).toBeGreaterThan(0);
    expect(midiData.uniqueNotes.length).toBeGreaterThan(0);
    console.log(`  Parsed: ${midiData.events.length} events, ${midiData.uniqueNotes.length} unique notes (${midiData.uniqueNotes.join(', ')}), tempo=${midiData.tempo} BPM`);
  });

  it('should seed a layout from natural hand pose with all voices placed', () => {
    const performance: Performance = {
      events: midiData.events,
      tempo: midiData.tempo,
      name: 'TEST MIDI 1',
    };

    // Build voices with stable IDs (simulating stream IDs)
    const existingVoices = new Map<number, Voice>();
    midiData.uniqueNotes.forEach((noteNumber, i) => {
      existingVoices.set(noteNumber, {
        id: `stream-${noteNumber}`,
        name: `Note ${noteNumber}`,
        sourceType: 'midi_track',
        sourceFile: 'TEST MIDI 1.mid',
        originalMidiNote: noteNumber,
        color: `#${((i * 37 + 128) % 256).toString(16).padStart(2, '0')}4444`,
      });
    });

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(performance, pose0, 0, existingVoices);

    const placedVoices = Object.values(layout.padToVoice);
    expect(placedVoices.length).toBe(midiData.uniqueNotes.length);

    // All voice IDs should match stream IDs
    for (const voice of placedVoices) {
      expect(voice.id).toMatch(/^stream-\d+$/);
    }

    // Log pad positions
    console.log('  Pad positions:');
    for (const [key, voice] of Object.entries(layout.padToVoice)) {
      console.log(`    ${key} => ${voice.name} (id=${voice.id})`);
    }
  });

  it('should produce playable candidates via generateCandidates', async () => {
    const performance: Performance = {
      events: midiData.events,
      tempo: midiData.tempo,
      name: 'TEST MIDI 1',
    };

    const existingVoices = new Map<number, Voice>();
    midiData.uniqueNotes.forEach((noteNumber, i) => {
      existingVoices.set(noteNumber, {
        id: `stream-${noteNumber}`,
        name: `Note ${noteNumber}`,
        sourceType: 'midi_track',
        sourceFile: 'TEST MIDI 1.mid',
        originalMidiNote: noteNumber,
        color: '#444444',
      });
    });

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(performance, pose0, 0, existingVoices);

    const result = await generateCandidates(performance, pose0, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    console.log(`  Generated ${result.candidates.length} candidates`);

    for (let i = 0; i < result.candidates.length; i++) {
      const candidate = result.candidates[i];
      const usage = countHandUsage(candidate.executionPlan);
      const total = usage.left + usage.right + usage.unplayable;
      const playableRatio = (usage.left + usage.right) / total;

      console.log(`  Candidate #${i + 1} (${candidate.metadata.strategy}): L=${usage.left} R=${usage.right} Unplayable=${usage.unplayable} (${(playableRatio * 100).toFixed(0)}% playable)`);

      // Log rejection reasons if any
      if (candidate.executionPlan.rejectionReasons) {
        const counts: Record<string, number> = {};
        for (const reasons of Object.values(candidate.executionPlan.rejectionReasons)) {
          for (const r of reasons) counts[r] = (counts[r] || 0) + 1;
        }
        console.log(`    Rejection reasons: ${JSON.stringify(counts)}`);
      }

      // THIS IS THE KEY ASSERTION: candidates must have playable events
      expect(playableRatio).toBeGreaterThan(0.5);
    }
  });

  it('should produce playable results via direct beam solver (allow-fallback)', async () => {
    const performance: Performance = {
      events: midiData.events,
      tempo: midiData.tempo,
      name: 'TEST MIDI 1',
    };

    const existingVoices = new Map<number, Voice>();
    midiData.uniqueNotes.forEach((noteNumber) => {
      existingVoices.set(noteNumber, {
        id: `stream-${noteNumber}`,
        name: `Note ${noteNumber}`,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: noteNumber,
        color: '#444',
      });
    });

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(performance, pose0, 0, existingVoices);

    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      mappingResolverMode: 'allow-fallback',
    };
    const solver = createBeamSolver(solverConfig);
    const planResult = await solver.solve(performance, DEFAULT_ENGINE_CONFIG);

    const usage = countHandUsage(planResult);
    const total = usage.left + usage.right + usage.unplayable;
    const playableRatio = total > 0 ? (usage.left + usage.right) / total : 0;

    console.log(`  Direct solver (fallback): L=${usage.left} R=${usage.right} Unplayable=${usage.unplayable} Score=${planResult.score.toFixed(1)} (${(playableRatio * 100).toFixed(0)}% playable)`);

    // Must have >50% playable events
    expect(playableRatio).toBeGreaterThan(0.5);
  });

  it('should produce ZERO unplayable events via strict-mode solver', async () => {
    // This matches the exact auto-analysis path in useAutoAnalysis.ts
    const performance: Performance = {
      events: midiData.events,
      tempo: midiData.tempo,
      name: 'TEST MIDI 1',
    };

    const existingVoices = new Map<number, Voice>();
    midiData.uniqueNotes.forEach((noteNumber) => {
      existingVoices.set(noteNumber, {
        id: `stream-${noteNumber}`,
        name: `Note ${noteNumber}`,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: noteNumber,
        color: '#444',
      });
    });

    const pose0 = createDefaultPose0();
    const layout = seedLayoutFromPose0(performance, pose0, 0, existingVoices);

    // Strict mode with initial pad ownership — same as auto-analysis path.
    // Compute ownership from pose0 finger positions.
    const posePads = getPose0PadsWithOffset(pose0, 0, true);
    const initialPadOwnership: Record<string, { hand: 'left' | 'right'; finger: import('../../../src/types/fingerModel').FingerType }> = {};
    for (const entry of posePads) {
      const padKey = `${entry.row},${entry.col}`;
      if (layout.padToVoice[padKey]) {
        const { hand, finger } = fingerIdToHandAndFingerType(entry.fingerId);
        initialPadOwnership[padKey] = { hand, finger };
      }
    }

    const solverConfig: SolverConfig = {
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      layout,
      initialPadOwnership,
    };
    const solver = createBeamSolver(solverConfig);
    const planResult = await solver.solve(
      performance,
      { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 },
    );

    const usage = countHandUsage(planResult);
    const total = usage.left + usage.right + usage.unplayable;
    console.log(`  Direct solver (strict): L=${usage.left} R=${usage.right} Unplayable=${usage.unplayable} / ${total} total`);

    // Zero unplayable — this is the exit criterion
    expect(usage.unplayable).toBe(0);
    expect(usage.left + usage.right).toBe(total);
  });
});
