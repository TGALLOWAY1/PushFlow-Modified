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
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown, type FactorKey } from '../../analysis/factorMeta';

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
  /** Notes that can't be played, and all notes (T23: notes are single hits, events are moments). */
  unplayableNotes?: number;
  noteCount?: number;
  /** Which Sounds the verdict covers (analysisScopeLine). */
  scope: string;
}

/** Event and note counts, as momentDifficultyCounts gives them. */
export interface VerdictCounts {
  events: number;
  notes: number;
  hard: number;
  unplayable: number;
  unplayableNotes: number;
}

/**
 * The verdict's one-line summary in events and notes (T23). The engine's own
 * summary counts whatever its plan counts (notes for Beam, events for Greedy),
 * so the UI states it from the shared moment counts instead.
 */
export function verdictSummary(level: VerdictLevel, c: VerdictCounts, verdict?: FeasibilityVerdict): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (level === 'feasible') return `All ${plural(c.events, 'event', 'events')} play with natural grips`;
  if (level === 'infeasible') {
    return c.unplayableNotes > 0
      ? `${c.unplayableNotes} of ${plural(c.notes, 'note', 'notes')} can't be played`
      : verdict?.summary ?? 'Not fully playable';
  }
  if (level === 'degraded') {
    const parts: string[] = [];
    if (c.hard > 0) parts.push(plural(c.hard, 'hard event', 'hard events'));
    if (verdict?.reasons.some(r => r.type === 'constraint_relaxed' || r.type === 'fallback_grip')) parts.push('fingering rules relaxed');
    return parts.length > 0 ? `Playable, with ${parts.join(' and ')}` : 'Playable, with hard passages';
  }
  return verdict?.summary ?? 'No analysis yet';
}

// ────────────────────────────────────────────────────────────────────────────
// Feasibility badge
// ────────────────────────────────────────────────────────────────────────────

/**
 * The whole-layout verdict. It is derived only from data that exists: with no
 * verdict and no counts it reads 'Unknown' ('Analysing...' while a run is in
 * flight), never 'Feasible'. Every verdict carries its scope line.
 */
export function FeasibilityBadge({ verdict, unplayableCount, hardCount, pending = false, scope, counts }: {
  verdict?: FeasibilityVerdict;
  unplayableCount?: number;
  hardCount?: number;
  /** An analysis is running, so 'Unknown' reads 'Analysing...'. */
  pending?: boolean;
  /** Which Sounds the verdict covers; null only where no Sounds are known. */
  scope: string | null;
  /** Event and note counts: the summary is stated from these when given (T23). */
  counts?: VerdictCounts;
}) {
  // Counts alone can prove a layout infeasible or degraded, never feasible:
  // 'feasible' also needs no fallback grips and no broken hand rules.
  const level: VerdictLevel = verdict?.level
    ?? (unplayableCount !== undefined && unplayableCount > 0
      ? 'infeasible'
      : hardCount !== undefined && hardCount > 0 ? 'degraded' : 'unknown');
  const tier = verdictTier(level);

  const summary = counts && level !== 'unknown'
    ? verdictSummary(level, counts, verdict)
    : verdict?.summary
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

function ErgonomicFactors({ metrics, diagnostics }: {
  metrics: V1CostBreakdown;
  diagnostics?: DiagnosticsPayload;
}) {
  // The five canonical factors, named and coloured by FACTOR_META (T20): from
  // the canonical DiagnosticFactors when available, else from the V1 breakdown.
  const values: Record<FactorKey, number> = diagnostics?.factors ?? factorsFromBreakdown(metrics);
  const rows = FACTOR_KEYS.map(key => ({ ...FACTOR_META[key], value: values[key] }));

  const maxValue = Math.max(...rows.map(r => r.value), 0.01);

  return (
    <div className="space-y-1.5">
      <h4 className="section-header">
        Ergonomics
      </h4>
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-2" title={row.description}>
            <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-pf-sm text-[var(--text-secondary)] whitespace-nowrap">{row.label}</span>
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
          Main burden: {diagnostics.topContributors.slice(0, 2)
            .map(key => FACTOR_META[key as FactorKey]?.label ?? key)
            .join(', ')}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Difficulty summary
// ────────────────────────────────────────────────────────────────────────────

function DifficultySummary({ hardCount, unplayableCount, mediumCount, unplayableNotes, noteCount }: {
  hardCount?: number;
  unplayableCount?: number;
  mediumCount?: number;
  unplayableNotes?: number;
  noteCount?: number;
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
            <span className="text-red-400" title={unplayableNotes !== undefined && noteCount !== undefined ? `${unplayableNotes} of ${noteCount} notes can't be played` : undefined}>
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

export function CostBreakdownBars({ metrics, diagnostics, hardCount, unplayableCount, mediumCount, unplayableNotes, noteCount, scope, events }: CostBreakdownBarsProps & { events?: number }) {
  const counts: VerdictCounts | undefined = events !== undefined && noteCount !== undefined
    ? { events, notes: noteCount, hard: hardCount ?? 0, unplayable: unplayableCount ?? 0, unplayableNotes: unplayableNotes ?? 0 }
    : undefined;
  return (
    <div className="space-y-3">
      {/* Layer 1: Feasibility verdict — always the whole layout's, pinned here
          whether or not an event is selected (the selected event has its own card). */}
      <FeasibilityBadge
        verdict={diagnostics?.feasibility}
        unplayableCount={unplayableCount}
        hardCount={hardCount}
        scope={scope}
        counts={counts}
      />

      {/* Layer 2: Ergonomic cost breakdown */}
      <ErgonomicFactors metrics={metrics} diagnostics={diagnostics} />

      {/* Layer 3: Difficulty summary */}
      <DifficultySummary hardCount={hardCount} unplayableCount={unplayableCount} mediumCount={mediumCount} unplayableNotes={unplayableNotes} noteCount={noteCount} />
    </div>
  );
}
