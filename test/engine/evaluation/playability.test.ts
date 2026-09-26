/**
 * S3.1 · One yardstick: a layout's Playability is the canonical evaluator's
 * verdict on the fingering of the layout's own analysis plan, fed through
 * computePlanScore. Deterministic, input-order independent, scores partial
 * layouts and filtered performances, honours cost toggles, and scores a
 * re-fingered strike with the finger the plan actually plays.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  scoreLayoutPlayability,
  evaluationConfigFor,
  PLAYABILITY_EVALUATOR_ID,
  computePlanScore,
  PLAN_SCORE_WEIGHTS,
  type LayoutScore,
} from '../../../src/engine';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getActivePerformance, getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';
import { DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG } from '../../helpers/testHelpers';
import { ALL_COSTS_ENABLED, ALL_COSTS_DISABLED } from '../../../src/types/costToggles';
import type { Layout } from '../../../src/types/layout';
import type { CandidateSolution } from '../../../src/types/candidateSolution';
import type { Performance } from '../../../src/types/performance';
import type { ExecutionPlanResult, FingerAssignment } from '../../../src/types/executionPlan';

let state: ProjectState;
let layout: Layout;
let performance: Performance;
let analysis: CandidateSolution;

async function analyse(l: Layout, perf: Performance = performance): Promise<CandidateSolution> {
  return analyzeLayout({ performance: perf, layout: l, instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections });
}

function score(l: Layout, plan: CandidateSolution['executionPlan'], perf: Performance = performance, costToggles = ALL_COSTS_ENABLED): LayoutScore {
  return scoreLayoutPlayability({
    performance: perf,
    layout: l,
    plan,
    config: evaluationConfigFor(l, state.engineConfig, state.instrumentConfig),
    costToggles,
  });
}

beforeAll(async () => {
  state = await suggestedTestMidi1();
  layout = getDisplayedLayout(state)!;
  performance = getActivePerformance(state);
  analysis = await analyse(layout);
});

describe('scoreLayoutPlayability on TEST MIDI 1', () => {
  it('scores the plan’s own fingering with the canonical evaluator, through computePlanScore', () => {
    const s = score(layout, analysis.executionPlan);
    expect(s.evaluatorId).toBe(PLAYABILITY_EVALUATOR_ID);
    expect(s.events).toBe(32);
    expect(s.unplayableEvents).toBe(0);
    expect(s.playability).toBe(computePlanScore({ hardCount: s.hardEvents, unplayableCount: s.unplayableEvents, avgErgonomicCost: s.costPerEvent }));
    expect(s.playability).toBeGreaterThan(0);
    expect(s.playability).toBeLessThanOrEqual(100);
    // The beam solver scores its own result with the same evaluator (all costs
    // on), re-fingered strikes included: the same fingering gives the same cost.
    expect(s.factors.total).toBeCloseTo(analysis.executionPlan.diagnostics!.factors.total, 9);
    expect(s.factors.transition).toBeCloseTo(analysis.executionPlan.diagnostics!.factors.transition, 9);
    const { total, ...parts } = s.factors;
    expect(Object.values(parts).reduce((a, b) => a + b, 0)).toBeCloseTo(total, 9);
    expect(s.feasibility.level).not.toBe('infeasible');
  });

  it('is deterministic, whatever order the events arrive in', () => {
    const a = score(layout, analysis.executionPlan);
    const b = score(layout, analysis.executionPlan);
    const reversed = { ...performance, events: [...performance.events].reverse() };
    expect(b).toEqual(a);
    expect(score(layout, analysis.executionPlan, reversed)).toEqual(a);
  });

  it('counts an unplaced Sound’s events as unplayable, and scores a filtered performance on placed material only', async () => {
    const placed = Object.entries(layout.padToVoice);
    const kept = Object.fromEntries(placed.slice(0, 4));
    const partial: Layout = { ...layout, padToVoice: kept, fingerConstraints: {} };
    const partialPlan = (await analyse(partial)).executionPlan;
    const s = score(partial, partialPlan);
    expect(s.events).toBe(32);
    expect(s.unplayableEvents).toBeGreaterThan(0);
    expect(s.feasibility.level).toBe('infeasible');
    expect(s.playability).toBeLessThan(score(layout, analysis.executionPlan).playability);

    // S3.3 scores placed material only: pass a filtered copy of the performance.
    const placedIds = new Set(Object.values(kept).map(v => v.id));
    const placedOnly = { ...performance, events: performance.events.filter(e => placedIds.has(e.voiceId!)) };
    const placedScore = score(partial, (await analyse(partial, placedOnly)).executionPlan, placedOnly);
    expect(placedScore.unplayableEvents).toBe(0);
    expect(placedScore.playability).toBeGreaterThan(s.playability);
  });

  it('honours cost toggles: a disabled family adds nothing, and with all off only the event counts remain', () => {
    const on = score(layout, analysis.executionPlan);
    const noMovement = score(layout, analysis.executionPlan, performance, { ...ALL_COSTS_ENABLED, transitionCost: false });
    expect(on.factors.transition).toBeGreaterThan(0);
    expect(noMovement.factors.transition).toBe(0);
    expect(noMovement.factors.total).toBeCloseTo(on.factors.total - on.factors.transition, 9);
    expect(noMovement.playability).toBeGreaterThanOrEqual(on.playability);

    const off = score(layout, analysis.executionPlan, performance, ALL_COSTS_DISABLED);
    expect(off.factors.total).toBe(0);
    expect(off.costPerEvent).toBe(0);
    expect(off.playability).toBe(100 - PLAN_SCORE_WEIGHTS.hardEvent * off.hardEvents - PLAN_SCORE_WEIGHTS.unplayableEvent * off.unplayableEvents);
  });
});

describe('scoreLayoutPlayability on a hand-made plan', () => {
  const voice = (id: string) => ({ id, name: id, sourceType: 'midi_track' as const, sourceFile: '', originalMidiNote: null, color: '#fff' });
  const twoPads: Layout = {
    id: 'l', name: 'two pads', role: 'working', scoreCache: null, placementLocks: {}, fingerConstraints: {},
    padToVoice: { '3,4': voice('a'), '3,5': voice('b') },
  } as unknown as Layout;
  const events = [
    { noteNumber: 36, voiceId: 'a', startTime: 0, eventKey: 'a0' },
    { noteNumber: 38, voiceId: 'b', startTime: 0, eventKey: 'b0' },
    { noteNumber: 36, voiceId: 'a', startTime: 1, eventKey: 'a1' },
  ];
  const strike = (voiceId: string, eventKey: string, startTime: number, col: number, finger: 'index' | 'middle'): FingerAssignment => ({
    noteNumber: voiceId === 'a' ? 36 : 38, voiceId, eventKey, startTime, row: 3, col, padId: `3,${col}`,
    assignedHand: 'right', finger, cost: 0, difficulty: 'Easy',
  });
  const ownership = { '3,4': { hand: 'right' as const, finger: 'index' as const }, '3,5': { hand: 'right' as const, finger: 'middle' as const } };
  const run = (fingerAssignments: FingerAssignment[]) => scoreLayoutPlayability({
    performance: { events },
    layout: twoPads,
    plan: { fingerAssignments, padFingerOwnership: ownership } as Pick<ExecutionPlanResult, 'fingerAssignments' | 'padFingerOwnership'>,
    config: evaluationConfigFor(twoPads, DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG),
  });

  it('scores each strike with the finger the plan plays, not the pad’s usual one', () => {
    const usual = run([strike('a', 'a0', 0, 4, 'index'), strike('b', 'b0', 0, 5, 'middle'), strike('a', 'a1', 1, 4, 'index')]);
    expect(usual.unplayableEvents).toBe(0);
    // At t=0 the plan plays b with the index finger that is already on a: one
    // finger on two pads at once, which is unplayable.
    const refingered = run([strike('a', 'a0', 0, 4, 'index'), strike('b', 'b0', 0, 5, 'index'), strike('a', 'a1', 1, 4, 'index')]);
    expect(refingered.unplayableEvents).toBe(1);
    expect(refingered.factors.constraintPenalty).toBeGreaterThan(usual.factors.constraintPenalty);
    expect(refingered.playability).toBeLessThan(usual.playability);
  });

  it('derives the fingering from the strikes when a plan has no pad ownership', () => {
    const fingerAssignments = [strike('a', 'a0', 0, 4, 'index'), strike('b', 'b0', 0, 5, 'middle'), strike('a', 'a1', 1, 4, 'index')];
    const withOwnership = run(fingerAssignments);
    const without = scoreLayoutPlayability({
      performance: { events },
      layout: twoPads,
      plan: { fingerAssignments },
      config: evaluationConfigFor(twoPads, DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG),
    });
    expect(without).toEqual(withOwnership);
  });
});
