/**
 * CostBreakdownBars.
 *
 * Three-layer cost presentation aligned with the canon:
 * 1. Feasibility verdict — can this layout be played?
 * 2. Ergonomic cost breakdown — how comfortable is it?
 * 3. Difficulty summary — how hard are the passages?
 */

import { type V1CostBreakdown } from '../../../types/diagnostics';
import { type DiagnosticsPayload, type FeasibilityVerdict } from '../../../types/diagnostics';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface CostBreakdownBarsProps {
  metrics: V1CostBreakdown;
  diagnostics?: DiagnosticsPayload;
  hardCount?: number;
  unplayableCount?: number;
  /** When set, shows event-specific metrics with a label */
  eventLabel?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Feasibility badge
// ────────────────────────────────────────────────────────────────────────────

function FeasibilityBadge({ verdict, unplayableCount }: {
  verdict?: FeasibilityVerdict;
  unplayableCount?: number;
}) {
  // Derive level from verdict or from raw counts
  const level = verdict?.level
    ?? (unplayableCount && unplayableCount > 0 ? 'infeasible' : 'feasible');

  const summary = verdict?.summary
    ?? (level === 'feasible'
      ? 'All events playable'
      : level === 'degraded'
        ? 'Playable with hard passages'
        : `${unplayableCount ?? '?'} unplayable event${(unplayableCount ?? 0) !== 1 ? 's' : ''}`);

  const styles: Record<string, string> = {
    feasible: 'bg-green-500/10 border-green-500/30 text-green-400',
    degraded: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    infeasible: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  const icons: Record<string, string> = {
    feasible: '\u2713',
    degraded: '\u26A0',
    infeasible: '\u2717',
  };

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] ${styles[level]}`}>
      <span className="text-sm">{icons[level]}</span>
      <div>
        <div className="font-medium capitalize">{level}</div>
        <div className="text-[9px] opacity-80">{summary}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Ergonomic factor bars
// ────────────────────────────────────────────────────────────────────────────

interface FactorRow {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}

function ErgonomicFactors({ metrics, diagnostics }: {
  metrics: V1CostBreakdown;
  diagnostics?: DiagnosticsPayload;
}) {
  // Prefer canonical DiagnosticFactors when available, fall back to V1
  const rows: FactorRow[] = diagnostics?.factors
    ? [
        {
          label: 'Grip',
          value: diagnostics.factors.gripNaturalness,
          color: '#a855f7',
          tooltip: 'Hand shape deviation + finger preference cost',
        },
        {
          label: 'Movement',
          value: diagnostics.factors.transition,
          color: '#f97316',
          tooltip: 'Fitts\'s Law transition cost between consecutive pads',
        },
        {
          label: 'Alternation',
          value: diagnostics.factors.alternation,
          color: '#22c55e',
          tooltip: 'Same-finger rapid repetition penalty',
        },
        {
          label: 'Balance',
          value: diagnostics.factors.handBalance,
          color: '#3b82f6',
          tooltip: 'Left/right hand distribution imbalance',
        },
      ]
    : [
        {
          label: 'Grip',
          value: metrics.fingerPreference + metrics.handShapeDeviation,
          color: '#a855f7',
          tooltip: 'Hand shape deviation + finger preference cost',
        },
        {
          label: 'Movement',
          value: metrics.transitionCost,
          color: '#f97316',
          tooltip: 'Fitts\'s Law transition cost between consecutive pads',
        },
        {
          label: 'Balance',
          value: metrics.handBalance,
          color: '#3b82f6',
          tooltip: 'Left/right hand distribution imbalance',
        },
      ];

  const maxValue = Math.max(...rows.map(r => r.value), 0.01);

  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
        Ergonomics
      </h4>
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2" title={row.tooltip}>
            <div className="flex items-center gap-1.5 w-20">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-[11px] text-gray-400">{row.label}</span>
            </div>
            <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${Math.max((row.value / maxValue) * 100, row.value > 0 ? 2 : 0)}%`,
                  backgroundColor: row.color,
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="text-[11px] text-gray-500 font-mono w-10 text-right">
              {row.value > 0 ? row.value.toFixed(0) : '0'}
            </span>
          </div>
        ))}
      </div>
      {diagnostics?.topContributors && diagnostics.topContributors.length > 0 && (
        <div className="text-[9px] text-gray-500">
          Main burden: {diagnostics.topContributors.slice(0, 2).join(', ')}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Difficulty summary
// ────────────────────────────────────────────────────────────────────────────

function DifficultySummary({ hardCount, unplayableCount }: {
  hardCount?: number;
  unplayableCount?: number;
}) {
  if (hardCount === undefined && unplayableCount === undefined) return null;
  const hard = hardCount ?? 0;
  const unplay = unplayableCount ?? 0;
  const total = hard + unplay;

  return (
    <div className="space-y-1">
      <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
        Difficulty
      </h4>
      {total === 0 ? (
        <div className="text-[10px] text-green-400">No hard or unplayable events</div>
      ) : (
        <div className="flex gap-3 text-[10px]">
          {hard > 0 && (
            <span className="text-amber-400">
              {hard} hard event{hard !== 1 ? 's' : ''}
            </span>
          )}
          {unplay > 0 && (
            <span className="text-red-400">
              {unplay} unplayable event{unplay !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Composite component
// ────────────────────────────────────────────────────────────────────────────

export function CostBreakdownBars({ metrics, diagnostics, hardCount, unplayableCount, eventLabel }: CostBreakdownBarsProps) {
  return (
    <div className="space-y-3">
      {/* Event-specific label */}
      {eventLabel && (
        <div className="text-[10px] text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 inline-block">
          {eventLabel}
        </div>
      )}

      {/* Layer 1: Feasibility verdict */}
      <FeasibilityBadge
        verdict={diagnostics?.feasibility}
        unplayableCount={unplayableCount}
      />

      {/* Layer 2: Ergonomic cost breakdown */}
      <ErgonomicFactors metrics={metrics} diagnostics={diagnostics} />

      {/* Layer 3: Difficulty summary */}
      <DifficultySummary hardCount={hardCount} unplayableCount={unplayableCount} />
    </div>
  );
}
