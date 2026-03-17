/**
 * Validator Engine Tests.
 *
 * Proves the evaluation bridge works independently of the beam solver.
 */

import { describe, it, expect } from 'vitest';
import { runValidation, buildEvaluationConfig } from '../../src/ui/validator/validatorEngine';
import { getValidatorScenario } from '../../src/ui/validator/validatorScenarios';
import { padKey } from '../../src/types/padGrid';
import { type Layout } from '../../src/types/layout';
import { type Voice } from '../../src/types/voice';

function makeVoice(id: string, noteNumber: number): Voice {
  return { id, name: `Sound ${noteNumber}`, sourceType: 'midi_track', sourceFile: '', originalMidiNote: noteNumber, color: '#fff' };
}

describe('buildEvaluationConfig', () => {
  it('should produce a valid EvaluationConfig', () => {
    const layout: Layout = {
      id: 'test', name: 'Test', padToVoice: {
        [padKey(3, 4)]: makeVoice('v1', 64),
      },
      fingerConstraints: {}, placementLocks: {}, scoreCache: null, role: 'active',
    };
    const config = buildEvaluationConfig(layout);
    expect(config.restingPose).toBeDefined();
    expect(config.stiffness).toBe(0.3);
    expect(config.instrumentConfig.rows).toBe(8);
    expect(config.instrumentConfig.cols).toBe(8);
    expect(config.neutralHandCenters).toBeDefined();
  });
});

describe('runValidation', () => {
  it('should detect span violation (V2)', () => {
    const scenario = getValidatorScenario('V2')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'span')).toBe(true);
    const spanEvidence = result.evidence.find(e => e.constraintId === 'span');
    expect(spanEvidence?.fingers).toContain('index');
    expect(spanEvidence?.fingers).toContain('middle');
    expect(spanEvidence?.measuredValue).toBeGreaterThan(2.0);
  });

  it('should detect ordering violation (V4)', () => {
    const scenario = getValidatorScenario('V4')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'ordering')).toBe(true);
  });

  it('should detect thumb delta violation (V5)', () => {
    const scenario = getValidatorScenario('V5')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'thumbDelta')).toBe(true);
    const thumbEvidence = result.evidence.find(e => e.constraintId === 'thumbDelta');
    expect(thumbEvidence?.measuredValue).toBeGreaterThan(1.0);
  });

  it('should detect collision / same-finger conflict (V1)', () => {
    const scenario = getValidatorScenario('V1')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'collision')).toBe(true);
  });

  it('should detect span reachability violation (V6)', () => {
    const scenario = getValidatorScenario('V6')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'span')).toBe(true);
  });

  it('should detect unmapped note (V7)', () => {
    const scenario = getValidatorScenario('V7')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
  });

  it('should detect missing assignment (V8)', () => {
    const scenario = getValidatorScenario('V8')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('violation');
    expect(result.evidence.some(e => e.constraintId === 'missing_assignment')).toBe(true);
  });

  it('should mark valid scenario as valid (V3)', () => {
    const scenario = getValidatorScenario('V3')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('valid');
    expect(result.evidence).toHaveLength(0);
    expect(result.dimensions.total).toBeGreaterThanOrEqual(0);
  });

  it('should mark valid-but-degraded as valid (V9)', () => {
    const scenario = getValidatorScenario('V9')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('valid');
    expect(result.dimensions.poseNaturalness).toBeGreaterThanOrEqual(0);
  });

  it('should mark dense valid cluster as valid (V10)', () => {
    const scenario = getValidatorScenario('V10')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.status).toBe('valid');
    expect(result.evidence).toHaveLength(0);
  });

  it('should include CostDimensions in result', () => {
    const scenario = getValidatorScenario('V10')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.dimensions).toBeDefined();
    expect(typeof result.dimensions.poseNaturalness).toBe('number');
    expect(typeof result.dimensions.transitionCost).toBe('number');
    expect(typeof result.dimensions.constraintPenalty).toBe('number');
    expect(typeof result.dimensions.alternation).toBe('number');
    expect(typeof result.dimensions.handBalance).toBe('number');
    expect(typeof result.dimensions.total).toBe('number');
  });

  it('should include poseDetail in result', () => {
    const scenario = getValidatorScenario('V10')!;
    const result = runValidation(scenario.layout, scenario.padFingerAssignment, scenario.moment);
    expect(result.poseDetail).toBeDefined();
    expect(typeof result.poseDetail.attractor).toBe('number');
    expect(typeof result.poseDetail.perFingerHome).toBe('number');
    expect(typeof result.poseDetail.fingerDominance).toBe('number');
  });
});
