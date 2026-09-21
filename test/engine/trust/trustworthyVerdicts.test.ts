/**
 * Trustworthy-verdict regression tests.
 *
 * These lock in the properties that make a layout verdict believable. Each one
 * corresponds to a defect where the app told the user something untrue about
 * their layout:
 *
 *   - "Unplayable" was reported when the search had merely run out of options.
 *   - Two engines scored the same layout 0 and 96 on a scale documented as shared.
 *   - Ordinary 16th-note grooves were rejected as physically impossible.
 *   - The Constraint Penalty factor was hardcoded to zero, so physically
 *     impossible assignments cost nothing.
 *   - A layout's score got worse simply because the performance was longer.
 *   - The natural-hand reference never resolved, so the primary ergonomic term
 *     rewarded one-finger-at-a-time playing.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Midi } from '@tonejs/midi';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type Voice } from '../../../src/types/voice';
import { createEmptyLayout, type Layout } from '../../../src/types/layout';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { seedLayoutFromPose0 } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { evaluatePerformance } from '../../../src/engine/evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../../../src/engine/structure/momentBuilder';
import { resolveNeutralPadPositions, getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import {
  buildNaturalPairwiseDistances,
  calculateHandShapeDeviation,
  exceedsHandSpeedLimit,
} from '../../../src/engine/evaluation/costFunction';
import { buildFingerAssignmentFromLayout } from '../../../src/engine/optimization/greedyEvaluation';
import { type PadFingerAssignment } from '../../../src/types/executionPlan';
import { padKey } from '../../../src/types/padGrid';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const MIDI_PATH = '../../../archive/v1-reference/test-data/Scenario 1 Tests/TEST MIDI 1.mid';

function voice(id: string, midi: number): Voice {
  return { id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444' };
}

function loadReferenceMidi() {
  const p = path.resolve(__dirname, MIDI_PATH);
  const buf = fs.readFileSync(p);
  const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const events: PerformanceEvent[] = [];
  midi.tracks.forEach(track => {
    const tally = new Map<string, number>();
    track.notes.forEach(note => {
      const hash = `${note.ticks}:${note.midi}:${track.channel + 1}`;
      const ordinal = (tally.get(hash) ?? 0) + 1;
      tally.set(hash, ordinal);
      events.push({
        noteNumber: note.midi, startTime: note.time, duration: note.duration,
        velocity: Math.round(note.velocity * 127), channel: track.channel + 1,
        eventKey: `${hash}:${ordinal}`,
      });
    });
  });
  events.sort((a, b) => a.startTime - b.startTime);
  const uniqueNotes = [...new Set(events.map(e => e.noteNumber))].sort((a, b) => a - b);
  return { events, uniqueNotes };
}

function referenceLayout(events: PerformanceEvent[], uniqueNotes: number[]) {
  const voices = new Map<number, Voice>();
  uniqueNotes.forEach(n => voices.set(n, voice(`stream-${n}`, n)));
  const perf = { events, tempo: 120, name: 'TEST MIDI 1' };
  return { perf, layout: seedLayoutFromPose0(perf, createDefaultPose0(), 0, voices) };
}

describe('the solver never presents a search failure as a physical impossibility', () => {
  it('assigns every event of the reference performance', async () => {
    const { events, uniqueNotes } = loadReferenceMidi();
    const { perf, layout } = referenceLayout(events, uniqueNotes);

    const solver = createBeamSolver({ instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout });
    const plan = await solver.solve(perf, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    expect(plan.unplayableCount).toBe(0);
    expect(plan.fingerAssignments).toHaveLength(events.length);
    for (const fa of plan.fingerAssignments) {
      expect(fa.assignedHand).not.toBe('Unplayable');
    }
  }, 60_000);

  it('never reports "beam_exhausted" to the user as a reason', async () => {
    const { events, uniqueNotes } = loadReferenceMidi();
    const { perf, layout } = referenceLayout(events, uniqueNotes);

    const solver = createBeamSolver({ instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout });
    const plan = await solver.solve(perf, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    const reasons = Object.values(plan.rejectionReasons ?? {}).flat();
    expect(reasons).not.toContain('beam_exhausted');
  }, 60_000);

  it('plays a chord whose correct hand split is not the column midpoint', async () => {
    // Three pads at columns 0, 5 and 6 struck together: left={0}, right={5,6}.
    // Only one arbitrary partition used to be tried, so this came back unplayable.
    const layout: Layout = {
      ...createEmptyLayout('L', 'L', 'active'),
      padToVoice: {
        [padKey(3, 0)]: voice('a', 36),
        [padKey(3, 5)]: voice('b', 41),
        [padKey(3, 6)]: voice('c', 42),
      },
    };
    const perf = {
      events: [
        { noteNumber: 36, startTime: 0, duration: 0.1, velocity: 100, voiceId: 'a', eventKey: 'a1' },
        { noteNumber: 41, startTime: 0, duration: 0.1, velocity: 100, voiceId: 'b', eventKey: 'b1' },
        { noteNumber: 42, startTime: 0, duration: 0.1, velocity: 100, voiceId: 'c', eventKey: 'c1' },
      ],
      tempo: 120, name: 'split',
    };

    const solver = createBeamSolver({ instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout });
    const plan = await solver.solve(perf as never, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    expect(plan.unplayableCount).toBe(0);
  }, 30_000);
});

describe('the score is on one comparable scale', () => {
  it('gives the reference layout a non-zero plan score', async () => {
    const { events, uniqueNotes } = loadReferenceMidi();
    const { perf, layout } = referenceLayout(events, uniqueNotes);

    const solver = createBeamSolver({ instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout });
    const plan = await solver.solve(perf, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 });

    // computePlanScore is calibrated per MOMENT. Feeding it per-EVENT counts pinned
    // the beam path to 0/100 for layouts the greedy path scored in the nineties.
    expect(plan.score).toBeGreaterThan(0);
    expect(plan.unplayableMomentCount).toBe(0);
  }, 60_000);
});

describe('physical impossibility costs something', () => {
  const config = () => ({
    restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
    stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    neutralHandCenters: getNeutralHandCenters(
      createEmptyLayout('L', 'L', 'active'), DEFAULT_TEST_INSTRUMENT_CONFIG,
    ),
  });

  const layout: Layout = {
    ...createEmptyLayout('L', 'L', 'active'),
    padToVoice: { [padKey(3, 4)]: voice('a', 36), [padKey(3, 6)]: voice('b', 38) },
  };
  const moments = [{
    momentIndex: 0, startTime: 0,
    notes: [
      { soundId: 'a', padId: padKey(3, 4), noteNumber: 36, velocity: 100 },
      { soundId: 'b', padId: padKey(3, 6), noteNumber: 38, velocity: 100 },
    ],
  }];

  it('charges a real constraint penalty when one finger must hit two pads at once', () => {
    const colliding: PadFingerAssignment = {
      [padKey(3, 4)]: { hand: 'right', finger: 'index' },
      [padKey(3, 6)]: { hand: 'right', finger: 'index' },
    };
    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: colliding, config: config(),
    });

    // This factor used to be hardcoded to zero, so an impossible assignment scored
    // exactly the same as a comfortable one and the UI bar never moved.
    expect(result.dimensions.constraintPenalty).toBeGreaterThan(0);
    expect(result.feasibility.level).toBe('infeasible');
  });

  it('charges nothing for a clean two-finger grip', () => {
    const clean: PadFingerAssignment = {
      [padKey(3, 4)]: { hand: 'right', finger: 'index' },
      [padKey(3, 6)]: { hand: 'right', finger: 'ring' },
    };
    const result = evaluatePerformance({
      moments, layout, padFingerAssignment: clean, config: config(),
    });

    expect(result.dimensions.constraintPenalty).toBe(0);
    expect(result.feasibility.level).not.toBe('infeasible');
  });
});

describe('ordinary playing is not called impossible', () => {
  it('accepts 16th notes between pads two columns apart at 110 BPM', () => {
    const from = { centroid: { x: 1, y: 2 }, fingers: {} };
    const to = { centroid: { x: 3, y: 2 }, fingers: {} };
    expect(exceedsHandSpeedLimit(from, to, 60 / 110 / 4)).toBe(false);
  });

  it('still rejects a full-grid sweep in 20 ms', () => {
    const from = { centroid: { x: 0, y: 0 }, fingers: {} };
    const to = { centroid: { x: 7, y: 7 }, fingers: {} };
    expect(exceedsHandSpeedLimit(from, to, 0.02)).toBe(true);
  });
});

describe('the cost a user sees does not grow with performance length', () => {
  it('reports a stable costPerMoment as the same pattern repeats', () => {
    const layout: Layout = {
      ...createEmptyLayout('L', 'L', 'active'),
      padToVoice: { [padKey(2, 1)]: voice('a', 36), [padKey(2, 5)]: voice('b', 38) },
    };
    const assignment: PadFingerAssignment = {
      [padKey(2, 1)]: { hand: 'left', finger: 'index' },
      [padKey(2, 5)]: { hand: 'right', finger: 'index' },
    };
    const config = {
      restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
      stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
    };

    const build = (count: number) => Array.from({ length: count }, (_, i) => ({
      momentIndex: i,
      startTime: i * 0.25,
      notes: [i % 2 === 0
        ? { soundId: 'a', padId: padKey(2, 1), noteNumber: 36, velocity: 100 }
        : { soundId: 'b', padId: padKey(2, 5), noteNumber: 38, velocity: 100 }],
    }));

    const short = evaluatePerformance({ moments: build(8), layout, padFingerAssignment: assignment, config });
    const long = evaluatePerformance({ moments: build(128), layout, padFingerAssignment: assignment, config });

    expect(long.total).toBeGreaterThan(short.total);          // the sum still grows
    expect(long.costPerMoment).toBeCloseTo(short.costPerMoment, 1); // the user-facing figure does not
  });
});

describe('the natural-hand reference resolves on the default grid', () => {
  it('resolves all ten fingers', () => {
    const pads = resolveNeutralPadPositions(
      createEmptyLayout('L', 'L', 'active'), DEFAULT_TEST_INSTRUMENT_CONFIG,
    );
    // Every finger of DEFAULT_HAND_POSE falls below the mandated bottomLeftNote of
    // 36, so this used to resolve zero fingers and leave the grip model without a
    // reference shape at all.
    expect(Object.keys(pads)).toHaveLength(10);
  });

  it('prefers a relaxed four-finger hand over a single finger pressed alone', () => {
    const pads = resolveNeutralPadPositions(
      createEmptyLayout('L', 'L', 'active'), DEFAULT_TEST_INSTRUMENT_CONFIG,
    );
    const natural = buildNaturalPairwiseDistances(pads, 'left');
    const fourFinger = {
      centroid: { x: 1.5, y: 4 },
      fingers: {
        pinky: { x: 0, y: 4 }, ring: { x: 1, y: 4 },
        middle: { x: 2, y: 4 }, index: { x: 3, y: 4 },
      },
    };

    // With no reference the deviation of this shape was 20 while a lone finger
    // scored 0, which biased every layout toward one-finger-at-a-time playing.
    expect(calculateHandShapeDeviation(fourFinger, natural)).toBeLessThan(1);
  });
});

describe('finger assignment respects simultaneity', () => {
  it('never gives two pads of the same moment the same finger', () => {
    const layout: Layout = {
      ...createEmptyLayout('L', 'L', 'active'),
      padToVoice: {
        [padKey(0, 3)]: voice('a', 36),
        [padKey(4, 3)]: voice('b', 38),
        [padKey(7, 3)]: voice('c', 40),
      },
    };
    const moments = [{
      momentIndex: 0, startTime: 0,
      notes: [
        { soundId: 'a', padId: padKey(0, 3), noteNumber: 36, velocity: 100 },
        { soundId: 'b', padId: padKey(4, 3), noteNumber: 38, velocity: 100 },
        { soundId: 'c', padId: padKey(7, 3), noteNumber: 40, velocity: 100 },
      ],
    }];

    // All three pads share column 3. A column-only lookup handed all of them the
    // same finger, and the greedy path still reported the layout "0 unplayable".
    const assignment = buildFingerAssignmentFromLayout(layout, moments);
    const used = Object.values(assignment).map(o => `${o.hand}:${o.finger}`);
    expect(new Set(used).size).toBe(used.length);
  });
});
