/**
 * Temporal Evaluator Scenarios.
 *
 * Curated set of temporal constraint test cases for the Temporal Evaluator.
 * Each scenario provides a pre-built layout, finger assignment, and ordered
 * moment sequence that demonstrates a specific temporal constraint violation
 * or valid temporal behavior.
 *
 * These are NOT solver-generated — each scenario manually specifies which
 * finger owns which pad and evaluates the sequence directly.
 */

import { type TemporalScenario } from './types';
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

function makeMoment(index: number, startTime: number, notes: NoteInstance[]): PerformanceMoment {
  return { momentIndex: index, startTime, notes };
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

const SCENARIOS: TemporalScenario[] = [

  // --------------------------------------------------------------------------
  // T1: Slow Feasible Transition
  // --------------------------------------------------------------------------
  (() => {
    const vKick = makeVoice('t1-kick', 'Kick', 64, '#ef4444');
    const vSnare = makeVoice('t1-snare', 'Snare', 65, '#3b82f6');
    const layout = makeLayout('t1-layout', 'Slow Feasible', [
      { row: 3, col: 4, voice: vKick },
      { row: 3, col: 5, voice: vSnare },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(3, 5);
    return {
      id: 'T1',
      title: 'Slow feasible transition',
      description: 'Two pads 1 unit apart with 500ms between events. Movement is modest relative to time — should remain fully valid.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'middle' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vKick.id, pk1, 64)]),
        makeMoment(1, 0.5, [makeNote(vSnare.id, pk2, 65)]),
        makeMoment(2, 1.0, [makeNote(vKick.id, pk1, 64)]),
        makeMoment(3, 1.5, [makeNote(vSnare.id, pk2, 65)]),
      ],
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Positive control: proves that a clearly reachable movement over enough time remains valid.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T2: Fast But Still Feasible Transition
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t2-a', 'Lo Tom', 64, '#ef4444');
    const vB = makeVoice('t2-b', 'Hi Tom', 68, '#3b82f6');
    const layout = makeLayout('t2-layout', 'Fast Feasible', [
      { row: 3, col: 3, voice: vA },
      { row: 3, col: 6, voice: vB },
    ]);
    const pk1 = padKey(3, 3);
    const pk2 = padKey(3, 6);
    // Distance = 3.0 units. At 300ms, speed = 10.0 units/s (under MAX_HAND_SPEED=12)
    return {
      id: 'T2',
      title: 'Fast but feasible transition',
      description: 'Two pads 3 units apart with 300ms gaps. Speed ~10 units/s approaches but does not exceed the MAX_HAND_SPEED=12. Elevated cost but still feasible.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'ring' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(1, 0.3, [makeNote(vB.id, pk2, 68)]),
        makeMoment(2, 0.6, [makeNote(vA.id, pk1, 64)]),
        makeMoment(3, 0.9, [makeNote(vB.id, pk2, 68)]),
      ],
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Shows a high transition cost without full invalidity. Speed = 10 units/s, under the 12 limit.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T3: Impossible Speed Transition
  // --------------------------------------------------------------------------
  (() => {
    const vBottom = makeVoice('t3-bottom', 'Bottom', 36, '#ef4444');
    const vTop = makeVoice('t3-top', 'Top', 95, '#3b82f6');
    const layout = makeLayout('t3-layout', 'Impossible Speed', [
      { row: 0, col: 3, voice: vBottom },
      { row: 7, col: 3, voice: vTop },
    ]);
    const pk1 = padKey(0, 3);
    const pk2 = padKey(7, 3);
    // Distance = 7.0 units. At 50ms, speed = 140 units/s >> MAX_HAND_SPEED=12
    return {
      id: 'T3',
      title: 'Impossible speed transition',
      description: 'Two pads 7 rows apart with only 50ms between events. Speed ~140 units/s far exceeds MAX_HAND_SPEED=12. Should be a hard violation.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vBottom.id, pk1, 36)]),
        makeMoment(1, 0.05, [makeNote(vTop.id, pk2, 95)]),
        makeMoment(2, 0.1, [makeNote(vBottom.id, pk1, 36)]),
        makeMoment(3, 0.15, [makeNote(vTop.id, pk2, 95)]),
      ],
      expectedInitialStatus: 'violation',
      expectedFirstFailureIndex: 0,
      notesForWhyThisScenarioExists: 'Proves that movement exceeding the temporal feasibility limit is detected.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T4: Alternation Penalty Case
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t4-a', 'Kick', 64, '#ef4444');
    const vB = makeVoice('t4-b', 'Snare', 65, '#3b82f6');
    const layout = makeLayout('t4-layout', 'Alternation', [
      { row: 3, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(3, 5);
    // Same finger (index) alternating between two adjacent pads rapidly
    return {
      id: 'T4',
      title: 'Alternation penalty case',
      description: 'Right index assigned to both adjacent pads. Rapid alternation at 150ms intervals. Same-finger reuse incurs alternation penalty without hard invalidity.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(1, 0.15, [makeNote(vB.id, pk2, 65)]),
        makeMoment(2, 0.30, [makeNote(vA.id, pk1, 64)]),
        makeMoment(3, 0.45, [makeNote(vB.id, pk2, 65)]),
        makeMoment(4, 0.60, [makeNote(vA.id, pk1, 64)]),
        makeMoment(5, 0.75, [makeNote(vB.id, pk2, 65)]),
      ],
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Shows that awkward repeated finger use increases cost. Adjacent pads, same finger, rapid pace.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T5: Repeated Same-Finger Stress Case
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t5-a', 'HH', 64, '#22c55e');
    const layout = makeLayout('t5-layout', 'Same Finger Stress', [
      { row: 3, col: 5, voice: vA },
    ]);
    const pk1 = padKey(3, 5);
    // Single pad, single finger, 8 rapid consecutive hits
    return {
      id: 'T5',
      title: 'Repeated same-finger stress case',
      description: 'Single pad hit 8 times rapidly (100ms intervals) by right index. Valid but ergonomically poor — repeated same-finger stress accumulates alternation cost.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moments: Array.from({ length: 8 }, (_, i) =>
        makeMoment(i, i * 0.1, [makeNote(vA.id, pk1, 64)]),
      ),
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Distinguishes temporal ergonomic degradation from a hard violation. Same pad, same finger, rapid pace.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T6: Hand Balance Stress Case
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t6-a', 'Kick', 64, '#ef4444');
    const vB = makeVoice('t6-b', 'Snare', 65, '#3b82f6');
    const vC = makeVoice('t6-c', 'HH', 66, '#22c55e');
    const vD = makeVoice('t6-d', 'Tom', 67, '#f59e0b');
    const layout = makeLayout('t6-layout', 'Hand Balance Stress', [
      { row: 3, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
      { row: 4, col: 4, voice: vC },
      { row: 4, col: 5, voice: vD },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(3, 5);
    const pk3 = padKey(4, 4);
    const pk4 = padKey(4, 5);
    // All pads assigned to right hand — heavy imbalance
    return {
      id: 'T6',
      title: 'Hand balance stress case',
      description: 'Four pads all assigned to the right hand. 12 moments total across 4 voices — 100% right hand workload. Feasible but heavily imbalanced.',
      constraintIds: ['zone'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'middle' },
        [pk3]: { hand: 'right', finger: 'ring' },
        [pk4]: { hand: 'right', finger: 'pinky' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(1, 0.25, [makeNote(vB.id, pk2, 65)]),
        makeMoment(2, 0.5, [makeNote(vC.id, pk3, 66)]),
        makeMoment(3, 0.75, [makeNote(vD.id, pk4, 67)]),
        makeMoment(4, 1.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(5, 1.25, [makeNote(vB.id, pk2, 65)]),
        makeMoment(6, 1.5, [makeNote(vC.id, pk3, 66)]),
        makeMoment(7, 1.75, [makeNote(vD.id, pk4, 67)]),
        makeMoment(8, 2.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(9, 2.25, [makeNote(vB.id, pk2, 65)]),
        makeMoment(10, 2.5, [makeNote(vC.id, pk3, 66)]),
        makeMoment(11, 2.75, [makeNote(vD.id, pk4, 67)]),
      ],
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Shows imbalance accumulation across a sequence. One hand carries all the work.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T7: First Failing Transition in Middle of Sequence
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t7-a', 'Lo', 64, '#ef4444');
    const vB = makeVoice('t7-b', 'Hi', 95, '#3b82f6');
    // Two pads: one close, one far
    const layout = makeLayout('t7-layout', 'Mid-Sequence Failure', [
      { row: 3, col: 4, voice: vA },
      { row: 7, col: 4, voice: vB },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(7, 4);
    // First transitions are slow and valid (500ms), then one is fast (40ms) and fails
    return {
      id: 'T7',
      title: 'First failing transition in middle of sequence',
      description: 'First 3 transitions are slow (500ms) and valid. Transition 3→4 is only 40ms across 4 rows — impossible speed. Proves evaluator identifies where failure first occurs.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),     // valid transition to 1
        makeMoment(1, 0.5, [makeNote(vB.id, pk2, 95)]),     // valid transition to 2
        makeMoment(2, 1.0, [makeNote(vA.id, pk1, 64)]),     // valid transition to 3
        makeMoment(3, 1.5, [makeNote(vA.id, pk1, 64)]),     // <-- THIS transition to 4 fails
        makeMoment(4, 1.54, [makeNote(vB.id, pk2, 95)]),    // 40ms across 4 rows = too fast
        makeMoment(5, 2.0, [makeNote(vA.id, pk1, 64)]),     // valid after
      ],
      expectedInitialStatus: 'violation',
      expectedFirstFailureIndex: 3,
      notesForWhyThisScenarioExists: 'Proves evaluator can identify where a sequence first becomes invalid, not just whether it is invalid.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T8: Valid Sequence Made Invalid by Pad Move
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t8-a', 'Kick', 64, '#ef4444');
    const vB = makeVoice('t8-b', 'Snare', 65, '#3b82f6');
    // Start with adjacent pads — transitions are short and valid
    const layout = makeLayout('t8-layout', 'Valid→Invalid via Move', [
      { row: 3, col: 4, voice: vA },
      { row: 3, col: 5, voice: vB },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(3, 5);
    // 200ms alternation at distance 1.0 → speed 5.0 (well under 12)
    return {
      id: 'T8',
      title: 'Valid sequence made invalid by pad move',
      description: 'Starts valid: 2 adjacent pads with 200ms alternation (speed=5). Drag Snare from (3,5) to (7,7) to create distance=5.0 and speed=25 → violation.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'middle' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(1, 0.2, [makeNote(vB.id, pk2, 65)]),
        makeMoment(2, 0.4, [makeNote(vA.id, pk1, 64)]),
        makeMoment(3, 0.6, [makeNote(vB.id, pk2, 65)]),
        makeMoment(4, 0.8, [makeNote(vA.id, pk1, 64)]),
      ],
      expectedInitialStatus: 'valid',
      fixHint: 'Drag Snare from (3,5) to (7,7) to create a speed violation.',
      notesForWhyThisScenarioExists: 'Proves that manual grid edits change temporal feasibility in real time.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T9: Violating Sequence Repaired by Reassignment
  // --------------------------------------------------------------------------
  (() => {
    const vA = makeVoice('t9-a', 'Lo', 64, '#ef4444');
    const vB = makeVoice('t9-b', 'Hi', 68, '#3b82f6');
    // Two pads at moderate distance, both assigned to right index (same finger)
    // Rapid alternation means same finger must jump between pads
    const layout = makeLayout('t9-layout', 'Fix via Reassignment', [
      { row: 3, col: 3, voice: vA },
      { row: 3, col: 6, voice: vB },
    ]);
    const pk1 = padKey(3, 3);
    const pk2 = padKey(3, 6);
    // Distance 3.0, at 80ms → speed = 37.5 units/s >> MAX_HAND_SPEED=12
    // Both on same finger (index) → impossible
    // Fix: reassign pk2 to right ring → different fingers, still same hand
    return {
      id: 'T9',
      title: 'Violating sequence repaired by reassignment',
      description: 'Both pads assigned to right index, 3 units apart, 80ms alternation. Speed=37.5 >> 12 max. Reassign Hi from right index to right ring to use different fingers and reduce transition.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'index' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [makeNote(vA.id, pk1, 64)]),
        makeMoment(1, 0.08, [makeNote(vB.id, pk2, 68)]),
        makeMoment(2, 0.16, [makeNote(vA.id, pk1, 64)]),
        makeMoment(3, 0.24, [makeNote(vB.id, pk2, 68)]),
        makeMoment(4, 0.32, [makeNote(vA.id, pk1, 64)]),
        makeMoment(5, 0.40, [makeNote(vB.id, pk2, 68)]),
      ],
      expectedInitialStatus: 'violation',
      expectedFirstFailureIndex: 0,
      expectedStatusAfterKnownMove: 'valid',
      fixHint: 'Click pad (3,6) and reassign from R-Ix to R-Rn. The transition changes from single-finger jump to in-place finger spread.',
      notesForWhyThisScenarioExists: 'Proves that assignment changes can fix temporal infeasibility even when layout remains unchanged.',
    } satisfies TemporalScenario;
  })(),

  // --------------------------------------------------------------------------
  // T10: Event Grouping Correctness Case
  // --------------------------------------------------------------------------
  (() => {
    const vKick = makeVoice('t10-kick', 'Kick', 64, '#ef4444');
    const vSnare = makeVoice('t10-snare', 'Snare', 65, '#3b82f6');
    const vHH = makeVoice('t10-hh', 'HH', 66, '#22c55e');
    const layout = makeLayout('t10-layout', 'Event Grouping', [
      { row: 3, col: 4, voice: vKick },
      { row: 3, col: 5, voice: vSnare },
      { row: 4, col: 5, voice: vHH },
    ]);
    const pk1 = padKey(3, 4);
    const pk2 = padKey(3, 5);
    const pk3 = padKey(4, 5);
    // Moments with simultaneous notes grouped correctly
    // Moment 0: Kick + HH (chord) at t=0
    // Moment 1: Snare alone at t=0.5
    // Moment 2: Kick + Snare + HH (3-note chord) at t=1.0
    // Moment 3: Kick alone at t=1.5
    return {
      id: 'T10',
      title: 'Event grouping correctness case',
      description: 'Simultaneous notes are grouped into single moments. Moment 0 has Kick+HH together, Moment 2 has Kick+Snare+HH together. Temporal costs are computed between moments, not between individual notes.',
      constraintIds: ['speed'] as const,
      layout,
      padFingerAssignment: {
        [pk1]: { hand: 'right', finger: 'index' },
        [pk2]: { hand: 'right', finger: 'middle' },
        [pk3]: { hand: 'right', finger: 'ring' },
      } satisfies PadFingerAssignment,
      moments: [
        makeMoment(0, 0.0, [
          makeNote(vKick.id, pk1, 64),
          makeNote(vHH.id, pk3, 66),
        ]),
        makeMoment(1, 0.5, [
          makeNote(vSnare.id, pk2, 65),
        ]),
        makeMoment(2, 1.0, [
          makeNote(vKick.id, pk1, 64),
          makeNote(vSnare.id, pk2, 65),
          makeNote(vHH.id, pk3, 66),
        ]),
        makeMoment(3, 1.5, [
          makeNote(vKick.id, pk1, 64),
        ]),
      ],
      expectedInitialStatus: 'valid',
      notesForWhyThisScenarioExists: 'Proves that simultaneous notes are treated as one moment and that temporal costs are computed between moments, not between individual note occurrences.',
    } satisfies TemporalScenario;
  })(),
];

// ============================================================================
// Public API
// ============================================================================

/** Get all temporal scenarios. */
export function getTemporalScenarios(): TemporalScenario[] {
  return SCENARIOS;
}

/** Get a specific scenario by ID. */
export function getTemporalScenario(id: string): TemporalScenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}
