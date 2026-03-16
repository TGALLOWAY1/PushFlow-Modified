/**
 * Lanes Reducer Tests.
 *
 * Unit tests for all performance lane and lane group actions.
 */

import { describe, it, expect } from 'vitest';
import { lanesReducer } from '../../../src/ui/state/lanesReducer';
import { createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';
import { type PerformanceLane, type LaneGroup, type SourceFile } from '../../../src/types/performanceLane';

// ============================================================================
// Helpers
// ============================================================================

function makeLane(overrides: Partial<PerformanceLane> = {}): PerformanceLane {
  return {
    id: 'lane-1',
    name: 'Kick',
    sourceFileId: 'src-1',
    sourceFileName: 'drums.mid',
    groupId: null,
    orderIndex: 0,
    color: '#ef4444',
    colorMode: 'inherited',
    events: [
      { eventId: 'e1', laneId: 'lane-1', startTime: 0, duration: 0.1, velocity: 100, rawPitch: 36 },
      { eventId: 'e2', laneId: 'lane-1', startTime: 0.5, duration: 0.1, velocity: 80, rawPitch: 36 },
    ],
    isHidden: false,
    isMuted: false,
    isSolo: false,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<LaneGroup> = {}): LaneGroup {
  return {
    groupId: 'grp-1',
    name: 'Drums',
    color: '#f59e0b',
    orderIndex: 0,
    isCollapsed: false,
    ...overrides,
  };
}

function makeSourceFile(overrides: Partial<SourceFile> = {}): SourceFile {
  return {
    id: 'src-1',
    fileName: 'drums.mid',
    importedAt: '2026-01-01T00:00:00.000Z',
    laneCount: 1,
    ...overrides,
  };
}

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    ...createEmptyProjectState(),
    id: 'test-project',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('lanesReducer', () => {

  // ---- IMPORT_LANES ----

  describe('IMPORT_LANES', () => {
    it('adds lanes, source file, and optional group', () => {
      const state = makeState();
      const lane = makeLane();
      const sourceFile = makeSourceFile();
      const group = makeGroup();

      const result = lanesReducer(state, {
        type: 'IMPORT_LANES',
        payload: { lanes: [lane], sourceFile, group },
      });

      expect(result.performanceLanes).toHaveLength(1);
      expect(result.performanceLanes[0].id).toBe('lane-1');
      expect(result.sourceFiles).toHaveLength(1);
      expect(result.sourceFiles[0].fileName).toBe('drums.mid');
      expect(result.laneGroups).toHaveLength(1);
      expect(result.laneGroups[0].name).toBe('Drums');
    });

    it('appends to existing lanes', () => {
      const existingLane = makeLane({ id: 'lane-0', name: 'Existing' });
      const state = makeState({ performanceLanes: [existingLane] });
      const newLane = makeLane({ id: 'lane-1', name: 'New' });

      const result = lanesReducer(state, {
        type: 'IMPORT_LANES',
        payload: { lanes: [newLane], sourceFile: makeSourceFile() },
      });

      expect(result.performanceLanes).toHaveLength(2);
      expect(result.performanceLanes[0].name).toBe('Existing');
      expect(result.performanceLanes[1].name).toBe('New');
    });
  });

  // ---- RENAME_LANE ----

  describe('RENAME_LANE', () => {
    it('renames the target lane', () => {
      const state = makeState({ performanceLanes: [makeLane()] });
      const result = lanesReducer(state, {
        type: 'RENAME_LANE',
        payload: { laneId: 'lane-1', name: 'Bass Drum' },
      });
      expect(result.performanceLanes[0].name).toBe('Bass Drum');
    });

    it('does not affect other lanes', () => {
      const state = makeState({
        performanceLanes: [
          makeLane({ id: 'lane-1', name: 'Kick' }),
          makeLane({ id: 'lane-2', name: 'Snare' }),
        ],
      });
      const result = lanesReducer(state, {
        type: 'RENAME_LANE',
        payload: { laneId: 'lane-1', name: 'Bass Drum' },
      });
      expect(result.performanceLanes[1].name).toBe('Snare');
    });
  });

  // ---- SET_LANE_COLOR ----

  describe('SET_LANE_COLOR', () => {
    it('sets color and color mode', () => {
      const state = makeState({ performanceLanes: [makeLane()] });
      const result = lanesReducer(state, {
        type: 'SET_LANE_COLOR',
        payload: { laneId: 'lane-1', color: '#3b82f6', colorMode: 'overridden' },
      });
      expect(result.performanceLanes[0].color).toBe('#3b82f6');
      expect(result.performanceLanes[0].colorMode).toBe('overridden');
    });
  });

  // ---- TOGGLE_LANE_MUTE / SOLO / HIDDEN ----

  describe('TOGGLE_LANE_MUTE', () => {
    it('toggles muted state', () => {
      const state = makeState({ performanceLanes: [makeLane()] });
      const result = lanesReducer(state, { type: 'TOGGLE_LANE_MUTE', payload: 'lane-1' });
      expect(result.performanceLanes[0].isMuted).toBe(true);

      const result2 = lanesReducer(result, { type: 'TOGGLE_LANE_MUTE', payload: 'lane-1' });
      expect(result2.performanceLanes[0].isMuted).toBe(false);
    });
  });

  describe('TOGGLE_LANE_SOLO', () => {
    it('toggles solo state', () => {
      const state = makeState({ performanceLanes: [makeLane()] });
      const result = lanesReducer(state, { type: 'TOGGLE_LANE_SOLO', payload: 'lane-1' });
      expect(result.performanceLanes[0].isSolo).toBe(true);
    });
  });

  describe('TOGGLE_LANE_HIDDEN', () => {
    it('toggles hidden state', () => {
      const state = makeState({ performanceLanes: [makeLane()] });
      const result = lanesReducer(state, { type: 'TOGGLE_LANE_HIDDEN', payload: 'lane-1' });
      expect(result.performanceLanes[0].isHidden).toBe(true);
    });
  });

  // ---- DELETE_LANE ----

  describe('DELETE_LANE', () => {
    it('removes the lane', () => {
      const state = makeState({
        performanceLanes: [
          makeLane({ id: 'lane-1' }),
          makeLane({ id: 'lane-2', name: 'Snare' }),
        ],
      });
      const result = lanesReducer(state, { type: 'DELETE_LANE', payload: 'lane-1' });
      expect(result.performanceLanes).toHaveLength(1);
      expect(result.performanceLanes[0].id).toBe('lane-2');
    });
  });

  // ---- SET_LANE_GROUP ----

  describe('SET_LANE_GROUP', () => {
    it('assigns a lane to a group', () => {
      const group = makeGroup();
      const lane = makeLane({ color: '#ef4444', colorMode: 'inherited' });
      const state = makeState({ performanceLanes: [lane], laneGroups: [group] });

      const result = lanesReducer(state, {
        type: 'SET_LANE_GROUP',
        payload: { laneId: 'lane-1', groupId: 'grp-1' },
      });

      expect(result.performanceLanes[0].groupId).toBe('grp-1');
      // Should inherit group color
      expect(result.performanceLanes[0].color).toBe('#f59e0b');
    });

    it('preserves overridden color when assigning to group', () => {
      const group = makeGroup();
      const lane = makeLane({ color: '#ef4444', colorMode: 'overridden' });
      const state = makeState({ performanceLanes: [lane], laneGroups: [group] });

      const result = lanesReducer(state, {
        type: 'SET_LANE_GROUP',
        payload: { laneId: 'lane-1', groupId: 'grp-1' },
      });

      expect(result.performanceLanes[0].groupId).toBe('grp-1');
      expect(result.performanceLanes[0].color).toBe('#ef4444');
    });

    it('ungroups a lane', () => {
      const lane = makeLane({ groupId: 'grp-1' });
      const state = makeState({ performanceLanes: [lane] });

      const result = lanesReducer(state, {
        type: 'SET_LANE_GROUP',
        payload: { laneId: 'lane-1', groupId: null },
      });

      expect(result.performanceLanes[0].groupId).toBeNull();
    });
  });

  // ---- REORDER_LANES ----

  describe('REORDER_LANES', () => {
    it('reorders lanes by ID list', () => {
      const state = makeState({
        performanceLanes: [
          makeLane({ id: 'a', orderIndex: 0 }),
          makeLane({ id: 'b', orderIndex: 1 }),
          makeLane({ id: 'c', orderIndex: 2 }),
        ],
      });

      const result = lanesReducer(state, {
        type: 'REORDER_LANES',
        payload: { orderedIds: ['c', 'a', 'b'] },
      });

      expect(result.performanceLanes.map(l => l.id)).toEqual(['c', 'a', 'b']);
      expect(result.performanceLanes[0].orderIndex).toBe(0);
      expect(result.performanceLanes[1].orderIndex).toBe(1);
      expect(result.performanceLanes[2].orderIndex).toBe(2);
    });
  });

  // ---- GROUP OPERATIONS ----

  describe('CREATE_LANE_GROUP', () => {
    it('adds a new group', () => {
      const state = makeState();
      const group = makeGroup();
      const result = lanesReducer(state, { type: 'CREATE_LANE_GROUP', payload: group });
      expect(result.laneGroups).toHaveLength(1);
      expect(result.laneGroups[0].name).toBe('Drums');
    });
  });

  describe('RENAME_LANE_GROUP', () => {
    it('renames the group', () => {
      const state = makeState({ laneGroups: [makeGroup()] });
      const result = lanesReducer(state, {
        type: 'RENAME_LANE_GROUP',
        payload: { groupId: 'grp-1', name: 'Percussion' },
      });
      expect(result.laneGroups[0].name).toBe('Percussion');
    });
  });

  describe('SET_LANE_GROUP_COLOR', () => {
    it('sets group color and cascades to inherited lanes', () => {
      const state = makeState({
        laneGroups: [makeGroup()],
        performanceLanes: [
          makeLane({ id: 'lane-1', groupId: 'grp-1', colorMode: 'inherited', color: '#old' }),
          makeLane({ id: 'lane-2', groupId: 'grp-1', colorMode: 'overridden', color: '#keep' }),
          makeLane({ id: 'lane-3', groupId: null, colorMode: 'inherited', color: '#unrelated' }),
        ],
      });

      const result = lanesReducer(state, {
        type: 'SET_LANE_GROUP_COLOR',
        payload: { groupId: 'grp-1', color: '#new-color' },
      });

      expect(result.laneGroups[0].color).toBe('#new-color');
      expect(result.performanceLanes[0].color).toBe('#new-color'); // inherited, in group
      expect(result.performanceLanes[1].color).toBe('#keep');       // overridden, in group
      expect(result.performanceLanes[2].color).toBe('#unrelated');   // not in group
    });
  });

  describe('TOGGLE_LANE_GROUP_COLLAPSE', () => {
    it('toggles collapsed state', () => {
      const state = makeState({ laneGroups: [makeGroup()] });
      const result = lanesReducer(state, { type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: 'grp-1' });
      expect(result.laneGroups[0].isCollapsed).toBe(true);

      const result2 = lanesReducer(result, { type: 'TOGGLE_LANE_GROUP_COLLAPSE', payload: 'grp-1' });
      expect(result2.laneGroups[0].isCollapsed).toBe(false);
    });
  });

  describe('DELETE_LANE_GROUP', () => {
    it('removes group and ungroups child lanes', () => {
      const state = makeState({
        laneGroups: [makeGroup()],
        performanceLanes: [
          makeLane({ id: 'lane-1', groupId: 'grp-1' }),
          makeLane({ id: 'lane-2', groupId: 'grp-1' }),
          makeLane({ id: 'lane-3', groupId: null }),
        ],
      });

      const result = lanesReducer(state, { type: 'DELETE_LANE_GROUP', payload: 'grp-1' });

      expect(result.laneGroups).toHaveLength(0);
      expect(result.performanceLanes).toHaveLength(3); // lanes not deleted
      expect(result.performanceLanes[0].groupId).toBeNull();
      expect(result.performanceLanes[1].groupId).toBeNull();
      expect(result.performanceLanes[2].groupId).toBeNull();
    });
  });

  describe('REORDER_LANE_GROUPS', () => {
    it('reorders groups by ID list', () => {
      const state = makeState({
        laneGroups: [
          makeGroup({ groupId: 'a', orderIndex: 0 }),
          makeGroup({ groupId: 'b', orderIndex: 1 }),
        ],
      });

      const result = lanesReducer(state, {
        type: 'REORDER_LANE_GROUPS',
        payload: { orderedGroupIds: ['b', 'a'] },
      });

      expect(result.laneGroups[0].groupId).toBe('b');
      expect(result.laneGroups[0].orderIndex).toBe(0);
      expect(result.laneGroups[1].groupId).toBe('a');
      expect(result.laneGroups[1].orderIndex).toBe(1);
    });
  });

  // ---- SYNC_STREAMS_FROM_LANES ----

  describe('SYNC_STREAMS_FROM_LANES', () => {
    it('is a no-op when no lanes exist', () => {
      const state = makeState({ soundStreams: [{ id: 'existing', name: 'X', color: '#fff', originalMidiNote: 36, events: [], muted: false }] });
      const result = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });
      expect(result.soundStreams).toEqual(state.soundStreams); // unchanged
    });

    it('builds sound streams from active lanes', () => {
      const state = makeState({
        performanceLanes: [
          makeLane({ id: 'lane-1', name: 'Kick', color: '#ef4444' }),
          makeLane({ id: 'lane-2', name: 'Snare', color: '#3b82f6', isMuted: true }),
        ],
      });

      const result = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });

      expect(result.soundStreams).toHaveLength(1); // muted lane excluded
      expect(result.soundStreams[0].id).toBe('lane-1');
      expect(result.soundStreams[0].name).toBe('Kick');
      expect(result.soundStreams[0].events).toHaveLength(2);
      expect(result.analysisStale).toBe(true);
    });

    it('respects solo mode', () => {
      const state = makeState({
        performanceLanes: [
          makeLane({ id: 'lane-1', name: 'Kick', isSolo: true }),
          makeLane({ id: 'lane-2', name: 'Snare', isSolo: false }),
          makeLane({ id: 'lane-3', name: 'Hat', isSolo: true }),
        ],
      });

      const result = lanesReducer(state, { type: 'SYNC_STREAMS_FROM_LANES' });

      expect(result.soundStreams).toHaveLength(2);
      expect(result.soundStreams.map(s => s.id)).toEqual(['lane-1', 'lane-3']);
    });
  });
});
