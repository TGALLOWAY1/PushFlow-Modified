/**
 * computePlanScore: the formula behind every Score (Playability), checked on
 * its own. It must stay informative on long and dense performances: hard events
 * count as a share of the events, unplayable events one by one, and the cost
 * term keeps ranking however high the cost per event goes.
 */

import { describe, it, expect } from 'vitest';
import { computePlanScore, ergonomicPenalty, PLAN_SCORE_WEIGHTS } from '../../../src/engine/evaluation/planScore';

const { hardEventPercent, unplayableEvent, ergonomicCap, ergonomicHalfCapCost } = PLAN_SCORE_WEIGHTS;

describe('computePlanScore', () => {
  it('scores a clean, costless plan 100', () => {
    expect(computePlanScore({ hardCount: 0, unplayableCount: 0, eventCount: 32 })).toBe(100);
  });

  it('counts hard events as a share: the same density scores the same at any length', () => {
    const loop = computePlanScore({ hardCount: 2, unplayableCount: 0, eventCount: 32, avgErgonomicCost: 3 });
    const song = computePlanScore({ hardCount: 50, unplayableCount: 0, eventCount: 800, avgErgonomicCost: 3 });
    expect(song).toBeCloseTo(loop, 9);
    // 2 of 32 events is 6.25%.
    expect(computePlanScore({ hardCount: 2, unplayableCount: 0, eventCount: 32 })).toBeCloseTo(100 - hardEventPercent * 6.25, 9);
    // A whole song with a few strained grips is not marked down as if it were all strain:
    // 9 of 696 events was 45 points as a count (−5 each); as a share it is under 3.
    expect(100 - computePlanScore({ hardCount: 9, unplayableCount: 0, eventCount: 696 })).toBeLessThan(3);
  });

  it('counts each unplayable event in full, however long the performance', () => {
    const short = computePlanScore({ hardCount: 0, unplayableCount: 1, eventCount: 32 });
    const long = computePlanScore({ hardCount: 0, unplayableCount: 1, eventCount: 1000 });
    expect(short).toBe(100 - unplayableEvent);
    expect(long).toBe(short);
  });

  it('takes half its cap at the half-cap cost, rises ever more slowly, and never reaches the cap', () => {
    expect(ergonomicPenalty(0)).toBe(0);
    expect(ergonomicPenalty(ergonomicHalfCapCost)).toBeCloseTo(ergonomicCap / 2, 9);
    const costs = [0.5, 1, 2, 3.4, 5, 7.5, 10, 18, 100];
    const penalties = costs.map(ergonomicPenalty);
    for (let i = 1; i < penalties.length; i++) {
      expect(penalties[i]).toBeGreaterThan(penalties[i - 1]);
      // Concave: each step buys less per unit of cost than the one before.
      const slope = (penalties[i] - penalties[i - 1]) / (costs[i] - costs[i - 1]);
      if (i > 1) expect(slope).toBeLessThan((penalties[i - 1] - penalties[i - 2]) / (costs[i - 1] - costs[i - 2]));
    }
    expect(penalties[penalties.length - 1]).toBeLessThan(ergonomicCap);
    expect(ergonomicPenalty(-3)).toBe(0);
  });

  it('still ranks dense material: costs that all read 75 under the old capped term stay apart', () => {
    // Costs per event measured on the dubstep drops' candidates (5–18). The old
    // linear term (6 per unit, capped at 25) gave every one of them exactly 75.
    const scores = [5.7, 7.5, 10.4, 17.9].map(c => computePlanScore({ hardCount: 0, unplayableCount: 0, eventCount: 100, avgErgonomicCost: c }));
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1] - scores[i]).toBeGreaterThan(1);
    expect(Math.min(...scores)).toBeGreaterThan(100 - ergonomicCap);
  });

  it('keeps TEST MIDI 1’s comfortable band where it was: about 3.3 per event with no hard events reads 80', () => {
    expect(computePlanScore({ hardCount: 0, unplayableCount: 0, eventCount: 32, avgErgonomicCost: 3.33 })).toBeCloseTo(80, 0);
  });

  it('is clamped to [0, 100], and an empty plan does not divide by zero', () => {
    expect(computePlanScore({ hardCount: 0, unplayableCount: 10, eventCount: 10, avgErgonomicCost: 20 })).toBe(0);
    expect(computePlanScore({ hardCount: 0, unplayableCount: 0, eventCount: 0 })).toBe(100);
    // Half the events hard takes 100 points: nothing is left.
    expect(computePlanScore({ hardCount: 10, unplayableCount: 0, eventCount: 20 })).toBe(Math.max(0, 100 - hardEventPercent * 50));
    expect(computePlanScore({ hardCount: 40, unplayableCount: 0, eventCount: 20 })).toBe(0);
  });
});
