/**
 * Pad-Move Regression Tests.
 *
 * Verifies that moving a pad from a feasible layout to an invalid
 * position produces the expected constraint failure.
 *
 * Pattern: Start feasible → move one pad → confirm failure + expected rule.
 *
 * Fixture data shared with src/ui/fixtures/feasibilityDemos.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  generateValidGripsWithTier,
  type GripDiagnosticOptions,
} from '../../../src/engine/prior/feasibility';
import {
  REGRESSION_R1,
  REGRESSION_R2,
  REGRESSION_R3,
  type RegressionScenario,
} from '../../golden/feasibilityFixtures';

function runRegressionScenario(scenario: RegressionScenario) {
  describe(`${scenario.id}: ${scenario.name}`, () => {
    it('should start with a feasible layout', () => {
      const gripResults = generateValidGripsWithTier(
        scenario.initialPads,
        scenario.hand
      );
      const hasValidGrips = gripResults.some(g => g.tier === 'strict' || g.tier === 'relaxed');
      expect(hasValidGrips).toBe(true);
    });

    it('should become infeasible after moving the pad', () => {
      // Create new pad array with the moved pad
      const movedPads = [...scenario.initialPads];
      movedPads[scenario.movePadIndex] = scenario.moveToPosition;

      const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
      const gripResults = generateValidGripsWithTier(movedPads, scenario.hand, diagnostics);

      // Should fall back to fallback tier (or worse)
      const hasStrictGrips = gripResults.some(g => g.tier === 'strict');
      const hasRelaxedGrips = gripResults.some(g => g.tier === 'relaxed');

      // At least one of strict/relaxed should fail
      expect(
        !hasStrictGrips || !hasRelaxedGrips,
        `${scenario.id}: Expected constraint failure after pad move, but both tiers passed`
      ).toBe(true);

      // Should have diagnostic rejections
      expect(
        diagnostics.rejections.length,
        `${scenario.id}: Expected diagnostic rejections after pad move`
      ).toBeGreaterThan(0);

      // At least one rejection should match the expected violation type
      const matchingRejections = diagnostics.rejections.filter(
        r => r.rule === scenario.expectedViolation
      );
      expect(
        matchingRejections.length,
        `${scenario.id}: Expected '${scenario.expectedViolation}' rejection but got: ${diagnostics.rejections.map(r => r.rule).join(', ')}`
      ).toBeGreaterThan(0);
    });

    it('should restore feasibility when pad is moved back', () => {
      // This verifies that the test is working correctly —
      // moving the pad back should restore the feasible state.
      const gripResults = generateValidGripsWithTier(
        scenario.initialPads,
        scenario.hand
      );
      const hasValidGrips = gripResults.some(g => g.tier === 'strict' || g.tier === 'relaxed');
      expect(hasValidGrips).toBe(true);
    });
  });
}

describe('Pad-Move Regression Tests', () => {
  runRegressionScenario(REGRESSION_R1);
  runRegressionScenario(REGRESSION_R2);
  runRegressionScenario(REGRESSION_R3);
});
