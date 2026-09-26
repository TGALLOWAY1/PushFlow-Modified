/**
 * Integration test: TEST MIDI 1.mid end-to-end through the app's own paths
 * (the CLAUDE.md TEST MIDI 1 gate, roadmap P0 "Extended TEST MIDI 1 gate").
 *
 * 1. Import the fixture the way the app does (useLaneImport → IMPORT_LANES), so
 *    Sound ids come from import and nothing is keyed by MIDI pitch.
 * 2. "Suggest a starting layout" (SUGGEST_STARTING_LAYOUT).
 * 3. Run each optimization method the way useAutoAnalysis.generateFull does:
 *    greedy, beam, and annealing Quick. Annealing Thorough (deep) runs nightly
 *    only: test/nightly/testMidi1DeepAnnealing.nightly.ts.
 * 4. Every candidate of every method has 0 unplayable events in strict mode.
 * 5. A Sound locked at [7,0] stays there in every candidate.
 * 6. Fixed-seed snapshots pin each method's output.
 * 7. Every candidate carries its stop reason and its method's trace (P3-9).
 *
 * In the app, Beam and Annealing "Quick" run the same code: generateCandidates
 * with optimizationMode 'fast', which is beam search only (annealing runs only in
 * 'deep'). Both cases are kept so each method the UI offers has its own gate.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { createDefaultPose0, getPose0PadsWithOffset, fingerIdToHandAndFingerType } from '../../../src/engine/prior/naturalHandPose';
import { getActivePerformance, getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { type SolverConfig } from '../../../src/types/engineConfig';
import { type FingerType } from '../../../src/types/fingerModel';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { countHandUsage } from '../../helpers/testHelpers';
import { groupIntoMoments, summarizeMomentCost, COMFORTABLE_PLAN_SCORE } from '../../../src/engine';
import {
  LOCK_PAD,
  importTestMidi1,
  suggestedTestMidi1,
  lockBusiestSoundAt7_0,
  generateGreedyAsApp,
  generateBeamAnnealingAsApp,
  unplayableCount,
  candidateSnapshot,
} from '../../helpers/testMidi1';

// Greedy runs every candidate family; on a CI runner that takes up to a minute.
const SLOW = 180_000;

type Method = 'greedy' | 'beam' | 'annealing-quick';

function generate(method: Method, state: ProjectState): Promise<CandidateSolution[]> {
  return method === 'greedy'
    ? generateGreedyAsApp(state)
    : generateBeamAnnealingAsApp(state, 'fast');
}

function expectStrictZeroUnplayable(candidates: CandidateSolution[]) {
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    const usage = countHandUsage(candidate.executionPlan);
    expect({ strategy: candidate.metadata.strategy, unplayable: usage.unplayable })
      .toEqual({ strategy: candidate.metadata.strategy, unplayable: 0 });
    expect(usage.left + usage.right).toBe(candidate.executionPlan.fingerAssignments.length);
    // Hand separation and one finger per Sound are hard rules, and this
    // performance can be played within them.
    expect(candidate.executionPlan.constraintRelaxation?.mode).toBe('strict');
  }
}

function expectLockHeld(candidates: CandidateSolution[], lockedId: string) {
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect({ strategy: candidate.metadata.strategy, soundAt7_0: candidate.layout.padToVoice[LOCK_PAD]?.id })
      .toEqual({ strategy: candidate.metadata.strategy, soundAt7_0: lockedId });
    expect(candidate.layout.placementLocks).toEqual({ [lockedId]: LOCK_PAD });
  }
}

describe('TEST MIDI 1.mid end-to-end', () => {
  let suggested: ProjectState;

  beforeAll(async () => {
    suggested = await suggestedTestMidi1();
  });

  it('imports through the app path: 7 Sounds with import ids, 48 events, tempo from the file', async () => {
    const imported = await importTestMidi1();
    expect(imported.soundStreams).toHaveLength(7);
    for (const stream of imported.soundStreams) {
      expect(stream.id).toMatch(/^lane_/);
    }
    expect(getActivePerformance(imported).events).toHaveLength(48);
    expect(imported.tempo).toBeGreaterThan(0);
    // Import places nothing (invariant 7).
    expect(Object.keys(getDisplayedLayout(imported)!.padToVoice)).toHaveLength(0);
  });

  it('Suggest a starting layout places every Sound once, by id', () => {
    const layout = getDisplayedLayout(suggested)!;
    const placedIds = Object.values(layout.padToVoice).map(v => v.id).sort();
    expect(placedIds).toEqual(suggested.soundStreams.map(s => s.id).sort());
  });

  it('auto-analysis (strict beam, pose0 ownership) has 0 unplayable events', async () => {
    // Mirrors useAutoAnalysis's re-analysis effect.
    const performance = getActivePerformance(suggested);
    const layout = getDisplayedLayout(suggested)!;
    const initialPadOwnership: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
    for (const entry of getPose0PadsWithOffset(createDefaultPose0(), 0, true)) {
      const padKey = `${entry.row},${entry.col}`;
      if (layout.padToVoice[padKey]) initialPadOwnership[padKey] = fingerIdToHandAndFingerType(entry.fingerId);
    }
    const solverConfig: SolverConfig = {
      instrumentConfig: suggested.instrumentConfig,
      layout,
      sourceLayoutRole: layout.role,
      initialPadOwnership,
    };
    const plan = await createBeamSolver(solverConfig).solve(performance, { ...suggested.engineConfig, beamWidth: 15 });
    const usage = countHandUsage(plan);
    expect(usage.unplayable).toBe(0);
    expect(usage.left + usage.right).toBe(performance.events.length);
    expect(plan.constraintRelaxation?.mode).toBe('strict');
  });

  it('direct beam solver in allow-fallback mode has 0 unplayable events', async () => {
    const performance = getActivePerformance(suggested);
    const solverConfig: SolverConfig = {
      instrumentConfig: suggested.instrumentConfig,
      layout: getDisplayedLayout(suggested)!,
      mappingResolverMode: 'allow-fallback',
    };
    const plan = await createBeamSolver(solverConfig).solve(performance, suggested.engineConfig);
    const usage = countHandUsage(plan);
    expect(usage.unplayable).toBe(0);
    expect(usage.left + usage.right).toBe(performance.events.length);
  });

  describe.each<Method>(['greedy', 'beam', 'annealing-quick'])('%s', method => {
    let candidates: CandidateSolution[];

    beforeAll(async () => {
      candidates = await generate(method, suggested);
    }, SLOW);

    it('every candidate has 0 unplayable events in strict mode', () => {
      expectStrictZeroUnplayable(candidates);
    });

    it('matches its fixed-seed snapshot', () => {
      // The pipelines use fixed seeds (greedy 42 + i·7919; beam strategies 42/49/56),
      // so the same input must give the same candidates, run after run.
      expect(candidates.map(c => candidateSnapshot(suggested, c))).toMatchSnapshot();
    });

    it('every candidate carries its strategy and seed', () => {
      for (const candidate of candidates) {
        expect(candidate.metadata.strategy).toBeTruthy();
        expect(typeof candidate.metadata.seed).toBe('number');
      }
    });

    // S3.4 (T33, P3-9): the trace and the stop reason travel with the candidate.
    it('P3-9: every candidate carries its stop reason, telemetry and its method’s trace', () => {
      for (const candidate of candidates) {
        expect(candidate.stopReason).toBeTruthy();
        expect(candidate.telemetry?.wallClockMs).toBeGreaterThanOrEqual(0);
        if (method === 'greedy') {
          expect(['no_improving_move', 'iteration_cap', 'infeasible_neighborhood']).toContain(candidate.stopReason);
          expect(candidate.moveHistory!.length).toBeGreaterThan(0);
        } else {
          // Beam, and Annealing Quick, which runs beam search only.
          expect(candidate.stopReason).toBe('completed');
          expect(candidate.beamSummary?.noteCount).toBe(candidate.executionPlan.fingerAssignments.length);
        }
      }
    });

    // S1b.1 (T22): one moment grouping, keyed by the performance itself.
    it('P1b-2c: every plan groups into the performance’s own moments (same momentKeys)', () => {
      const performanceKeys = groupIntoMoments(getActivePerformance(suggested).events).map(m => m.key);
      expect(performanceKeys.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(groupIntoMoments(candidate.executionPlan.fingerAssignments).map(m => m.key)).toEqual(performanceKeys);
      }
    });

    it('P1b-2b: every playable note of a moment carries the same moment cost, read once per moment', () => {
      for (const candidate of candidates) {
        for (const moment of groupIntoMoments(candidate.executionPlan.fingerAssignments)) {
          const totals = new Set(moment.items
            .filter(a => a.assignedHand !== 'Unplayable')
            .map(a => a.costBreakdown?.total ?? a.cost));
          expect(totals.size).toBeLessThanOrEqual(1);
          if (totals.size === 1) expect(summarizeMomentCost(moment.items).cost).toBe([...totals][0]);
        }
      }
    });

    // S1b.1 "False claim fix".
    it.runIf(method === 'greedy')('P1b-7: the lowest-scoring candidate never carries "low overall difficulty"', () => {
      const claims = (c: CandidateSolution) => c.metadata.explanation?.wonBecause.includes('low overall difficulty') ?? false;
      const scores = candidates.map(c => c.executionPlan.score);
      expect(candidates.length).toBeGreaterThan(1);
      for (const candidate of candidates) {
        if (candidate.executionPlan.score === Math.min(...scores)) expect(claims(candidate)).toBe(false);
        if (claims(candidate)) {
          expect(candidate.executionPlan.score).toBe(Math.max(...scores));
          expect(candidate.executionPlan.score).toBeGreaterThanOrEqual(COMFORTABLE_PLAN_SCORE);
        }
      }
    });

    it.runIf(method === 'greedy')('every candidate carries an explanation card', () => {
      for (const candidate of candidates) {
        expect(candidate.metadata.candidateFamily).toBeDefined();
        expect(candidate.metadata.explanation?.bestFor).toBeTruthy();
        expect(candidate.metadata.explanation!.wonBecause.length).toBeGreaterThan(0);
      }
    });
  });

  describe('a Sound locked at [7,0]', () => {
    let locked: ProjectState;
    let lockedId: string;

    beforeAll(() => {
      ({ state: locked, lockedId } = lockBusiestSoundAt7_0(suggested));
    });

    it('is set up through the reducer: on [7,0] and locked there', () => {
      const layout = getDisplayedLayout(locked)!;
      expect(layout.padToVoice[LOCK_PAD]?.id).toBe(lockedId);
      expect(layout.placementLocks).toEqual({ [lockedId]: LOCK_PAD });
    });

    it('greedy: holds in every candidate, with 0 unplayable events', async () => {
      const candidates = await generateGreedyAsApp(locked);
      expectLockHeld(candidates, lockedId);
      expect(candidates.map(unplayableCount)).toEqual(candidates.map(() => 0));
    }, SLOW);

    describe.each(['beam', 'annealing-quick'] as const)('%s', method => {
      let candidates: CandidateSolution[];

      beforeAll(async () => {
        candidates = await generate(method, locked);
      });

      it('produces candidates with 0 unplayable events', () => {
        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.map(unplayableCount)).toEqual(candidates.map(() => 0));
      });

      // S1a.3 (C3 / T11): every seeded candidate pre-places the locked Sound and
      // carries the lock; a candidate that moved it would have been dropped.
      it('holds in every candidate', () => {
        expectLockHeld(candidates, lockedId);
      });
    });
  });

  // S1a.4 (T15 slice, P1a-9): Generate never removes a placed Sound. A muted
  // Sound has no events in the performance the optimizers see, so every
  // method pins it to its pad for the run, without adding a lock.
  describe('a muted, placed Sound', () => {
    let muted: ProjectState;
    let mutedId: string;
    let mutedPad: string;

    beforeAll(() => {
      const quietest = [...suggested.soundStreams].sort((a, b) => a.events.length - b.events.length)[0];
      mutedId = quietest.id;
      mutedPad = Object.entries(getDisplayedLayout(suggested)!.padToVoice).find(([, v]) => v.id === mutedId)![0];
      muted = projectReducer(suggested, { type: 'TOGGLE_MUTE', payload: mutedId });
    });

    it('is muted through the reducer: still on its pad, its events out of the performance', () => {
      expect(getActivePerformance(muted).events.some(e => e.voiceId === mutedId)).toBe(false);
      expect(getActivePerformance(muted).events.length).toBeLessThan(getActivePerformance(suggested).events.length);
      expect(getDisplayedLayout(muted)!.padToVoice[mutedPad]?.id).toBe(mutedId);
    });

    describe.each<Method>(['greedy', 'beam', 'annealing-quick'])('%s', method => {
      let candidates: CandidateSolution[];

      beforeAll(async () => {
        candidates = await generate(method, muted);
      }, SLOW);

      it('keeps the muted Sound on its pad in every candidate, without a lock', () => {
        expect(candidates.length).toBeGreaterThan(0);
        for (const candidate of candidates) {
          expect({ strategy: candidate.metadata.strategy, soundOnPad: candidate.layout.padToVoice[mutedPad]?.id })
            .toEqual({ strategy: candidate.metadata.strategy, soundOnPad: mutedId });
          expect(Object.values(candidate.layout.padToVoice).filter(v => v.id === mutedId)).toHaveLength(1);
          expect(candidate.layout.placementLocks).toEqual({});
        }
      });

      it('still has 0 unplayable events in strict mode', () => {
        expectStrictZeroUnplayable(candidates);
      });
    });
  });
});
