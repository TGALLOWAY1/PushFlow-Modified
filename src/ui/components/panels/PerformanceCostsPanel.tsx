import { useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { getDisplayedExecutionPlan } from '../../state/projectState';
import { CostBreakdownBars } from './CostBreakdownBars';
import { EventCostChart } from './EventCostChart';
import { formatPlanScore, getPlanScoreQuality, getPlanScoreSummary } from '../../analysis/planScore';

export function PerformanceCostsPanel() {
  const { state, dispatch } = useProject();
  const [chartOpen, setChartOpen] = useState(false);
  const currentPlan = getDisplayedExecutionPlan(state);

  const assignment = useMemo(() => {
    if (state.selectedEventIndex === null || !currentPlan) return null;
    return currentPlan.fingerAssignments.find(a => a.eventIndex === state.selectedEventIndex) ?? null;
  }, [currentPlan, state.selectedEventIndex]);

  const selectedEventMetrics = useMemo(() => {
    if (state.selectedEventIndex === null || !currentPlan) return null;
    const assignments = currentPlan.fingerAssignments.filter(a => a.eventIndex === state.selectedEventIndex);
    if (assignments.length === 0) return null;

    const metrics = {
      fingerPreference: 0,
      handShapeDeviation: 0,
      transitionCost: 0,
      handBalance: 0,
      constraintPenalty: 0,
      total: 0,
    };

    for (const current of assignments) {
      if (current.costBreakdown) {
        metrics.fingerPreference += current.costBreakdown.fingerPreference;
        metrics.handShapeDeviation += current.costBreakdown.handShapeDeviation;
        metrics.transitionCost += current.costBreakdown.transitionCost;
        metrics.handBalance += current.costBreakdown.handBalance;
        metrics.constraintPenalty += current.costBreakdown.constraintPenalty;
        metrics.total += current.costBreakdown.total;
      } else {
        metrics.transitionCost += current.cost;
        metrics.total += current.cost;
      }
    }

    return metrics;
  }, [currentPlan, state.selectedEventIndex]);

  if (!currentPlan && !state.isProcessing) {
    return (
      <div className="px-3 py-4 text-pf-xs text-[var(--text-tertiary)] text-center">
        No cost analysis yet. Generate or preview a layout to inspect playability.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <h3 className="section-header">Cost Analysis</h3>
          {state.analysisStale && currentPlan && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {state.isProcessing && !currentPlan ? (
          <div className="text-pf-xs text-blue-400 py-4 text-center animate-pulse">
            Analyzing layout...
          </div>
        ) : null}

        {currentPlan ? (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              <QuickStat
                label="Score"
                value={formatPlanScore(currentPlan.score)}
                quality={getPlanScoreQuality(currentPlan.score)}
                subtitle={getPlanScoreSummary(currentPlan.score)}
              />
              <QuickStat
                label="Events"
                value={String(new Set(currentPlan.fingerAssignments.map(a => a.startTime)).size)}
              />
              <QuickStat
                label="Hard"
                value={String(currentPlan.hardCount)}
                quality={currentPlan.hardCount === 0 ? 'good' : 'bad'}
              />
              <QuickStat
                label="Unplay"
                value={String(currentPlan.unplayableCount)}
                quality={currentPlan.unplayableCount === 0 ? 'good' : 'bad'}
              />
            </div>

            <CostBreakdownBars
              metrics={selectedEventMetrics ?? currentPlan.averageMetrics}
              diagnostics={selectedEventMetrics ? undefined : currentPlan.diagnostics}
              hardCount={selectedEventMetrics ? undefined : currentPlan.hardCount}
              unplayableCount={selectedEventMetrics ? undefined : currentPlan.unplayableCount}
              eventLabel={selectedEventMetrics && state.selectedEventIndex !== null
                ? `Event ${state.selectedEventIndex + 1} (t=${assignment?.startTime.toFixed(3) ?? '?'}s)`
                : undefined}
            />

            {currentPlan.fingerAssignments.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-1"
                  onClick={() => setChartOpen(!chartOpen)}
                >
                  <span className="text-[8px]">{chartOpen ? '\u25BE' : '\u25B8'}</span>
                  Event Difficulty Chart
                </button>
                {chartOpen && (
                  <EventCostChart
                    fingerAssignments={currentPlan.fingerAssignments}
                    selectedEventIndex={state.selectedEventIndex}
                    onEventClick={(idx) => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                  />
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function QuickStat({ label, value, quality, subtitle }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
  subtitle?: string;
}) {
  const colors = {
    good: 'text-green-400 border-green-500/15 bg-green-500/5',
    ok: 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]',
    bad: 'text-red-400 border-red-500/15 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]';

  return (
    <div className={`px-2 py-1.5 rounded-pf-md border text-center ${style}`} title={subtitle}>
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className="text-pf-sm font-mono font-medium tabular-nums">{value}</div>
    </div>
  );
}
