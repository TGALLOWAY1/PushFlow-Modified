/**
 * Temporal Results Panel (right panel).
 *
 * Shows overall status, feasibility tier, CostDimensions,
 * first failing transition, per-transition breakdown, evidence cards,
 * assignment validation, and debug info.
 */

import { type TemporalEvaluationResult, type TemporalConstraintEvidence, type TransitionResult } from './types';
import { type CostDimensions } from '../../types/costBreakdown';

interface Props {
  result: TemporalEvaluationResult | null;
  selectedMomentIndex: number;
}

export function TemporalResultsPanel({ result, selectedMomentIndex }: Props) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Select a scenario to see results
      </div>
    );
  }

  const selectedTransition = result.transitionResults.find(
    t => t.transitionIndex === selectedMomentIndex,
  );

  const selectedEvent = result.eventCosts[selectedMomentIndex];

  return (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-180px)]">
      {/* Overall Status Badge */}
      <OverallStatusBadge
        status={result.overallStatus}
        tier={result.feasibilityTier}
        firstFailingTransition={result.firstFailingTransitionIndex}
      />

      {/* Aggregate Cost Dimensions */}
      <CostDimensionsTable
        label="Aggregate Cost Dimensions"
        dimensions={result.dimensions}
      />

      {/* Per-Transition Breakdown for selected transition */}
      {selectedTransition && (
        <TransitionDetail transition={selectedTransition} />
      )}

      {/* Per-Event Cost for selected moment */}
      {selectedEvent && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Moment {selectedMomentIndex} Cost
          </h3>
          <CostDimensionsTable
            label=""
            dimensions={selectedEvent.dimensions}
            compact
          />
          <div className="mt-1 text-[10px] text-gray-500">
            feasibilityTier: {selectedEvent.feasibilityTier}
            {' '} | notes: {selectedEvent.noteAssignments.length}
          </div>
        </div>
      )}

      {/* Assignment Validation */}
      {!result.assignmentValidation.valid && (
        <AssignmentIssuesSection issues={result.assignmentValidation.issues} />
      )}

      {/* All Evidence */}
      {result.evidence.length > 0 && (
        <EvidenceSection evidence={result.evidence} />
      )}

      {/* Per-Transition Summary Table */}
      <TransitionSummaryTable transitions={result.transitionResults} />

      {/* Debug: Aggregate Metrics */}
      <DebugMetrics result={result} />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function OverallStatusBadge({
  status,
  tier,
  firstFailingTransition,
}: {
  status: string;
  tier: string;
  firstFailingTransition: number;
}) {
  const statusColor = status === 'valid'
    ? 'bg-green-500/20 text-green-300 border-green-500/30'
    : status === 'degraded'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-red-500/20 text-red-300 border-red-500/30';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full border ${statusColor}`}>
          {status === 'valid' ? 'Valid' : status === 'degraded' ? 'Degraded' : 'Violation'}
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
          tier: {tier}
        </span>
      </div>
      {firstFailingTransition >= 0 && (
        <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          First failure: transition {firstFailingTransition}→{firstFailingTransition + 1}
        </div>
      )}
    </div>
  );
}

function CostDimensionsTable({
  label,
  dimensions,
  compact,
}: {
  label: string;
  dimensions: CostDimensions;
  compact?: boolean;
}) {
  const rows: Array<{ label: string; key: keyof CostDimensions }> = [
    { label: 'Pose Naturalness', key: 'poseNaturalness' },
    { label: 'Transition Cost', key: 'transitionCost' },
    { label: 'Constraint Penalty', key: 'constraintPenalty' },
    { label: 'Alternation', key: 'alternation' },
    { label: 'Hand Balance', key: 'handBalance' },
    { label: 'Total', key: 'total' },
  ];

  return (
    <div>
      {label && (
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </h3>
      )}
      <div className="bg-gray-800/50 rounded border border-gray-700/50">
        {rows.map(({ label: rowLabel, key }) => {
          const val = dimensions[key];
          const isInfinite = !isFinite(val);
          return (
            <div
              key={key}
              className={`flex justify-between px-3 ${compact ? 'py-1' : 'py-1.5'} text-xs ${
                key === 'total' ? 'border-t border-gray-600/50 font-semibold text-gray-200' : 'text-gray-400'
              } ${isInfinite ? 'text-red-400' : ''}`}
            >
              <span>{rowLabel}</span>
              <span className="font-mono tabular-nums">
                {isInfinite ? '∞ (INFEASIBLE)' : val.toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransitionDetail({ transition }: { transition: TransitionResult }) {
  const { costBreakdown: tc } = transition;
  const timeDeltaSec = tc.timeDeltaMs / 1000;
  const speed = timeDeltaSec > 0.001 ? tc.movement.gridDistance / timeDeltaSec : 0;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Transition {tc.fromMomentIndex}→{tc.toMomentIndex} Detail
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50">
        <div className="flex justify-between px-3 py-1 text-xs text-gray-400">
          <span>Grid Distance</span>
          <span className="font-mono">{tc.movement.gridDistance.toFixed(2)}</span>
        </div>
        <div className="flex justify-between px-3 py-1 text-xs text-gray-400">
          <span>Time Delta</span>
          <span className="font-mono">{tc.timeDeltaMs.toFixed(0)}ms</span>
        </div>
        <div className={`flex justify-between px-3 py-1 text-xs ${speed > 12 ? 'text-red-400' : 'text-gray-400'}`}>
          <span>Speed</span>
          <span className="font-mono">{speed.toFixed(1)} units/s {speed > 12 ? '> MAX 12' : ''}</span>
        </div>
        <div className="flex justify-between px-3 py-1 text-xs text-gray-400">
          <span>Speed Pressure</span>
          <span className="font-mono">{tc.movement.speedPressure.toFixed(3)}</span>
        </div>
        <div className="flex justify-between px-3 py-1 text-xs text-gray-400">
          <span>Hand Switch</span>
          <span className="font-mono">{tc.movement.handSwitch ? 'yes' : 'no'}</span>
        </div>
        <div className="flex justify-between px-3 py-1 text-xs text-gray-400">
          <span>Finger Change</span>
          <span className="font-mono">{tc.movement.fingerChange ? 'yes' : 'no'}</span>
        </div>
        <div className={`flex justify-between px-3 py-1 text-xs border-t border-gray-600/50 ${
          !isFinite(tc.dimensions.transitionCost) ? 'text-red-400 font-semibold' : 'text-gray-300 font-semibold'
        }`}>
          <span>Transition Cost</span>
          <span className="font-mono">
            {isFinite(tc.dimensions.transitionCost) ? tc.dimensions.transitionCost.toFixed(4) : '∞ INFEASIBLE'}
          </span>
        </div>
      </div>

      {/* Evidence for this transition */}
      {transition.evidence.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {transition.evidence.map((e, i) => (
            <EvidenceCard key={i} evidence={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function TransitionSummaryTable({ transitions }: { transitions: TransitionResult[] }) {
  if (transitions.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        All Transitions
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50 max-h-40 overflow-y-auto">
        {transitions.map(tr => {
          const tc = tr.costBreakdown;
          const timeDeltaSec = tc.timeDeltaMs / 1000;
          const speed = timeDeltaSec > 0.001 ? tc.movement.gridDistance / timeDeltaSec : 0;
          return (
            <div
              key={tr.transitionIndex}
              className={`flex items-center gap-2 px-2.5 py-1 text-[10px] border-b border-gray-700/30 last:border-b-0 ${
                tr.status === 'violation' ? 'text-red-300 bg-red-500/5'
                : tr.status === 'degraded' ? 'text-amber-300 bg-amber-500/5'
                : 'text-gray-400'
              }`}
            >
              <span className="font-mono w-10">{tc.fromMomentIndex}→{tc.toMomentIndex}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                tr.status === 'violation' ? 'bg-red-500/20'
                : tr.status === 'degraded' ? 'bg-amber-500/20'
                : 'bg-green-500/20'
              }`}>
                {tr.status}
              </span>
              <span className="ml-auto font-mono">
                d={tc.movement.gridDistance.toFixed(1)}
                {' '}v={speed.toFixed(1)}
                {' '}c={isFinite(tc.dimensions.transitionCost) ? tc.dimensions.transitionCost.toFixed(2) : '∞'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceSection({ evidence }: { evidence: TemporalConstraintEvidence[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Evidence ({evidence.length})
      </h3>
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {evidence.map((e, i) => (
          <EvidenceCard key={i} evidence={e} />
        ))}
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: TemporalConstraintEvidence }) {
  const isHard = evidence.severity === 'hard';
  return (
    <div className={`rounded p-2.5 ${
      isHard
        ? 'bg-red-500/10 border border-red-500/20'
        : 'bg-amber-500/10 border border-amber-500/20'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
          isHard ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {evidence.constraintId}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">
          {evidence.severity}
        </span>
        {evidence.transitionIndex !== undefined && (
          <span className="text-[10px] text-gray-500">
            T{evidence.transitionIndex}→{evidence.transitionIndex + 1}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{evidence.message}</p>
      {(evidence.measuredValue !== undefined || evidence.threshold !== undefined) && (
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
          {evidence.measuredValue !== undefined && (
            <span>measured: <span className={`font-mono ${isHard ? 'text-red-300' : 'text-amber-300'}`}>
              {evidence.measuredValue.toFixed(2)}
            </span></span>
          )}
          {evidence.threshold !== undefined && (
            <span>limit: <span className="text-gray-400 font-mono">{evidence.threshold.toFixed(2)}</span></span>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentIssuesSection({
  issues,
}: {
  issues: Array<{ type: string; message: string; padKey?: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Assignment Issues ({issues.length})
      </h3>
      <div className="flex flex-col gap-1.5">
        {issues.map((issue, i) => (
          <div
            key={i}
            className="bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-2 text-xs text-amber-300"
          >
            <span className="font-mono text-[10px] text-amber-400">[{issue.type}]</span>{' '}
            {issue.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function DebugMetrics({ result }: { result: TemporalEvaluationResult }) {
  const agg = result.performanceCost.aggregateMetrics;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Debug / Aggregate Metrics
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50 text-[10px] text-gray-500">
        <div className="flex justify-between px-3 py-1">
          <span>Moments</span><span className="font-mono">{agg.momentCount}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Transitions</span><span className="font-mono">{agg.transitionCount}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Hard Moments</span><span className="font-mono">{agg.hardMomentCount}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Infeasible Moments</span><span className="font-mono">{agg.infeasibleMomentCount}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Peak Moment Index</span><span className="font-mono">{agg.peakMomentIndex}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Peak Cost</span><span className="font-mono">{agg.peakDimensions.total.toFixed(4)}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Avg Cost</span><span className="font-mono">{agg.averageDimensions.total.toFixed(4)}</span>
        </div>
        <div className="flex justify-between px-3 py-1">
          <span>Feasibility</span><span className="font-mono">{result.performanceCost.feasibility.level}</span>
        </div>
        <div className="px-3 py-1 text-gray-600 border-t border-gray-700/30">
          {result.performanceCost.feasibility.summary}
        </div>
      </div>
    </div>
  );
}
