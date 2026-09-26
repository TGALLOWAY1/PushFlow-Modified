/**
 * What the trace panel says about how a candidate was found (T33).
 *
 * - Costs in words, with before, after and the change always agreeing: they
 *   are rounded to one precision and the change is taken between the rounded
 *   values. The greedy trace's own costBefore can leave out a term that its
 *   costAfter and costDelta include (the rhythm-peer cost), which is how a
 *   step used to read "−44.29" beside "86.51 → 88.22"; a step's before is the
 *   cost its after and delta imply.
 * - The phases a greedy run went through, so phases with no steps are hidden.
 * - An annealing trace reduced for drawing: at most a few hundred points,
 *   while the summary and the per-run table read every snapshot.
 */

import { type OptimizationIteration, type OptimizerMove } from '../../engine/optimization/optimizerInterface';
import { type AnnealingIterationSnapshot } from '../../types/executionPlan';

const MINUS = '−';

export type CostDirection = 'better' | 'worse' | 'same';

/** A cost change: before, after and the change between them, rounded alike. */
export interface CostChange {
  before: string;
  after: string;
  /** "−44.3" (a true minus sign), "+1.2" or "0". */
  change: string;
  direction: CostDirection;
  /** "−44.3 cost · better", "+1.2 cost · worse" or "no change". */
  words: string;
}

const UNKNOWN: CostChange = { before: '—', after: '—', change: '—', direction: 'same', words: 'cost unknown' };

/** Decimals that keep a change of this size readable: 44.29 → 1, 0.29 → 2, 0.004 → 3. */
function decimalsFor(delta: number): number {
  const d = Math.abs(delta);
  if (d >= 1) return 1;
  if (d >= 0.01) return 2;
  return 3;
}

/** Before and after in units of 10^-decimals, their change taken between them. */
function fromUnits(b: number, a: number, decimals: number): CostChange {
  const scale = 10 ** decimals;
  const units = a - b;
  const show = (n: number) => (n / scale).toFixed(decimals);
  const direction: CostDirection = units < 0 ? 'better' : units > 0 ? 'worse' : 'same';
  const change = units < 0 ? `${MINUS}${show(-units)}` : units > 0 ? `+${show(units)}` : '0';
  return {
    before: show(b),
    after: show(a),
    change,
    direction,
    words: direction === 'same' ? 'no change' : `${change} cost · ${direction}`,
  };
}

/** The change from `before` to `after`, in words, with all three numbers agreeing. */
export function costChange(before: number, after: number, decimals = decimalsFor(after - before)): CostChange {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return UNKNOWN;
  const scale = 10 ** decimals;
  return fromUnits(Math.round(before * scale), Math.round(after * scale), decimals);
}

/**
 * One step's change, from the cost after it and its delta: the delta is
 * rounded as it is everywhere else (the moves it weighed, the grid's move
 * labels), and before is after minus it, so the three agree.
 */
export function stepChange(after: number, delta: number): CostChange {
  if (!Number.isFinite(after) || !Number.isFinite(delta)) return UNKNOWN;
  const decimals = decimalsFor(delta);
  const scale = 10 ** decimals;
  const a = Math.round(after * scale);
  return fromUnits(a - Math.round(delta * scale), a, decimals);
}

/** A change on its own, signed and rounded as stepChange rounds it: "−6.8", "+1.2". */
export function signedChange(delta: number): string {
  return stepChange(0, delta).change;
}

// ---------------------------------------------------------------------------
// Greedy: steps and phases
// ---------------------------------------------------------------------------

export type TracePhase = NonNullable<OptimizerMove['phase']>;

/** In the order a greedy run goes through them. */
export const TRACE_PHASES: readonly TracePhase[] = ['init-layout', 'init-fingers', 'hill-climb'];

export const PHASE_LABELS: Record<TracePhase, string> = {
  'init-layout': 'Placement',
  'init-fingers': 'Finger setup',
  'hill-climb': 'Hill climb',
};

/** One row of a greedy trace, from its iteration trace or its move history. */
export interface TraceStep {
  /** Its place in the whole list: the replay step (state.moveHistoryIndex). */
  index: number;
  phase: TracePhase | undefined;
  description: string;
  /** The cost after the step and its change (placement steps carry no cost). */
  after: number;
  delta: number;
  attemptIndex: number;
  iteration?: OptimizationIteration;
  move?: OptimizerMove;
}

/** The rows the panel lists: the iteration trace when there is one (its steps replay on the grid), else the moves. */
export function traceSteps(moves: OptimizerMove[] | null | undefined, iterations: OptimizationIteration[] | null | undefined): TraceStep[] {
  if (iterations?.length) {
    return iterations.map((iteration, index) => ({
      index,
      phase: iteration.phase,
      description: iteration.summary,
      after: iteration.scoreAfter,
      delta: iteration.netDelta,
      attemptIndex: iteration.attemptIndex ?? 0,
      iteration,
    }));
  }
  return (moves ?? []).map((move, index) => ({
    index,
    phase: move.phase,
    description: move.description,
    after: move.costAfter,
    delta: move.costDelta,
    attemptIndex: move.attemptIndex ?? 0,
    move,
  }));
}

/** Steps per phase, only the phases that happened, in run order. */
export function phaseCounts(steps: readonly TraceStep[]): Array<{ phase: TracePhase; count: number }> {
  return TRACE_PHASES
    .map(phase => ({ phase, count: steps.filter(s => s.phase === phase).length }))
    .filter(p => p.count > 0);
}

/**
 * What the hill climb did: the cost before its first step and after its last,
 * in the last attempt (a run with restarts lists every attempt's steps).
 */
export function hillClimbChange(steps: readonly TraceStep[]): { change: CostChange; steps: number } | null {
  const climbing = steps.filter(s => s.phase === 'hill-climb');
  if (climbing.length === 0) return null;
  const attempt = climbing[climbing.length - 1]!.attemptIndex;
  const run = climbing.filter(s => s.attemptIndex === attempt);
  const first = run[0]!;
  const last = run[run.length - 1]!;
  return { change: costChange(first.after - first.delta, last.after), steps: run.length };
}

/** The cost a run started from: its finger-setup step's (moves only). */
export function startingCost(steps: readonly TraceStep[]): number | null {
  const setup = steps.find(s => s.phase === 'init-fingers');
  return setup && Number.isFinite(setup.after) ? setup.after : null;
}

// ---------------------------------------------------------------------------
// Annealing: summary, runs and a reduced series for drawing
// ---------------------------------------------------------------------------

/** A stretch of consecutive snapshots drawn as one point. */
export interface AnnealingBucket {
  /** Snapshot indices [from, to) across all runs. */
  from: number;
  to: number;
  /** Mean current cost, lowest best-so-far cost and mean temperature over the stretch. */
  current: number;
  best: number;
  temperature: number;
  accepted: number;
  count: number;
  /** The run (restart) its first snapshot belongs to: 0 is the first. */
  run: number;
}

export interface AnnealingRun {
  run: number;
  iterations: number;
  accepted: number;
  /** Best cost found by the end of this run (the search keeps its best across runs). */
  best: number;
  /** Its share of the time limit ran out before its planned iterations. */
  stoppedByTime: boolean;
}

export interface AnnealingSummary {
  total: number;
  accepted: number;
  runs: AnnealingRun[];
  /** The cost at the first iteration, and the best found. */
  start: number;
  best: number;
  change: CostChange;
  /** Snapshot index where each run after the first starts. */
  runStarts: number[];
  buckets: AnnealingBucket[];
}

/** Points drawn at most; every snapshot still counts in the summary and the table. */
export const ANNEALING_MAX_POINTS = 150;

export function summarizeAnnealing(trace: readonly AnnealingIterationSnapshot[], maxPoints = ANNEALING_MAX_POINTS): AnnealingSummary | null {
  const n = trace.length;
  if (n === 0) return null;
  const runs = new Map<number, AnnealingRun>();
  const runStarts: number[] = [];
  let accepted = 0;
  trace.forEach((s, i) => {
    const run = s.restartIndex ?? 0;
    let row = runs.get(run);
    if (!row) {
      row = { run, iterations: 0, accepted: 0, best: s.bestCost, stoppedByTime: false };
      runs.set(run, row);
      if (i > 0) runStarts.push(i);
    }
    row.iterations++;
    if (s.accepted) {
      row.accepted++;
      accepted++;
    }
    row.best = s.bestCost;
    if (s.stoppedBy === 'time_budget') row.stoppedByTime = true;
  });

  const size = Math.max(1, Math.ceil(n / Math.max(1, maxPoints)));
  const buckets: AnnealingBucket[] = [];
  for (let from = 0; from < n; from += size) {
    const to = Math.min(n, from + size);
    let current = 0, temperature = 0, best = Infinity, acc = 0;
    for (let i = from; i < to; i++) {
      const s = trace[i]!;
      current += s.currentCost;
      temperature += s.temperature;
      best = Math.min(best, s.bestCost);
      if (s.accepted) acc++;
    }
    const count = to - from;
    buckets.push({
      from, to, count, accepted: acc,
      current: current / count,
      best,
      temperature: temperature / count,
      run: trace[from]!.restartIndex ?? 0,
    });
  }

  const start = trace[0]!.currentCost;
  const best = trace[n - 1]!.bestCost;
  return {
    total: n,
    accepted,
    runs: [...runs.values()].sort((a, b) => a.run - b.run),
    start,
    best,
    change: costChange(start, best),
    runStarts,
    buckets,
  };
}
