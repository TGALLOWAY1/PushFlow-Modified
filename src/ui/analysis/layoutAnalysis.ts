/**
 * Analysis of any layout through the per-layout cache (T08 slice).
 *
 * `analysisKeyFor(state, layout)` keys a layout against the project's current
 * performance and settings. `useLayoutAnalysis(layout)` gives a component that
 * layout's analysis: the project's own fresh analysis when it describes the
 * layout, else a cached one, else a solve through the cache
 * ('Analysing…'), or 'error' when the solve fails. Nothing here is written to
 * project state (analysis-only, never persisted).
 */

import { useEffect, useMemo, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActivePerformance, getAnalysisForLayout as getProjectAnalysisForLayout, type ProjectState } from '../state/projectState';
import type { Layout } from '../../types/layout';
import type { CandidateSolution } from '../../types/candidateSolution';
import { analyzeLayout } from './analyzeLayout';
import {
  getAnalysisForLayout,
  makeAnalysisKey,
  peekAnalysis,
  analysisCacheKey,
  type AnalysisKey,
} from './analysisCache';

export function analysisKeyFor(state: ProjectState, layout: Layout): AnalysisKey {
  return makeAnalysisKey(layout, getActivePerformance(state), {
    engineConfig: state.engineConfig,
    instrumentConfig: state.instrumentConfig,
    sections: state.sections,
    costToggles: state.costToggles,
  });
}

/** Analyses a layout of this project through the cache (one solve per key). */
export function analyseLayoutCached(state: ProjectState, layout: Layout): Promise<CandidateSolution> {
  const performance = getActivePerformance(state);
  return getAnalysisForLayout(analysisKeyFor(state, layout), () => analyzeLayout({
    performance,
    layout,
    instrumentConfig: state.instrumentConfig,
    engineConfig: state.engineConfig,
    sections: state.sections,
  }));
}

export type LayoutAnalysisState =
  | { status: 'ready'; analysis: CandidateSolution }
  | { status: 'analysing' }
  | { status: 'error'; message: string }
  | { status: 'empty' };

export function useLayoutAnalysis(layout: Layout | null): LayoutAnalysisState {
  const { state } = useProject();
  const own = layout ? getProjectAnalysisForLayout(state, layout) : null;
  const key = useMemo(() => (layout ? analysisKeyFor(state, layout) : null), [
    layout, state.soundStreams, state.engineConfig, state.instrumentConfig, state.sections, state.costToggles, // eslint-disable-line react-hooks/exhaustive-deps
  ]);
  const keyString = key ? analysisCacheKey(key) : null;
  const [result, setResult] = useState<{ key: string; state: LayoutAnalysisState } | null>(null);

  const isEmpty = !layout || Object.keys(layout.padToVoice).length === 0 || getActivePerformance(state).events.length === 0;
  const cached = key && !own && !isEmpty ? peekAnalysis(key) : null;

  useEffect(() => {
    if (!layout || !key || !keyString || own || cached || isEmpty) return;
    let cancelled = false;
    setResult({ key: keyString, state: { status: 'analysing' } });
    analyseLayoutCached(state, layout).then(
      analysis => { if (!cancelled) setResult({ key: keyString, state: { status: 'ready', analysis } }); },
      err => { if (!cancelled) setResult({ key: keyString, state: { status: 'error', message: err instanceof Error ? err.message : String(err) } }); },
    );
    return () => { cancelled = true; };
    // Re-run only when the key changes; `state` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyString, !!own, !!cached, isEmpty]);

  if (isEmpty) return { status: 'empty' };
  if (own) return { status: 'ready', analysis: own };
  if (cached) return { status: 'ready', analysis: cached };
  if (result && result.key === keyString) return result.state;
  return { status: 'analysing' };
}
