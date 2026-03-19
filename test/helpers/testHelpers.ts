/**
 * Test Helpers.
 *
 * Shared testing utilities with canonical terminology.
 * Provides solver creation, assertion functions, and test data generators.
 */

import { type Performance, type InstrumentConfig, type RestingPose } from '../../src/types/performance';
import { type PerformanceEvent } from '../../src/types/performanceEvent';
import { type Layout } from '../../src/types/layout';
import { type EngineConfiguration } from '../../src/types/engineConfig';
import { type SolverConfig } from '../../src/types/engineConfig';
import { type ExecutionPlanResult, type FingerAssignment } from '../../src/types/executionPlan';
import { createBeamSolver } from '../../src/engine/solvers/beamSolver';
import { generateId } from '../../src/utils/idGenerator';

// ============================================================================
// Default Test Configuration
// ============================================================================

export const DEFAULT_TEST_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'test-inst-001',
  name: 'Test Push 3',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

export const DEFAULT_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 1, y: 1 },
      index: { x: 2, y: 2 },
      middle: { x: 3, y: 3 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 6, y: 1 },
      index: { x: 5, y: 2 },
      middle: { x: 4, y: 3 },
    },
  },
};

export const DEFAULT_ENGINE_CONFIG: EngineConfiguration = {
  beamWidth: 10,
  stiffness: 0.3,
  restingPose: DEFAULT_RESTING_POSE,
};

export const EMPTY_LAYOUT: Layout = {
  id: 'test-layout-empty',
  name: 'Empty Layout',
  padToVoice: {},
  fingerConstraints: {},
  scoreCache: null,
};

// ============================================================================
// Solver Helpers
// ============================================================================

/** Creates a BeamSolver with default or custom config. */
export function createTestSolver(overrides?: Partial<SolverConfig>) {
  const config: SolverConfig = {
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    layout: null,
    mappingResolverMode: 'allow-fallback',
    ...overrides,
  };
  return createBeamSolver(config);
}

/** Runs a beam solver on a performance and returns the result. */
export async function runSolver(
  performance: Performance,
  solverConfigOverrides?: Partial<SolverConfig>,
  engineConfigOverrides?: Partial<EngineConfiguration>
): Promise<ExecutionPlanResult> {
  const solver = createTestSolver(solverConfigOverrides);
  const config: EngineConfiguration = {
    ...DEFAULT_ENGINE_CONFIG,
    ...engineConfigOverrides,
  };
  return solver.solve(performance, config);
}

// ============================================================================
// Test Data Generators
// ============================================================================

/** Converts beats to seconds at a given BPM. */
export function beatsToSeconds(beats: number, bpm: number = 120): number {
  return (beats / bpm) * 60;
}

/** Generates a deterministic event key. */
export function generateEventKey(
  noteNumber: number,
  startTime: number,
  channel: number = 1,
  ordinal: number = 1
): string {
  const nominalTime = Math.round(startTime * 10000);
  return `${nominalTime}:${noteNumber}:${channel}:${ordinal}`;
}

/** Creates a simple test performance from note specs. */
export function createTestPerformance(
  notes: Array<{ noteNumber: number; startTime: number; duration?: number }>,
  name?: string
): Performance {
  const events: PerformanceEvent[] = notes.map((n, i) => ({
    noteNumber: n.noteNumber,
    startTime: n.startTime,
    duration: n.duration ?? 0.25,
    velocity: 100,
    channel: 1,
    eventKey: generateEventKey(n.noteNumber, n.startTime, 1, 1),
  }));

  return {
    events,
    tempo: 120,
    name: name ?? 'Test Performance',
  };
}

/**
 * Creates a performance with alternating notes at a given interval.
 */
export function createAlternatingPerformance(
  noteA: number,
  noteB: number,
  count: number,
  intervalSeconds: number
): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      noteNumber: i % 2 === 0 ? noteA : noteB,
      startTime: i * intervalSeconds,
    });
  }
  return createTestPerformance(notes, `Alternating ${noteA}-${noteB}`);
}

/**
 * Creates a performance with a single repeated note.
 */
export function createRepeatedNotePerformance(
  noteNumber: number,
  count: number,
  intervalSeconds: number
): Performance {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let i = 0; i < count; i++) {
    notes.push({ noteNumber, startTime: i * intervalSeconds });
  }
  return createTestPerformance(notes, `Repeated ${noteNumber}`);
}

/**
 * Creates a performance with simultaneous notes at given timestamps.
 */
export function createSimultaneousPerformance(
  groups: Array<{ time: number; notes: number[] }>
): Performance {
  const allNotes: Array<{ noteNumber: number; startTime: number }> = [];
  for (const group of groups) {
    for (const n of group.notes) {
      allNotes.push({ noteNumber: n, startTime: group.time });
    }
  }
  return createTestPerformance(allNotes, 'Simultaneous Notes');
}

// ============================================================================
// Assertions
// ============================================================================

/** Asserts that result has no NaN values in key metrics. */
export function assertNoNaNs(result: ExecutionPlanResult): void {
  expect(result.score).not.toBeNaN();
  expect(result.averageDrift).not.toBeNaN();
  expect(result.averageMetrics.total).not.toBeNaN();
  expect(result.averageMetrics.movement).not.toBeNaN();
  expect(result.averageMetrics.stretch).not.toBeNaN();

  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand !== 'Unplayable') {
      expect(fa.cost).not.toBeNaN();
    }
  }
}

/** Asserts that all assigned grid positions are valid (within 8x8 bounds). */
export function assertValidGridPositions(result: ExecutionPlanResult): void {
  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand !== 'Unplayable' && fa.row !== undefined && fa.col !== undefined) {
      expect(fa.row).toBeGreaterThanOrEqual(0);
      expect(fa.row).toBeLessThan(8);
      expect(fa.col).toBeGreaterThanOrEqual(0);
      expect(fa.col).toBeLessThan(8);
    }
  }
}

/** Asserts that every playable assignment has a valid hand and finger. */
export function assertMappingIntegrity(result: ExecutionPlanResult): void {
  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand !== 'Unplayable') {
      expect(['left', 'right']).toContain(fa.assignedHand);
      expect(fa.finger).not.toBeNull();
    }
  }
}

/** Asserts the number of finger assignments matches the expected event count. */
export function assertEventCount(result: ExecutionPlanResult, expectedCount: number): void {
  expect(result.fingerAssignments.length).toBe(expectedCount);
}

/** Counts hand usage. */
export function countHandUsage(result: ExecutionPlanResult): { left: number; right: number; unplayable: number } {
  let left = 0, right = 0, unplayable = 0;
  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand === 'left') left++;
    else if (fa.assignedHand === 'right') right++;
    else unplayable++;
  }
  return { left, right, unplayable };
}

/** Gets the set of unique pads used. */
export function getUniquePads(result: ExecutionPlanResult): Set<string> {
  const pads = new Set<string>();
  for (const fa of result.fingerAssignments) {
    if (fa.row !== undefined && fa.col !== undefined) {
      pads.add(`${fa.row},${fa.col}`);
    }
  }
  return pads;
}

/** Computes the max spread (bounding box) of assigned pads. */
export function computeMaxSpread(result: ExecutionPlanResult): { rows: number; cols: number } {
  let minRow = 7, maxRow = 0, minCol = 7, maxCol = 0;
  let found = false;

  for (const fa of result.fingerAssignments) {
    if (fa.row !== undefined && fa.col !== undefined && fa.assignedHand !== 'Unplayable') {
      found = true;
      if (fa.row < minRow) minRow = fa.row;
      if (fa.row > maxRow) maxRow = fa.row;
      if (fa.col < minCol) minCol = fa.col;
      if (fa.col > maxCol) maxCol = fa.col;
    }
  }

  if (!found) return { rows: 0, cols: 0 };
  return { rows: maxRow - minRow + 1, cols: maxCol - minCol + 1 };
}

/** Counts crossovers (left hand in right zone or vice versa). */
export function countCrossovers(result: ExecutionPlanResult): number {
  let count = 0;
  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand === 'Unplayable' || fa.col === undefined) continue;
    if (fa.assignedHand === 'left' && fa.col >= 5) count++;
    if (fa.assignedHand === 'right' && fa.col <= 2) count++;
  }
  return count;
}

/** Computes total travel distance (consecutive pad distances). */
export function computeTotalTravel(result: ExecutionPlanResult): number {
  let total = 0;
  let prevRow: number | undefined;
  let prevCol: number | undefined;

  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand === 'Unplayable' || fa.row === undefined || fa.col === undefined) continue;
    if (prevRow !== undefined && prevCol !== undefined) {
      total += Math.abs(fa.row - prevRow) + Math.abs(fa.col - prevCol);
    }
    prevRow = fa.row;
    prevCol = fa.col;
  }

  return total;
}

/** Asserts no same-finger conflict in simultaneous events. */
export function assertNoSimultaneousFingerConflict(result: ExecutionPlanResult): void {
  const TIME_EPSILON = 0.001;
  const groups = new Map<number, FingerAssignment[]>();

  // Group by rounded timestamp
  for (const fa of result.fingerAssignments) {
    if (fa.assignedHand === 'Unplayable') continue;
    const key = Math.round(fa.startTime / TIME_EPSILON);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fa);
  }

  for (const [_, group] of groups) {
    if (group.length <= 1) continue;

    // Same hand + same finger at same time = conflict
    const fingerKeys = group.map(fa => `${fa.assignedHand}-${fa.finger}`);
    const uniqueKeys = new Set(fingerKeys);
    expect(uniqueKeys.size).toBe(fingerKeys.length);
  }
}
