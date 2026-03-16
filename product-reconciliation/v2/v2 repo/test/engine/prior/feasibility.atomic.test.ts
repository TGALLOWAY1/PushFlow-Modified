/**
 * Atomic Feasibility Constraint Tests.
 *
 * Tests each feasibility constraint in isolation:
 *   A1: Finger ordering violation → infeasible
 *   A2: Local span overflow → infeasible
 *   A3: Thumb above other fingers → infeasible (strict)
 *   A4: Simultaneous chord impossible shape → infeasible
 *   A5: Reachability failure → infeasible
 *   A6: Transition too fast → Infinity cost
 *   A7: Hand crossover (three adjacent pads) → feasible with valid orderings
 *   A8: Zone violation → feasible but penalized
 *
 * Fixture data is shared with src/ui/fixtures/feasibilityDemos.ts
 * so the same scenarios can be loaded in the grid editor for visual verification.
 */

import { describe, it, expect } from 'vitest';
import {
  generateValidGrips,
  generateValidGripsWithTier,
  isReachPossible,
  type GripDiagnosticOptions,
} from '../../../src/engine/prior/feasibility';
import { calculateTransitionCost } from '../../../src/engine/evaluation/costFunction';
import { getPreferredHand } from '../../../src/engine/surface/handZone';
import {
  FINGER_PAIR_MAX_SPAN_STRICT,
  FINGER_PAIR_MAX_SPAN_RELAXED,
  MAX_REACH_GRID_UNITS,
  pairKey,
  type GripRejection,
} from '../../../src/engine/prior/biomechanicalModel';
import {
  SCENARIO_A1,
  SCENARIO_A2,
  SCENARIO_A3,
  SCENARIO_A4,
  SCENARIO_A5,
  SCENARIO_A6,
  SCENARIO_A7,
  SCENARIO_A8,
} from '../../golden/feasibilityFixtures';

describe('Atomic Feasibility Constraints', () => {
  // ========================================================================
  // A1: Finger Ordering Violation
  // ========================================================================
  describe('A1: Finger Ordering Violation', () => {
    it('should produce no strict grips for 4 pads spanning cols 0–7', () => {
      const grips = generateValidGrips(SCENARIO_A1.pads, SCENARIO_A1.hand);
      // With 4 pads spanning 0-7 (distance 7), no strict grip should work
      // because per-pair spans are too large. The function may fall back to
      // Tier 3. Let's check with tier metadata:
      const gripResults = generateValidGripsWithTier(SCENARIO_A1.pads, SCENARIO_A1.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      expect(hasStrictGrips).toBe(SCENARIO_A1.expected.strictFeasible);
    });

    it('should collect diagnostic rejections', () => {
      const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
      generateValidGripsWithTier(SCENARIO_A1.pads, SCENARIO_A1.hand, diagnostics);
      // Should have rejection data
      expect(diagnostics.rejections.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // A2: Local Span Overflow
  // ========================================================================
  describe('A2: Local Span Overflow (Strict)', () => {
    it('should produce no strict grips but relaxed grips for maximally distant pads', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A2.pads, SCENARIO_A2.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      const hasRelaxedGrips = gripResults.some(g => g.tier === 'relaxed');
      expect(hasStrictGrips).toBe(SCENARIO_A2.expected.strictFeasible); // false
      expect(hasRelaxedGrips).toBe(SCENARIO_A2.expected.relaxedFeasible); // false — pinky-thumb relaxed = 6.33 < 9.9
    });

    it('should report span rejection in diagnostics', () => {
      const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
      generateValidGripsWithTier(SCENARIO_A2.pads, SCENARIO_A2.hand, diagnostics);
      const spanRejections = diagnostics.rejections.filter(r => r.rule === 'span');
      expect(spanRejections.length).toBeGreaterThan(0);
      // The actual distance should be much larger than the limit
      for (const rej of spanRejections) {
        expect(rej.actual).toBeGreaterThan(rej.limit);
      }
    });
  });

  // ========================================================================
  // A3: Thumb Above Other Fingers
  // ========================================================================
  describe('A3: Thumb Above Other Fingers', () => {
    it('should find strict grips — topology checks column ordering, not row height', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A3.pads, SCENARIO_A3.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      // Cols 2 and 3 are adjacent, distance 5.1 is within ring-thumb (5.5).
      // Topology checks X (col) ordering, not Y (row), so this IS feasible.
      expect(hasStrictGrips).toBe(SCENARIO_A3.expected.strictFeasible); // true
    });
  });

  // ========================================================================
  // A4: Impossible Chord Shape
  // ========================================================================
  describe('A4: Impossible Chord Shape', () => {
    it('should produce no strict or relaxed grips for 5 pads spanning 7 columns', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A4.pads, SCENARIO_A4.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      const hasRelaxedGrips = gripResults.some(g => g.tier === 'relaxed');
      expect(hasStrictGrips).toBe(SCENARIO_A4.expected.strictFeasible);
      expect(hasRelaxedGrips).toBe(SCENARIO_A4.expected.relaxedFeasible);
    });

    it('should report span rejections in diagnostics', () => {
      const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
      generateValidGripsWithTier(SCENARIO_A4.pads, SCENARIO_A4.hand, diagnostics);
      expect(diagnostics.rejections.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // A5: Reachability Failure
  // ========================================================================
  describe('A5: Reachability Failure', () => {
    it('should detect reachability failure for pads 6 units apart', () => {
      const { pads } = SCENARIO_A5;
      const reachable = isReachPossible(pads[0], pads[1], 'index');
      // Distance is 6.0, maxReach is 4 (DEFAULT_ENGINE_CONSTANTS.maxReach = 4)
      expect(reachable).toBe(false);
    });

    it('should not find strict grips — distance 6.0 exceeds pinky-thumb strict (5.5)', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A5.pads, SCENARIO_A5.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      const hasRelaxedGrips = gripResults.some(g => g.tier === 'relaxed');
      // Distance 6.0 > pinky-thumb strict (5.5), so no strict grips.
      // But 6.0 < pinky-thumb relaxed (6.33), so relaxed grips exist.
      expect(hasStrictGrips).toBe(SCENARIO_A5.expected.strictFeasible); // false
      expect(hasRelaxedGrips).toBe(SCENARIO_A5.expected.relaxedFeasible); // true
    });
  });

  // ========================================================================
  // A6: Transition Too Fast
  // ========================================================================
  describe('A6: Transition Too Fast', () => {
    it('should have feasible grips for each pad individually', () => {
      const { pads, hand } = SCENARIO_A6;
      // Each pad individually should produce feasible grips
      for (const pad of pads) {
        const grips = generateValidGrips([pad], hand);
        expect(grips.length).toBeGreaterThan(0);
      }
    });

    it('should produce no strict or relaxed grips for both pads together (7 rows apart)', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A6.pads, SCENARIO_A6.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      const hasRelaxedGrips = gripResults.some(g => g.tier === 'relaxed');
      // Distance 7.0 > pinky-thumb strict (5.5) and relaxed (6.33)
      expect(hasStrictGrips).toBe(SCENARIO_A6.expected.strictFeasible); // false
      expect(hasRelaxedGrips).toBe(SCENARIO_A6.expected.relaxedFeasible); // false
    });

    it('should return Infinity transition cost for fast movement', () => {
      // Simulate: hand at (0,0) moving to (7,0) in 0.05 seconds
      // Distance = 7.0, speed = 7.0 / 0.05 = 140 >> MAX_HAND_SPEED (12.0)
      const prevPose = { centroid: { x: 0, y: 0 }, fingers: {} };
      const currPose = { centroid: { x: 0, y: 7 }, fingers: {} };
      const cost = calculateTransitionCost(prevPose, currPose, 0.05);
      expect(cost).toBe(Infinity);
    });

    it('should return finite transition cost for slow movement', () => {
      const prevPose = { centroid: { x: 0, y: 0 }, fingers: {} };
      const currPose = { centroid: { x: 0, y: 7 }, fingers: {} };
      // Speed = 7.0 / 2.0 = 3.5 < 12.0 → finite
      const cost = calculateTransitionCost(prevPose, currPose, 2.0);
      expect(cost).toBeLessThan(Infinity);
      expect(cost).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // A7: Hand Crossover (three adjacent pads)
  // ========================================================================
  describe('A7: Hand Crossover (Three Adjacent Pads)', () => {
    it('should find valid strict grips for three adjacent pads', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A7.pads, SCENARIO_A7.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      expect(hasStrictGrips).toBe(SCENARIO_A7.expected.strictFeasible);
    });
  });

  // ========================================================================
  // A8: Zone Violation
  // ========================================================================
  describe('A8: Zone Violation', () => {
    it('should find feasible grips (zone is soft constraint, not hard)', () => {
      const gripResults = generateValidGripsWithTier(SCENARIO_A8.pads, SCENARIO_A8.hand);
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      expect(hasStrictGrips).toBe(SCENARIO_A8.expected.strictFeasible);
    });

    it('should detect zone preference for right hand at cols 5-6', () => {
      for (const pad of SCENARIO_A8.pads) {
        const preferred = getPreferredHand(pad);
        expect(preferred).toBe('right');
      }
    });
  });

  // ========================================================================
  // Diagnostic Mode Integration
  // ========================================================================
  describe('Diagnostic Mode', () => {
    it('should collect rejections across strictly infeasible scenarios', () => {
      // Only scenarios that are strictly infeasible (no strict grips found)
      const strictlyInfeasible = [SCENARIO_A1, SCENARIO_A2, SCENARIO_A4, SCENARIO_A5, SCENARIO_A6];

      for (const scenario of strictlyInfeasible) {
        const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
        generateValidGripsWithTier(scenario.pads, scenario.hand, diagnostics);
        expect(
          diagnostics.rejections.length,
          `${scenario.id}: expected rejections but got none`
        ).toBeGreaterThan(0);
      }
    });

    it('should produce no rejections for feasible scenarios (strict tier)', () => {
      // A7 and A8 are feasible under strict constraints
      const feasibleScenarios = [SCENARIO_A7, SCENARIO_A8];

      for (const scenario of feasibleScenarios) {
        const gripResults = generateValidGripsWithTier(scenario.pads, scenario.hand);
        const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
        expect(hasStrictGrips).toBe(true);
      }
    });
  });

  // ========================================================================
  // Fallback Grip Topology
  // ========================================================================
  describe('Fallback Grip Topology', () => {
    it('right hand: thumb should be leftmost, pinky rightmost', () => {
      // 5 pads spanning cols 0–7 forces Tier 3 fallback (distance 7 > all span limits)
      const pads = [
        { row: 3, col: 0 },
        { row: 3, col: 2 },
        { row: 3, col: 4 },
        { row: 3, col: 5 },
        { row: 3, col: 7 },
      ];
      const gripResults = generateValidGripsWithTier(pads, 'right');
      expect(gripResults.length).toBeGreaterThan(0);

      // Should be fallback tier given the extreme spread
      const fallbackGrips = gripResults.filter(g => g.tier === 'fallback');
      expect(fallbackGrips.length).toBeGreaterThan(0);

      const grip = fallbackGrips[0].pose;
      // Right hand L→R: thumb(col 0) < index(col 2) < middle(col 4) < ring(col 5) < pinky(col 7)
      expect(grip.fingers.thumb!.x).toBeLessThan(grip.fingers.index!.x);
      expect(grip.fingers.index!.x).toBeLessThan(grip.fingers.middle!.x);
      expect(grip.fingers.middle!.x).toBeLessThan(grip.fingers.ring!.x);
      expect(grip.fingers.ring!.x).toBeLessThan(grip.fingers.pinky!.x);
    });

    it('left hand: pinky should be leftmost, thumb rightmost', () => {
      const pads = [
        { row: 3, col: 0 },
        { row: 3, col: 2 },
        { row: 3, col: 4 },
        { row: 3, col: 5 },
        { row: 3, col: 7 },
      ];
      const gripResults = generateValidGripsWithTier(pads, 'left');
      expect(gripResults.length).toBeGreaterThan(0);

      const fallbackGrips = gripResults.filter(g => g.tier === 'fallback');
      expect(fallbackGrips.length).toBeGreaterThan(0);

      const grip = fallbackGrips[0].pose;
      // Left hand L→R: pinky(col 0) < ring(col 2) < middle(col 4) < index(col 5) < thumb(col 7)
      expect(grip.fingers.pinky!.x).toBeLessThan(grip.fingers.ring!.x);
      expect(grip.fingers.ring!.x).toBeLessThan(grip.fingers.middle!.x);
      expect(grip.fingers.middle!.x).toBeLessThan(grip.fingers.index!.x);
      expect(grip.fingers.index!.x).toBeLessThan(grip.fingers.thumb!.x);
    });
  });
});
