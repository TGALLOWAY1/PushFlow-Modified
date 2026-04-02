/**
 * MIDI Import Integration Tests.
 *
 * Validates that importing MIDI with low note numbers into a project
 * with default instrumentConfig produces a working layout and analysis
 * (regression test for the "all notes unplayable" bug).
 */

import { describe, it, expect } from 'vitest';
import { createEmptyProjectState, projectReducer } from '../../../src/ui/state/projectState';
import { lanesReducer } from '../../../src/ui/state/lanesReducer';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { type PerformanceLane, type SourceFile, type LaneGroup } from '../../../src/types/performanceLane';
import { type Performance } from '../../../src/types/performance';
import { DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

// ============================================================================
// Helpers — simulate the MIDI import flow for notes 0-14
// ============================================================================

/** Create lanes mimicking a MIDI file with very low note numbers (0, 1, 4, 5, 12, 13, 14). */
function makeLowNoteLanes(): { lanes: PerformanceLane[]; sourceFile: SourceFile; group: LaneGroup } {
  const notes = [0, 1, 4, 5, 12, 13, 14];
  const lanes: PerformanceLane[] = notes.map((note, i) => ({
    id: `lane-${i}`,
    name: `Sound ${i}`,
    sourceFileId: 'src-test',
    sourceFileName: 'TEST MIDI 1.mid',
    groupId: 'grp-test',
    orderIndex: i,
    color: '#ef4444',
    colorMode: 'inherited' as const,
    events: [
      { eventId: `e-${i}-0`, laneId: `lane-${i}`, startTime: 0 + i * 0.5, duration: 0.1, velocity: 100, rawPitch: note },
      { eventId: `e-${i}-1`, laneId: `lane-${i}`, startTime: 2 + i * 0.5, duration: 0.1, velocity: 80, rawPitch: note },
    ],
    isHidden: false,
    isMuted: false,
    isSolo: false,
  }));

  const sourceFile: SourceFile = {
    id: 'src-test',
    fileName: 'TEST MIDI 1.mid',
    importedAt: new Date().toISOString(),
    laneCount: lanes.length,
  };

  const group: LaneGroup = {
    groupId: 'grp-test',
    name: 'Test Midi 1',
    color: '#f59e0b',
    orderIndex: 0,
    isCollapsed: false,
  };

  return { lanes, sourceFile, group };
}

// ============================================================================
// Tests
// ============================================================================

describe('MIDI Import Integration — low note numbers', () => {
  it('default instrumentConfig.bottomLeftNote is 36', () => {
    const state = createEmptyProjectState();
    expect(state.instrumentConfig.bottomLeftNote).toBe(36);
  });

  it('SET_INSTRUMENT_CONFIG updates bottomLeftNote', () => {
    const state = createEmptyProjectState();
    const updated = projectReducer(state, {
      type: 'SET_INSTRUMENT_CONFIG',
      payload: { bottomLeftNote: 0 },
    });
    expect(updated.instrumentConfig.bottomLeftNote).toBe(0);
    expect(updated.analysisStale).toBe(true);
  });

  it('SET_INSTRUMENT_CONFIG preserves other config fields', () => {
    const state = createEmptyProjectState();
    const updated = projectReducer(state, {
      type: 'SET_INSTRUMENT_CONFIG',
      payload: { bottomLeftNote: 5 },
    });
    expect(updated.instrumentConfig.rows).toBe(8);
    expect(updated.instrumentConfig.cols).toBe(8);
    expect(updated.instrumentConfig.name).toBe('Push 3');
    expect(updated.instrumentConfig.bottomLeftNote).toBe(5);
  });

  it('SYNC_STREAMS_FROM_LANES creates streams with correct originalMidiNote', () => {
    let state = createEmptyProjectState();
    const { lanes, sourceFile, group } = makeLowNoteLanes();

    // Import lanes
    state = lanesReducer(state, { type: 'IMPORT_LANES', payload: { lanes, sourceFile, group } });
    expect(state.performanceLanes.length).toBe(7);

    // Sync to streams
    state = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });
    expect(state.soundStreams.length).toBe(7);

    const midiNotes = state.soundStreams.map(s => s.originalMidiNote).sort((a, b) => a - b);
    expect(midiNotes).toEqual([0, 1, 4, 5, 12, 13, 14]);
  });

  it('BUG REPRO: with default bottomLeftNote=36, notes 0-14 produce all-unmapped solver result', () => {
    let state = createEmptyProjectState();
    const { lanes, sourceFile, group } = makeLowNoteLanes();

    // Import and sync
    state = lanesReducer(state, { type: 'IMPORT_LANES', payload: { lanes, sourceFile, group } });
    state = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });

    // Build auto layout with WRONG bottomLeftNote (the bug)
    const streams = state.soundStreams.filter(s => !s.muted);
    const padToVoice: Record<string, any> = {};
    for (const stream of streams) {
      const offset = stream.originalMidiNote - 36; // default bottomLeftNote
      if (offset < 0) continue; // All notes 0-14 are below 36!
      const row = Math.floor(offset / 8);
      const col = offset % 8;
      padToVoice[`${row},${col}`] = {
        id: stream.id,
        name: stream.name,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: stream.originalMidiNote,
        color: stream.color,
      };
    }

    // With bottomLeftNote=36, all notes 0-14 have negative offset — nothing mapped
    expect(Object.keys(padToVoice).length).toBe(0);
  });

  it('FIX: with corrected bottomLeftNote=0, notes 0-14 map correctly to the grid', () => {
    let state = createEmptyProjectState();
    const { lanes, sourceFile, group } = makeLowNoteLanes();

    // Import and sync
    state = lanesReducer(state, { type: 'IMPORT_LANES', payload: { lanes, sourceFile, group } });
    state = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });

    // Apply the fix: update bottomLeftNote to match the MIDI range
    state = projectReducer(state, {
      type: 'SET_INSTRUMENT_CONFIG',
      payload: { bottomLeftNote: 0 },
    });

    // Build auto layout with CORRECT bottomLeftNote
    const streams = state.soundStreams.filter(s => !s.muted);
    const padToVoice: Record<string, any> = {};
    for (const stream of streams) {
      const offset = stream.originalMidiNote - state.instrumentConfig.bottomLeftNote;
      if (offset < 0) continue;
      const row = Math.floor(offset / 8);
      const col = offset % 8;
      if (row >= 8) continue;
      padToVoice[`${row},${col}`] = {
        id: stream.id,
        name: stream.name,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: stream.originalMidiNote,
        color: stream.color,
      };
    }

    // All 7 notes should now map to grid positions
    expect(Object.keys(padToVoice).length).toBe(7);

    // Verify specific grid positions
    expect(padToVoice['0,0']).toBeDefined(); // note 0 → row 0, col 0
    expect(padToVoice['0,1']).toBeDefined(); // note 1 → row 0, col 1
    expect(padToVoice['0,4']).toBeDefined(); // note 4 → row 0, col 4
    expect(padToVoice['0,5']).toBeDefined(); // note 5 → row 0, col 5
    expect(padToVoice['1,4']).toBeDefined(); // note 12 → row 1, col 4
    expect(padToVoice['1,5']).toBeDefined(); // note 13 → row 1, col 5
    expect(padToVoice['1,6']).toBeDefined(); // note 14 → row 1, col 6
  });

  it('FIX: solver produces non-unplayable results with corrected config', () => {
    let state = createEmptyProjectState();
    const { lanes, sourceFile, group } = makeLowNoteLanes();

    // Import, sync, fix config
    state = lanesReducer(state, { type: 'IMPORT_LANES', payload: { lanes, sourceFile, group } });
    state = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });
    state = projectReducer(state, {
      type: 'SET_INSTRUMENT_CONFIG',
      payload: { bottomLeftNote: 0 },
    });

    // Build auto layout
    const streams = state.soundStreams.filter(s => !s.muted);
    const padToVoice: Record<string, any> = {};
    for (const stream of streams) {
      const offset = stream.originalMidiNote - state.instrumentConfig.bottomLeftNote;
      if (offset < 0) continue;
      const row = Math.floor(offset / 8);
      const col = offset % 8;
      if (row >= 8) continue;
      padToVoice[`${row},${col}`] = {
        id: stream.id,
        name: stream.name,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: stream.originalMidiNote,
        color: stream.color,
      };
    }

    // Apply layout to state
    state = projectReducer(state, { type: 'BULK_ASSIGN_PADS', payload: padToVoice });
    const layout = state.workingLayout!;
    expect(Object.keys(layout.padToVoice).length).toBe(7);

    // Build performance from streams
    const performance: Performance = {
      events: streams.flatMap(stream =>
        stream.events.map(e => ({
          noteNumber: stream.originalMidiNote,
          voiceId: stream.id,
          startTime: e.startTime,
          duration: e.duration,
          velocity: e.velocity,
          eventKey: e.eventKey,
          channel: 1,
        }))
      ),
      tempo: 120,
      name: 'test',
    };

    // Run solver
    const solver = createBeamSolver({
      instrumentConfig: state.instrumentConfig,
      layout,
    });
    const result = solver.solveSync(performance, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    // The key assertion: NOT all unplayable (the bug was 14/14 unplayable)
    expect(result.fingerAssignments.length).toBe(14); // 7 sounds × 2 events each

    // The majority of events should be playable — the bug was 100% unplayable
    const playable = result.fingerAssignments.filter(a => a.assignedHand !== 'Unplayable');
    expect(playable.length).toBeGreaterThanOrEqual(10); // At least ~70% playable

    // Some events might legitimately be hard to play (e.g. wide simultaneous spans)
    // but the critical fix is that most events now get real hand assignments
    expect(result.unplayableCount).toBeLessThan(result.fingerAssignments.length);
  });
});
