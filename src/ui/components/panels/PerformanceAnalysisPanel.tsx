/**
 * PerformanceAnalysisPanel.
 *
 * Unified right-panel surface merging Analysis + Diagnostics.
 * Structure:
 * 1. Top controls (Learn more, Settings gear)
 * 2. Event-level difficulty visualization (stacked chart)
 * 3. Aggregate cost breakdown (horizontal bars)
 * 4. Candidate layout previews with actions
 */

import { useState, useMemo, type ReactNode } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type ExecutionPlanResult } from '../../../types/executionPlan';
import { type CostToggles, TOGGLE_LABELS, TOGGLE_CATEGORIES, isExperimentalMode } from '../../../types/costToggles';
import { type PerformanceCostBreakdown } from '../../../types/costBreakdown';

import { LearnMoreModal } from './LearnMoreModal';
import { EventCostChart } from './EventCostChart';
import { CostBreakdownBars } from './CostBreakdownBars';
import { CandidatePreviewCard } from './CandidatePreviewCard';
import { MoveTracePanel } from './MoveTracePanel';
import { CandidateCompare } from '../CandidateCompare';
import { LayoutDebugPanel } from '../Debug/LayoutDebugPanel';

interface PerformanceAnalysisPanelProps {
  onClose: () => void;
  calculateCost?: (toggles: CostToggles) => Promise<void>;
}

export function PerformanceAnalysisPanel({
  onClose,
  calculateCost,
}: PerformanceAnalysisPanelProps) {
  const { state, dispatch } = useProject();
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const activeResult = state.analysisResult;
  const hasCandidates = state.candidates.length > 0;

  const selectedCandidate = state.candidates.find(c => c.id === state.selectedCandidateId) ?? null;
  const compareCandidate = state.candidates.find(c => c.id === state.compareCandidateId) ?? null;

  // Get the candidate label for chart context
  const selectedCandidateLabel = useMemo(() => {
    if (!selectedCandidate) return undefined;
    const idx = state.candidates.indexOf(selectedCandidate);
    return `Candidate #${idx + 1}${selectedCandidate.metadata.strategy ? ` (${selectedCandidate.metadata.strategy})` : ''}`;
  }, [selectedCandidate, state.candidates]);

  // Current execution plan data (from active result or selected candidate)
  const currentPlan = activeResult?.executionPlan ?? selectedCandidate?.executionPlan;

  // Other candidates for comparison picking
  const otherCandidates = state.candidates.filter(c => c.id !== state.selectedCandidateId);

  // Per-event aggregated metrics when an event is selected
  const selectedEventMetrics = useMemo(() => {
    if (state.selectedEventIndex === null || !currentPlan) return null;
    const eventAssignments = currentPlan.fingerAssignments.filter(a => a.eventIndex === state.selectedEventIndex);
    if (eventAssignments.length === 0) return null;
    const metrics = {
      fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0,
      handBalance: 0, constraintPenalty: 0, total: 0,
    };
    for (const a of eventAssignments) {
      if (a.costBreakdown) {
        metrics.fingerPreference += a.costBreakdown.fingerPreference;
        metrics.handShapeDeviation += a.costBreakdown.handShapeDeviation;
        metrics.transitionCost += a.costBreakdown.transitionCost;
        metrics.handBalance += a.costBreakdown.handBalance;
        metrics.constraintPenalty += a.costBreakdown.constraintPenalty;
        metrics.total += a.costBreakdown.total;
      } else {
        metrics.transitionCost += a.cost;
        metrics.total += a.cost;
      }
    }
    return metrics;
  }, [state.selectedEventIndex, currentPlan]);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* ─── Top Controls ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-pf-md font-semibold text-[var(--text-primary)]">Performance Analysis</h3>
            {state.analysisStale && activeResult && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="text-pf-sm text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded-pf-sm hover:bg-[var(--bg-hover)]"
              onClick={() => setLearnMoreOpen(true)}
            >
              Learn more
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-pf-md"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </div>

        {/* ─── Scrollable Content ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Staleness warning */}
          {state.analysisStale && activeResult && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-pf-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 text-pf-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Analysis outdated — layout has changed since last run
            </div>
          )}

          {/* Empty state */}
          {!activeResult && !state.isProcessing && !hasCandidates && (
            <div className="text-pf-sm text-[var(--text-secondary)] py-8 text-center">
              <div className="mb-2 text-[var(--text-secondary)]">No analysis yet</div>
              Assign sounds to pads, then click <strong>Generate</strong> to create
              candidate solutions and analyze difficulty.
            </div>
          )}

          {/* Processing state */}
          {state.isProcessing && (
            <div className="text-pf-sm text-blue-400 py-6 text-center animate-pulse">
              Generating candidate solutions...
            </div>
          )}

          {/* ─── Section 1: Event-Level Difficulty Chart ───────── */}
          {currentPlan && currentPlan.fingerAssignments.length > 0 && (
            <CollapsibleSection title="Event Difficulty" defaultOpen>
              <EventCostChart
                fingerAssignments={currentPlan.fingerAssignments}
                candidateLabel={selectedCandidateLabel}
                selectedEventIndex={state.selectedEventIndex}
                onEventClick={(idx) => dispatch({ type: 'SELECT_EVENT', payload: idx })}
              />
            </CollapsibleSection>
          )}

          {/* ─── Section 2: Aggregate Cost Breakdown ──────────── */}
          {currentPlan && (
            <CollapsibleSection title="Cost Breakdown" defaultOpen>
              <CostBreakdownBars
                metrics={selectedEventMetrics ?? currentPlan.averageMetrics}
                eventLabel={selectedEventMetrics && state.selectedEventIndex !== null
                  ? `Event ${state.selectedEventIndex + 1}`
                  : undefined}
              />

              {/* Quick stats row */}
              <div className="flex gap-2 mt-3">
                <QuickStat
                  label="Score"
                  value={currentPlan.score.toFixed(1)}
                  quality={currentPlan.score < 5 ? 'good' : currentPlan.score < 15 ? 'ok' : 'bad'}
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
                {currentPlan.unplayableCount > 0 && (
                  <QuickStat
                    label="Unplayable"
                    value={String(currentPlan.unplayableCount)}
                    quality="bad"
                  />
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* ─── Section 2.5: Cost Toggles & Calculate ─────── */}
          {calculateCost && (
            <CostToggleSection
              costToggles={state.costToggles}
              onToggleChange={(toggles) => dispatch({ type: 'SET_COST_TOGGLES', payload: toggles })}
              onCalculate={() => calculateCost(state.costToggles)}
              manualCostResult={state.manualCostResult}
              hasAssignment={!!(state.analysisResult?.executionPlan?.fingerAssignments?.length)}
            />
          )}

          {/* ─── Unplayable Diagnostics ─────────────────────── */}
          {currentPlan && currentPlan.unplayableCount > 0 && (
            <UnplayableDiagnostics plan={currentPlan} />
          )}

          {/* ─── Section 3: Compare Mode ──────────────────────── */}
          {compareMode && selectedCandidate && (
            <div className="border-b border-[var(--border-subtle)] pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-pf-sm text-[var(--text-secondary)] font-medium uppercase tracking-wider">
                  Compare Candidates
                </h4>
                <button
                  className="text-pf-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    setCompareMode(false);
                    dispatch({ type: 'SET_COMPARE_CANDIDATE', payload: null });
                  }}
                >
                  Close
                </button>
              </div>

              {/* Comparison target picker */}
              <div className="flex items-center gap-2">
                <span className="text-pf-xs text-[var(--text-secondary)]">Compare with:</span>
                <div className="flex gap-1">
                  {otherCandidates.map((c) => {
                    const globalIdx = state.candidates.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        className={`px-2 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
                          c.id === state.compareCandidateId
                            ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                            : 'bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        onClick={() => dispatch({
                          type: 'SET_COMPARE_CANDIDATE',
                          payload: c.id === state.compareCandidateId ? null : c.id,
                        })}
                      >
                        #{globalIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {compareCandidate ? (
                <CandidateCompare candidateA={selectedCandidate} candidateB={compareCandidate} />
              ) : (
                <div className="text-pf-sm text-[var(--text-tertiary)] py-3 text-center">
                  Select a candidate above to compare.
                </div>
              )}
            </div>
          )}

          {/* ─── Section 4: Candidate Layout Previews ─────────── */}
          {hasCandidates && (
            <CollapsibleSection
              title="Candidates"
              defaultOpen
              onEnlarge={() => setViewAllOpen(true)}
            >
              {/* Candidate grid - show up to 4 cards */}
              <div className="grid grid-cols-2 gap-2">
                {state.candidates.slice(0, 4).map((candidate, idx) => (
                  <CandidatePreviewCard
                    key={candidate.id}
                    candidate={candidate}
                    soundStreams={state.soundStreams}
                    rank={idx + 1}
                    isSelected={candidate.id === state.selectedCandidateId}
                    onSelect={() => {
                      dispatch({ type: 'SELECT_CANDIDATE', payload: candidate.id });
                      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
                    }}
                    isCheckedForCompare={false}
                    onPromote={() => {
                      if (confirm('Promote this candidate to become the Active Layout? The current active layout will be auto-saved as a variant.')) {
                        dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
                      }
                    }}
                    onDelete={() => {
                      dispatch({ type: 'DELETE_CANDIDATE', payload: { candidateId: candidate.id } });
                    }}
                    onToggleCompare={() => {}}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ─── Section 5: Move Trace (greedy optimizer) ────── */}
          {state.moveHistory && state.moveHistory.length > 0 && (
            <CollapsibleSection title="Optimization Trace" defaultOpen>
              <MoveTracePanel
                moves={state.moveHistory}
                stopReason={state.moveHistoryStopReason as any}
              />
            </CollapsibleSection>
          )}

          {/* Debug panel for unplayable events */}
          {currentPlan && currentPlan.unplayableCount > 0 && (
            <LayoutDebugPanel executionPlan={currentPlan} />
          )}

          {/* Saved variants */}
          {state.savedVariants.length > 0 && (
            <div className="text-pf-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-subtle)]">
              {state.savedVariants.length} saved variant{state.savedVariants.length !== 1 ? 's' : ''} available
            </div>
          )}
        </div>
      </div>

      {/* Learn More Modal */}
      <LearnMoreModal open={learnMoreOpen} onClose={() => setLearnMoreOpen(false)} />

      {/* View All Modal */}
      {viewAllOpen && (
        <ViewAllModal
          candidates={state.candidates}
          savedVariants={state.savedVariants}
          soundStreams={state.soundStreams}
          selectedId={state.selectedCandidateId}
          onSelect={(id) => {
            const candidate = state.candidates.find(c => c.id === id);
            if (candidate) {
              dispatch({ type: 'SELECT_CANDIDATE', payload: id });
              dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
            }
          }}
          onClose={() => setViewAllOpen(false)}
        />
      )}
    </>
  );
}

/** Summarizes WHY events are unplayable, using solver rejection reasons. */
function UnplayableDiagnostics({ plan }: { plan: ExecutionPlanResult }) {
  const reasons = plan.rejectionReasons;
  if (!reasons || Object.keys(reasons).length === 0) {
    return (
      <div className="p-3 rounded-pf-lg border border-red-500/30 bg-red-500/5 text-pf-sm text-red-300">
        <div className="font-medium mb-1">{plan.unplayableCount} event{plan.unplayableCount !== 1 ? 's' : ''} unplayable</div>
        <div className="text-red-400/70">No diagnostic details available.</div>
      </div>
    );
  }

  // Aggregate reasons
  const counts: Record<string, number> = {};
  for (const eventReasons of Object.values(reasons)) {
    for (const r of eventReasons) {
      counts[r] = (counts[r] || 0) + 1;
    }
  }

  const REASON_LABELS: Record<string, string> = {
    unmapped: 'Could not map to any pad position',
    zone_conflict: 'Pad is outside all hand zones',
    ownership_conflict: 'Pad ownership conflict (finger already assigned)',
    speed_limit: 'Hand can\'t move fast enough',
    no_valid_grip: 'No valid finger assignment exists',
    beam_exhausted: 'Solver could not find a solution path',
  };

  return (
    <div className="p-3 rounded-pf-lg border border-red-500/30 bg-red-500/5 space-y-2">
      <div className="text-pf-sm font-medium text-red-300">
        {plan.unplayableCount} event{plan.unplayableCount !== 1 ? 's' : ''} unplayable
      </div>
      <div className="space-y-1">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([reason, count]) => (
            <div key={reason} className="flex items-center gap-2 text-pf-xs">
              <span className="font-mono text-red-400 w-5 text-right">{count}</span>
              <span className="text-red-300/80">{REASON_LABELS[reason] ?? reason}</span>
            </div>
          ))
        }
      </div>
      <div className="text-pf-xs text-[var(--text-secondary)] pt-1 border-t border-red-500/10">
        Try adjusting pad positions on the grid, then re-generate.
      </div>
    </div>
  );
}

function QuickStat({ label, value, quality }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
}) {
  const colors = {
    good: 'text-green-400 border-green-500/20 bg-green-500/5',
    ok: 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]/50',
    bad: 'text-red-400 border-red-500/20 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]/50';

  return (
    <div className={`px-2 py-1 rounded-pf-sm border text-pf-xs ${style}`}>
      <span className="text-pf-micro text-[var(--text-secondary)] uppercase mr-1">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  onEnlarge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  onEnlarge?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border-subtle)] pb-4">
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-1.5 text-pf-sm text-[var(--text-secondary)] font-medium uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
          onClick={() => setOpen(!open)}
        >
          <span className="text-pf-xs">{open ? '\u25BE' : '\u25B8'}</span>
          {title}
        </button>
        {onEnlarge && (
          <button
            className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-pf-sm hover:bg-[var(--bg-hover)]"
            onClick={onEnlarge}
            title="Expand"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        )}
      </div>
      {open && children}
    </div>
  );
}

function CostToggleSection({
  costToggles,
  onToggleChange,
  onCalculate,
  manualCostResult,
  hasAssignment,
}: {
  costToggles: CostToggles;
  onToggleChange: (toggles: CostToggles) => void;
  onCalculate: () => void;
  manualCostResult: PerformanceCostBreakdown | null;
  hasAssignment: boolean;
}) {
  const toggleKeys = Object.keys(TOGGLE_LABELS) as Array<keyof CostToggles>;
  const experimental = isExperimentalMode(costToggles);

  const handleToggle = (key: keyof CostToggles) => {
    onToggleChange({ ...costToggles, [key]: !costToggles[key] });
  };

  // Group toggles by category
  const staticToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'static');
  const temporalToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'temporal');
  const hardToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'hard');

  return (
    <CollapsibleSection title="Cost Evaluation" defaultOpen={false}>
      <div className="space-y-3">
        {/* Toggle groups */}
        <div className="space-y-2">
          <div className="text-pf-xs text-[var(--text-secondary)] uppercase tracking-wider">Static Costs</div>
          {staticToggles.map(key => (
            <ToggleRow key={key} label={TOGGLE_LABELS[key]} enabled={costToggles[key]} onChange={() => handleToggle(key)} />
          ))}

          <div className="text-pf-xs text-[var(--text-secondary)] uppercase tracking-wider pt-1">Temporal Costs</div>
          {temporalToggles.map(key => (
            <ToggleRow key={key} label={TOGGLE_LABELS[key]} enabled={costToggles[key]} onChange={() => handleToggle(key)} />
          ))}

          <div className="text-pf-xs text-[var(--text-secondary)] uppercase tracking-wider pt-1">Hard Rules</div>
          {hardToggles.map(key => (
            <ToggleRow key={key} label={TOGGLE_LABELS[key]} enabled={costToggles[key]} onChange={() => handleToggle(key)} isHard />
          ))}
        </div>

        {/* Experimental mode warning */}
        {experimental && (
          <div className="px-2 py-1.5 rounded-pf-sm border border-orange-500/30 bg-orange-500/10 text-pf-xs text-orange-400">
            Hard constraints disabled — results may include infeasible assignments
          </div>
        )}

        {/* Calculate button */}
        <button
          className={`w-full px-3 py-2 rounded-pf-md text-pf-sm font-medium transition-colors ${
            hasAssignment
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed'
          }`}
          onClick={onCalculate}
          disabled={!hasAssignment}
          title={!hasAssignment ? 'Run Generate first to create a finger assignment' : 'Evaluate current layout + assignment with active cost toggles'}
        >
          Calculate Cost
        </button>

        {/* Manual cost result */}
        {manualCostResult && (
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-pf-xs text-[var(--text-secondary)] uppercase tracking-wider">Manual Evaluation</span>
              {manualCostResult.costTogglesUsed && (
                <span className="text-pf-micro text-[var(--text-tertiary)]">
                  {Object.values(manualCostResult.costTogglesUsed).filter(Boolean).length}/5 toggles active
                </span>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline">
              <span className="text-pf-sm text-[var(--text-primary)] font-medium">Total Cost</span>
              <span className="text-pf-md font-mono text-white">{manualCostResult.total.toFixed(2)}</span>
            </div>

            {/* Static vs Temporal subtotals */}
            <div className="grid grid-cols-2 gap-2">
              <div className="px-2 py-1.5 rounded-pf-sm bg-[var(--bg-card)]/50 border border-[var(--border-default)]">
                <div className="text-pf-micro text-[var(--text-secondary)] uppercase">Static</div>
                <div className="text-pf-sm font-mono text-[var(--text-primary)]">
                  {(manualCostResult.dimensions.poseNaturalness + manualCostResult.dimensions.handBalance).toFixed(2)}
                </div>
              </div>
              <div className="px-2 py-1.5 rounded-pf-sm bg-[var(--bg-card)]/50 border border-[var(--border-default)]">
                <div className="text-pf-micro text-[var(--text-secondary)] uppercase">Temporal</div>
                <div className="text-pf-sm font-mono text-[var(--text-primary)]">
                  {(manualCostResult.dimensions.transitionCost + manualCostResult.dimensions.alternation).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Per-factor breakdown */}
            <div className="space-y-1">
              {[
                { label: 'Grip Quality', value: manualCostResult.dimensions.poseNaturalness },
                { label: 'Movement', value: manualCostResult.dimensions.transitionCost },
                { label: 'Repetition', value: manualCostResult.dimensions.alternation },
                { label: 'Hand Balance', value: manualCostResult.dimensions.handBalance },
                { label: 'Constraints', value: manualCostResult.dimensions.constraintPenalty },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-pf-xs">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className={`font-mono ${value > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>

            {/* Feasibility */}
            <div className="flex items-center gap-1.5 text-pf-xs">
              <span className={`w-2 h-2 rounded-full ${
                manualCostResult.feasibility.level === 'feasible' ? 'bg-green-400' :
                manualCostResult.feasibility.level === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              <span className="text-[var(--text-secondary)]">{manualCostResult.feasibility.summary}</span>
            </div>

            {/* Event/transition counts */}
            <div className="flex gap-2 text-pf-xs text-[var(--text-tertiary)]">
              <span>{manualCostResult.aggregateMetrics.momentCount} events</span>
              <span>{manualCostResult.aggregateMetrics.transitionCount} transitions</span>
              {manualCostResult.aggregateMetrics.hardMomentCount > 0 && (
                <span className="text-red-400">{manualCostResult.aggregateMetrics.hardMomentCount} hard</span>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ToggleRow({ label, enabled, onChange, isHard }: {
  label: string;
  enabled: boolean;
  onChange: () => void;
  isHard?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onChange}
        className="w-3 h-3 rounded-pf-sm accent-cyan-500 cursor-pointer"
      />
      <span className={`text-pf-sm group-hover:text-[var(--text-primary)] transition-colors ${
        enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] line-through'
      } ${isHard && !enabled ? 'text-orange-400' : ''}`}>
        {label}
      </span>
      {isHard && (
        <span className="text-pf-micro text-[var(--text-tertiary)] ml-auto">(hard)</span>
      )}
    </label>
  );
}

function ViewAllModal({ candidates, savedVariants, soundStreams, selectedId, onSelect, onClose }: {
  candidates: import('../../../types/candidateSolution').CandidateSolution[];
  savedVariants: import('../../../types/layout').Layout[];
  soundStreams: import('../../state/projectState').SoundStream[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-6 md:inset-x-auto md:max-w-3xl md:mx-auto z-[61] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-pf-md font-semibold text-[var(--text-primary)]">All Candidates & Saved Variants</h3>
          <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg" onClick={onClose}>&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {candidates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-pf-sm text-[var(--text-secondary)] font-medium uppercase tracking-wider mb-3">
                Generated Candidates ({candidates.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {candidates.map((c, idx) => (
                  <CandidatePreviewCard
                    key={c.id}
                    candidate={c}
                    soundStreams={soundStreams}
                    rank={idx + 1}
                    isSelected={c.id === selectedId}
                    isCheckedForCompare={false}
                    onSelect={() => onSelect(c.id)}
                    onPromote={() => {}}
                    onToggleCompare={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {savedVariants.length > 0 && (
            <div>
              <h4 className="text-pf-sm text-[var(--text-secondary)] font-medium uppercase tracking-wider mb-3">
                Saved Layout Variants ({savedVariants.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {savedVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 p-3"
                  >
                    <div className="text-pf-sm text-[var(--text-primary)] font-medium mb-1 truncate">
                      {variant.name}
                    </div>
                    <div className="text-pf-xs text-[var(--text-tertiary)]">
                      {Object.keys(variant.padToVoice).length} pads assigned
                    </div>
                    {variant.savedAt && (
                      <div className="text-pf-xs text-[var(--text-tertiary)]">
                        Saved: {new Date(variant.savedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidates.length === 0 && savedVariants.length === 0 && (
            <div className="text-pf-md text-[var(--text-secondary)] text-center py-8">
              No candidates or saved variants yet. Generate candidates to get started.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
