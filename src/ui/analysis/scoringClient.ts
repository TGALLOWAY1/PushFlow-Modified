/**
 * Scoring client (S3.1, "One yardstick"): runs analyseAndScoreLayout in a
 * module worker, so solving and scoring the layouts on screen never blocks the
 * page. Each request carries an id and the worker answers by it. Where there is
 * no Worker (vitest's node and happy-dom), or the worker fails to start or to
 * answer, the same function runs in-process, so a layout is always scored.
 *
 * Requests reach here only through the analysis cache, which serves hits and
 * joins a request already in flight for the same key.
 */

import { analyseAndScoreLayout, type ScoreLayoutRequest, type ScoredLayoutAnalysis } from './scoreLayout';

export interface ScoringRequestMessage {
  id: number;
  request: ScoreLayoutRequest;
}

export type ScoringResponseMessage =
  | { id: number; ok: true; result: ScoredLayoutAnalysis }
  | { id: number; ok: false; message: string };

/** How many layouts were scored in the worker and in-process (read by the e2e hook). */
export interface ScoringCounts {
  worker: number;
  inline: number;
}

interface Pending {
  request: ScoreLayoutRequest;
  resolve: (value: ScoredLayoutAnalysis) => void;
  reject: (error: Error) => void;
}

const counts: ScoringCounts = { worker: 0, inline: 0 };
const pending = new Map<number, Pending>();
let nextId = 1;
let worker: Worker | null = null;
/** Set once the worker is unavailable or has failed; from then on everything runs in-process. */
let workerUnavailable = false;

function runInline(request: ScoreLayoutRequest): Promise<ScoredLayoutAnalysis> {
  counts.inline++;
  return analyseAndScoreLayout(request);
}

/** The worker failed as a whole: stop using it and score what it still owed in-process. */
function abandonWorker(): void {
  worker?.terminate();
  worker = null;
  workerUnavailable = true;
  const owed = [...pending.values()];
  pending.clear();
  for (const p of owed) runInline(p.request).then(p.resolve, p.reject);
}

function getWorker(): Worker | null {
  if (worker || workerUnavailable) return worker;
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    worker = new Worker(new URL('./scoring.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerUnavailable = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<ScoringResponseMessage>) => {
    const reply = event.data;
    const p = pending.get(reply.id);
    if (!p) return;
    pending.delete(reply.id);
    if (reply.ok) {
      counts.worker++;
      p.resolve(reply.result);
    } else {
      p.reject(new Error(reply.message));
    }
  };
  worker.onerror = event => {
    event.preventDefault();
    abandonWorker();
  };
  worker.onmessageerror = () => abandonWorker();
  return worker;
}

/** Solves and scores a layout, in the worker when there is one. */
export function scoreLayoutInBackground(request: ScoreLayoutRequest): Promise<ScoredLayoutAnalysis> {
  const w = getWorker();
  if (!w) return runInline(request);
  const id = nextId++;
  return new Promise<ScoredLayoutAnalysis>((resolve, reject) => {
    pending.set(id, { request, resolve, reject });
    try {
      w.postMessage({ id, request } satisfies ScoringRequestMessage);
    } catch {
      // Not cloneable (never expected for plain project data): score it here.
      pending.delete(id);
      runInline(request).then(resolve, reject);
    }
  });
}

export function scoringCounts(): ScoringCounts {
  return { ...counts };
}

/** Tests only: forget the worker, the counts and anything pending. */
export function resetScoringClient(): void {
  worker?.terminate();
  worker = null;
  workerUnavailable = false;
  pending.clear();
  counts.worker = 0;
  counts.inline = 0;
}
