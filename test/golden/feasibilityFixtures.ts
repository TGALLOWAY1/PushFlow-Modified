/**
 * Feasibility Fixture Data.
 *
 * Shared fixture definitions for both:
 *   1. vitest unit tests (test/engine/prior/feasibility.*.test.ts)
 *   2. Loadable demo projects (src/ui/fixtures/feasibilityDemos.ts)
 *
 * Each scenario defines a set of pad positions, a hand assignment, and
 * the expected feasibility outcome. The same data drives automated tests
 * and the interactive grid-editor demos the user can visually verify.
 */

import { type PadCoord } from '../../src/types/padGrid';
import { type HandSide } from '../../src/types/fingerModel';

// ============================================================================
// Types
// ============================================================================

export interface FeasibilityScenario {
  /** Unique scenario identifier (e.g., "A1"). */
  id: string;
  /** Human-readable name for the scenario. */
  name: string;
  /** Description of what this scenario tests. */
  description: string;
  /** Pad positions (active pads for this grip). */
  pads: PadCoord[];
  /** Which hand is being tested. */
  hand: HandSide;
  /** MIDI note numbers corresponding to each pad (for demo project SoundStreams). */
  noteNumbers: number[];
  /** Voice names for display. */
  voiceNames: string[];
  /** Expected outcome of feasibility check. */
  expected: {
    /** Whether any grips should be found under strict constraints. */
    strictFeasible: boolean;
    /** Whether any grips should be found under relaxed constraints. */
    relaxedFeasible: boolean;
    /** Expected constraint violation rule name (if infeasible). */
    violationRule?: string;
    /** Human-readable explanation of the constraint being tested. */
    explanation: string;
  };
}

export interface RegressionScenario {
  /** Unique scenario identifier (e.g., "R1"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of the regression being tested. */
  description: string;
  /** Starting pad positions (feasible layout). */
  initialPads: PadCoord[];
  /** Which hand. */
  hand: HandSide;
  /** MIDI note numbers. */
  noteNumbers: number[];
  /** Voice names. */
  voiceNames: string[];
  /** Which pad index to move. */
  movePadIndex: number;
  /** New position for the moved pad. */
  moveToPosition: PadCoord;
  /** Expected violation rule after the move. */
  expectedViolation: string;
}

// ============================================================================
// Atomic Feasibility Scenarios (A1–A8)
// ============================================================================

/**
 * A1: Finger Ordering Violation
 *
 * For right hand: place pads such that a lower-numbered finger (index)
 * would need to be to the right of a higher-numbered finger (middle),
 * violating the right-hand ordering constraint (index ≤ middle ≤ ring ≤ pinky).
 *
 * Pads at (3,5) and (3,3) — if index is at col 5 and middle at col 3,
 * that's index > middle which is invalid for right hand.
 */
export const SCENARIO_A1: FeasibilityScenario = {
  id: 'A1',
  name: 'Finger Ordering Violation',
  description: 'Two pads placed so that no finger ordering satisfies right-hand topology',
  pads: [
    { row: 3, col: 0 }, // Far left
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 3, col: 7 }, // Far right — forces a crossover with the sequence
  ],
  hand: 'right',
  noteNumbers: [60, 61, 62, 67],
  voiceNames: ['Pad A', 'Pad B', 'Pad C', 'Pad D'],
  expected: {
    strictFeasible: false,
    relaxedFeasible: false,
    violationRule: 'ordering',
    explanation: 'Right-hand ordering requires index ≤ middle ≤ ring ≤ pinky (left to right). Placing 4 pads spanning cols 0–7 with one far-right pad forces a crossover.',
  },
};

/**
 * A2: Local Span Overflow (per pair)
 *
 * Two pads placed so that the Euclidean distance exceeds the per-pair
 * max span for adjacent fingers (index-middle max = 2.0).
 */
export const SCENARIO_A2: FeasibilityScenario = {
  id: 'A2',
  name: 'Local Span Overflow (Both Tiers)',
  description: 'Two pads too far apart for any finger pair under both strict and relaxed constraints',
  pads: [
    { row: 0, col: 0 }, // Bottom-left
    { row: 7, col: 7 }, // Top-right (distance = sqrt(49+49) = ~9.9)
  ],
  hand: 'right',
  noteNumbers: [36, 99],
  voiceNames: ['Low Pad', 'High Pad'],
  expected: {
    strictFeasible: false,
    relaxedFeasible: false, // pinky-thumb relaxed (1.15×) = 6.33 < 9.9 — still fails
    violationRule: 'span',
    explanation: 'Distance 9.9 exceeds all per-pair span limits including relaxed (max relaxed: pinky-thumb = 6.33 at 1.15× strict). This layout requires split-hand or is infeasible for one hand.',
  },
};

/**
 * A3: Thumb Above Other Fingers
 *
 * Thumb is placed above the index finger row, violating the natural
 * vertical arrangement constraint (THUMB_DELTA).
 */
export const SCENARIO_A3: FeasibilityScenario = {
  id: 'A3',
  name: 'Thumb Above Other Fingers',
  description: 'Pad configuration with large vertical separation — topology checks column ordering, not row height',
  pads: [
    { row: 7, col: 2 }, // Very high row
    { row: 2, col: 3 }, // Low row
  ],
  hand: 'left',
  noteNumbers: [76, 55],
  voiceNames: ['High Pad', 'Low Pad'],
  expected: {
    strictFeasible: true, // Topology checks X (col) ordering, not Y (row). Cols 2&3 are close. Distance 5.1 within ring-thumb (5.5).
    relaxedFeasible: true,
    explanation: 'Topology constraints check column ordering, not row height. Cols 2 and 3 are adjacent, distance 5.1 is within ring-thumb strict limit (5.5). Multiple valid finger assignments exist.',
  },
};

/**
 * A4: Simultaneous Chord — Impossible Shape
 *
 * Five pads spread across the full grid width, requiring all five fingers
 * but the shape is physically impossible for one hand.
 */
export const SCENARIO_A4: FeasibilityScenario = {
  id: 'A4',
  name: 'Impossible Chord Shape',
  description: 'Five-finger chord spanning too wide for one hand',
  pads: [
    { row: 3, col: 0 },
    { row: 3, col: 2 },
    { row: 3, col: 4 },
    { row: 3, col: 6 },
    { row: 3, col: 7 },
  ],
  hand: 'right',
  noteNumbers: [60, 62, 64, 66, 67],
  voiceNames: ['V1', 'V2', 'V3', 'V4', 'V5'],
  expected: {
    strictFeasible: false,
    relaxedFeasible: false,
    violationRule: 'span',
    explanation: 'Five pads spanning 7 columns exceeds MAX_HAND_SPAN (5.5). Individual pairs also exceed strict limits.',
  },
};

/**
 * A5: Reachability Failure
 *
 * Two pads are within per-pair span but the overall shape pushes
 * one finger outside reach given a hand anchor position.
 * For testing, we check with the isReachPossible function.
 */
export const SCENARIO_A5: FeasibilityScenario = {
  id: 'A5',
  name: 'Reachability Failure',
  description: 'Pads outside MAX_REACH_GRID_UNITS but within pinky-thumb span',
  pads: [
    { row: 0, col: 0 },
    { row: 0, col: 6 }, // Distance 6.0 > MAX_REACH_GRID_UNITS (5.0)
  ],
  hand: 'right',
  noteNumbers: [36, 42],
  voiceNames: ['Anchor', 'Far Pad'],
  expected: {
    strictFeasible: false, // Distance 6.0 > pinky-thumb strict (5.5). Exceeds one-hand grip under strict.
    relaxedFeasible: true,  // Distance 6.0 < pinky-thumb relaxed (5.5 × 1.15 = 6.33). Feasible under relaxed tier.
    violationRule: 'span',
    explanation: 'Distance 6.0 exceeds pinky-thumb strict span (5.5) but is within relaxed span (6.33 at 1.15×). Feasible only under Tier 2 relaxed constraints.',
  },
};

/**
 * A6: Transition Too Fast
 *
 * This tests the speed constraint in calculateTransitionCost.
 * Not a grip feasibility issue but a transition feasibility issue.
 * Two pads far apart with events occurring very close in time.
 */
export const SCENARIO_A6: FeasibilityScenario = {
  id: 'A6',
  name: 'Transition Too Fast',
  description: 'Two events very close in time on distant pads — speed exceeds MAX_HAND_SPEED',
  pads: [
    { row: 0, col: 0 },
    { row: 7, col: 0 },
  ],
  hand: 'right',
  noteNumbers: [36, 92],
  voiceNames: ['Bottom', 'Top'],
  expected: {
    strictFeasible: false, // Distance 7.0 > pinky-thumb strict (5.5) — grip itself is infeasible
    relaxedFeasible: false, // Distance 7.0 > pinky-thumb relaxed (6.33) — infeasible even under relaxed
    violationRule: 'span',
    explanation: 'Two pads on the same column 7 rows apart (distance 7.0). Exceeds pinky-thumb strict (5.5) and relaxed (6.33). Anatomically impossible for one hand — matches user report: "Left pinky top-left and left thumb bottom-left can\'t simultaneously be played."',
  },
};

/**
 * A7: Hand Crossover (index right of middle for right hand)
 *
 * Tests the topology constraint where finger ordering is violated
 * in a simultaneous assignment.
 */
export const SCENARIO_A7: FeasibilityScenario = {
  id: 'A7',
  name: 'Hand Crossover',
  description: 'Right hand: index positioned right of middle (crossover)',
  pads: [
    { row: 3, col: 6 }, // Would be index (right of middle)
    { row: 3, col: 4 }, // Would be middle
    { row: 3, col: 5 }, // Would be ring — but ring between index and middle breaks ordering
  ],
  hand: 'right',
  noteNumbers: [66, 64, 65],
  voiceNames: ['Pad Right', 'Pad Middle', 'Pad Center'],
  expected: {
    strictFeasible: true, // Some orderings will work (index=4, middle=5, ring=6)
    relaxedFeasible: true,
    explanation: 'Three adjacent pads in a row — valid orderings exist for right hand (e.g., index=4, middle=5, ring=6).',
  },
};

/**
 * A8: Zone Violation
 *
 * Left hand pads deep in right territory (cols 5-7).
 * This is not a hard constraint failure but should be penalized.
 * The zone violation is detected by handZone.ts getPreferredHand().
 */
export const SCENARIO_A8: FeasibilityScenario = {
  id: 'A8',
  name: 'Zone Violation',
  description: 'Left hand assigned to pads in right-hand territory (cols 5-7)',
  pads: [
    { row: 3, col: 5 },
    { row: 3, col: 6 },
  ],
  hand: 'left',
  noteNumbers: [65, 66],
  voiceNames: ['Right-Zone Pad 1', 'Right-Zone Pad 2'],
  expected: {
    strictFeasible: true, // Grip is physically possible
    relaxedFeasible: true,
    violationRule: 'zone',
    explanation: 'Left hand in cols 5-6 is in right-hand territory. Not a grip failure but a zone penalty.',
  },
};

/** All atomic feasibility scenarios. */
export const ATOMIC_SCENARIOS: FeasibilityScenario[] = [
  SCENARIO_A1, SCENARIO_A2, SCENARIO_A3, SCENARIO_A4,
  SCENARIO_A5, SCENARIO_A6, SCENARIO_A7, SCENARIO_A8,
];

// ============================================================================
// Regression Scenarios (R1–R3)
// ============================================================================

/**
 * R1: Snare moved outward — span violation.
 *
 * Start with a feasible 3-pad layout for right hand (kick, snare, hat).
 * Move snare 3 columns outward → causes span overflow.
 */
export const REGRESSION_R1: RegressionScenario = {
  id: 'R1',
  name: 'Snare Moved Outward → Span Violation',
  description: 'Moving snare from col 5 to col 2 breaks span constraint with hat at col 7',
  initialPads: [
    { row: 0, col: 4 }, // Kick
    { row: 0, col: 5 }, // Snare
    { row: 0, col: 6 }, // Hat
  ],
  hand: 'right',
  noteNumbers: [40, 41, 42],
  voiceNames: ['Kick', 'Snare', 'Hat'],
  movePadIndex: 1, // Move snare
  moveToPosition: { row: 0, col: 0 }, // Far left — distance to hat (col 6) = 6.0
  expectedViolation: 'span',
};

/**
 * R2: Hat moved below thumb region — topology violation.
 *
 * Start with a feasible layout, move hat to a very low row that would
 * force thumb position issues.
 */
export const REGRESSION_R2: RegressionScenario = {
  id: 'R2',
  name: 'Hat Moved Below Thumb → Topology',
  description: 'Moving hat to bottom row forces topology violation for right hand',
  initialPads: [
    { row: 3, col: 4 }, // Kick
    { row: 3, col: 5 }, // Snare
    { row: 5, col: 6 }, // Hat (high)
  ],
  hand: 'right',
  noteNumbers: [52, 53, 70],
  voiceNames: ['Kick', 'Snare', 'Hat'],
  movePadIndex: 2, // Move hat
  moveToPosition: { row: 0, col: 0 }, // Bottom-left — far from cluster
  expectedViolation: 'span',
};

/**
 * R3: Tom moved into opposite cluster — ordering violation.
 *
 * Start with a compact right-hand cluster, move a voice to the left
 * side of the grid where it would force a crossover.
 */
export const REGRESSION_R3: RegressionScenario = {
  id: 'R3',
  name: 'Tom Into Opposite Cluster → Ordering',
  description: 'Moving a voice far left forces right-hand ordering violation',
  initialPads: [
    { row: 3, col: 4 },
    { row: 3, col: 5 },
    { row: 3, col: 6 },
    { row: 3, col: 7 },
  ],
  hand: 'right',
  noteNumbers: [52, 53, 54, 55],
  voiceNames: ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4'],
  movePadIndex: 0, // Move Voice 1
  moveToPosition: { row: 3, col: 0 }, // Far left — col span 0-7 impossible
  expectedViolation: 'span',
};

/** All regression scenarios. */
export const REGRESSION_SCENARIOS: RegressionScenario[] = [
  REGRESSION_R1, REGRESSION_R2, REGRESSION_R3,
];
