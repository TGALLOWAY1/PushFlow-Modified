/**
 * Per-layout analysis cache (T08 slice, roadmap P1b "Compare stop-gap and
 * analysis cache"; S3.1 "One yardstick").
 *
 * An in-memory LRU of scored layouts: each entry holds a layout's own
 * analysis plan (Execution Plan, difficulty analysis, tradeoff profile) and its
 * Playability, keyed fully by
 *   (layoutHash, performanceHash, costToggles, evaluatorId).
 * It is analysis-only state: it lives in this module, never in project state,
 * never in undo history and never in storage. Losing it costs a re-solve.
 *
 * `getAnalysisForLayout` serves a cached entry, joins a solve already in flight
 * for the same key, or runs `compute` once. A failed solve is not cached.
 */

import type { CostToggles } from '../../types/costToggles';
import type { Performance, InstrumentConfig } from '../../types/performance';
import type { EngineConfiguration } from '../../types/engineConfig';
import type { Section } from '../../types/performanceStructure';
import type { ScoredLayoutAnalysis } from './scoreLayout';

export interface AnalysisKey {
  layoutHash: string;
  /** The performance and every setting that shapes its plan (see hashPerformance). */
  performanceHash: string;
  costToggles: CostToggles;
  /** Which evaluator scored the layout (the engine's PLAYABILITY_EVALUATOR_ID). */
  evaluatorId: string;
}

/**
 * Entries kept before the least recently used one is dropped: room for every
 * row a Layouts list shows at once (Active, the draft, about 12 candidates
 * across runs, the variants and 5 recovered drafts) with space to spare. A row
 * keeps a result it already has even after its entry is dropped
 * (useLayoutAnalysis), so a full cache never makes rows re-solve each other out.
 */
export const ANALYSIS_CACHE_CAPACITY = 64;

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

const entries = new Map<string, ScoredLayoutAnalysis>();
const inFlight = new Map<string, Promise<ScoredLayoutAnalysis>>();

function touch(k: string, value: ScoredLayoutAnalysis) {
  entries.delete(k);
  entries.set(k, value);
  while (entries.size > ANALYSIS_CACHE_CAPACITY) {
    const oldest = entries.keys().next().value as string;
    entries.delete(oldest);
  }
}

/** The cached entry for this key, or null. Marks it recently used. */
export function peekAnalysis(key: AnalysisKey): ScoredLayoutAnalysis | null {
  const k = analysisCacheKey(key);
  const hit = entries.get(k);
  if (!hit) return null;
  touch(k, hit);
  return hit;
}

/** Stores an entry computed elsewhere under its key. */
export function rememberAnalysis(key: AnalysisKey, value: ScoredLayoutAnalysis): void {
  touch(analysisCacheKey(key), value);
}

/**
 * The scored analysis of a layout: from the cache, from a solve already
 * running for the same key, or by running `compute` once and caching its result.
 */
export function getAnalysisForLayout(
  key: AnalysisKey,
  compute: () => Promise<ScoredLayoutAnalysis>,
): Promise<ScoredLayoutAnalysis> {
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
