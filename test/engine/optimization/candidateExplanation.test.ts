/**
 * "low overall difficulty" is claimed only where the score supports it
 * (S1b.1 "False claim fix"; criterion P1b-7). The TEST MIDI 1 run's check is in
 * testMidi1Integration.test.ts, beside the greedy candidates it already makes.
 */

import { describe, it, expect } from 'vitest';
import { claimsLowOverallDifficulty } from '../../../src/engine/optimization/greedyCandidatePipeline';
import { COMFORTABLE_PLAN_SCORE } from '../../../src/engine';

const plan = (score: number, hardCount = 0, unplayableCount = 0) => ({ score, hardCount, unplayableCount });

describe('claimsLowOverallDifficulty', () => {
  it('never claims it for the hardest candidates (the old score < 5 rule)', () => {
    expect(claimsLowOverallDifficulty(plan(3, 4, 5), [60, 80])).toBe(false);
    expect(claimsLowOverallDifficulty(plan(0), [])).toBe(false);
  });

  it('claims it for a comfortable plan that scores best', () => {
    expect(claimsLowOverallDifficulty(plan(95), [93, 90])).toBe(true);
    expect(claimsLowOverallDifficulty(plan(COMFORTABLE_PLAN_SCORE), [])).toBe(true);
  });

  it('never claims it for a plan below another finalist, or below the comfortable band', () => {
    expect(claimsLowOverallDifficulty(plan(90), [95])).toBe(false);
    expect(claimsLowOverallDifficulty(plan(COMFORTABLE_PLAN_SCORE - 1), [10])).toBe(false);
  });

  it('never claims it with Hard or Unplayable events', () => {
    expect(claimsLowOverallDifficulty(plan(90, 1), [50])).toBe(false);
    expect(claimsLowOverallDifficulty(plan(90, 0, 1), [50])).toBe(false);
  });

  it('claims nothing when every finalist ties', () => {
    expect(claimsLowOverallDifficulty(plan(90), [90, 90])).toBe(false);
  });

  it('uses the UI’s comfortable band', () => {
    expect(COMFORTABLE_PLAN_SCORE).toBe(80);
  });
});
