/**
 * The inspected layout's own plan (S3.2). A read-only layout on screen (Active
 * over a differing draft, a candidate, a variant, a recovered draft) is shown
 * with its plan from the per-layout cache, the one its Score describes and the
 * one the draft gets after "Use as my draft", never a candidate's optimizer
 * plan (that stays on the CandidateSolution, for its trace).
 *
 * The plan is mirrored into state.inspectedAnalysis, so the pure selectors the
 * grid, the timeline, the Events list and the costs panels read
 * (getDisplayedExecutionPlan) see it too. The mirror is session state (no undo,
 * never saved) and is ignored unless it is fresh for the layout on screen.
 * Mounted once, by the workspace.
 */

import { useLayoutEffect } from 'react';
import { useProject } from '../state/ProjectContext';
import { resolveInspectedLayout } from '../state/projectState';
import { useLayoutAnalysis, type LayoutAnalysisState } from '../analysis/layoutAnalysis';

export function useInspectedAnalysis(): LayoutAnalysisState {
  const { state, dispatch } = useProject();
  const shown = resolveInspectedLayout(state);
  const scored = useLayoutAnalysis(shown.readOnly ? shown.layout : null);
  const analysis = scored.status === 'ready' ? scored.analysis : null;
  // Before paint, so a plan already in the cache never flashes an empty timeline.
  useLayoutEffect(() => {
    if (analysis && analysis !== state.inspectedAnalysis) {
      dispatch({ type: 'SET_INSPECTED_ANALYSIS', payload: analysis });
    }
  }, [analysis, state.inspectedAnalysis, dispatch]);
  return scored;
}
