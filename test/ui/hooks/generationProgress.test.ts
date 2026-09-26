/**
 * The toolbar's progress pill (S3.4, T35): its wording, and the store that
 * shows at most four updates a second.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createGenerationProgressStore,
  describeGenerationProgress,
  formatDuration,
  stoppedRunMessage,
  announceRun,
  PROGRESS_THROTTLE_MS,
} from '../../../src/ui/hooks/generationProgress';
import { type GenerationProgress } from '../../../src/engine/optimization/runControl';
import { type GenerationRunRecord } from '../../../src/ui/state/projectState';

afterEach(() => vi.useRealTimers());

const annealing = (over: Partial<GenerationProgress> = {}): GenerationProgress => ({
  method: 'annealing', current: 2, total: 3, counts: 'candidates',
  iteration: 1200, iterationsPlanned: 3200, elapsedMs: 90_000, etaMs: 8_000, ...over,
});

describe('describeGenerationProgress', () => {
  it('reads "Candidate 2 of 3 · ~8 s left", and annealing adds its iteration count', () => {
    expect(describeGenerationProgress({ method: 'beam', progress: annealing({ method: 'beam', iteration: undefined, iterationsPlanned: undefined }) }))
      .toBe('Candidate 2 of 3 · ~8 s left');
    expect(describeGenerationProgress({ method: 'annealing', progress: annealing() }))
      .toBe('Candidate 2 of 3 · ~8 s left · iteration 1,200 of 3,200');
    expect(describeGenerationProgress({ method: 'annealing', progress: annealing({ etaMs: null }) }))
      .toBe('Candidate 2 of 3 · iteration 1,200 of 3,200');
  });

  it('counts the layouts greedy tries, and leaves the ETA out until there is one', () => {
    expect(describeGenerationProgress({
      method: 'greedy',
      progress: { method: 'greedy', current: 5, total: 16, counts: 'layouts', elapsedMs: 100, etaMs: null },
    })).toBe('Trying layout 5 of 16');
    expect(describeGenerationProgress({ method: 'greedy', progress: null })).toBe('Preparing…');
  });

  it('formats time left in seconds, then minutes', () => {
    expect(formatDuration(400)).toBe('1 s');
    expect(formatDuration(8_200)).toBe('8 s');
    expect(formatDuration(100_000)).toBe('1 min 40 s');
    expect(formatDuration(120_000)).toBe('2 min');
    expect(formatDuration(59 * 60_000)).toBe('59 min');
  });
});

describe('when a run ends', () => {
  const run = (over: Partial<GenerationRunRecord>): GenerationRunRecord => ({
    outcome: 'completed', stopReason: 'completed', method: 'annealing', candidateCount: 3, elapsedMs: 1000, ...over,
  });

  it('a run that stopped early gets a toast in the trace panel’s words', () => {
    expect(stoppedRunMessage(run({ outcome: 'cancelled', stopReason: 'cancelled', candidateCount: 0 })))
      .toBe('Stopped: cancelled · nothing from that run was kept');
    expect(stoppedRunMessage(run({ stopReason: 'time_budget' })))
      .toBe('Stopped: time limit reached · Thorough kept the best layouts it found');
    expect(stoppedRunMessage(run({}))).toBeNull();
  });

  it('the live region announces a finish, a failure, and leaves early stops to their toast', () => {
    expect(announceRun(run({}))).toBe('Generation finished: 3 candidates.');
    expect(announceRun(run({ candidateCount: 1 }))).toBe('Generation finished: 1 candidate.');
    expect(announceRun(run({ outcome: 'failed', stopReason: null, candidateCount: 0 }))).toBe('Generation failed.');
    expect(announceRun(run({ outcome: 'cancelled', stopReason: 'cancelled' }))).toBe('');
    expect(announceRun(run({ stopReason: 'time_budget' }))).toBe('');
  });
});

describe('createGenerationProgressStore', () => {
  it('shows the first report at once, then at most one every PROGRESS_THROTTLE_MS, and the latest wins', () => {
    vi.useFakeTimers();
    const store = createGenerationProgressStore();
    const seen: Array<number | undefined> = [];
    store.subscribe(() => seen.push(store.get()?.progress?.iteration));

    store.start('annealing');
    expect(store.get()).toEqual({ method: 'annealing', progress: null });
    store.report(annealing({ iteration: 1 }));
    store.report(annealing({ iteration: 2 }));
    store.report(annealing({ iteration: 3 }));
    expect(store.get()?.progress?.iteration).toBe(1);
    vi.advanceTimersByTime(PROGRESS_THROTTLE_MS);
    expect(store.get()?.progress?.iteration).toBe(3);
    expect(seen).toEqual([undefined, 1, 3]);

    store.report(annealing({ iteration: 4 }));
    store.finish();
    vi.advanceTimersByTime(PROGRESS_THROTTLE_MS);
    expect(store.get()).toBeNull();
    expect(seen).toEqual([undefined, 1, 3, undefined]);
  });

  it('ignores reports when no run is in flight', () => {
    const store = createGenerationProgressStore();
    store.report(annealing());
    expect(store.get()).toBeNull();
  });
});
