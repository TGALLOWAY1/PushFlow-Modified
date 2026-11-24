/**
 * Nightly: the dubstep test suite's whole songs (test/fixtures/midi/dubstep/3-songs),
 * 1,100–1,400 events each, through auto-analysis and Beam / Annealing "Quick" the
 * way the app runs them. Durations go to the job summary.
 *
 * A known gap is marked `it.fails` with what fails and where: when the engine is
 * fixed the case starts failing, and the fix deletes the marker.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FILES } from '../fixtures/midi/dubstep/arrangements.mjs';
import { generateBeamAnnealingAsApp } from '../helpers/testMidi1';
import {
  suggestedDubstep,
  autoAnalysis,
  planSummary,
  candidateSummary,
  expectEveryEventPlayed,
  expectCandidatesPlayEverything,
} from '../helpers/dubstep';
import { reportDuration } from './reportDuration';
import { type ProjectState } from '../../src/ui/state/projectState';
import { type ExecutionPlanResult } from '../../src/types/executionPlan';
import { type CandidateSolution } from '../../src/types/candidateSolution';

const SONGS = FILES.filter((spec) => spec.path.startsWith('3-songs/'));

/** Known engine gaps, by file: what fails, where, and why it should not. None today. */
const BEAM_GAPS: Record<string, string> = {};

describe.each(SONGS)('dubstep song $path', (spec) => {
  let state: ProjectState;
  let analysis: ExecutionPlanResult;
  let beam: CandidateSolution[];

  beforeAll(async () => {
    state = await suggestedDubstep(spec);
    let start = performance.now();
    analysis = await autoAnalysis(state);
    reportDuration(`Dubstep ${spec.path}, auto-analysis`, performance.now() - start);
    start = performance.now();
    beam = await generateBeamAnnealingAsApp(state, 'fast');
    reportDuration(`Dubstep ${spec.path}, Beam / Annealing Quick`, performance.now() - start);
  });

  it('auto-analysis plays every event', () => {
    expectEveryEventPlayed(state, analysis);
  });

  const gap = BEAM_GAPS[spec.path];
  (gap ? it.fails : it)(`beam / annealing-quick candidates play every event${gap ? ` (known gap: ${gap})` : ''}`, () => {
    expectCandidatesPlayEverything(state, beam);
  });

  it('matches its summary snapshot (mode, relaxed moments, hard events, score)', () => {
    expect({ analysis: planSummary(analysis), beam: beam.map(candidateSummary) }).toMatchSnapshot();
  });
});
