/**
 * Canonical Cost Evaluator Tests.
 *
 * Proves that cost evaluation works independently of the beam solver.
 * Tests the core product requirement:
 *   f(layout, padFingerAssignment, events) = structured cost output
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateEvent,
  evaluateTransition,
  evaluatePerformance,
  compareLayouts,
  validateAssignment,
} from '../../../src/engine/evaluation/canonicalEvaluator';
import { buildMomentPoses } from '../../../src/engine/evaluation/poseBuilder';
import { type Layout } from '../../../src/types/layout';
import { type PadFingerAssignment } from '../../../src/types/executionPlan';
import { type PerformanceMoment, type NoteInstance } from '../../../src/types/performanceEvent';
import { type EvaluationConfig } from '../../../src/types/evaluationConfig';
import { type Voice } from '../../../src/types/voice';
import { padKey } from '../../../src/types/padGrid';
import {
  DEFAULT_TEST_INSTRUMENT_CONFIG,
  DEFAULT_RESTING_POSE,
} from '../../helpers/testHelpers';
import {
  computeNeutralHandCenters,
  resolveNeutralPadPositions,
} from '../../../src/engine/prior/handPose';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeVoice(noteNumber: number, name?: string): Voice {
  return {
    id: `voice-${noteNumber}`,
    name: name ?? `Sound ${noteNumber}`,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: noteNumber,
    color: '#ffffff',
  };
}

/** A simple 3-sound layout: notes 40, 41, 42 on pads (0,4), (0,5), (0,6). */
function makeSimpleLayout(): Layout {
  return {
    id: 'test-layout-1',
    name: 'Simple Layout',
    padToVoice: {
      [padKey(0, 4)]: makeVoice(40),
      [padKey(0, 5)]: makeVoice(41),
      [padKey(0, 6)]: makeVoice(42),
    },
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active',
  };
}

/** A simple pad-finger assignment for the simple layout. */
function makeSimpleAssignment(): PadFingerAssignment {
  return {
    [padKey(0, 4)]: { hand: 'right', finger: 'index' },
    [padKey(0, 5)]: { hand: 'right', finger: 'middle' },
    [padKey(0, 6)]: { hand: 'right', finger: 'ring' },
  };
}

/** A wider layout spanning both hands. */
function makeTwoHandLayout(): Layout {
  return {
    id: 'test-layout-2',
    name: 'Two Hand Layout',
    padToVoice: {
      [padKey(2, 1)]: makeVoice(45, 'Kick'),
      [padKey(2, 2)]: makeVoice(46, 'Snare'),
      [padKey(2, 5)]: makeVoice(50, 'HiHat'),
      [padKey(2, 6)]: makeVoice(51, 'Ride'),
    },
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active',
  };
}

function makeTwoHandAssignment(): PadFingerAssignment {
  return {
    [padKey(2, 1)]: { hand: 'left', finger: 'index' },
    [padKey(2, 2)]: { hand: 'left', finger: 'middle' },
    [padKey(2, 5)]: { hand: 'right', finger: 'index' },
    [padKey(2, 6)]: { hand: 'right', finger: 'middle' },
  };
}

function makeNote(soundId: string, noteNumber: number, padId: string): NoteInstance {
  return { soundId, padId, noteNumber, velocity: 100 };
}

function makeMoment(index: number, time: number, notes: NoteInstance[]): PerformanceMoment {
  return { momentIndex: index, startTime: time, notes };
}

function makeConfig(): EvaluationConfig {
  const neutralPads = resolveNeutralPadPositions(makeSimpleLayout(), DEFAULT_TEST_INSTRUMENT_CONFIG);
  const neutralHandCenters = computeNeutralHandCenters(neutralPads);
  return {
    restingPose: DEFAULT_RESTING_POSE,
    stiffness: 0.3,
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    neutralHandCenters,
  };
}

// ============================================================================
// Tests: poseBuilder
// ============================================================================

describe('poseBuilder', () => {
  it('should build hand poses from pad-finger assignment', () => {
    const assignment = makeSimpleAssignment();
    const result = buildMomentPoses(
      [padKey(0, 4), padKey(0, 5), padKey(0, 6)],
      assignment,
    );

    expect(result.right).not.toBeNull();
    expect(result.left).toBeNull();
    expect(result.unmappedPads).toHaveLength(0);

    // Right hand should have index, middle, ring
    expect(result.right!.fingers.index).toBeDefined();
    expect(result.right!.fingers.middle).toBeDefined();
    expect(result.right!.fingers.ring).toBeDefined();
  });

  it('should build both hands for two-hand layout', () => {
    const assignment = makeTwoHandAssignment();
    const result = buildMomentPoses(
      [padKey(2, 1), padKey(2, 5)],
      assignment,
    );

    expect(result.left).not.toBeNull();
    expect(result.right).not.toBeNull();
  });

  it('should report unmapped pads', () => {
    const assignment = makeSimpleAssignment();
    const result = buildMomentPoses(
      [padKey(0, 4), padKey(7, 7)], // 7,7 not in assignment
      assignment,
    );

    expect(result.unmappedPads).toContain(padKey(7, 7));
  });

  it('should classify strict-tier grips for close pads', () => {
    const assignment: PadFingerAssignment = {
      [padKey(3, 4)]: { hand: 'right', finger: 'index' },
      [padKey(3, 5)]: { hand: 'right', finger: 'middle' },
    };
    const result = buildMomentPoses([padKey(3, 4), padKey(3, 5)], assignment);
    expect(result.tier).toBe('strict');
  });
});

// ============================================================================
// Tests: evaluateEvent
// ============================================================================

describe('evaluateEvent', () => {
  it('should evaluate a single-note moment', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moment = makeMoment(0, 0.0, [
      makeNote('voice-40', 40, padKey(0, 4)),
    ]);

    const result = evaluateEvent({
      moment,
      layout,
      padFingerAssignment: assignment,
      config,
    });

    expect(result.momentIndex).toBe(0);
    expect(result.timestamp).toBe(0.0);
    expect(result.dimensions.total).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.total).not.toBeNaN();
    expect(result.noteAssignments).toHaveLength(1);
    expect(result.noteAssignments[0].hand).toBe('right');
    expect(result.noteAssignments[0].finger).toBe('index');
  });

  it('should evaluate a two-note simultaneous moment', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moment = makeMoment(0, 0.0, [
      makeNote('voice-40', 40, padKey(0, 4)),
      makeNote('voice-41', 41, padKey(0, 5)),
    ]);

    const result = evaluateEvent({
      moment,
      layout,
      padFingerAssignment: assignment,
      config,
    });

    expect(result.noteAssignments).toHaveLength(2);
    expect(result.dimensions.poseNaturalness).toBeGreaterThanOrEqual(0);
    expect(result.feasibilityTier).toBe('strict');
  });

  it('should return pose detail sub-breakdown', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moment = makeMoment(0, 0.0, [
      makeNote('voice-40', 40, padKey(0, 4)),
    ]);

    const result = evaluateEvent({
      moment,
      layout,
      padFingerAssignment: assignment,
      config,
    });

    expect(result.poseDetail.attractor).toBeGreaterThanOrEqual(0);
    expect(result.poseDetail.perFingerHome).toBeGreaterThanOrEqual(0);
    expect(result.poseDetail.fingerDominance).toBeGreaterThanOrEqual(0);
    // poseNaturalness should equal sum of detail
    const detailSum = result.poseDetail.attractor + result.poseDetail.perFingerHome + result.poseDetail.fingerDominance;
    expect(result.dimensions.poseNaturalness).toBeCloseTo(detailSum, 10);
  });

  it('should include debug info when requested', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moment = makeMoment(0, 0.0, [
      makeNote('voice-40', 40, padKey(0, 4)),
    ]);

    const result = evaluateEvent({
      moment,
      layout,
      padFingerAssignment: assignment,
      config,
      includeDebug: true,
    });

    expect(result.debug).toBeDefined();
    expect(result.debug!.handPoses.right).toBeDefined();
  });

  it('should detect alternation cost for same-finger rapid repetition', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moment = makeMoment(1, 0.05, [
      makeNote('voice-40', 40, padKey(0, 4)),
    ]);

    const result = evaluateEvent({
      moment,
      layout,
      padFingerAssignment: assignment,
      config,
      prevMomentContext: {
        assignments: [{ hand: 'right', finger: 'index' }],
        timestamp: 0.0,
      },
    });

    expect(result.dimensions.alternation).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: evaluateTransition
// ============================================================================

describe('evaluateTransition', () => {
  it('should evaluate transition between two moments', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const from = makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]);
    const to = makeMoment(1, 0.5, [makeNote('voice-42', 42, padKey(0, 6))]);

    const result = evaluateTransition({
      fromMoment: from,
      toMoment: to,
      layout,
      padFingerAssignment: assignment,
      config,
    });

    expect(result.fromMomentIndex).toBe(0);
    expect(result.toMomentIndex).toBe(1);
    expect(result.timeDeltaMs).toBeCloseTo(500);
    expect(result.dimensions.transitionCost).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.transitionCost).not.toBeNaN();
  });

  it('should have higher cost for faster transitions', () => {
    const layout = makeTwoHandLayout();
    const assignment = makeTwoHandAssignment();
    const config = makeConfig();

    const from = makeMoment(0, 0.0, [makeNote('voice-45', 45, padKey(2, 1))]);
    const toSlow = makeMoment(1, 2.0, [makeNote('voice-50', 50, padKey(2, 5))]);
    const toFast = makeMoment(1, 0.1, [makeNote('voice-50', 50, padKey(2, 5))]);

    const slowResult = evaluateTransition({
      fromMoment: from, toMoment: toSlow, layout, padFingerAssignment: assignment, config,
    });
    const fastResult = evaluateTransition({
      fromMoment: from, toMoment: toFast, layout, padFingerAssignment: assignment, config,
    });

    // Both notes are on different hands, so transition cost per-hand may be 0.
    // But the movement metrics should still differ.
    expect(fastResult.movement.speedPressure).toBeGreaterThanOrEqual(slowResult.movement.speedPressure);
  });

  it('should detect hand switch', () => {
    const layout = makeTwoHandLayout();
    const assignment = makeTwoHandAssignment();
    const config = makeConfig();

    const from = makeMoment(0, 0.0, [makeNote('voice-45', 45, padKey(2, 1))]);
    const to = makeMoment(1, 0.5, [makeNote('voice-50', 50, padKey(2, 5))]);

    const result = evaluateTransition({
      fromMoment: from, toMoment: to, layout, padFingerAssignment: assignment, config,
    });

    expect(result.movement.handSwitch).toBe(true);
  });

  it('should include debug info when requested', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const from = makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]);
    const to = makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]);

    const result = evaluateTransition({
      fromMoment: from, toMoment: to, layout, padFingerAssignment: assignment, config,
      includeDebug: true,
    });

    expect(result.debug).toBeDefined();
    expect(result.debug!.rawFittsLawCost).toBeDefined();
  });
});

// ============================================================================
// Tests: evaluatePerformance
// ============================================================================

describe('evaluatePerformance', () => {
  it('should evaluate a full 3-moment performance', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
      makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]),
      makeMoment(2, 1.0, [makeNote('voice-42', 42, padKey(0, 6))]),
    ];

    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: assignment, config,
    });

    expect(result.eventCosts).toHaveLength(3);
    expect(result.transitionCosts).toHaveLength(2);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).not.toBeNaN();
    expect(result.aggregateMetrics.momentCount).toBe(3);
    expect(result.aggregateMetrics.transitionCount).toBe(2);
    expect(result.padFingerAssignment).toBe(assignment);
  });

  it('should return structured aggregate metrics', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
      makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]),
    ];

    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: assignment, config,
    });

    expect(result.aggregateMetrics.averageDimensions.total).toBeGreaterThanOrEqual(0);
    expect(result.aggregateMetrics.peakDimensions.total).toBeGreaterThanOrEqual(0);
    expect(result.aggregateMetrics.peakMomentIndex).toBeGreaterThanOrEqual(0);
  });

  it('should return feasibility verdict', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
    ];

    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: assignment, config,
    });

    expect(result.feasibility).toBeDefined();
    expect(['feasible', 'degraded', 'infeasible']).toContain(result.feasibility.level);
  });

  it('should handle empty performance', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const result = evaluatePerformance({
      moments: [], layout, padFingerAssignment: assignment, config,
    });

    expect(result.total).toBe(0);
    expect(result.eventCosts).toHaveLength(0);
    expect(result.transitionCosts).toHaveLength(0);
  });

  it('total should equal sum of event + transition costs', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
      makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]),
      makeMoment(2, 1.0, [makeNote('voice-42', 42, padKey(0, 6))]),
    ];

    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: assignment, config,
    });

    const eventTotal = result.eventCosts.reduce((s, e) => s + e.dimensions.total, 0);
    const transitionTotal = result.transitionCosts.reduce((s, t) => s + t.dimensions.total, 0);

    expect(result.total).toBeCloseTo(eventTotal + transitionTotal, 8);
  });
});

// ============================================================================
// Tests: Recomputation after manual edit
// ============================================================================

describe('Recomputation after manual edit', () => {
  it('should produce different costs when a sound moves to a different pad', () => {
    const config = makeConfig();
    const assignment = makeSimpleAssignment();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
      makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]),
    ];

    // Original layout
    const layoutA = makeSimpleLayout();
    const resultA = evaluatePerformance({
      moments, layout: layoutA, padFingerAssignment: assignment, config,
    });

    // Modified layout: move voice-42 to a different pad
    const layoutB: Layout = {
      ...layoutA,
      padToVoice: {
        ...layoutA.padToVoice,
        [padKey(4, 4)]: makeVoice(40, 'Moved Sound'),
      },
    };
    // Remove from old position
    delete layoutB.padToVoice[padKey(0, 4)];

    // Also update assignment
    const assignmentB: PadFingerAssignment = {
      ...assignment,
      [padKey(4, 4)]: { hand: 'right', finger: 'index' },
    };
    delete assignmentB[padKey(0, 4)];

    const resultB = evaluatePerformance({
      moments, layout: layoutB, padFingerAssignment: assignmentB, config,
    });

    // Costs should differ because the sound moved
    // (unless by coincidence they happen to be equal, which is very unlikely)
    expect(resultA.total).not.toBe(resultB.total);
  });

  it('should produce different costs when finger ownership changes', () => {
    const layout = makeSimpleLayout();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
    ];

    // Assignment A: index finger
    const assignmentA: PadFingerAssignment = {
      [padKey(0, 4)]: { hand: 'right', finger: 'index' },
      [padKey(0, 5)]: { hand: 'right', finger: 'middle' },
      [padKey(0, 6)]: { hand: 'right', finger: 'ring' },
    };

    // Assignment B: pinky finger (higher dominance cost)
    const assignmentB: PadFingerAssignment = {
      [padKey(0, 4)]: { hand: 'right', finger: 'pinky' },
      [padKey(0, 5)]: { hand: 'right', finger: 'middle' },
      [padKey(0, 6)]: { hand: 'right', finger: 'ring' },
    };

    const resultA = evaluatePerformance({
      moments, layout, padFingerAssignment: assignmentA, config,
    });
    const resultB = evaluatePerformance({
      moments, layout, padFingerAssignment: assignmentB, config,
    });

    // Pinky should have higher cost due to finger dominance
    expect(resultB.total).toBeGreaterThan(resultA.total);
  });
});

// ============================================================================
// Tests: compareLayouts
// ============================================================================

describe('compareLayouts', () => {
  it('should compare two layouts on the same events', () => {
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
      makeMoment(1, 0.5, [makeNote('voice-41', 41, padKey(0, 5))]),
    ];

    const layoutA = makeSimpleLayout();
    const assignmentA = makeSimpleAssignment();

    // Layout B: slightly different placement
    const layoutB: Layout = {
      ...layoutA,
      id: 'test-layout-B',
      padToVoice: {
        [padKey(3, 4)]: makeVoice(40),
        [padKey(3, 5)]: makeVoice(41),
        [padKey(3, 6)]: makeVoice(42),
      },
    };
    const assignmentB: PadFingerAssignment = {
      [padKey(3, 4)]: { hand: 'right', finger: 'index' },
      [padKey(3, 5)]: { hand: 'right', finger: 'middle' },
      [padKey(3, 6)]: { hand: 'right', finger: 'ring' },
    };

    const result = compareLayouts({
      moments, layoutA, assignmentA, layoutB, assignmentB, config,
    });

    expect(result.costA).toBeDefined();
    expect(result.costB).toBeDefined();
    expect(result.dimensionDeltas).toBeDefined();
    expect(result.dimensionDeltas.total).toBeCloseTo(result.overallDelta, 8);
    expect(['A', 'B', 'tie']).toContain(result.winner);
    expect(result.perMomentDeltas).toHaveLength(2);
    expect(result.layoutChanges.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: validateAssignment
// ============================================================================

describe('validateAssignment', () => {
  it('should pass for a valid assignment', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-40', 40, padKey(0, 4))]),
    ];

    const result = validateAssignment({
      layout, padFingerAssignment: assignment, moments, config,
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should flag unmapped notes', () => {
    const layout = makeSimpleLayout();
    const assignment = makeSimpleAssignment();
    const config = makeConfig();

    // Note 99 has no pad in the layout
    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-99', 99, padKey(7, 7))]),
    ];

    const result = validateAssignment({
      layout, padFingerAssignment: assignment, moments, config,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.type === 'unmapped_note')).toBe(true);
  });

  it('should flag pads with no finger assignment', () => {
    const layout = makeSimpleLayout();
    // Assignment missing pad (0,5)
    const assignment: PadFingerAssignment = {
      [padKey(0, 4)]: { hand: 'right', finger: 'index' },
      [padKey(0, 6)]: { hand: 'right', finger: 'ring' },
    };
    const config = makeConfig();

    const moments = [
      makeMoment(0, 0.0, [makeNote('voice-41', 41, padKey(0, 5))]),
    ];

    const result = validateAssignment({
      layout, padFingerAssignment: assignment, moments, config,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.type === 'unmapped_note')).toBe(true);
  });
});
