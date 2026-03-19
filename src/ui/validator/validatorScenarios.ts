/**
 * Validator Scenarios.
 *
 * Curated set of atomic constraint test cases for the Constraint Validator.
 * Each scenario provides a pre-built layout, finger assignment, and moment
 * that demonstrates a specific constraint violation (or valid state).
 *
 * These are NOT solver-generated — each scenario manually specifies which
 * finger owns which pad, and the validator checks feasibility directly.
 */

import { type ValidatorScenario } from './types';
import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment, type NoteInstance } from '../../types/performanceEvent';
import { type Voice } from '../../types/voice';
import { padKey } from '../../types/padGrid';

// ============================================================================
// Helpers
// ============================================================================

function makeVoice(id: string, name: string, noteNumber: number, color: string): Voice {
  return { id, name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: noteNumber, color };
}

function makeNote(soundId: string, padId: string, noteNumber: number): NoteInstance {
  return { soundId, padId, noteNumber, velocity: 100 };
}

function makeMoment(notes: NoteInstance[]): PerformanceMoment {
  return { momentIndex: 0, startTime: 0, notes };
}

function makeLayout(
  id: string,
  name: string,
  entries: Array<{ row: number; col: number; voice: Voice }>,
): Layout {
  const padToVoice: Record<string, Voice> = {};
  for (const e of entries) {
    padToVoice[padKey(e.row, e.col)] = e.voice;
  }
  return {
    id,
    name,
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'manual',
    role: 'active',
  };
}

// ============================================================================
// Scenario Definitions
// ============================================================================

const SCENARIOS: ValidatorScenario[] = [
  // --------------------------------------------------------------------------
  // V1: Same Finger Owns Two Active Pads (Collision)
  // --------------------------------------------------------------------------
  (() => {
    const vKick = makeVoice('v1-kick', 'Kick', 64, '#ef4444');
    const vSnare = makeVoice('v1-snare', 'Snare', 65, '#3b82f6');
    const layout = makeLayout('v1-layout', 'Collision Test', [
      { row: 3, col: 4, voice: vKick },
      { row: 3, col: 5, voice: vSnare },
    ]);
    return {
      id: 'V1',
      title: 'Collision: Same Finger on Two Active Pads',
      description: 'Right index is assigned to both pads (3,4) and (3,5). Both notes are active simultaneously, so the same finger must be in two places at once.',
      constraintIds: ['collision'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 4)]: { hand: 'right', finger: 'index' },
        [padKey(3, 5)]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vKick.id, padKey(3, 4), 64),
        makeNote(vSnare.id, padKey(3, 5), 65),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V2: Span Violation — Index-Middle Exceed 2.0
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v2-a', 'Sound A', 62, '#ef4444');
    const vB = makeVoice('v2-b', 'Sound B', 65, '#3b82f6');
    const layout = makeLayout('v2-layout', 'Span Violation Test', [
      { row: 3, col: 2, voice: vA },
      { row: 3, col: 5, voice: vB },
    ]);
    return {
      id: 'V2',
      title: 'Span: Index-Middle Exceed 2.0',
      description: 'Right index at (3,2) and right middle at (3,5). Distance = 3.0, but index-middle max span = 2.0.',
      constraintIds: ['span'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 2)]: { hand: 'right', finger: 'index' },
        [padKey(3, 5)]: { hand: 'right', finger: 'middle' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(3, 2), 62),
        makeNote(vB.id, padKey(3, 5), 65),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V3: Span Start Valid, Drag to Break
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v3-a', 'Sound A', 64, '#ef4444');
    const vB = makeVoice('v3-b', 'Sound B', 65, '#3b82f6');
    const layout = makeLayout('v3-layout', 'Span Valid Start', [
      { row: 3, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
    ]);
    return {
      id: 'V3',
      title: 'Span: Start Valid, Drag to Break',
      description: 'Right index at (3,4) and right middle at (3,5). Distance = 1.0 ≤ 2.0 max. Drag Sound B to col 7 to create a span violation.',
      constraintIds: ['span'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 4)]: { hand: 'right', finger: 'index' },
        [padKey(3, 5)]: { hand: 'right', finger: 'middle' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(3, 4), 64),
        makeNote(vB.id, padKey(3, 5), 65),
      ]),
      expectedInitialStatus: 'valid',
      fixHint: 'Drag Sound B from (3,5) to (3,7) to see a span violation appear.',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V4: Ordering Violation — Index Right of Middle (Right Hand)
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v4-a', 'Sound A', 66, '#ef4444');
    const vB = makeVoice('v4-b', 'Sound B', 64, '#3b82f6');
    const layout = makeLayout('v4-layout', 'Ordering Violation Test', [
      { row: 3, col: 6, voice: vA },
      { row: 3, col: 4, voice: vB },
    ]);
    return {
      id: 'V4',
      title: 'Ordering: Index Right of Middle (Crossover)',
      description: 'Right index at col 6, right middle at col 4. Right hand requires index left of middle, so this is a crossover violation.',
      constraintIds: ['ordering'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 6)]: { hand: 'right', finger: 'index' },
        [padKey(3, 4)]: { hand: 'right', finger: 'middle' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(3, 6), 66),
        makeNote(vB.id, padKey(3, 4), 64),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V5: Thumb Delta — Thumb 2 Rows Above Index
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v5-a', 'Sound A', 75, '#ef4444');
    const vB = makeVoice('v5-b', 'Sound B', 64, '#3b82f6');
    const layout = makeLayout('v5-layout', 'Thumb Delta Test', [
      { row: 5, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
    ]);
    return {
      id: 'V5',
      title: 'Thumb Delta: Thumb 2 Rows Above Index',
      description: 'Right thumb at row 5, right index at row 3. Thumb row offset = 2.0, but THUMB_DELTA max = 1.0.',
      constraintIds: ['thumbDelta'] as const,
      layout,
      padFingerAssignment: {
        [padKey(5, 4)]: { hand: 'right', finger: 'thumb' },
        [padKey(3, 5)]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(5, 4), 75),
        makeNote(vB.id, padKey(3, 5), 64),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V6: Reachability — Maximum Grid Distance
  // --------------------------------------------------------------------------
  (() => {
    const vLow = makeVoice('v6-low', 'Low', 36, '#ef4444');
    const vHigh = makeVoice('v6-high', 'High', 99, '#3b82f6');
    const layout = makeLayout('v6-layout', 'Reachability Test', [
      { row: 0, col: 0, voice: vLow },
      { row: 7, col: 7, voice: vHigh },
    ]);
    return {
      id: 'V6',
      title: 'Reachability: Max Grid Distance',
      description: 'Right thumb at (0,0) and right pinky at (7,7). Distance = 9.9, far beyond thumb-pinky max span of 5.5.',
      constraintIds: ['span'] as const,
      layout,
      padFingerAssignment: {
        [padKey(0, 0)]: { hand: 'right', finger: 'thumb' },
        [padKey(7, 7)]: { hand: 'right', finger: 'pinky' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vLow.id, padKey(0, 0), 36),
        makeNote(vHigh.id, padKey(7, 7), 99),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V7: Unmapped Note — Sound Not in Layout
  // --------------------------------------------------------------------------
  (() => {
    const vKick = makeVoice('v7-kick', 'Kick', 64, '#ef4444');
    const vSnare = makeVoice('v7-snare', 'Snare', 65, '#3b82f6');
    // Only Kick is in the layout — Snare is unmapped
    const layout = makeLayout('v7-layout', 'Unmapped Note Test', [
      { row: 3, col: 4, voice: vKick },
    ]);
    return {
      id: 'V7',
      title: 'Unmapped Note: Sound Not in Layout',
      description: 'The moment requires both Kick and Snare, but only Kick has a pad in the layout. Snare has no mapped pad.',
      constraintIds: ['reachability'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 4)]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vKick.id, padKey(3, 4), 64),
        makeNote(vSnare.id, '', 65), // empty padId — unmapped
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V8: Missing Finger Assignment
  // --------------------------------------------------------------------------
  (() => {
    const vKick = makeVoice('v8-kick', 'Kick', 64, '#ef4444');
    const vSnare = makeVoice('v8-snare', 'Snare', 65, '#3b82f6');
    const layout = makeLayout('v8-layout', 'Missing Assignment Test', [
      { row: 3, col: 4, voice: vKick },
      { row: 3, col: 5, voice: vSnare },
    ]);
    return {
      id: 'V8',
      title: 'Missing Finger Assignment',
      description: 'Both Kick and Snare have pads, but only Kick has a finger assignment. Snare at (3,5) has no finger owner.',
      constraintIds: ['zone'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 4)]: { hand: 'right', finger: 'index' },
        // (3,5) intentionally missing
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vKick.id, padKey(3, 4), 64),
        makeNote(vSnare.id, padKey(3, 5), 65),
      ]),
      expectedInitialStatus: 'violation',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V9: Valid But Degraded — High Cost, Still Feasible
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v9-a', 'Sound A', 62, '#ef4444');
    const vB = makeVoice('v9-b', 'Sound B', 65, '#3b82f6');
    const vC = makeVoice('v9-c', 'Sound C', 71, '#22c55e');
    const layout = makeLayout('v9-layout', 'Valid But Degraded', [
      { row: 3, col: 2, voice: vA },
      { row: 3, col: 5, voice: vB },
      { row: 4, col: 3, voice: vC },
    ]);
    // thumb(2) < middle(3) < pinky(5) for right hand — valid ordering
    // thumb-pinky = sqrt((5-2)^2) = 3.0 ≤ 5.5 OK
    // thumb-middle = sqrt((3-2)^2 + (4-3)^2) = sqrt(2) ≈ 1.41 ≤ 4.5 OK
    // middle-pinky = sqrt((5-3)^2 + (3-4)^2) = sqrt(5) ≈ 2.24 ≤ 2.5 OK
    return {
      id: 'V9',
      title: 'Valid But Degraded: High Cost, Feasible',
      description: 'Three pads using thumb, middle, and pinky — weak finger choices with moderate spread. Feasible but high cost.',
      constraintIds: ['span'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 2)]: { hand: 'right', finger: 'thumb' },
        [padKey(4, 3)]: { hand: 'right', finger: 'middle' },
        [padKey(3, 5)]: { hand: 'right', finger: 'pinky' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(3, 2), 62),
        makeNote(vB.id, padKey(3, 5), 65),
        makeNote(vC.id, padKey(4, 3), 71),
      ]),
      expectedInitialStatus: 'valid',
    } satisfies ValidatorScenario;
  })(),

  // --------------------------------------------------------------------------
  // V10: Dense Valid Cluster — Compact Right Hand
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('v10-a', 'Sound A', 64, '#ef4444');
    const vB = makeVoice('v10-b', 'Sound B', 65, '#3b82f6');
    const vC = makeVoice('v10-c', 'Sound C', 66, '#22c55e');
    const layout = makeLayout('v10-layout', 'Dense Valid Cluster', [
      { row: 3, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
      { row: 3, col: 6, voice: vC },
    ]);
    // index(4) < middle(5) < ring(6) — valid right hand ordering
    // index-middle = 1.0 ≤ 2.0, middle-ring = 1.0 ≤ 2.0, index-ring = 2.0 ≤ 2.0 — OK
    return {
      id: 'V10',
      title: 'Dense Valid Cluster: Compact Right Hand',
      description: 'Three adjacent pads with index, middle, ring. All spans within limits. Drag Sound C far left to create crossover + span violations.',
      constraintIds: ['span', 'ordering'] as const,
      layout,
      padFingerAssignment: {
        [padKey(3, 4)]: { hand: 'right', finger: 'index' },
        [padKey(3, 5)]: { hand: 'right', finger: 'middle' },
        [padKey(3, 6)]: { hand: 'right', finger: 'ring' },
      } satisfies PadFingerAssignment,
      moment: makeMoment([
        makeNote(vA.id, padKey(3, 4), 64),
        makeNote(vB.id, padKey(3, 5), 65),
        makeNote(vC.id, padKey(3, 6), 66),
      ]),
      expectedInitialStatus: 'valid',
      fixHint: 'Drag Sound C from (3,6) to (3,0) to create ordering and span violations.',
    } satisfies ValidatorScenario;
  })(),
];

// ============================================================================
// Public API
// ============================================================================

/** Get all validator scenarios. */
export function getValidatorScenarios(): ValidatorScenario[] {
  return SCENARIOS;
}

/** Get a specific scenario by ID. */
export function getValidatorScenario(id: string): ValidatorScenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}
