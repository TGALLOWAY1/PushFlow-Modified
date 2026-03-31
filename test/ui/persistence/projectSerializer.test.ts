/**
 * Tests for project serialization/deserialization.
 *
 * Verifies that:
 * - Durable project fields survive round-trip (serialize → deserialize)
 * - Costs and analysis are NOT persisted
 * - Ephemeral UI state is reset on deserialize
 * - Legacy localStorage format migrates correctly
 */

import { describe, it, expect } from 'vitest';
import { createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';
import { serializeProject, deserializeProject, validateAndMigrateRaw } from '../../../src/ui/persistence/projectSerializer';
import { PERSISTED_SCHEMA_VERSION } from '../../../src/ui/persistence/persistedProject';
import { createEmptyLayout } from '../../../src/types/layout';

function makeTestProject(): ProjectState {
  const base = createEmptyProjectState();
  return {
    ...base,
    id: 'test-project-1',
    name: 'Test Project',
    tempo: 140,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-15T12:00:00.000Z',
    soundStreams: [
      {
        id: 'stream-1',
        name: 'Kick',
        color: '#ff0000',
        originalMidiNote: 36,
        events: [
          { startTime: 0, duration: 0.1, velocity: 100, eventKey: 'e1', voiceId: 'stream-1' },
          { startTime: 0.5, duration: 0.1, velocity: 80, eventKey: 'e2', voiceId: 'stream-1' },
        ],
        muted: false,
      },
      {
        id: 'stream-2',
        name: 'Snare',
        color: '#00ff00',
        originalMidiNote: 38,
        events: [
          { startTime: 0.25, duration: 0.1, velocity: 90, eventKey: 'e3', voiceId: 'stream-2' },
        ],
        muted: false,
      },
    ],
    activeLayout: {
      ...createEmptyLayout('layout-1', 'Main Layout', 'active'),
      padToVoice: {
        '0,0': { id: 'stream-1', name: 'Kick', sourceType: 'midi_track', sourceFile: '', originalMidiNote: 36, color: '#ff0000' },
        '1,0': { id: 'stream-2', name: 'Snare', sourceType: 'midi_track', sourceFile: '', originalMidiNote: 38, color: '#00ff00' },
      },
      fingerConstraints: { '0,0': 'L-Thumb' },
      placementLocks: { 'stream-1': '0,0' },
    },
    voiceConstraints: {
      'stream-1': { hand: 'left' },
    },
    // Add some analysis results that should NOT persist
    analysisResult: {
      id: 'analysis-1',
      layout: createEmptyLayout('a', 'a', 'active'),
      executionPlan: {
        score: 42.5,
        fingerAssignments: [],
        unplayableCount: 0,
        hardCount: 0,
      },
      difficultyAnalysis: {
        overallScore: 0.3,
        sectionScores: [],
        passageDetails: [],
      },
      tradeoffProfile: {
        playability: 0.8,
        compactness: 0.7,
        handBalance: 0.6,
        transitionEfficiency: 0.5,
        structuralCoherence: 0.5,
      },
      metadata: {
        generationMethod: 'beam',
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    },
    candidates: [
      {
        id: 'candidate-1',
        layout: createEmptyLayout('c', 'c', 'active'),
        executionPlan: { score: 30, fingerAssignments: [], unplayableCount: 0, hardCount: 0 },
        difficultyAnalysis: { overallScore: 0.2, sectionScores: [], passageDetails: [] },
        tradeoffProfile: { playability: 0.9, compactness: 0.8, handBalance: 0.7, transitionEfficiency: 0.6, structuralCoherence: 0.5 },
        metadata: { generationMethod: 'beam', timestamp: '2025-01-01T00:00:00.000Z' },
      },
    ],
    selectedCandidateId: 'candidate-1',
    // Ephemeral state
    selectedEventIndex: 5,
    selectedMomentIndex: 3,
    isProcessing: true,
    error: 'some error',
  };
}

describe('serializeProject', () => {
  it('extracts durable fields from project state', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);

    expect(persisted.id).toBe('test-project-1');
    expect(persisted.name).toBe('Test Project');
    expect(persisted.bpm).toBe(140);
    expect(persisted.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
    expect(persisted.activeLayout.id).toBe('layout-1');
    expect(persisted.soundStreams).toHaveLength(2);
    expect(persisted.voiceConstraints['stream-1']).toEqual({ hand: 'left' });
  });

  it('does NOT include costs or analysis in the persisted shape', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const serialized = JSON.stringify(persisted);

    // The persisted shape should not contain analysis/cost fields
    expect(serialized).not.toContain('"analysisResult"');
    expect(serialized).not.toContain('"candidates"');
    expect(serialized).not.toContain('"selectedCandidateId"');
    expect(serialized).not.toContain('"manualCostResult"');
    expect(serialized).not.toContain('"isProcessing"');
    expect(serialized).not.toContain('"selectedEventIndex"');
  });

  it('does NOT include ephemeral UI state', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const keys = Object.keys(persisted);

    expect(keys).not.toContain('workingLayout');
    expect(keys).not.toContain('selectedEventIndex');
    expect(keys).not.toContain('selectedMomentIndex');
    expect(keys).not.toContain('isProcessing');
    expect(keys).not.toContain('error');
    expect(keys).not.toContain('compareCandidateId');
    expect(keys).not.toContain('currentTime');
    expect(keys).not.toContain('isPlaying');
  });
});

describe('deserializeProject', () => {
  it('restores durable fields from persisted data', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const restored = deserializeProject(persisted);

    expect(restored.id).toBe('test-project-1');
    expect(restored.name).toBe('Test Project');
    expect(restored.tempo).toBe(140);
    expect(restored.activeLayout.id).toBe('layout-1');
    expect(restored.activeLayout.padToVoice['0,0'].name).toBe('Kick');
    expect(restored.activeLayout.fingerConstraints['0,0']).toBe('L-Thumb');
    expect(restored.activeLayout.placementLocks['stream-1']).toBe('0,0');
    expect(restored.soundStreams).toHaveLength(2);
    expect(restored.soundStreams[0].events).toHaveLength(2);
    expect(restored.voiceConstraints['stream-1']).toEqual({ hand: 'left' });
  });

  it('resets analysis/cost state to null/empty', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const restored = deserializeProject(persisted);

    expect(restored.analysisResult).toBeNull();
    expect(restored.candidates).toEqual([]);
    expect(restored.selectedCandidateId).toBeNull();
    expect(restored.manualCostResult).toBeNull();
  });

  it('resets ephemeral UI state', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const restored = deserializeProject(persisted);

    expect(restored.workingLayout).toBeNull();
    expect(restored.selectedEventIndex).toBeNull();
    expect(restored.selectedMomentIndex).toBeNull();
    expect(restored.isProcessing).toBe(false);
    expect(restored.error).toBeNull();
    expect(restored.analysisStale).toBe(true);
    expect(restored.currentTime).toBe(0);
    expect(restored.isPlaying).toBe(false);
  });

  it('round-trips sound stream data correctly', () => {
    const state = makeTestProject();
    const persisted = serializeProject(state);
    const restored = deserializeProject(persisted);

    const kick = restored.soundStreams.find(s => s.name === 'Kick');
    expect(kick).toBeDefined();
    expect(kick!.id).toBe('stream-1');
    expect(kick!.color).toBe('#ff0000');
    expect(kick!.originalMidiNote).toBe(36);
    expect(kick!.events[0].startTime).toBe(0);
    expect(kick!.events[0].velocity).toBe(100);
  });
});

describe('validateAndMigrateRaw', () => {
  it('rejects non-objects', () => {
    expect(() => validateAndMigrateRaw(null)).toThrow('root must be an object');
    expect(() => validateAndMigrateRaw('string')).toThrow('root must be an object');
  });

  it('rejects objects without id', () => {
    expect(() => validateAndMigrateRaw({ name: 'test' })).toThrow('missing id');
  });

  it('migrates legacy V1 format (layouts[] + activeLayoutId)', () => {
    const v1Data = {
      id: 'v1-project',
      name: 'V1 Project',
      version: 1,
      tempo: 130,
      layouts: [
        { id: 'layout-a', name: 'Layout A', padToVoice: {}, fingerConstraints: {} },
        { id: 'layout-b', name: 'Layout B', padToVoice: {}, fingerConstraints: {} },
      ],
      activeLayoutId: 'layout-a',
      soundStreams: [],
    };

    const persisted = validateAndMigrateRaw(v1Data);
    expect(persisted.id).toBe('v1-project');
    expect(persisted.bpm).toBe(130);
    expect(persisted.activeLayout.id).toBe('layout-a');
    expect(persisted.activeLayout.role).toBe('active');
    expect(persisted.savedVariants).toHaveLength(1);
    expect(persisted.savedVariants[0].id).toBe('layout-b');
    expect(persisted.savedVariants[0].role).toBe('variant');
    expect(persisted.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
  });

  it('migrates legacy V2 format (activeLayout + savedVariants)', () => {
    const v2Data = {
      id: 'v2-project',
      name: 'V2 Project',
      version: 2,
      tempo: 120,
      activeLayout: {
        id: 'active-layout',
        name: 'Active',
        padToVoice: {},
        fingerConstraints: {},
      },
      savedVariants: [],
      soundStreams: [],
    };

    const persisted = validateAndMigrateRaw(v2Data);
    expect(persisted.id).toBe('v2-project');
    expect(persisted.bpm).toBe(120);
    expect(persisted.activeLayout.role).toBe('active');
    expect(persisted.activeLayout.placementLocks).toEqual({});
    expect(persisted.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
  });

  it('handles new schemaVersion format directly', () => {
    const newData = {
      id: 'new-project',
      name: 'New Project',
      bpm: 150,
      schemaVersion: 1,
      activeLayout: {
        id: 'al',
        name: 'Active',
        padToVoice: {},
        fingerConstraints: {},
        placementLocks: {},
        role: 'active' as const,
      },
      savedVariants: [],
      soundStreams: [],
    };

    const persisted = validateAndMigrateRaw(newData);
    expect(persisted.id).toBe('new-project');
    expect(persisted.bpm).toBe(150);
    expect(persisted.schemaVersion).toBe(PERSISTED_SCHEMA_VERSION);
  });

  it('applies defaults for missing fields', () => {
    const minimal = {
      id: 'minimal',
      schemaVersion: 1,
    };

    const persisted = validateAndMigrateRaw(minimal);
    expect(persisted.name).toBe('Unnamed Project');
    expect(persisted.bpm).toBe(120);
    expect(persisted.soundStreams).toEqual([]);
    expect(persisted.savedVariants).toEqual([]);
    expect(persisted.voiceConstraints).toEqual({});
  });
});
