/**
 * Tests for Event and Finger Constraint Corrections.
 *
 * Validates:
 * - Canonical event construction (moment grouping)
 * - Pad-to-finger ownership extraction and validation
 * - Moment-level cost (not divided per-note)
 */

import { describe, it, expect } from 'vitest';
import {
  buildPerformanceMoments,
  extractPadOwnership,
  validatePadOwnershipConsistency,
} from '../../../src/engine/structure/momentBuilder';
import { MOMENT_EPSILON } from '../../../src/types/performanceEvent';
import type { PerformanceEvent } from '../../../src/types/performanceEvent';
import type { FingerAssignment } from '../../../src/types/executionPlan';

// ============================================================================
// Event Construction Tests
// ============================================================================

describe('buildPerformanceMoments', () => {
  it('single note at timestamp 0.5 → one moment with one note', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.5 },
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments).toHaveLength(1);
    expect(moments[0].notes).toHaveLength(1);
    expect(moments[0].startTime).toBe(0.5);
    expect(moments[0].momentIndex).toBe(0);
  });

  it('three simultaneous notes at timestamp 0.5 → one moment with 3 notes', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.5 },
      { noteNumber: 62, startTime: 0.5 },
      { noteNumber: 64, startTime: 0.5 },
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments).toHaveLength(1);
    expect(moments[0].notes).toHaveLength(3);
  });

  it('notes within epsilon are grouped', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.500 },
      { noteNumber: 62, startTime: 0.5008 }, // within 0.001s
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments).toHaveLength(1);
    expect(moments[0].notes).toHaveLength(2);
  });

  it('notes outside epsilon are separate moments', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.5 },
      { noteNumber: 62, startTime: 0.6 },
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments).toHaveLength(2);
    expect(moments[0].notes).toHaveLength(1);
    expect(moments[1].notes).toHaveLength(1);
  });

  it('mixed — chord then single note', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.5 },
      { noteNumber: 62, startTime: 0.5 },
      { noteNumber: 64, startTime: 1.0 },
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments).toHaveLength(2);
    expect(moments[0].notes).toHaveLength(2);
    expect(moments[1].notes).toHaveLength(1);
  });

  it('empty input → empty output', () => {
    const moments = buildPerformanceMoments([]);
    expect(moments).toHaveLength(0);
  });

  it('moment indices are sequential', () => {
    const events: PerformanceEvent[] = [
      { noteNumber: 60, startTime: 0.0 },
      { noteNumber: 62, startTime: 0.5 },
      { noteNumber: 64, startTime: 1.0 },
    ];
    const moments = buildPerformanceMoments(events);

    expect(moments[0].momentIndex).toBe(0);
    expect(moments[1].momentIndex).toBe(1);
    expect(moments[2].momentIndex).toBe(2);
  });

  it('MOMENT_EPSILON is 0.001', () => {
    expect(MOMENT_EPSILON).toBe(0.001);
  });
});

// ============================================================================
// Finger Ownership Tests
// ============================================================================

function makeAssignment(overrides: Partial<FingerAssignment>): FingerAssignment {
  return {
    noteNumber: 60,
    startTime: 0,
    assignedHand: 'left',
    finger: 'index',
    cost: 1.0,
    difficulty: 'Easy',
    padId: '2,3',
    row: 2,
    col: 3,
    ...overrides,
  };
}

describe('extractPadOwnership', () => {
  it('produces correct map for consistent assignments', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 0 }),
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 0.5 }),
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 1.0 }),
      makeAssignment({ padId: '4,5', assignedHand: 'right', finger: 'middle', startTime: 0 }),
    ];

    const { ownership, violations } = extractPadOwnership(assignments);

    expect(violations).toHaveLength(0);
    expect(ownership['2,3']).toEqual({ hand: 'left', finger: 'index' });
    expect(ownership['4,5']).toEqual({ hand: 'right', finger: 'middle' });
  });

  it('detects violation when same pad assigned to different fingers', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 0 }),
      makeAssignment({ padId: '2,3', assignedHand: 'right', finger: 'middle', startTime: 0.5 }),
    ];

    const { violations } = extractPadOwnership(assignments);

    expect(violations).toHaveLength(1);
    expect(violations[0].padKey).toBe('2,3');
    expect(violations[0].fingers).toHaveLength(2);
  });

  it('skips unplayable assignments', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'Unplayable', finger: null }),
    ];

    const { ownership } = extractPadOwnership(assignments);
    expect(Object.keys(ownership)).toHaveLength(0);
  });
});

describe('validatePadOwnershipConsistency', () => {
  it('returns valid for consistent assignments', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index' }),
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 0.5 }),
    ];

    const result = validatePadOwnershipConsistency(assignments);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns invalid for inconsistent assignments', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index', startTime: 0 }),
      makeAssignment({ padId: '2,3', assignedHand: 'right', finger: 'middle', startTime: 0.5 }),
    ];

    const result = validatePadOwnershipConsistency(assignments);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it('different pads can have different fingers (valid)', () => {
    const assignments: FingerAssignment[] = [
      makeAssignment({ padId: '2,3', assignedHand: 'left', finger: 'index' }),
      makeAssignment({ padId: '4,5', assignedHand: 'right', finger: 'middle' }),
    ];

    const result = validatePadOwnershipConsistency(assignments);
    expect(result.valid).toBe(true);
  });
});
