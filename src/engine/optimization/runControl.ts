/**
 * Run control for generation: progress, Cancel and the clock (T35).
 *
 * generateCandidates, generateGreedyCandidates and the annealing solver take a
 * RunControl. Cancel sets `signal.aborted`; the runs check it at every yield
 * point (and every iteration) and throw GenerationCancelledError, so a
 * cancelled run returns nothing and its caller commits nothing.
 *
 * `now` is the clock for budgets, elapsed time and the ETA; tests inject one.
 * Yield pacing always uses the real clock: yielding never changes a result, it
 * only lets the page paint and take the Cancel click.
 */

import { type OptimizerMethodKey } from './optimizerInterface';

/** The abort flag Cancel sets (an AbortSignal satisfies it). */
export interface AbortFlag {
  readonly aborted: boolean;
}

/** Progress of a generation run, for the toolbar's pill. */
export interface GenerationProgress {
  method: OptimizerMethodKey;
  /**
   * The candidate being built (1-based) and how many the run builds. Greedy
   * counts the layouts it tries (it keeps the best few of them), so `counts`
   * says which.
   */
  current: number;
  total: number;
  counts: 'candidates' | 'layouts';
  /** Annealing: iterations done and planned for the current candidate. */
  iteration?: number;
  iterationsPlanned?: number;
  /** Time since the run started (ms, on the run's clock). */
  elapsedMs: number;
  /** Estimated time left (ms) from the measured rate; null until measurable. */
  etaMs: number | null;
}

export interface RunControl {
  /** Set by Cancel; checked at every yield point. */
  signal?: AbortFlag;
  /** Called at yield points and whenever a new candidate starts. */
  onProgress?: (progress: GenerationProgress) => void;
  /** The clock (ms) for budgets, elapsed time and the ETA. Defaults to Date.now. */
  now?: () => number;
}

/** The annealing solver's own progress, which generateCandidates turns into GenerationProgress. */
export interface AnnealingProgress {
  /** Iterations run so far, and planned for the whole solve (all restarts). */
  iteration: number;
  iterationsPlanned: number;
  /** The restart running (0 = the first run) and how many runs there are in all. */
  restartIndex: number;
  runs: number;
  /** Time since the solve started (ms, on the run's clock). */
  elapsedMs: number;
}

/** Cancel, clock and progress for one annealing solve. */
export interface AnnealingRunControl {
  signal?: AbortFlag;
  /** Read once when the solve starts, once per iteration, and once at the end. */
  now?: () => number;
  onProgress?: (progress: AnnealingProgress) => void;
}

/** Thrown by a run whose signal was aborted: the run was cancelled, it did not fail. */
export class GenerationCancelledError extends Error {
  constructor() {
    super('Generation cancelled');
    this.name = 'GenerationCancelledError';
  }
}

export function isGenerationCancelled(error: unknown): error is GenerationCancelledError {
  return error instanceof GenerationCancelledError
    || (error instanceof Error && error.name === 'GenerationCancelledError');
}

export function throwIfCancelled(signal?: AbortFlag): void {
  if (signal?.aborted) throw new GenerationCancelledError();
}

// ============================================================================
// Yielding
// ============================================================================

/** Longest stretch of work between yields (ms of real time). */
export const YIELD_SLICE_MS = 50;

const realNow: () => number = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? () => performance.now()
  : () => Date.now();

type NodeLikeGlobal = { process?: { versions?: { node?: string } } };

/**
 * Hands the event loop one macrotask turn.
 *
 * Browsers clamp nested setTimeout(0) to 4 ms, which at one yield per 50 ms
 * would cost about 8% of the run; a MessageChannel post is a task without the
 * clamp. Node has no clamp (and a port with a listener keeps a process alive),
 * so there it is setTimeout.
 */
const nextTask: () => Promise<void> = (() => {
  const isNode = !!(globalThis as NodeLikeGlobal).process?.versions?.node;
  if (!isNode && typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel();
    const waiting: Array<() => void> = [];
    channel.port1.onmessage = () => waiting.shift()?.();
    return () => new Promise<void>(resolve => {
      waiting.push(resolve);
      channel.port2.postMessage(null);
    });
  }
  return () => new Promise<void>(resolve => setTimeout(resolve, 0));
})();

/**
 * Yields when about `sliceMs` of work has passed since the last yield, then
 * checks the abort flag. Checking `due()` is a clock read, cheap enough to do
 * once per evaluated move.
 */
export class Yielder {
  private last = realNow();

  constructor(
    private readonly signal?: AbortFlag,
    private readonly sliceMs: number = YIELD_SLICE_MS,
  ) {}

  due(): boolean {
    return realNow() - this.last >= this.sliceMs;
  }

  /** Yields now, then throws if the run was cancelled meanwhile. */
  async yield(): Promise<void> {
    throwIfCancelled(this.signal);
    await nextTask();
    this.last = realNow();
    throwIfCancelled(this.signal);
  }
}

// ============================================================================
// ETA
// ============================================================================

/** Below this much measured work an estimate is noise, so the ETA stays null. */
const MIN_MEASURED_MS = 250;

/**
 * Time left for `unitsLeft` units at the rate measured so far (`unitsDone` in
 * `elapsedMs`); null until there is a rate to measure.
 */
export function estimateRemainingMs(unitsDone: number, elapsedMs: number, unitsLeft: number): number | null {
  if (unitsDone <= 0 || elapsedMs < MIN_MEASURED_MS) return null;
  return Math.max(0, (unitsLeft * elapsedMs) / unitsDone);
}
