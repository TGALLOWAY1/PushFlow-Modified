/**
 * Per-layout analysis cache (T08 slice, roadmap P1b "Compare stop-gap and
 * analysis cache").
 *
 * An in-memory LRU of analysed layouts (Execution Plan, difficulty analysis,
 * tradeoff profile), keyed fully by
 *   (layoutHash, performanceHash, costToggles, evaluatorId).
 * It is analysis-only state: it lives in this module, never in project state,
 * never in undo history and never in storage. Losing it costs a re-solve.
 *
 * `getAnalysisForLayout` serves a cached entry, joins a solve already in flight
 * for the same key, or runs `compute` once. A failed solve is not cached.
 */

import { hashLayout } from '@/engine';
import type { Layout } from '../../types/layout';
import type { CandidateSolution } from '../../types/candidateSolution';
import type { CostToggles } from '../../types/costToggles';
import type { Performance, InstrumentConfig } from '../../types/performance';
import type { EngineConfiguration } from '../../types/engineConfig';
import type { Section } from '../../types/performanceStructure';

export interface AnalysisKey {
  layoutHash: string;
  /** The performance and every setting that shapes its plan (see hashPerformance). */
  performanceHash: string;
  costToggles: CostToggles;
  /** Which evaluator produced the plan. */
  evaluatorId: string;
}

/** The auto-analysis evaluator: fast beam solve (analyzeLayout). */
export const AUTO_ANALYSIS_EVALUATOR_ID = 'beam-fast';

/** Entries kept before the least recently used one is dropped. */
export const ANALYSIS_CACHE_CAPACITY = 16;

/** 53-bit string hash (cyrb53); stable across sessions. */
function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export interface PerformanceContext {
  engineConfig: EngineConfiguration;
  instrumentConfig: InstrumentConfig;
  sections: Section[];
}

/**
 * Hash of the performance being analysed plus the settings that change its
 * plan (engine config, instrument, sections). Events are identified by Sound,
 * time and key, never by pitch alone.
 */
export function hashPerformance(performance: Performance, context: PerformanceContext): string {
  const events = performance.events.map(e => [e.eventKey ?? null, e.voiceId ?? null, e.noteNumber, e.startTime, e.duration ?? null, e.velocity ?? null]);
  return hashString(JSON.stringify([events, context.engineConfig, context.instrumentConfig, context.sections]));
}

export function analysisCacheKey(key: AnalysisKey): string {
  const toggles = Object.keys(key.costToggles).sort().map(k => `${k}:${(key.costToggles as unknown as Record<string, unknown>)[k]}`).join(',');
  return `${key.evaluatorId}|${key.performanceHash}|${toggles}|${hashString(key.layoutHash)}`;
}

/** Builds the key for a layout from its parts. */
export function makeAnalysisKey(
  layout: Layout,
  performance: Performance,
  context: PerformanceContext & { costToggles: CostToggles },
  evaluatorId: string = AUTO_ANALYSIS_EVALUATOR_ID,
): AnalysisKey {
  return {
    layoutHash: hashLayout(layout),
    performanceHash: hashPerformance(performance, context),
    costToggles: context.costToggles,
    evaluatorId,
  };
}

const entries = new Map<string, CandidateSolution>();
const inFlight = new Map<string, Promise<CandidateSolution>>();

function touch(k: string, value: CandidateSolution) {
  entries.delete(k);
  entries.set(k, value);
  while (entries.size > ANALYSIS_CACHE_CAPACITY) {
    const oldest = entries.keys().next().value as string;
    entries.delete(oldest);
  }
}

/** The cached analysis for this key, or null. Marks it recently used. */
export function peekAnalysis(key: AnalysisKey): CandidateSolution | null {
  const k = analysisCacheKey(key);
  const hit = entries.get(k);
  if (!hit) return null;
  touch(k, hit);
  return hit;
}

/** Stores an analysis computed elsewhere (auto-analysis) under its key. */
export function rememberAnalysis(key: AnalysisKey, value: CandidateSolution): void {
  touch(analysisCacheKey(key), value);
}

/**
 * The analysis of a layout: from the cache, from a solve already running for
 * the same key, or by running `compute` once and caching its result.
 */
export function getAnalysisForLayout(
  key: AnalysisKey,
  compute: () => Promise<CandidateSolution>,
): Promise<CandidateSolution> {
  const k = analysisCacheKey(key);
  const hit = entries.get(k);
  if (hit) {
    touch(k, hit);
    return Promise.resolve(hit);
  }
  const running = inFlight.get(k);
  if (running) return running;
  const p = compute().then(
    value => {
      inFlight.delete(k);
      touch(k, value);
      return value;
    },
    err => {
      inFlight.delete(k);
      throw err;
    },
  );
  inFlight.set(k, p);
  return p;
}

export function analysisCacheSize(): number {
  return entries.size;
}

/** Tests only. */
export function clearAnalysisCache(): void {
  entries.clear();
  inFlight.clear();
}
