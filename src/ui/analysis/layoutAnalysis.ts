/**
 * One yardstick for every layout on screen (S3.1, T21 slice), through the
 * per-layout analysis cache (T08).
 *
 * `analyseLayoutCached(state, layout)` gives any layout of this project (the
 * Active Layout, the draft, a candidate, a variant) its own analysis plan and
 * its Playability, solved and scored in the scoring worker. The draft's
 * auto-analysis takes the same path, so a layout scores the same wherever it is
 * shown and whichever optimizer proposed it. Only the notes of Sounds on the
 * layout's pads are scored (S3.3): a partly placed layout is unfinished, not
 * failed.
 *
 * `useLayoutAnalysis(layout)` is the hook form: 'analysing' ("Scoring…"), then
 * `{ analysis, score }` (the plan, bound to `layout`, and its LayoutScore), or
 * 'error' ("Couldn't score"). Any surface that shows a layout it isn't editing
 * (Compare, the Layouts list, S3.2's inspected layout) renders it with this
 * plan and this score. Nothing here is written to project state
 * (analysis-only, never persisted, never in undo history).
 */

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { hashLayout, PLAYABILITY_EVALUATOR_ID, type LayoutScore } from '@/engine';
import { useProject } from '../state/ProjectContext';
import {
  getActivePerformance,
  rebindAnalysisToLayout,
  withDerivedLayoutState,
  type ProjectState,
} from '../state/projectState';
import type { Layout } from '../../types/layout';
import type { Performance } from '../../types/performance';
import type { CandidateSolution } from '../../types/candidateSolution';
import type { ScoreLayoutRequest, ScoredLayoutAnalysis } from './scoreLayout';
import { scoreLayoutInBackground } from './scoringClient';
import {
  getAnalysisForLayout,
  hashPerformance,
  peekAnalysis,
  analysisCacheKey,
  type AnalysisKey,
} from './analysisCache';

/**
 * The layout as it is scored: its pad finger preferences re-derived from each
 * Sound's own (voiceConstraints, invariant 6) and its locks pruned to Sounds on
 * their pads, exactly as applying it as the draft leaves it. A candidate and
 * the same pads applied as the draft therefore share one key and one score,
 * even when the candidate carries preferences keyed to pads its Sounds have left.
 */
export function scoringLayoutFor(state: ProjectState, layout: Layout): Layout {
  return withDerivedLayoutState(layout, state.voiceConstraints);
}

/** The project's performance and its hash, reused while nothing they depend on changes. */
let lastPerformance: {
  from: readonly unknown[];
  performance: Performance;
  performanceHash: string;
} | null = null;

function performanceFor(state: ProjectState): { performance: Performance; performanceHash: string } {
  const from = [state.soundStreams, state.tempo, state.name, state.engineConfig, state.instrumentConfig, state.sections];
  if (lastPerformance && from.every((part, i) => part === lastPerformance!.from[i])) return lastPerformance;
  const performance = getActivePerformance(state);
  const performanceHash = hashPerformance(performance, {
    engineConfig: state.engineConfig,
    instrumentConfig: state.instrumentConfig,
    sections: state.sections,
  });
  lastPerformance = { from, performance, performanceHash };
  return lastPerformance;
}

/**
 * The performance a layout is scored on: only the notes of Sounds on its pads
 * (S3.3, T25). A partly placed layout is unfinished, not failed: its unplaced
 * Sounds' notes are neither played nor counted as unplayable, so its plan,
 * verdict and Playability describe the notes you can play so far. The hash
 * covers the notes kept, so the cache key follows them. Reused per layout
 * placement while the performance is unchanged.
 */
type ScoredPerformance = { performance: Performance; performanceHash: string };

const placedPerformances = new Map<string, { from: Performance; result: ScoredPerformance }>();

function placedPerformanceFor(state: ProjectState, layout: Layout): ScoredPerformance {
  const full = performanceFor(state);
  const placed = new Set(Object.values(layout.padToVoice).map(v => v.id));
  const placedKey = [...placed].sort().join('|');
  const hit = placedPerformances.get(placedKey);
  if (hit && hit.from === full.performance) return hit.result;
  const events = full.performance.events.filter(e => e.voiceId !== undefined && placed.has(e.voiceId));
  let result: ScoredPerformance = full;
  if (events.length !== full.performance.events.length) {
    const performance: Performance = { ...full.performance, events };
    result = {
      performance,
      performanceHash: hashPerformance(performance, {
        engineConfig: state.engineConfig,
        instrumentConfig: state.instrumentConfig,
        sections: state.sections,
      }),
    };
  }
  // A handful of placements are on screen at once (the draft, Active, rows).
  if (placedPerformances.size >= 32) placedPerformances.clear();
  placedPerformances.set(placedKey, { from: full.performance, result });
  return result;
}

/** The cache key and the worker request for one layout of this project. */
export function scoringRequestFor(state: ProjectState, layout: Layout): { key: AnalysisKey; request: ScoreLayoutRequest } {
  const scored = scoringLayoutFor(state, layout);
  const { performance, performanceHash } = placedPerformanceFor(state, scored);
  return {
    key: {
      layoutHash: hashLayout(scored),
      performanceHash,
      costToggles: state.costToggles,
      evaluatorId: PLAYABILITY_EVALUATOR_ID,
    },
    request: {
      performance,
      layout: scored,
      instrumentConfig: state.instrumentConfig,
      engineConfig: state.engineConfig,
      sections: state.sections,
      costToggles: state.costToggles,
    },
  };
}

/** The cache key for a layout of this project. */
export function analysisKeyFor(state: ProjectState, layout: Layout): AnalysisKey {
  return scoringRequestFor(state, layout).key;
}

/** Whether any note in scope is on this layout's pads: with none there is nothing to analyse. */
export function hasPlacedNotes(state: ProjectState, layout: Layout): boolean {
  return Object.keys(layout.padToVoice).length > 0 && placedPerformanceFor(state, layout).performance.events.length > 0;
}

/** A cached entry with its plan bound to the layout it was asked for (same hash, that layout's id and role). */
function boundTo(scored: ScoredLayoutAnalysis, layout: Layout): ScoredLayoutAnalysis {
  return { analysis: rebindAnalysisToLayout(scored.analysis, layout), score: scored.score };
}

/** Plan and Playability of a layout of this project: one solve per key, in the worker. */
export async function analyseLayoutCached(state: ProjectState, layout: Layout): Promise<ScoredLayoutAnalysis> {
  const { key, request } = scoringRequestFor(state, layout);
  return boundTo(await getAnalysisForLayout(key, () => scoreLayoutInBackground(request)), layout);
}

/** The cached plan and Playability of a layout, or null when it hasn't been scored. */
export function peekLayoutAnalysis(state: ProjectState, layout: Layout): ScoredLayoutAnalysis | null {
  const hit = peekAnalysis(analysisKeyFor(state, layout));
  return hit ? boundTo(hit, layout) : null;
}

export type LayoutAnalysisState =
  | { status: 'ready'; analysis: CandidateSolution; score: LayoutScore }
  | { status: 'analysing' }
  | { status: 'error'; message: string }
  | { status: 'empty' };

/**
 * A layout's plan and Playability for a component: from the cache, or
 * scored through it. A result this component already has is kept for as long
 * as its key holds, even after the cache drops the entry, so a row never flips
 * back to "Scoring…" or re-solves because other rows filled the cache.
 */
export function useLayoutAnalysis(layout: Layout | null): LayoutAnalysisState {
  const { state } = useProject();
  // Nothing to analyse without a note on the layout's pads (placed-only scoring, S3.3).
  const isEmpty = !layout || !hasPlacedNotes(state, layout);
  const scoring = useMemo(() => (layout && !isEmpty ? scoringRequestFor(state, layout) : null), [
    layout, isEmpty, state.soundStreams, state.tempo, state.engineConfig, state.instrumentConfig, state.sections, // eslint-disable-line react-hooks/exhaustive-deps
    state.costToggles, state.voiceConstraints,
  ]);
  const keyString = scoring ? analysisCacheKey(scoring.key) : null;

  const held = useRef<{ key: string; value: ScoredLayoutAnalysis } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [, settled] = useReducer((n: number) => n + 1, 0);

  let value = held.current && held.current.key === keyString ? held.current.value : null;
  if (!value && scoring && keyString) {
    const hit = peekAnalysis(scoring.key);
    if (hit) {
      value = hit;
      held.current = { key: keyString, value: hit };
    }
  }

  useEffect(() => {
    if (!scoring || !keyString || held.current?.key === keyString) return;
    let cancelled = false;
    getAnalysisForLayout(scoring.key, () => scoreLayoutInBackground(scoring.request)).then(
      result => {
        if (cancelled) return;
        held.current = { key: keyString, value: result };
        settled();
      },
      err => {
        if (!cancelled) setFailure({ key: keyString, message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { cancelled = true; };
    // Re-run only when the key changes; `scoring` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyString]);

  const analysis = useMemo(
    () => (value && layout ? rebindAnalysisToLayout(value.analysis, layout) : null),
    [value, layout],
  );

  if (isEmpty) return { status: 'empty' };
  if (value && analysis) return { status: 'ready', analysis, score: value.score };
  if (failure && failure.key === keyString) return { status: 'error', message: failure.message };
  return { status: 'analysing' };
}
