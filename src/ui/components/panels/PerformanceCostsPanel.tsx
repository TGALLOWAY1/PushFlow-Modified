import { useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { getDisplayedExecutionPlan, getDisplayedLayout, getSelectedCandidate } from '../../state/projectState';
import { CostBreakdownBars, FeasibilityBadge } from './CostBreakdownBars';
import { SelectedEventCard } from './SelectedEventCard';
import { findSelectedMoment } from '../../analysis/selectedMoment';
import { analysisScopeLine, planSoundIds } from '../../analysis/analysisScope';
import { EventCostChart } from './EventCostChart';
import { scoreTile } from '../../analysis/planScore';
import { useLayoutAnalysis } from '../../analysis/layoutAnalysis';
import { momentDifficultyCounts } from '../../analysis/momentCounts';
import { COST_FAMILY_FACTOR, FACTOR_META } from '../../analysis/factorMeta';
import { type CostToggles } from '../../../types/costToggles';

export function PerformanceCostsPanel() {
  const { state, dispatch } = useProject();
  const [chartOpen, setChartOpen] = useState(false);
  const currentPlan = getDisplayedExecutionPlan(state);
  // The Score is the Playability of the layout the grid shows (S3.1).
  const layoutScore = useLayoutAnalysis(getSelectedCandidate(state)?.layout ?? getDisplayedLayout(state));

  // The selected event's whole moment, costed once (never summed per note).
  const selectedMoment = useMemo(
    () => findSelectedMoment(currentPlan?.fingerAssignments, state.selectedEventIndex),
    [currentPlan, state.selectedEventIndex],
  );
  // The plan's own scope (the Sounds it analysed), so a mute made since it was
  // computed never relabels an old verdict; the live scope when there is no plan.
  const scope = analysisScopeLine(
    state.soundStreams,
    getDisplayedLayout(state),
    currentPlan ? planSoundIds(currentPlan.fingerAssignments) : undefined,
  );
  const liveScope = analysisScopeLine(state.soundStreams, getDisplayedLayout(state));
  // Events are moments for both solvers (T23).
  const counts = useMemo(() => momentDifficultyCounts(currentPlan?.fingerAssignments), [currentPlan]);

  if (!currentPlan && !state.isProcessing) {
    return (
      <div className="px-3 py-4 space-y-2">
        {state.soundStreams.length > 0 && <FeasibilityBadge scope={scope} />}
        <div className="text-pf-xs text-[var(--text-tertiary)] text-center">
          No cost analysis yet. Generate or preview a layout to inspect playability.
        </div>
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
        {/* Manual "Calculate Cost" result.
            This ran a full canonical evaluation and then rendered nothing at all,
            so from the user's side the button did nothing and one of the two ways
            to get a cost story for the current layout was unusable. */}
        {state.manualCostResult && (
          <div className="rounded-pf-sm border border-accent-primary/30 bg-accent-primary/5 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-pf-xs font-semibold text-[var(--accent-primary-soft)]">
                Calculated cost
              </span>
              <button
                className="text-pf-micro text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                onClick={() => dispatch({ type: 'SET_MANUAL_COST_RESULT', payload: null })}
              >
                ✕
              </button>
            </div>
            {/* The manual result keeps no record of its Sounds, so its scope is
                the live one, and only while nothing has changed since. */}
            <div data-testid="verdict-scope" className="text-pf-micro text-[var(--text-tertiary)]">
              {state.analysisStale ? 'Out of date: the Sounds or layout changed since. Calculate again.' : liveScope}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-pf-xs">
              <div>
                <div className="text-[var(--text-tertiary)]">Per event</div>
                <div className="font-mono text-[var(--text-primary)]">
                  {state.manualCostResult.costPerMoment.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-[var(--text-tertiary)]">Feasibility</div>
                <div className="text-[var(--text-primary)] capitalize">
                  {state.manualCostResult.feasibility.level}
                </div>
              </div>
            </div>
            <div className="space-y-0.5 text-pf-micro font-mono text-[var(--text-secondary)]">
              {(Object.keys(COST_FAMILY_FACTOR) as (keyof CostToggles)[]).map(family => {
                const meta = FACTOR_META[COST_FAMILY_FACTOR[family]];
                return (
                  <div key={family} className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                      {meta.label}
                    </span>
                    <span>{state.manualCostResult!.dimensions[family].toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            {state.manualCostResult.costTogglesUsed && (
              <div className="text-pf-micro text-[var(--text-tertiary)]">
                Cost families active:{' '}
                {(Object.entries(state.manualCostResult.costTogglesUsed) as [keyof CostToggles, boolean][])
                  .filter(([, on]) => on)
                  .map(([family]) => FACTOR_META[COST_FAMILY_FACTOR[family]]?.label ?? family)
                  .join(', ') || 'none'}
              </div>
            )}
          </div>
        )}

        {state.isProcessing && !currentPlan ? (
          <FeasibilityBadge pending scope={scope} />
        ) : null}

        {currentPlan ? (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              <QuickStat label="Score" testId="costs-score" {...scoreTile(layoutScore)} />
              <QuickStat
                label="Events"
                value={String(counts.events)}
                subtitle={`${counts.events} events · ${counts.notes} notes`}
              />
              <QuickStat
                label="Hard"
                value={String(counts.hard)}
                quality={counts.hard === 0 ? 'good' : 'bad'}
                subtitle="Events that are hard to play"
              />
              <QuickStat
                label="Unplay"
                value={String(counts.unplayable)}
                quality={counts.unplayable === 0 ? 'good' : 'bad'}
                subtitle={`${counts.unplayable} events with a note that can't be played (${counts.unplayableNotes} of ${counts.notes} notes)`}
              />
            </div>

            <CostBreakdownBars
              metrics={currentPlan.averageMetrics}
              diagnostics={currentPlan.diagnostics}
              hardCount={counts.hard}
              unplayableCount={counts.unplayable}
              mediumCount={counts.medium}
              unplayableNotes={counts.unplayableNotes}
              noteCount={counts.notes}
              events={counts.events}
              scope={scope}
            />

            {selectedMoment && (
              <SelectedEventCard selected={selectedMoment} tempo={state.tempo} scope={scope} />
            )}

            {currentPlan.fingerAssignments.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-1"
                  onClick={() => setChartOpen(!chartOpen)}
                >
                  <span className="text-pf-micro" aria-hidden="true">{chartOpen ? '\u25BE' : '\u25B8'}</span>
                  Event difficulty chart
                </button>
                {chartOpen && (
                  <EventCostChart
                    fingerAssignments={currentPlan.fingerAssignments}
                    tempo={state.tempo}
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

function QuickStat({ label, value, quality, subtitle, wording = false, testId }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
  subtitle?: string;
  /** The value is words ("Scoring…"), not a number: smaller, so it fits the tile. */
  wording?: boolean;
  testId?: string;
}) {
  const colors = {
    good: 'text-green-400 border-green-500/15 bg-green-500/5',
    ok: 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]',
    bad: 'text-red-400 border-red-500/15 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]';

  return (
    <div className={`px-2 py-1.5 rounded-pf-md border text-center ${style}`} title={subtitle} data-testid={testId}>
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className={wording ? 'text-pf-micro leading-[18px] text-[var(--text-secondary)] whitespace-nowrap' : 'text-pf-sm font-mono font-medium tabular-nums'}>{value}</div>
    </div>
  );
}
