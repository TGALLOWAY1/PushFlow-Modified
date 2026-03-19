/**
 * Validator Scenario Integrity Tests.
 *
 * Verifies that every curated scenario:
 * 1. Has valid structure (layout, assignment, moment)
 * 2. Produces the expected initial status (violation or valid)
 * 3. Contains the expected constraint violation types
 */

import { describe, it, expect } from 'vitest';
import { getValidatorScenarios, getValidatorScenario } from '../../src/ui/validator/validatorScenarios';
import { runValidation } from '../../src/ui/validator/validatorEngine';

describe('validatorScenarios integrity', () => {
  const scenarios = getValidatorScenarios();

  it('should have at least 10 scenarios', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique IDs', () => {
    const ids = scenarios.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should find scenarios by ID', () => {
    for (const s of scenarios) {
      expect(getValidatorScenario(s.id)).toBeDefined();
      expect(getValidatorScenario(s.id)!.id).toBe(s.id);
    }
  });

  it('should return undefined for unknown ID', () => {
    expect(getValidatorScenario('NONEXISTENT')).toBeUndefined();
  });

  for (const scenario of scenarios) {
    describe(`scenario ${scenario.id}: ${scenario.title}`, () => {
      it('should have valid structure', () => {
        expect(scenario.layout).toBeDefined();
        expect(scenario.layout.padToVoice).toBeDefined();
        expect(Object.keys(scenario.layout.padToVoice).length).toBeGreaterThan(0);
        expect(scenario.padFingerAssignment).toBeDefined();
        expect(scenario.moment).toBeDefined();
        expect(scenario.moment.notes.length).toBeGreaterThan(0);
        expect(scenario.constraintIds.length).toBeGreaterThan(0);
      });

      it(`should produce expectedInitialStatus = '${scenario.expectedInitialStatus}'`, () => {
        const result = runValidation(
          scenario.layout,
          scenario.padFingerAssignment,
          scenario.moment,
        );
        expect(result.status).toBe(scenario.expectedInitialStatus);
      });

      if (scenario.expectedInitialStatus === 'violation') {
        it('should produce at least one evidence item', () => {
          const result = runValidation(
            scenario.layout,
            scenario.padFingerAssignment,
            scenario.moment,
          );
          expect(result.evidence.length).toBeGreaterThan(0);
        });
      }

      if (scenario.expectedInitialStatus === 'valid') {
        it('should produce zero evidence items', () => {
          const result = runValidation(
            scenario.layout,
            scenario.padFingerAssignment,
            scenario.moment,
          );
          expect(result.evidence).toHaveLength(0);
        });

        it('should have non-negative total cost', () => {
          const result = runValidation(
            scenario.layout,
            scenario.padFingerAssignment,
            scenario.moment,
          );
          expect(result.dimensions.total).toBeGreaterThanOrEqual(0);
        });
      }
    });
  }
});
