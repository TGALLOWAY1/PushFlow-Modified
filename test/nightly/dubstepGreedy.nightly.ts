/**
 * Nightly: greedy Generate on the dubstep test suite's tier-1 files (one family,
 * 8 bars; test/fixtures/midi/dubstep), the way useAutoAnalysis.generateFull runs it.
 * Greedy takes 20 s – 1 min per file, too slow for every PR; the PR suite
 * (test/engine/optimization/dubstepSuite.test.ts) covers auto-analysis and Beam.
 *
 * Tier 2 is left out because greedy's iteration trace keeps the layouts and every
 * move considered at each step: 2-sections/build-140.mid (9 Sounds) needs 6–8 GB of
 * heap and 4 minutes, and build-into-drop-150.mid (15 Sounds) ran out of an 8 GB
 * heap after 12 minutes without finishing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FILES } from '../fixtures/midi/dubstep/arrangements.mjs';
import { generateGreedyAsApp } from '../helpers/testMidi1';
import { suggestedDubstep, candidateSummary, expectCandidatesPlayEverything } from '../helpers/dubstep';
import { reportDuration } from './reportDuration';
import { type ProjectState } from '../../src/ui/state/projectState';
import { type CandidateSolution } from '../../src/types/candidateSolution';

const GREEDY_FILES = FILES.filter((spec) => spec.path.startsWith('1-elements/'));

describe.each(GREEDY_FILES)('dubstep greedy $path', (spec) => {
  let state: ProjectState;
  let greedy: CandidateSolution[];
  let traceLengths: number[];

  beforeAll(async () => {
    state = await suggestedDubstep(spec);
    const start = performance.now();
    greedy = await generateGreedyAsApp(state);
    reportDuration(`Dubstep ${spec.path}, greedy`, performance.now() - start);
    // Each iteration of the trace holds the layout before and after and every move
    // considered: 90–180 MB per candidate on an 8-bar loop. Keep its length, let the
    // rest go, or the files after this one run out of heap.
    traceLengths = greedy.map((c) => c.iterationTrace?.length ?? 0);
    for (const candidate of greedy) delete candidate.iterationTrace;
  });

  it('every candidate plays every event, keeps every Sound on the grid, and carries its traces', () => {
    expectCandidatesPlayEverything(state, greedy);
    for (const candidate of greedy) expect(candidate.moveHistory!.length).toBeGreaterThan(0);
    expect(traceLengths.every((n) => n > 0)).toBe(true);
  });

  it('matches its summary snapshot (mode, relaxed moments, hard events, score)', () => {
    expect(greedy.map((c) => candidateSummary(state, c))).toMatchSnapshot();
  });
});
