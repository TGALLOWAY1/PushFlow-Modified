/**
 * Hooks the Performance Route reads the project through (S9.2).
 *
 * - useActiveLayoutPlan: the Active Layout's own Execution Plan, from the
 *   per-layout cache, judged fresh against the Active Layout (R-D6). It is the
 *   Route's only plan source: never the displayed plan (which follows the
 *   draft or an inspected layout) nor the global analysisStale flag (which a
 *   draft edit sets while Active is unchanged).
 * - usePlayheadAt: the playhead rounded down to a step, re-rendering only
 *   when that rounded value changes, so a card's state or a lane's live dot
 *   follows the music without redrawing every frame.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useProject } from '../state/ProjectContext';
import { useTransport } from '../audio/TransportProvider';
import { useLayoutAnalysis, type LayoutAnalysisState } from '../analysis/layoutAnalysis';
import { checkPlanFreshness } from '../../engine/evaluation/executionPlanValidation';
import { type ExecutionPlanResult } from '../../types/executionPlan';

export interface ActiveLayoutPlan {
  /** Where the Active Layout's analysis is: no notes placed ('empty'), scoring, ready or failed. */
  status: LayoutAnalysisState['status'];
  /** The plan, only while it is fresh for the Active Layout. */
  plan: ExecutionPlanResult | null;
  /** Notes the plan can't play, by eventKey. */
  unplayable: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

export function useActiveLayoutPlan(): ActiveLayoutPlan {
  const { state } = useProject();
  const scored = useLayoutAnalysis(state.activeLayout);
  const candidate = scored.status === 'ready' ? scored.analysis.executionPlan : null;
  const plan = candidate && checkPlanFreshness(candidate, state.activeLayout).isFresh ? candidate : null;
  const unplayable = useMemo(() => {
    if (!plan) return NONE;
    const keys = plan.fingerAssignments
      .filter(a => a.assignedHand === 'Unplayable' && a.eventKey)
      .map(a => a.eventKey as string);
    return keys.length > 0 ? new Set(keys) : NONE;
  }, [plan]);
  return { status: scored.status, plan, unplayable };
}

const noSubscription = () => () => {};

/**
 * The playhead in seconds, rounded down to a multiple of `step` seconds: the
 * transport's live position while it plays, else where it rests.
 */
export function usePlayheadAt(step: number): number {
  const { engine } = useTransport();
  const { state } = useProject();
  const resting = state.currentTime;
  const round = (t: number) => (step > 0 ? Math.floor(t / step + 1e-9) * step : t);
  return useSyncExternalStore(
    engine ? engine.subscribe : noSubscription,
    () => round(engine && engine.isRunning() ? engine.snapshot : resting),
  );
}
