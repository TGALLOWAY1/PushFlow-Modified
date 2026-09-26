/**
 * One identity for each performance event across solvers (S4.1, T24; P4-13).
 *
 * eventIndex is a note's index in the analysed performance in every solver
 * (beam used to number notes and greedy moments), and every plan note carries
 * a momentIndex from the shared groupIntoMoments. So a note's eventIndex and
 * momentIndex are the same whichever solver planned it, a chord played a few
 * ms apart is one moment in both, and greedy notes keep their own start times.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { groupIntoMoments } from '../../../src/engine';
import { type OptimizerInput } from '../../../src/engine/optimization/optimizerInterface';
import { getOptimizer } from '../../../src/engine/optimization/optimizerRegistry';
import '../../../src/engine/optimization/greedyOptimizer';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { type Performance } from '../../../src/types/performance';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type EngineConfiguration } from '../../../src/types/engineConfig';
import { type InstrumentConfig } from '../../../src/types/performance';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { getActivePerformance, getDisplayedLayout } from '../../../src/ui/state/projectState';
import { DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG } from '../../helpers/testHelpers';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

function voice(id: string, midi: number): Voice {
  return { id, name: id, sourceType: 'midi_track', sourceFile: 'test.mid', originalMidiNote: midi, color: '#888' };
}

/**
 * A kick + snare + hat chord struck 0, 2 and 4 ms apart (a played-in chord),
 * then single hits, and a chord at 1.5 s. Stored out of voice order within
 * the chord so array order, not voice order, is what eventIndex follows.
 */
const PERFORMANCE: Performance = {
  name: 'Humanized',
  tempo: 120,
  events: [
    { noteNumber: 42, voiceId: 'hat', startTime: 0.000, eventKey: 'n0' },
    { noteNumber: 36, voiceId: 'kick', startTime: 0.002, eventKey: 'n1' },
    { noteNumber: 38, voiceId: 'snare', startTime: 0.004, eventKey: 'n2' },
    { noteNumber: 42, voiceId: 'hat', startTime: 0.5, eventKey: 'n3' },
    { noteNumber: 38, voiceId: 'snare', startTime: 1.0, eventKey: 'n4' },
    { noteNumber: 36, voiceId: 'kick', startTime: 1.5, eventKey: 'n5' },
    { noteNumber: 42, voiceId: 'hat', startTime: 1.503, eventKey: 'n6' },
  ],
};

const LAYOUT: Layout = {
  id: 'humanized',
  name: 'Humanized',
  padToVoice: { '0,1': voice('kick', 36), '0,2': voice('snare', 38), '1,5': voice('hat', 42) },
  fingerConstraints: {},
  placementLocks: {},
  scoreCache: null,
  role: 'active',
};

function greedyInput(performance: Performance, layout: Layout, engineConfig: EngineConfiguration, instrumentConfig: InstrumentConfig): OptimizerInput {
  return {
    performance,
    layout,
    costToggles: ALL_COSTS_ENABLED,
    constraints: {},
    config: { engineConfig, seed: 0 },
    evaluationConfig: {
      restingPose: engineConfig.restingPose,
      stiffness: engineConfig.stiffness,
      instrumentConfig,
      neutralHandCenters: getNeutralHandCenters(layout, instrumentConfig),
    },
    instrumentConfig,
  };
}

async function beamPlan(performance: Performance, layout: Layout, engineConfig: EngineConfiguration, instrumentConfig: InstrumentConfig) {
  return createBeamSolver({ instrumentConfig, layout, sourceLayoutRole: layout.role })
    .solve(performance, { ...engineConfig, beamWidth: 15 });
}

/** eventKey → [eventIndex, momentIndex] for every note of a plan. */
function identities(plan: ExecutionPlanResult): Map<string, [number | undefined, number | undefined]> {
  return new Map(plan.fingerAssignments.map(a => [a.eventKey!, [a.eventIndex, a.momentIndex]]));
}

/** What eventIndex and momentIndex must be: the note's index, and its moment in the shared grouping. */
function expectedIdentities(performance: Performance): Map<string, [number, number]> {
  const moments = groupIntoMoments(performance.events);
  const momentOf = new Map(moments.flatMap(m => m.items.map(e => [e.eventKey!, m.index] as const)));
  return new Map(performance.events.map((e, i) => [e.eventKey!, [i, momentOf.get(e.eventKey!)!]]));
}

describe('a played-in chord, planned by greedy and by beam', () => {
  let greedy: ExecutionPlanResult;
  let beam: ExecutionPlanResult;
  beforeAll(async () => {
    const result = await getOptimizer('greedy').optimize(greedyInput(PERFORMANCE, LAYOUT, DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG));
    greedy = result.executionPlan;
    // Beam plays the layout greedy settled on, so the two plans cover the same pads.
    beam = await beamPlan(PERFORMANCE, result.layout, DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG);
  });

  it('gives every note the same eventIndex and momentIndex in both plans: its index and its moment', () => {
    const expected = expectedIdentities(PERFORMANCE);
    expect(identities(greedy)).toEqual(expected);
    expect(identities(beam)).toEqual(expected);
    // The chord 0-4 ms apart is one moment, as is the one 3 ms apart at 1.5 s.
    expect([...expected.values()].map(([, m]) => m)).toEqual([0, 0, 0, 1, 2, 3, 3]);
  });

  it('keeps each note\'s own start time in the greedy plan, as beam does', () => {
    const own = new Map(PERFORMANCE.events.map(e => [e.eventKey!, e.startTime]));
    for (const plan of [greedy, beam]) {
      for (const a of plan.fingerAssignments) expect(a.startTime).toBe(own.get(a.eventKey!));
    }
  });

  it('lists one moment assignment per moment, with the notes stamped with its index', () => {
    for (const plan of [greedy, beam]) {
      expect(plan.momentAssignments!.map(m => m.momentIndex)).toEqual([0, 1, 2, 3]);
      expect(plan.momentAssignments!.map(m => m.noteAssignments.length)).toEqual([3, 1, 1, 2]);
    }
  });
});

describe('a moment with a note beam cannot play (Codex review on #111)', () => {
  it('is unplayable in beam\'s moment summary, whether that note lands with the others or a few ms later', async () => {
    // The hat has no pad (strict mapping), so beam can't play its notes.
    const layout: Layout = { ...LAYOUT, padToVoice: { '0,1': voice('kick', 36), '0,2': voice('snare', 38) } };
    const performance: Performance = {
      name: 'Partly placed',
      tempo: 120,
      events: [
        { noteNumber: 36, voiceId: 'kick', startTime: 0, eventKey: 'k0' },
        { noteNumber: 42, voiceId: 'hat', startTime: 0.003, eventKey: 'h0' },
        { noteNumber: 38, voiceId: 'snare', startTime: 0.5, eventKey: 's0' },
        { noteNumber: 36, voiceId: 'kick', startTime: 1.0, eventKey: 'k1' },
        { noteNumber: 42, voiceId: 'hat', startTime: 1.0, eventKey: 'h1' },
      ],
    };
    const plan = await beamPlan(performance, layout, DEFAULT_ENGINE_CONFIG, DEFAULT_TEST_INSTRUMENT_CONFIG);
    expect(plan.fingerAssignments.filter(a => a.assignedHand === 'Unplayable').map(a => a.eventKey)).toEqual(['h0', 'h1']);
    const moments = plan.momentAssignments!;
    expect(moments.map(m => m.noteAssignments.length)).toEqual([2, 1, 2]);
    expect(moments.map(m => m.difficulty === 'Unplayable')).toEqual([true, false, true]);
    expect([moments[0]!.cost, moments[2]!.cost]).toEqual([Infinity, Infinity]);
    expect(plan.unplayableMomentCount).toBe(2);
  });
});

describe('TEST MIDI 1, planned by greedy and by beam', () => {
  let performance: Performance;
  let greedy: ExecutionPlanResult;
  let beam: ExecutionPlanResult;
  beforeAll(async () => {
    const state = await suggestedTestMidi1();
    performance = getActivePerformance(state);
    const result = await getOptimizer('greedy').optimize(
      greedyInput(performance, getDisplayedLayout(state)!, state.engineConfig, state.instrumentConfig),
    );
    greedy = result.executionPlan;
    beam = await beamPlan(performance, result.layout, state.engineConfig, state.instrumentConfig);
  }, 120_000);

  it('numbers the same 32 moments and every note alike in both plans, with no note unplayable', () => {
    const expected = expectedIdentities(performance);
    expect(new Set([...expected.values()].map(([, m]) => m)).size).toBe(32);
    expect(identities(greedy)).toEqual(expected);
    expect(identities(beam)).toEqual(expected);
    for (const plan of [greedy, beam]) {
      expect(plan.fingerAssignments.filter(a => a.assignedHand === 'Unplayable')).toHaveLength(0);
      expect(plan.momentAssignments).toHaveLength(32);
    }
  });
});
