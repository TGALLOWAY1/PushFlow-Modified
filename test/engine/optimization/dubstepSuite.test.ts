/**
 * The dubstep test suite (test/fixtures/midi/dubstep) through the engine, the way
 * the app runs it: import, "Suggest a starting layout", then auto-analysis and
 * Generate. Tiers 1 and 2 (8-bar elements and sections) run here with auto-analysis
 * and Beam / Annealing "Quick"; greedy (minutes per file) and the three whole songs
 * run nightly in test/nightly/dubstepSuite.nightly.ts.
 *
 * The hard claim: every method plays every event of a realistic 130–150 BPM
 * performance, 0 unplayable. Each plan's score is its Playability, and on the
 * drops every candidate scores differently. The snapshot pins what else each run
 * reports per file (strict or relaxed, relaxed moments, the solver's own hard
 * notes, and the score with its inputs: events, hard events, cost per event), so
 * a change in how the engine handles dense, fast material shows up in review.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FILES } from '../../fixtures/midi/dubstep/arrangements.mjs';
import { generateBeamAnnealingAsApp } from '../../helpers/testMidi1';
import {
  suggestedDubstep,
  autoAnalysis,
  planSummary,
  candidateSummary,
  expectEveryEventPlayed,
  expectCandidatesPlayEverything,
  playabilityOf,
} from '../../helpers/dubstep';
import { getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { type CandidateSolution } from '../../../src/types/candidateSolution';

const TIERS_1_AND_2 = FILES.filter((spec) => !spec.path.startsWith('3-songs/'));

describe.each(TIERS_1_AND_2)('dubstep $path', (spec) => {
  let state: ProjectState;
  let analysis: ExecutionPlanResult;
  let beam: CandidateSolution[];

  beforeAll(async () => {
    state = await suggestedDubstep(spec);
    analysis = await autoAnalysis(state);
    // Beam and Annealing "Quick" run the same code in the app (optimizationMode 'fast').
    beam = await generateBeamAnnealingAsApp(state, 'fast');
  }, 60_000);

  it('auto-analysis plays every event', () => {
    expectEveryEventPlayed(state, analysis);
  });

  it('beam / annealing-quick candidates play every event and keep every Sound on the grid', () => {
    expectCandidatesPlayEverything(state, beam);
  });

  it('scores every plan on the one yardstick: a plan’s score is its Playability', () => {
    expect(analysis.score).toBeCloseTo(playabilityOf(state, analysis, getDisplayedLayout(state)!).playability, 9);
    for (const c of beam) {
      expect(c.executionPlan.score).toBeCloseTo(playabilityOf(state, c.executionPlan, c.layout).playability, 9);
    }
  });

  // The drops are the densest material here. Scored by counting hard events and
  // capping the cost term at 25, every candidate of every drop tied: 0 as each
  // solver scored it, 75 on its card.
  it.runIf(spec.path.includes('/drop-'))('gives each candidate of a drop its own score, none pinned at a bound', () => {
    const scores = beam.map((c) => Number(c.executionPlan.score.toFixed(1)));
    expect(new Set(scores).size).toBe(scores.length);
    for (const score of scores) {
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    }
  });

  it('matches its summary snapshot (mode, relaxed moments, hard events, score)', () => {
    expect({ analysis: planSummary(state, analysis), beam: beam.map((c) => candidateSummary(state, c)) }).toMatchSnapshot();
  });
});
