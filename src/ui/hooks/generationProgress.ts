/**
 * Generation progress for the toolbar (T35).
 *
 * The engine reports progress about every 50 ms. Keeping it in project state
 * would re-render the whole workspace at that rate, so it lives in this small
 * store instead: only the pill subscribes, and it is told at most every
 * PROGRESS_THROTTLE_MS (the first report and the end of a run go through at
 * once).
 */

import { useSyncExternalStore } from 'react';
import { type GenerationProgress, type OptimizerMethodKey } from '@/engine';
import { type GenerationRunRecord } from '../state/projectState';
import { stopReasonText } from '../analysis/stopReason';

/** What the pill shows while a Generate runs. */
export interface GenerationActivity {
  method: OptimizerMethodKey;
  /** The latest report; null until the engine sends its first. */
  progress: GenerationProgress | null;
}

export interface GenerationProgressStore {
  subscribe(listener: () => void): () => void;
  /** The run in flight, or null when idle. */
  get(): GenerationActivity | null;
  start(method: OptimizerMethodKey): void;
  report(progress: GenerationProgress): void;
  finish(): void;
}

export const PROGRESS_THROTTLE_MS = 250;

export function createGenerationProgressStore(): GenerationProgressStore {
  let current: GenerationActivity | null = null;
  let pending: GenerationProgress | null = null;
  let lastEmit = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    lastEmit = Date.now();
    for (const listener of listeners) listener();
  };
  const flush = () => {
    timer = null;
    if (!current || !pending) return;
    current = { ...current, progress: pending };
    pending = null;
    emit();
  };
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => current,
    start(method) {
      clearTimer();
      pending = null;
      current = { method, progress: null };
      emit();
    },
    report(progress) {
      if (!current) return;
      pending = progress;
      if (current.progress === null) {
        flush();
        return;
      }
      const wait = PROGRESS_THROTTLE_MS - (Date.now() - lastEmit);
      if (wait <= 0) {
        clearTimer();
        flush();
      } else if (timer === null) {
        timer = setTimeout(flush, wait);
      }
    },
    finish() {
      clearTimer();
      pending = null;
      current = null;
      emit();
    },
  };
}

/** Subscribes a component to the run in flight. */
export function useGenerationActivity(store: GenerationProgressStore): GenerationActivity | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** "8 s", "1 min 40 s", then whole minutes ("6 min"): an estimate needs no more. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  if (seconds >= 120) return `${Math.round(seconds / 60)} min`;
  const rest = Math.round((seconds - 60) / 10) * 10;
  return rest === 0 ? '1 min' : rest === 60 ? '2 min' : `1 min ${rest} s`;
}

/**
 * The pill's parts, most important first: which candidate ("Candidate 2 of 3";
 * greedy tries more layouts than it keeps, so it counts layouts), the time left
 * ("~1 min 40 s left", null until the rate is measurable), and for annealing
 * the iteration count ("iteration 1,200 of 3,200").
 */
export function generationProgressParts(
  activity: GenerationActivity,
): { step: string; eta: string | null; iterations: string | null } {
  const p = activity.progress;
  if (!p) return { step: 'Preparing…', eta: null, iterations: null };
  return {
    step: p.counts === 'layouts' ? `Trying layout ${p.current} of ${p.total}` : `Candidate ${p.current} of ${p.total}`,
    eta: p.etaMs === null ? null : `~${formatDuration(p.etaMs)} left`,
    iterations: p.iteration !== undefined && p.iterationsPlanned !== undefined
      ? `iteration ${p.iteration.toLocaleString('en-US')} of ${p.iterationsPlanned.toLocaleString('en-US')}`
      : null,
  };
}

/** The pill's whole text: "Candidate 2 of 3 · ~1 min 40 s left · iteration 1,200 of 3,200". */
export function describeGenerationProgress(activity: GenerationActivity): string {
  const { step, eta, iterations } = generationProgressParts(activity);
  return [step, eta, iterations].filter(Boolean).join(' · ');
}

/**
 * The toast for a run that stopped early ("Stopped: cancelled", "Stopped: time
 * limit reached"); null for a run that simply finished, since the list fills.
 */
export function stoppedRunMessage(run: GenerationRunRecord): string | null {
  if (run.stopReason === 'cancelled') return `${stopReasonText('cancelled')} · nothing from that run was kept`;
  if (run.stopReason === 'time_budget') {
    return `${stopReasonText('time_budget')} · Thorough kept the best layout${run.candidateCount === 1 ? '' : 's'} it found`;
  }
  return null;
}

/** What the toolbar's live region says when a run ends; a run that stopped early is announced by its toast. */
export function announceRun(run: GenerationRunRecord): string {
  if (run.outcome === 'failed') return 'Generation failed.';
  if (run.outcome !== 'completed' || stoppedRunMessage(run)) return '';
  return `Generation finished: ${run.candidateCount} candidate${run.candidateCount === 1 ? '' : 's'}.`;
}
