/**
 * LayoutDebugPanel.
 *
 * Appears when solver results have unplayable events.
 * Shows rejection reason breakdown and zone boundary info.
 * Lets the user recompute after manually adjusting the grid layout.
 */

import { useState, useCallback } from 'react';
import { useProject } from '../../state/ProjectContext';
import { getActivePerformance, getDisplayedLayout, getActiveStreams } from '../../state/projectState';
import { createBeamSolver } from '../../../engine/solvers/beamSolver';
import { type SolverConfig } from '../../../types/engineConfig';
import { type ExecutionPlanResult } from '../../../types/executionPlan';

const REASON_LABELS: Record<string, string> = {
  unmapped: 'Not mapped to any pad',
  zone_conflict: 'Pad outside hand zone',
  ownership_conflict: 'Finger ownership conflict',
  speed_limit: 'Hand speed exceeded',
  no_valid_grip: 'No valid finger grip',
  beam_exhausted: 'No solution path found',
};

interface LayoutDebugPanelProps {
  executionPlan: ExecutionPlanResult;
}

export function LayoutDebugPanel({ executionPlan }: LayoutDebugPanelProps) {
  const { state, dispatch } = useProject();
  const [recomputeResult, setRecomputeResult] = useState<ExecutionPlanResult | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);

  const activeResult = recomputeResult ?? executionPlan;
  const unplayableCount = activeResult.unplayableCount;
  const totalEvents = activeResult.fingerAssignments.length;
  const playableCount = totalEvents - unplayableCount;

  // Aggregate rejection reasons
  const reasonCounts: Record<string, number> = {};
  if (activeResult.rejectionReasons) {
    for (const reasons of Object.values(activeResult.rejectionReasons)) {
      for (const r of reasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
  }

  const handleRecompute = useCallback(async () => {
    const layout = getDisplayedLayout(state);
    const activeStreams = getActiveStreams(state);
    if (!layout || activeStreams.length === 0) return;

    setIsRecomputing(true);
    try {
      const performance = getActivePerformance(state);
      const solverConfig: SolverConfig = {
        instrumentConfig: state.instrumentConfig,
        layout,
        sourceLayoutRole: layout.role,
        mappingResolverMode: 'allow-fallback',
      };
      const solver = createBeamSolver(solverConfig);
      const result = await solver.solve(performance, state.engineConfig);
      setRecomputeResult(result);

      // Update the analysis result in state so the timeline reflects the new assignments
      if (state.analysisResult) {
        dispatch({
          type: 'SET_ANALYSIS_RESULT',
          payload: { ...state.analysisResult, executionPlan: result },
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Recompute failed',
      });
    } finally {
      setIsRecomputing(false);
    }
  }, [state, dispatch]);

  if (unplayableCount === 0) return null;

  return (
    <div className="rounded-pf-lg border border-red-500/15 bg-red-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-pf-sm font-medium text-red-400">
          Debug: {unplayableCount}/{totalEvents} events unplayable
        </h3>
        <button
          className={`pf-btn text-pf-xs ${
            isRecomputing
              ? 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] cursor-wait'
              : 'bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20'
          }`}
          onClick={handleRecompute}
          disabled={isRecomputing}
          title="Re-run solver on current pad layout to check if manual adjustments fix unplayable events"
        >
          {isRecomputing ? 'Recomputing...' : 'Recompute'}
        </button>
      </div>

      {/* Playability summary bar */}
      <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500/60 transition-all rounded-full"
          style={{ width: `${(playableCount / totalEvents) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-pf-xs text-[var(--text-secondary)]">
        <span>{playableCount} playable</span>
        <span>{unplayableCount} unplayable</span>
      </div>

      {/* Rejection reason breakdown */}
      {Object.keys(reasonCounts).length > 0 && (
        <div className="space-y-1">
          <span className="section-header">Rejection reasons:</span>
          {Object.entries(reasonCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between text-pf-xs">
                <span className="text-[var(--text-secondary)]">{REASON_LABELS[reason] ?? reason}</span>
                <span className="text-red-400/80 font-mono tabular-nums">{count}</span>
              </div>
            ))}
        </div>
      )}

      {/* Zone reference */}
      <div className="text-pf-xs text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] pt-2">
        <span className="font-medium text-[var(--text-secondary)]">Hand zones: </span>
        Left cols 0-4, Right cols 3-7, Shared cols 3-4.
        Drag pads on the grid to adjust placement, then click Recompute.
      </div>

      {recomputeResult && (
        <div className="text-pf-xs text-[var(--text-secondary)] italic">
          Showing recomputed results. {recomputeResult.unplayableCount === 0
            ? 'All events now playable!'
            : `Still ${recomputeResult.unplayableCount} unplayable.`}
        </div>
      )}
    </div>
  );
}
