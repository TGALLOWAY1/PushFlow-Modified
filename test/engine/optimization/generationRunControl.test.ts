/**
 * Generation progress, Cancel and the annealing budgets (S3.4, T35; roadmap
 * P3-7a/b/c), with an injected clock.
 *
 * - P3-7a: Cancel stops a run at its next check and it returns nothing (the
 *   hook test, test/ui/hooks/generationCancel.test.tsx, checks the state).
 * - P3-7b: a wall-clock budget stop keeps the best result so far, reports
 *   'time_budget', every restart has started, and the trace records it.
 * - P3-7c: the iteration budget, not the wall clock, bounds a fixed-seed run,
 *   so it is the same run whatever the clock does.
 * Plus: every candidate of every method carries its stop reason, telemetry and
 * trace (T33), and progress is reported with an ETA once there is a rate.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type Performance } from '../../../src/types/performance';
import { type AnnealingConfig, DEEP_ANNEALING_CONFIG } from '../../../src/types/engineConfig';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../../src/engine/optimization/greedyCandidatePipeline';
import { createAnnealingSolver, planAnnealingRun, annealingRunSummary } from '../../../src/engine/optimization/annealingSolver';
import { type GenerationProgress, GenerationCancelledError } from '../../../src/engine/optimization/runControl';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const voice = (id: string, midi: number): Voice => ({
  id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444',
});

function fourSounds(): Performance {
  const ids = ['kick', 'snare', 'hat', 'tom'];
  const events = ids.flatMap((id, v) =>
    Array.from({ length: 6 }, (_, i) => ({
      noteNumber: 36 + v,
      startTime: (i * 4 + v) * 0.25,
      duration: 0.1,
      velocity: 100,
      voiceId: id,
      eventKey: `${id}-${i}`,
    })),
  ).sort((a, b) => a.startTime - b.startTime);
  return { events, tempo: 120, name: 'four' };
}

const baseLayout = (): Layout => ({
  id: 'L', name: 'L', role: 'active', scoreCache: null, fingerConstraints: {}, placementLocks: {},
  padToVoice: {
    '3,1': voice('kick', 36), '3,2': voice('snare', 37),
    '3,5': voice('hat', 38), '3,6': voice('tom', 39),
  },
});

/** Small and quick, with restarts and the deep schedule's shape. */
const TINY: AnnealingConfig = {
  iterations: 20, initialTemp: 500, coolingRate: 0.9, restartCount: 2,
  fastBeamWidth: 4, finalBeamWidth: 8, useZoneTransfer: true,
};

/** A clock that moves `step` ms every time it is read. */
function steppingClock(step: number) {
  let t = 0;
  let reads = 0;
  return {
    now: () => { reads++; t += step; return t; },
    reads: () => reads,
  };
}

async function anneal(config: AnnealingConfig, now?: () => number, seed = 0) {
  const solver = createAnnealingSolver({
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    layout: baseLayout(),
    seed,
    annealingConfig: config,
    runControl: { now },
  });
  const plan = await solver.solve(fourSounds(), DEFAULT_ENGINE_CONFIG);
  return { plan, best: solver.getBestLayout()! };
}

/** The trajectory, step by step: what a deterministic run must reproduce. */
const trajectory = (plan: ExecutionPlanResult) => plan.annealingTrace!.map(s => [
  s.restartIndex, s.iteration, s.temperature, s.currentCost, s.bestCost, s.accepted,
]);

describe('planAnnealingRun (the iteration budget)', () => {
  it('without a budget, runs `iterations` per restart at the configured cooling, as before', () => {
    const plan = planAnnealingRun(TINY);
    expect(plan.iterationsPerRestart).toEqual([20, 20, 20]);
    expect(plan.coolingRates).toEqual([0.9, 0.9, 0.9]);
    expect(plan.total).toBe(60);
  });

  it('shares the budget equally over every restart and keeps the schedule’s end temperature', () => {
    const plan = planAnnealingRun({ ...TINY, iterationBudget: 13 });
    expect(plan.iterationsPerRestart).toEqual([5, 4, 4]);
    expect(plan.total).toBe(13);
    const configuredEnd = TINY.initialTemp * Math.pow(TINY.coolingRate, TINY.iterations);
    plan.iterationsPerRestart.forEach((n, r) => {
      const end = TINY.initialTemp * Math.pow(plan.coolingRates[r], n);
      expect(end / configuredEnd).toBeCloseTo(1, 9);
    });
  });

  it('never drops a restart: each runs at least one iteration', () => {
    expect(planAnnealingRun({ ...TINY, iterationBudget: 1 }).iterationsPerRestart).toEqual([1, 1, 1]);
  });

  it('sizes Thorough (DEEP_ANNEALING_CONFIG) to its iteration budget with every restart', () => {
    const plan = planAnnealingRun(DEEP_ANNEALING_CONFIG);
    expect(plan.iterationsPerRestart).toHaveLength(DEEP_ANNEALING_CONFIG.restartCount + 1);
    expect(plan.total).toBe(DEEP_ANNEALING_CONFIG.iterationBudget);
    expect(DEEP_ANNEALING_CONFIG.timeBudgetMs).toBeGreaterThan(0);
  });
});

describe('P3-7b · a wall-clock budget stop, with an injected clock', () => {
  // 300 ms shared by 3 runs; the clock moves 10 ms per read (one read per iteration).
  const BUDGETED: AnnealingConfig = { ...TINY, timeBudgetMs: 300 };

  it('returns the best result so far with stopReason time_budget, every restart having started', async () => {
    const clock = steppingClock(10);
    const { plan, best } = await anneal(BUDGETED, clock.now, 7);
    const telemetry = plan.metadata!.solverTelemetry!;
    const trace = plan.annealingTrace!;

    expect(telemetry.stopReason).toBe('time_budget');
    // Every restart started, each stopped by its share of the time.
    expect(new Set(trace.map(s => s.restartIndex))).toEqual(new Set([0, 1, 2]));
    expect(telemetry.restartsStoppedByTime).toEqual([0, 1, 2]);
    expect(telemetry.completedIterationsPerRestart!.every(n => n >= 1 && n < TINY.iterations)).toBe(true);
    expect(telemetry.iterationsCompleted).toBe(trace.length);
    expect(telemetry.iterationsCompleted).toBeLessThan(planAnnealingRun(BUDGETED).total);
    // The budgets and the measured runtime are in the telemetry.
    expect(telemetry.timeBudgetMs).toBe(300);
    expect(telemetry.plannedIterationsPerRestart).toEqual([20, 20, 20]);
    expect(telemetry.wallClockMs).toBeGreaterThan(0);

    // The trace records where each restart's time ran out.
    const stops = trace.filter(s => s.stoppedBy === 'time_budget');
    expect(stops.map(s => s.restartIndex)).toEqual([0, 1, 2]);
    for (const stop of stops) {
      const lastOfRestart = trace.filter(s => s.restartIndex === stop.restartIndex).at(-1);
      expect(stop).toBe(lastOfRestart);
    }

    // Best so far: the best cost never rises, the result is the best layout
    // found, and the final plan is that layout's.
    const bestCosts = trace.map(s => s.bestCost);
    expect(bestCosts.every((c, i) => i === 0 || c <= bestCosts[i - 1])).toBe(true);
    expect(telemetry.restartBestCosts.at(-1)).toBe(Math.min(...bestCosts));
    expect(plan.layoutBinding?.layoutHash).toBe(hashLayout(best));
  });

  it('stops within its share of the time: restart r ends by (r + 1) × budget / runs, plus one iteration', async () => {
    const clock = steppingClock(10);
    const { plan } = await anneal(BUDGETED, clock.now, 7);
    // One read before the first iteration, one per iteration, one per stop and
    // one at the end: the time spent is exactly what the reads say.
    const telemetry = plan.metadata!.solverTelemetry!;
    const reads = 1 + telemetry.iterationsCompleted + telemetry.restartsStoppedByTime!.length + 1;
    expect(clock.reads()).toBe(reads);
    expect(telemetry.wallClockMs).toBeLessThanOrEqual(300 + 2 * 10);
  });

  it('reaches the optimizer output contract as stopReason time_budget, with the budgets in telemetry', async () => {
    // The annealing adapter and generateCandidates both summarise a run this way.
    const { plan } = await anneal(BUDGETED, steppingClock(10).now, 7);
    const summary = annealingRunSummary(plan);
    expect(summary.stopReason).toBe('time_budget');
    expect(summary.telemetry).toMatchObject({
      timeBudgetMs: 300,
      iterationsPlanned: 60,
      iterationsCompleted: plan.annealingTrace!.length,
      restartsStoppedByTime: [0, 1, 2],
      seed: 7,
    });
  });
});

describe('P3-7c · the iteration budget, not the wall clock, bounds a fixed-seed run', () => {
  const SIZED: AnnealingConfig = { ...TINY, iterationBudget: 12 };

  it('runs exactly the iteration budget and repeats step for step, whatever the clock does', async () => {
    const withoutTimeBudget = await anneal(SIZED, undefined, 0);
    const frozen = await anneal({ ...SIZED, timeBudgetMs: 60_000 }, () => 5, 0);
    const racing = await anneal({ ...SIZED, timeBudgetMs: 60_000 }, steppingClock(997).now, 0);

    for (const run of [withoutTimeBudget, frozen, racing]) {
      const telemetry = run.plan.metadata!.solverTelemetry!;
      expect(telemetry.stopReason).toBe('completed');
      expect(telemetry.iterationsCompleted).toBe(12);
      expect(telemetry.plannedIterationsPerRestart).toEqual([4, 4, 4]);
      expect(telemetry.restartsStoppedByTime).toEqual([]);
      expect(trajectory(run.plan)).toEqual(trajectory(withoutTimeBudget.plan));
      expect(hashLayout(run.best)).toBe(hashLayout(withoutTimeBudget.best));
      expect(run.plan.averageMetrics.total).toBe(withoutTimeBudget.plan.averageMetrics.total);
    }
  });

  it('keeps every restart and cools each over its budget-sized share', async () => {
    const { plan } = await anneal(SIZED, undefined, 0);
    const trace = plan.annealingTrace!;
    const rates = planAnnealingRun(SIZED).coolingRates;
    for (const restart of [0, 1, 2]) {
      const steps = trace.filter(s => s.restartIndex === restart);
      expect(steps.map(s => s.iteration)).toEqual([0, 1, 2, 3]);
      expect(steps[0].temperature).toBe(TINY.initialTemp);
      expect(steps[1].temperature / steps[0].temperature).toBeCloseTo(rates[restart], 12);
    }
  });
});

describe('P3-7a · Cancel during annealing, with an injected clock', () => {
  it('stops at the next check and returns nothing: no candidates, no trace', async () => {
    const controller = new AbortController();
    let reads = 0;
    // Cancel lands at the 30th clock read, deep inside the first candidate's search.
    const now = () => {
      reads++;
      if (reads === 30) controller.abort();
      return reads * 10;
    };
    const progress: GenerationProgress[] = [];
    let result: unknown = 'not returned';
    await expect((async () => {
      result = await generateCandidates(fourSounds(), createDefaultPose0(), {
        count: 2,
        optimizationMode: 'deep',
        annealingConfig: { ...TINY, iterations: 200 },
        engineConfig: DEFAULT_ENGINE_CONFIG,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        baseLayout: baseLayout(),
        activeLayout: baseLayout(),
        runControl: { signal: controller.signal, now, onProgress: p => progress.push(p) },
      });
    })()).rejects.toBeInstanceOf(GenerationCancelledError);
    expect(result).toBe('not returned');
    // It stopped straight after the Cancel: one more clock read at most.
    expect(reads).toBeLessThanOrEqual(31);
    expect(progress[0]).toMatchObject({ method: 'annealing', current: 1, total: 2, iteration: 0 });
  });

  it('also stops between Beam candidates', async () => {
    const controller = new AbortController();
    await expect(generateCandidates(fourSounds(), null, {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: baseLayout(),
      activeLayout: baseLayout(),
      runControl: { signal: controller.signal, onProgress: p => { if (p.current === 2) controller.abort(); } },
    })).rejects.toBeInstanceOf(GenerationCancelledError);
  });

  it('is not swallowed by greedy’s per-run error handling', async () => {
    const controller = new AbortController();
    const layout = baseLayout();
    await expect(generateGreedyCandidates({
      performance: fourSounds(),
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      evaluationConfig: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
      baseLayout: layout,
      activeLayout: layout,
      count: 3,
      strategy: 'natural-pose',
      runControl: { signal: controller.signal, onProgress: () => controller.abort() },
    })).rejects.toBeInstanceOf(GenerationCancelledError);
  });
});

describe('Progress (T35)', () => {
  it('annealing: candidate k of n with its iterations, and an ETA once there is a rate', async () => {
    const progress: GenerationProgress[] = [];
    await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 2,
      optimizationMode: 'deep',
      annealingConfig: TINY,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: baseLayout(),
      activeLayout: baseLayout(),
      runControl: { now: steppingClock(50).now, onProgress: p => progress.push(p) },
    });
    expect(progress[0]).toEqual({
      method: 'annealing', current: 1, total: 2, counts: 'candidates',
      iteration: 0, iterationsPlanned: 60, elapsedMs: expect.any(Number), etaMs: null,
    });
    expect(new Set(progress.map(p => p.current))).toEqual(new Set([1, 2]));
    const second = progress.find(p => p.current === 2)!;
    expect(second.etaMs).toBeGreaterThan(0);
    expect(progress.every(p => p.elapsedMs >= 0)).toBe(true);
  });

  it('greedy: counts the layouts it tries, with an ETA from the runs finished so far', async () => {
    const progress: GenerationProgress[] = [];
    const layout = baseLayout();
    await generateGreedyCandidates({
      performance: fourSounds(),
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      evaluationConfig: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
      baseLayout: layout,
      activeLayout: layout,
      count: 3,
      strategy: 'natural-pose',
      runControl: { now: steppingClock(200).now, onProgress: p => progress.push(p) },
    });
    const starts = progress.filter((p, i) => i === 0 || p.current !== progress[i - 1].current);
    expect(starts.map(p => [p.method, p.current, p.total, p.counts])).toEqual([
      ['greedy', 1, 3, 'layouts'], ['greedy', 2, 3, 'layouts'], ['greedy', 3, 3, 'layouts'],
    ]);
    expect(starts[0].etaMs).toBeNull();
    expect(starts[1].etaMs).toBeGreaterThan(0);
  });
});

describe('Every candidate carries its stop reason, telemetry and trace (T33)', () => {
  it('greedy: its move history and the hill climb’s stop reason', async () => {
    const layout = baseLayout();
    const { candidates } = await generateGreedyCandidates({
      performance: fourSounds(),
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      evaluationConfig: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
      baseLayout: layout,
      activeLayout: layout,
      count: 3,
      strategy: 'natural-pose',
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(['no_improving_move', 'iteration_cap', 'infeasible_neighborhood']).toContain(c.stopReason);
      expect(c.moveHistory!.length).toBeGreaterThan(0);
      expect(c.moveHistory![0]).toHaveProperty('phase');
      expect(c.telemetry!.wallClockMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('beam: stopReason completed and a small beam summary', async () => {
    const { candidates } = await generateCandidates(fourSounds(), null, {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: baseLayout(),
      activeLayout: baseLayout(),
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.stopReason).toBe('completed');
      expect(c.beamSummary).toMatchObject({ beamWidth: DEFAULT_ENGINE_CONFIG.beamWidth, noteCount: 24, layoutStrategy: c.metadata.strategy });
      expect(c.telemetry!.seed).toBe(c.metadata.seed);
      expect(c.annealingTrace).toBeUndefined();
    }
  });

  it('annealing: its iteration trace, the solver’s stop reason and the budgets in telemetry', async () => {
    const { candidates } = await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 2,
      optimizationMode: 'deep',
      annealingConfig: { ...TINY, iterationBudget: 9, timeBudgetMs: 60_000 },
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: baseLayout(),
      activeLayout: baseLayout(),
      runControl: { now: () => 0 },
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.stopReason).toBe('completed');
      expect(c.annealingTrace).toBe(c.executionPlan.annealingTrace);
      expect(c.annealingTrace!.length).toBe(9);
      expect(c.telemetry).toMatchObject({ iterationsCompleted: 9, iterationsPlanned: 9, iterationBudget: 9, timeBudgetMs: 60_000 });
      expect(c.metadata.optimizationSummary).toBe('Deep optimization (9 iterations over 3 runs)');
    }
  });

  it('annealing stopped by its time budget says so first on its card line', async () => {
    const { candidates } = await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 1,
      optimizationMode: 'deep',
      annealingConfig: { ...TINY, timeBudgetMs: 300 },
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: baseLayout(),
      activeLayout: baseLayout(),
      runControl: { now: steppingClock(10).now },
    });
    const [c] = candidates;
    expect(c.stopReason).toBe('time_budget');
    expect(c.telemetry!.restartsStoppedByTime).toEqual([0, 1, 2]);
    expect(c.metadata.optimizationSummary).toBe(
      `Stopped: time limit reached · Deep optimization (${c.telemetry!.iterationsCompleted} of 60 iterations over 3 runs)`,
    );
  });
});
