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
import { type Layout } from '../../src/types/layout';
import { scoreLayoutPlayability, evaluationConfigFor, type LayoutScore } from '../../src/engine/evaluation/playability';

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

/**
 * A plan on the one yardstick (playability.ts): the canonical evaluator's events
 * (everything struck at one instant), hard events and cost per event for the
 * plan's own fingering, with every cost family on, as the solvers score it.
 */
export function playabilityOf(state: ProjectState, plan: ExecutionPlanResult, layout: Layout): LayoutScore {
  return scoreLayoutPlayability({
    performance: getActivePerformance(state),
    layout,
    plan,
    config: evaluationConfigFor(layout, state.engineConfig, state.instrumentConfig),
  });
}

/** What a plan reports beyond its fingering: the numbers the snapshots pin. `layout` defaults to the one shown. */
export function planSummary(state: ProjectState, plan: ExecutionPlanResult, layout: Layout = getDisplayedLayout(state)!) {
  const scored = playabilityOf(state, plan, layout);
  return {
    mode: plan.constraintRelaxation?.mode,
    relaxedMoments: plan.constraintRelaxation?.relaxedMomentCount ?? 0,
    // The solver's own rule (a note whose strike costs it more than 10): its
    // difficulty labels count these. The score does not use them.
    hardNotes: plan.hardCount,
    unplayable: plan.fingerAssignments.filter((a) => a.assignedHand === 'Unplayable').length,
    // The score's own inputs, in events.
    events: scored.events,
    hardEvents: scored.hardEvents,
    costPerEvent: Number(scored.costPerEvent.toFixed(2)),
    score: Number(plan.score.toFixed(1)),
  };
}

export const candidateSummary = (state: ProjectState, c: CandidateSolution) =>
  ({ strategy: c.metadata.strategy, ...planSummary(state, c.executionPlan, c.layout) });

export function expectEveryEventPlayed(state: ProjectState, plan: ExecutionPlanResult): void {
  expect(plan.fingerAssignments).toHaveLength(getActivePerformance(state).events.length);
  expect(plan.fingerAssignments.filter((a) => a.assignedHand === 'Unplayable')).toHaveLength(0);
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
