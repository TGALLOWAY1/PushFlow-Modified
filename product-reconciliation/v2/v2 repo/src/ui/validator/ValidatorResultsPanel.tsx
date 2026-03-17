/**
 * Validator Results Panel (right panel).
 *
 * Shows status badge, feasibility tier, CostDimensions table,
 * evidence cards, assignment issues, and debug info.
 */

import { type ValidatorResult, type ConstraintViolationEvidence } from './types';
import { type CostDimensions } from '../../types/costBreakdown';

interface Props {
  result: ValidatorResult | null;
}

export function ValidatorResultsPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Select a scenario to see results
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status Badge */}
      <StatusBadge status={result.status} tier={result.feasibilityTier} />

      {/* Cost Dimensions */}
      <CostDimensionsTable dimensions={result.dimensions} />

      {/* Pose Detail */}
      <PoseDetailSection
        attractor={result.poseDetail.attractor}
        perFingerHome={result.poseDetail.perFingerHome}
        fingerDominance={result.poseDetail.fingerDominance}
      />

      {/* Evidence Cards */}
      {result.evidence.length > 0 && (
        <EvidenceSection evidence={result.evidence} />
      )}

      {/* Assignment Issues */}
      {!result.assignmentValidation.valid && (
        <AssignmentIssuesSection issues={result.assignmentValidation.issues} />
      )}

      {/* Grip Rejections Debug */}
      {result.gripRejections.length > 0 && (
        <GripRejectionsSection rejections={result.gripRejections} />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({
  status,
  tier,
}: {
  status: 'valid' | 'violation';
  tier: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
          status === 'valid'
            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}
      >
        {status === 'valid' ? 'Valid' : 'Violation'}
      </span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
        tier: {tier}
      </span>
    </div>
  );
}

function CostDimensionsTable({ dimensions }: { dimensions: CostDimensions }) {
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
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Cost Dimensions
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50">
        {rows.map(({ label, key }) => (
          <div
            key={key}
            className={`flex justify-between px-3 py-1.5 text-xs ${
              key === 'total' ? 'border-t border-gray-600/50 font-semibold text-gray-200' : 'text-gray-400'
            }`}
          >
            <span>{label}</span>
            <span className="font-mono tabular-nums">
              {dimensions[key].toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoseDetailSection({
  attractor,
  perFingerHome,
  fingerDominance,
}: {
  attractor: number;
  perFingerHome: number;
  fingerDominance: number;
}) {
  const items = [
    { label: 'Attractor', value: attractor },
    { label: 'Per-Finger Home', value: perFingerHome },
    { label: 'Finger Preference', value: fingerDominance },
  ];

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Pose Detail
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between px-3 py-1.5 text-xs text-gray-400">
            <span>{label}</span>
            <span className="font-mono tabular-nums">{value.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceSection({ evidence }: { evidence: ConstraintViolationEvidence[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Violations ({evidence.length})
      </h3>
      <div className="flex flex-col gap-2">
        {evidence.map((e, i) => (
          <EvidenceCard key={i} evidence={e} />
        ))}
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: ConstraintViolationEvidence }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
          {evidence.constraintId}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">
          {evidence.severity}
        </span>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{evidence.message}</p>
      {(evidence.measuredValue !== undefined || evidence.threshold !== undefined) && (
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
          {evidence.measuredValue !== undefined && (
            <span>measured: <span className="text-red-300 font-mono">{evidence.measuredValue.toFixed(2)}</span></span>
          )}
          {evidence.threshold !== undefined && (
            <span>limit: <span className="text-gray-400 font-mono">{evidence.threshold.toFixed(2)}</span></span>
          )}
        </div>
      )}
      {evidence.pads && (
        <div className="mt-1 text-[10px] text-gray-500">
          pads: {evidence.pads.join(', ')}
        </div>
      )}
      {evidence.fingers && (
        <div className="text-[10px] text-gray-500">
          fingers: {evidence.fingers.join(', ')}
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

function GripRejectionsSection({
  rejections,
}: {
  rejections: Array<{ fingerA: string; fingerB: string; rule: string; actual: number; limit: number }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Grip Rejections (debug)
      </h3>
      <div className="bg-gray-800/50 rounded border border-gray-700/50 max-h-32 overflow-y-auto">
        {rejections.slice(0, 20).map((r, i) => (
          <div key={i} className="flex gap-2 px-2.5 py-1 text-[10px] text-gray-500 border-b border-gray-700/30 last:border-b-0">
            <span className="font-mono text-gray-400">{r.rule}</span>
            <span>{r.fingerA}↔{r.fingerB}</span>
            <span className="ml-auto font-mono">{r.actual.toFixed(2)} / {r.limit.toFixed(1)}</span>
          </div>
        ))}
        {rejections.length > 20 && (
          <div className="px-2.5 py-1 text-[10px] text-gray-600">
            +{rejections.length - 20} more...
          </div>
        )}
      </div>
    </div>
  );
}
