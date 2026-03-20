/**
 * ComposerPreset type tests.
 *
 * Validates bounding box computation, handedness detection,
 * mirror eligibility, normalization, and serialization round-trips.
 */

import { describe, it, expect } from 'vitest';
import {
  type PresetPad,
  type ComposerPreset,
  computeBoundingBox,
  computeHandedness,
  isMirrorEligible,
  normalizePadPositions,
  createInitialComposerWorkspaceState,
} from '../../src/types/composerPreset';

// ============================================================================
// Test Helpers
// ============================================================================

function makePad(
  rowOffset: number,
  colOffset: number,
  hand: 'left' | 'right' = 'left',
  finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' = 'index',
  laneId = 'lane-1',
): PresetPad {
  return {
    position: { rowOffset, colOffset },
    laneId,
    finger,
    hand,
  };
}

function makePreset(pads: PresetPad[]): ComposerPreset {
  const handedness = computeHandedness(pads);
  return {
    id: 'test-preset',
    name: 'Test Preset',
    createdAt: 1000,
    updatedAt: 1000,
    pads,
    config: { barCount: 4, subdivision: '1/8', bpm: 120, beatsPerBar: 4 },
    lanes: [{ id: 'lane-1', name: 'Kick', color: '#ff0000', midiNote: 36, orderIndex: 0, isMuted: false, isSolo: false }],
    events: [['lane-1:0', { laneId: 'lane-1', stepIndex: 0, velocity: 100 }]],
    handedness,
    mirrorEligible: isMirrorEligible(handedness),
    boundingBox: computeBoundingBox(pads),
    tags: [],
  };
}

// ============================================================================
// Bounding Box
// ============================================================================

describe('computeBoundingBox', () => {
  it('returns zero for empty pads', () => {
    expect(computeBoundingBox([])).toEqual({ rows: 0, cols: 0 });
  });

  it('computes 1×1 for single pad at origin', () => {
    const pads = [makePad(0, 0)];
    expect(computeBoundingBox(pads)).toEqual({ rows: 1, cols: 1 });
  });

  it('computes correct box for multi-pad preset', () => {
    const pads = [makePad(0, 0), makePad(2, 3), makePad(1, 1)];
    expect(computeBoundingBox(pads)).toEqual({ rows: 3, cols: 4 });
  });

  it('handles pads in a single row', () => {
    const pads = [makePad(0, 0), makePad(0, 5)];
    expect(computeBoundingBox(pads)).toEqual({ rows: 1, cols: 6 });
  });

  it('handles pads in a single column', () => {
    const pads = [makePad(0, 0), makePad(4, 0)];
    expect(computeBoundingBox(pads)).toEqual({ rows: 5, cols: 1 });
  });
});

// ============================================================================
// Handedness
// ============================================================================

describe('computeHandedness', () => {
  it('returns both for empty pads', () => {
    expect(computeHandedness([])).toBe('both');
  });

  it('detects left-only', () => {
    const pads = [makePad(0, 0, 'left'), makePad(1, 1, 'left')];
    expect(computeHandedness(pads)).toBe('left');
  });

  it('detects right-only', () => {
    const pads = [makePad(0, 0, 'right'), makePad(1, 1, 'right')];
    expect(computeHandedness(pads)).toBe('right');
  });

  it('detects both hands', () => {
    const pads = [makePad(0, 0, 'left'), makePad(1, 1, 'right')];
    expect(computeHandedness(pads)).toBe('both');
  });
});

// ============================================================================
// Mirror Eligibility
// ============================================================================

describe('isMirrorEligible', () => {
  it('left-hand presets are eligible', () => {
    expect(isMirrorEligible('left')).toBe(true);
  });

  it('right-hand presets are eligible', () => {
    expect(isMirrorEligible('right')).toBe(true);
  });

  it('both-hand presets are not eligible', () => {
    expect(isMirrorEligible('both')).toBe(false);
  });
});

// ============================================================================
// Normalization
// ============================================================================

describe('normalizePadPositions', () => {
  it('returns empty for empty input', () => {
    expect(normalizePadPositions([])).toEqual([]);
  });

  it('no-ops already normalized pads', () => {
    const pads = [makePad(0, 0), makePad(1, 2)];
    const normalized = normalizePadPositions(pads);
    expect(normalized).toEqual(pads);
  });

  it('shifts pads to origin', () => {
    const pads = [makePad(3, 5), makePad(5, 7)];
    const normalized = normalizePadPositions(pads);
    expect(normalized[0].position).toEqual({ rowOffset: 0, colOffset: 0 });
    expect(normalized[1].position).toEqual({ rowOffset: 2, colOffset: 2 });
  });

  it('preserves non-position fields', () => {
    const pads = [makePad(2, 3, 'right', 'pinky', 'lane-x')];
    const normalized = normalizePadPositions(pads);
    expect(normalized[0].hand).toBe('right');
    expect(normalized[0].finger).toBe('pinky');
    expect(normalized[0].laneId).toBe('lane-x');
  });
});

// ============================================================================
// Serialization Round-Trip
// ============================================================================

describe('ComposerPreset serialization', () => {
  it('survives JSON round-trip', () => {
    const preset = makePreset([
      makePad(0, 0, 'left', 'index', 'lane-1'),
      makePad(1, 2, 'left', 'middle', 'lane-1'),
    ]);

    const json = JSON.stringify(preset);
    const restored = JSON.parse(json) as ComposerPreset;

    expect(restored.id).toBe(preset.id);
    expect(restored.name).toBe(preset.name);
    expect(restored.pads).toEqual(preset.pads);
    expect(restored.config).toEqual(preset.config);
    expect(restored.lanes).toEqual(preset.lanes);
    expect(restored.events).toEqual(preset.events);
    expect(restored.handedness).toBe(preset.handedness);
    expect(restored.mirrorEligible).toBe(preset.mirrorEligible);
    expect(restored.boundingBox).toEqual(preset.boundingBox);
    expect(restored.tags).toEqual(preset.tags);
  });

  it('preserves finger assignment through round-trip', () => {
    const preset = makePreset([
      makePad(0, 0, 'right', 'thumb', 'lane-1'),
      makePad(0, 1, 'right', 'index', 'lane-1'),
      makePad(0, 2, 'right', 'middle', 'lane-1'),
    ]);

    const restored = JSON.parse(JSON.stringify(preset)) as ComposerPreset;

    expect(restored.pads[0].finger).toBe('thumb');
    expect(restored.pads[0].hand).toBe('right');
    expect(restored.pads[1].finger).toBe('index');
    expect(restored.pads[2].finger).toBe('middle');
  });

  it('preserves event data through round-trip', () => {
    const preset = makePreset([makePad(0, 0)]);

    const restored = JSON.parse(JSON.stringify(preset)) as ComposerPreset;
    expect(restored.events).toHaveLength(1);
    expect(restored.events[0][0]).toBe('lane-1:0');
    expect(restored.events[0][1].velocity).toBe(100);
  });
});

// ============================================================================
// Initial State
// ============================================================================

describe('createInitialComposerWorkspaceState', () => {
  it('creates empty state', () => {
    const state = createInitialComposerWorkspaceState();
    expect(state.placedInstances).toEqual([]);
    expect(state.selectedInstanceId).toBeNull();
  });
});
