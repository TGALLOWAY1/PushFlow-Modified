/**
 * The dubstep test suite (test/fixtures/midi/dubstep) through the app's own paths:
 * import, "Suggest a starting layout", auto-analysis, and the summaries and checks
 * the PR and nightly suites share.
 */

import * as path from 'path';
import { expect } from 'vitest';
import { importMidiFixture, unplayableCount } from './testMidi1';
import { createBeamSolver } from '../../src/engine/solvers/beamSolver';
import { createDefaultPose0, getPose0PadsWithOffset, fingerIdToHandAndFingerType } from '../../src/engine/prior/naturalHandPose';
import { getActivePerformance, getDisplayedLayout, projectReducer, type ProjectState } from '../../src/ui/state/projectState';
import { type SolverConfig } from '../../src/types/engineConfig';
import { type FingerType } from '../../src/types/fingerModel';
import { type ExecutionPlanResult } from '../../src/types/executionPlan';
import { type CandidateSolution } from '../../src/types/candidateSolution';

export const DUBSTEP_DIR = path.resolve(__dirname, '../fixtures/midi/dubstep');

/** A file from FILES imported, then "Suggest a starting layout". */
export async function suggestedDubstep(spec: { path: string }): Promise<ProjectState> {
  const imported = await importMidiFixture(path.join(DUBSTEP_DIR, spec.path));
  return projectReducer(imported, { type: 'SUGGEST_STARTING_LAYOUT' });
}

/** useAutoAnalysis's re-analysis: strict beam search seeded with pose-0 pad ownership. */
export function autoAnalysis(state: ProjectState): Promise<ExecutionPlanResult> {
  const layout = getDisplayedLayout(state)!;
  const initialPadOwnership: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  for (const entry of getPose0PadsWithOffset(createDefaultPose0(), 0, true)) {
    const padKey = `${entry.row},${entry.col}`;
    if (layout.padToVoice[padKey]) initialPadOwnership[padKey] = fingerIdToHandAndFingerType(entry.fingerId);
  }
  const solverConfig: SolverConfig = {
    instrumentConfig: state.instrumentConfig,
    layout,
    sourceLayoutRole: layout.role,
    initialPadOwnership,
  };
  return createBeamSolver(solverConfig).solve(getActivePerformance(state), { ...state.engineConfig, beamWidth: 15 });
}

/** What a plan reports beyond its fingering: the numbers the snapshots pin. */
export function planSummary(plan: ExecutionPlanResult) {
  return {
    mode: plan.constraintRelaxation?.mode,
    relaxedMoments: plan.constraintRelaxation?.relaxedMomentCount ?? 0,
    hard: plan.hardCount,
    unplayable: plan.fingerAssignments.filter((a) => a.assignedHand === 'Unplayable').length,
    score: Number(plan.score.toFixed(1)),
  };
}

export const candidateSummary = (c: CandidateSolution) => ({ strategy: c.metadata.strategy, ...planSummary(c.executionPlan) });

export function expectEveryEventPlayed(state: ProjectState, plan: ExecutionPlanResult): void {
  expect(plan.fingerAssignments).toHaveLength(getActivePerformance(state).events.length);
  expect(planSummary(plan).unplayable).toBe(0);
}

/** 0 unplayable events in every candidate, every Sound still placed, a stop reason recorded. */
export function expectCandidatesPlayEverything(state: ProjectState, candidates: CandidateSolution[]): void {
  const soundIds = state.soundStreams.map((s) => s.id).sort();
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect({ strategy: candidate.metadata.strategy, unplayable: unplayableCount(candidate) })
      .toEqual({ strategy: candidate.metadata.strategy, unplayable: 0 });
    expect(Object.values(candidate.layout.padToVoice).map((v) => v.id).sort()).toEqual(soundIds);
    expect(candidate.stopReason).toBeTruthy();
  }
}
