/**
 * How an annealing candidate was found (T33): the cost over every iteration of
 * every run, the temperature that let the search accept worse layouts early
 * on, and where it accepted a move.
 *
 * - Cost and temperature are two small charts on one iteration axis, never two
 *   scales on one plot. The best cost so far is the line that matters (accent);
 *   the current cost is context (grey). Temperature falls by orders of
 *   magnitude, so it is drawn on a log scale.
 * - At most ANNEALING_MAX_POINTS points are drawn; the summary line and the
 *   per-run table read every snapshot, and the table gives the chart's values
 *   without it.
 * - Pointing at the chart, or focusing it and pressing ←/→, reads out that
 *   stretch of iterations.
 */

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { type AnnealingIterationSnapshot } from '../../../types/executionPlan';
import { summarizeAnnealing, type AnnealingBucket, type AnnealingSummary } from '../../analysis/traceSummary';

/** The drawing's own width: the SVGs stretch it to the panel and keep their strokes 2 px. */
const W = 300;
const COST_H = 56;
const TEMP_H = 26;
const RUG_H = 8;
const PAD = 3;

const BEST = 'var(--accent-hover)';
const CURRENT = 'var(--text-tertiary)';
const TEMPERATURE = 'var(--accent-tertiary)';
const GRID = 'var(--border-strong)';

const count = (n: number) => n.toLocaleString('en-US');

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function fmtTemperature(t: number): string {
  if (!Number.isFinite(t)) return '—';
  if (t >= 10) return t.toFixed(0);
  if (t >= 0.1) return t.toFixed(2);
  return t.toExponential(1);
}

/** x for a snapshot index across all runs. */
function xOf(index: number, total: number): number {
  return total <= 1 ? W / 2 : (index / (total - 1)) * W;
}

function mid(bucket: AnnealingBucket): number {
  return (bucket.from + bucket.to - 1) / 2;
}

function path(buckets: readonly AnnealingBucket[], total: number, y: (b: AnnealingBucket) => number): string {
  return buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${xOf(mid(b), total).toFixed(2)} ${y(b).toFixed(2)}`).join(' ');
}

function scale(lo: number, hi: number, height: number): (v: number) => number {
  const span = hi - lo || 1;
  return v => PAD + (1 - (v - lo) / span) * (height - 2 * PAD);
}

export function AnnealingTraceChart({ trace }: { trace: readonly AnnealingIterationSnapshot[] }) {
  const summary = useMemo(() => summarizeAnnealing(trace), [trace]);
  const [focus, setFocus] = useState<number | null>(null);
  if (!summary) return null;
  const { buckets, total } = summary;
  const focused = focus !== null ? buckets[Math.min(focus, buckets.length - 1)] ?? null : null;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const svg = e.currentTarget.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const index = frac * (total - 1);
    let best = 0;
    buckets.forEach((b, i) => {
      if (Math.abs(mid(b) - index) < Math.abs(mid(buckets[best]!) - index)) best = i;
    });
    setFocus(best);
  };

  // The chart's own keys while it has focus (the input table leaves a key a
  // widget has handled alone).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = buckets.length - 1;
    const step = e.shiftKey ? 10 : 1;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight') next = Math.min(last, (focus ?? -1) + step);
    else if (e.key === 'ArrowLeft') next = Math.max(0, (focus ?? last + 1) - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape' && focus !== null) next = null;
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    setFocus(next);
  };

  return (
    <div data-testid="trace-annealing" className="space-y-2">
      <AnnealingSummaryLine summary={summary} />
      <div
        data-testid="trace-annealing-chart"
        role="group"
        tabIndex={0}
        aria-label="Cost and temperature by iteration; use the left and right arrow keys to read them out, or the table below"
        className="rounded-pf-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 space-y-1 focus-ring outline-none"
        onPointerMove={pick}
        onPointerLeave={() => setFocus(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setFocus(null)}
      >
        <CostChart summary={summary} focused={focused} />
        <TemperatureChart summary={summary} focused={focused} />
        <AcceptedRug summary={summary} focused={focused} />
        <div className="flex justify-between text-pf-micro text-[var(--text-tertiary)] tabular-nums" aria-hidden="true">
          <span>Iteration 1</span>
          <span>{count(total)}</span>
        </div>
      </div>
      <p data-testid="trace-readout" aria-live="polite" className="min-h-[14px] text-pf-micro text-[var(--text-secondary)] tabular-nums">
        {focused ? describeBucket(focused, summary) : ''}
      </p>
      <RunsTable summary={summary} />
    </div>
  );
}

function AnnealingSummaryLine({ summary }: { summary: AnnealingSummary }) {
  const { total, accepted, runs, change } = summary;
  const tone = change.direction === 'better' ? 'text-[var(--status-ok)]' : change.direction === 'worse' ? 'text-[var(--status-bad)]' : '';
  return (
    <p data-testid="trace-summary" className="text-pf-xs text-[var(--text-secondary)]">
      {count(total)} iterations over {runs.length} {runs.length === 1 ? 'run' : 'runs'} · {count(accepted)} accepted ·
      {' '}cost {change.before} → best {change.after} · <span className={tone}>{change.words}</span>
    </p>
  );
}

function describeBucket(b: AnnealingBucket, summary: AnnealingSummary): string {
  const range = b.count === 1 ? `Iteration ${count(b.from + 1)}` : `Iterations ${count(b.from + 1)}–${count(b.to)}`;
  const runs = summary.runs.length > 1 ? ` · run ${b.run + 1}` : '';
  return `${range}${runs} · current ${fmt(b.current)} · best ${fmt(b.best)} · temperature ${fmtTemperature(b.temperature)} · ${count(b.accepted)} of ${count(b.count)} accepted`;
}

function Crosshair({ focused, total, height }: { focused: AnnealingBucket | null; total: number; height: number }) {
  if (!focused) return null;
  const x = xOf(mid(focused), total);
  return <line x1={x} x2={x} y1={0} y2={height} style={{ stroke: 'var(--text-secondary)' }} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
}

function RunBoundaries({ summary, height }: { summary: AnnealingSummary; height: number }) {
  return (
    <>
      {summary.runStarts.map(i => {
        const x = xOf(i - 0.5, summary.total);
        return <line key={i} x1={x} x2={x} y1={0} y2={height} style={{ stroke: GRID }} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
    </>
  );
}

function LineKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The cost scale: from the lowest best cost to the 90th percentile of the
 * current cost (never below the best line's top), so a few costly layouts the
 * search tried don't flatten the best-so-far line; higher peaks are drawn at
 * the top edge, and the readout and table keep their values.
 */
export function costScale(buckets: readonly AnnealingBucket[]): { lo: number; hi: number; clipped: boolean } {
  const bests = buckets.map(b => b.best).filter(Number.isFinite);
  const currents = buckets.map(b => b.current).filter(Number.isFinite).sort((a, b) => a - b);
  const lo = Math.min(...bests, ...currents.slice(0, 1));
  const p90 = currents[Math.floor(0.9 * (currents.length - 1))] ?? lo;
  const hi = Math.max(p90, ...bests);
  return { lo, hi, clipped: (currents[currents.length - 1] ?? hi) > hi };
}

function CostChart({ summary, focused }: { summary: AnnealingSummary; focused: AnnealingBucket | null }) {
  const { buckets, total } = summary;
  const { lo, hi, clipped } = costScale(buckets);
  const toY = scale(lo, hi, COST_H);
  const y = (v: number) => toY(Math.min(v, hi));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-pf-micro text-[var(--text-tertiary)]">
        <span data-testid="trace-cost-scale">
          Cost <span className="tabular-nums">{fmt(lo)}–{fmt(hi)}</span>{clipped ? ' · peaks clipped' : ''}
        </span>
        <span className="flex items-center gap-2" data-testid="trace-annealing-legend">
          <LineKey color={BEST} label="Best so far" />
          <LineKey color={CURRENT} label="Current" />
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${COST_H}`} preserveAspectRatio="none" width="100%" height={COST_H} aria-hidden="true" className="block">
        <RunBoundaries summary={summary} height={COST_H} />
        <path d={path(buckets, total, b => y(b.current))} fill="none" style={{ stroke: CURRENT }} strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path data-testid="trace-best-line" d={path(buckets, total, b => y(b.best))} fill="none" style={{ stroke: BEST }} strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <Crosshair focused={focused} total={total} height={COST_H} />
      </svg>
    </div>
  );
}

function TemperatureChart({ summary, focused }: { summary: AnnealingSummary; focused: AnnealingBucket | null }) {
  const { buckets, total } = summary;
  const log = (t: number) => Math.log10(Math.max(t, 1e-9));
  const logs = buckets.map(b => log(b.temperature));
  const y = scale(Math.min(...logs), Math.max(...logs), TEMP_H);
  return (
    <div>
      <div className="text-pf-micro text-[var(--text-tertiary)]">Temperature, log scale</div>
      <svg viewBox={`0 0 ${W} ${TEMP_H}`} preserveAspectRatio="none" width="100%" height={TEMP_H} aria-hidden="true" className="block">
        <RunBoundaries summary={summary} height={TEMP_H} />
        <path d={path(buckets, total, b => y(log(b.temperature)))} fill="none" style={{ stroke: TEMPERATURE }} strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <Crosshair focused={focused} total={total} height={TEMP_H} />
      </svg>
    </div>
  );
}

/** One tick per stretch that accepted a move, stronger where it accepted more. */
function AcceptedRug({ summary, focused }: { summary: AnnealingSummary; focused: AnnealingBucket | null }) {
  const { buckets, total } = summary;
  return (
    <div>
      <div className="text-pf-micro text-[var(--text-tertiary)]">Accepted moves</div>
      <svg data-testid="trace-accepted-rug" viewBox={`0 0 ${W} ${RUG_H}`} preserveAspectRatio="none" width="100%" height={RUG_H} aria-hidden="true" className="block">
        {buckets.filter(b => b.accepted > 0).map(b => {
          const x0 = xOf(b.from, total);
          const x1 = Math.max(x0 + 0.6, xOf(b.to - 1, total));
          return (
            <rect key={b.from} x={x0} y={0} width={x1 - x0} height={RUG_H}
              style={{ fill: BEST, opacity: 0.2 + 0.8 * (b.accepted / b.count) }} />
          );
        })}
        <Crosshair focused={focused} total={total} height={RUG_H} />
      </svg>
    </div>
  );
}

/** The chart's values without the chart: one row per run (restart). */
function RunsTable({ summary }: { summary: AnnealingSummary }) {
  const anyStopped = summary.runs.some(r => r.stoppedByTime);
  return (
    <table data-testid="trace-runs" className="w-full text-pf-micro text-[var(--text-secondary)] tabular-nums">
      <caption className="sr-only">Each run of the search: its iterations, accepted moves and the best cost found by its end</caption>
      <thead className="text-[var(--text-tertiary)]">
        <tr>
          <th scope="col" className="text-left font-medium py-0.5">Run</th>
          <th scope="col" className="text-right font-medium">Iterations</th>
          <th scope="col" className="text-right font-medium">Accepted</th>
          <th scope="col" className="text-right font-medium">Best cost</th>
          {anyStopped && <th scope="col" className="text-right font-medium">Stopped</th>}
        </tr>
      </thead>
      <tbody>
        {summary.runs.map(r => (
          <tr key={r.run} data-testid="trace-run" className="border-t border-[var(--border-subtle)]">
            <td className="py-0.5">{r.run + 1}</td>
            <td className="text-right">{count(r.iterations)}</td>
            <td className="text-right">{count(r.accepted)}</td>
            <td className="text-right">{fmt(r.best)}</td>
            {anyStopped && <td className="text-right">{r.stoppedByTime ? 'time limit' : ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
