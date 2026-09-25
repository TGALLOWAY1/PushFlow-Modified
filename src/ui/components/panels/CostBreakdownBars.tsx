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
import { verdictTier, type VerdictLevel } from '../../analysis/verdictTiers';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface CostBreakdownBarsProps {
  metrics: V1CostBreakdown;
  diagnostics?: DiagnosticsPayload;
  hardCount?: number;
  unplayableCount?: number;
  /** Events classified Medium — playable but needing attention. */
  mediumCount?: number;
  /** Which Sounds the verdict covers (analysisScopeLine). */
  scope: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Feasibility badge
// ────────────────────────────────────────────────────────────────────────────

/**
 * The whole-layout verdict. It is derived only from data that exists: with no
 * verdict and no counts it reads 'Unknown' ('Analysing...' while a run is in
 * flight), never 'Feasible'. Every verdict carries its scope line.
 */
export function FeasibilityBadge({ verdict, unplayableCount, hardCount, pending = false, scope }: {
  verdict?: FeasibilityVerdict;
  unplayableCount?: number;
  hardCount?: number;
  /** An analysis is running, so 'Unknown' reads 'Analysing...'. */
  pending?: boolean;
  /** Which Sounds the verdict covers; null only where no Sounds are known. */
  scope: string | null;
}) {
  // Counts alone can prove a layout infeasible or degraded, never feasible:
  // 'feasible' also needs no fallback grips and no broken hand rules.
  const level: VerdictLevel = verdict?.level
    ?? (unplayableCount !== undefined && unplayableCount > 0
      ? 'infeasible'
      : hardCount !== undefined && hardCount > 0 ? 'degraded' : 'unknown');
  const tier = verdictTier(level);

  const summary = verdict?.summary
    ?? (level === 'infeasible'
      ? `${unplayableCount} unplayable event${unplayableCount !== 1 ? 's' : ''}`
      : level === 'degraded'
        ? 'Playable with hard passages'
        : pending ? 'Analysing\u2026' : 'No analysis yet');

  return (
    <div
      data-testid="verdict-badge"
      data-level={level}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-pf-sm border text-pf-xs ${tier.className}`}
      title={tier.description}
    >
      <span className="text-pf-sm">{tier.icon}</span>
      <div className="min-w-0">
        <div className="font-medium">{tier.label}</div>
        <div className="text-pf-micro opacity-80">{summary}</div>
        {scope && (
          <div data-testid="verdict-scope" className="text-pf-micro text-[var(--text-tertiary)]">{scope}</div>
        )}
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
      <h4 className="section-header">
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
              <span className="text-pf-sm text-[var(--text-secondary)]">{row.label}</span>
            </div>
            <div className="flex-1 h-3 bg-[var(--bg-card)] rounded-pf-sm overflow-hidden">
              <div
                className="h-full rounded-pf-sm transition-all duration-300"
                style={{
                  width: `${Math.max((row.value / maxValue) * 100, row.value > 0 ? 2 : 0)}%`,
                  backgroundColor: row.color,
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="text-pf-sm text-[var(--text-tertiary)] font-mono w-10 text-right">
              {row.value > 0 ? row.value.toFixed(0) : '0'}
            </span>
          </div>
        ))}
      </div>
      {diagnostics?.topContributors && diagnostics.topContributors.length > 0 && (
        <div className="text-pf-micro text-[var(--text-tertiary)]">
          Main burden: {diagnostics.topContributors.slice(0, 2).join(', ')}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Difficulty summary
// ────────────────────────────────────────────────────────────────────────────

function DifficultySummary({ hardCount, unplayableCount, mediumCount }: {
  hardCount?: number;
  unplayableCount?: number;
  mediumCount?: number;
}) {
  if (hardCount === undefined && unplayableCount === undefined) return null;
  const hard = hardCount ?? 0;
  const unplay = unplayableCount ?? 0;
  const medium = mediumCount ?? 0;
  const total = hard + unplay;

  return (
    <div className="space-y-1">
      <h4 className="section-header">
        Difficulty
      </h4>
      {total === 0 ? (
        // The green all-clear is reserved for a plan that is genuinely easy
        // throughout. It previously fired whenever nothing was Hard or Unplayable,
        // so a layout the engine considered mediocre — two thirds of its notes
        // classified Medium — was presented as clean.
        medium > 0 ? (
          <div className="text-pf-xs text-[var(--text-secondary)]">
            Nothing hard or unplayable, but{' '}
            <span className="text-[var(--text-primary)]">{medium}</span> event
            {medium !== 1 ? 's' : ''} need attention
          </div>
        ) : (
          <div className="text-pf-xs text-green-400">Comfortable throughout</div>
        )
      ) : (
        <div className="flex gap-3 text-pf-xs">
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

export function CostBreakdownBars({ metrics, diagnostics, hardCount, unplayableCount, mediumCount, scope }: CostBreakdownBarsProps) {
  return (
    <div className="space-y-3">
      {/* Layer 1: Feasibility verdict — always the whole layout's, pinned here
          whether or not an event is selected (the selected event has its own card). */}
      <FeasibilityBadge
        verdict={diagnostics?.feasibility}
        unplayableCount={unplayableCount}
        hardCount={hardCount}
        scope={scope}
      />

      {/* Layer 2: Ergonomic cost breakdown */}
      <ErgonomicFactors metrics={metrics} diagnostics={diagnostics} />

      {/* Layer 3: Difficulty summary */}
      <DifficultySummary hardCount={hardCount} unplayableCount={unplayableCount} mediumCount={mediumCount} />
    </div>
  );
}
