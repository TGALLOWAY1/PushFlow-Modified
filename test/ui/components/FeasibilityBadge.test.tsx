// @vitest-environment happy-dom
/**
 * FeasibilityBadge component test (roadmap P0 "Component tests", criterion P0-4;
 * S1b.1 criterion P1b-2a).
 *
 * Missing data reads "Unknown" (or "Analysing..." while a run is in flight),
 * never "Feasible" (T07, repro C6), and every verdict carries its scope line.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FeasibilityBadge } from '@/ui/components/panels/CostBreakdownBars';
import { VERDICT_TIERS } from '@/ui/analysis/verdictTiers';
import type { FeasibilityVerdict } from '@/types';

afterEach(cleanup);

function verdict(level: FeasibilityVerdict['level'], summary: string): FeasibilityVerdict {
  return { level, summary, reasons: [] };
}

const SCOPE = 'Analysing 5 of 7 Sounds · 2 muted';

describe('FeasibilityBadge', () => {
  it.each([
    ['feasible', 'Feasible', 'All events playable'],
    ['degraded', 'Degraded', 'Playable with hard passages'],
    ['infeasible', 'Infeasible', '3 unplayable events'],
  ] as const)('renders the %s tier from a verdict', (level, label, summary) => {
    render(<FeasibilityBadge verdict={verdict(level, summary)} scope={SCOPE} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe(level);
    expect(badge.textContent).toContain(label);
    expect(badge.textContent).toContain(summary);
  });

  it('renders infeasible from an unplayable count alone', () => {
    render(<FeasibilityBadge unplayableCount={2} scope={SCOPE} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe('infeasible');
    expect(badge.textContent).toContain('2 unplayable events');
  });

  it('renders degraded from a hard count alone', () => {
    render(<FeasibilityBadge unplayableCount={0} hardCount={3} scope={SCOPE} />);
    expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('degraded');
  });

  // Flipped in S1b.1 (T07): missing data must read "Unknown", never "Feasible".
  it('never reports feasible when it has no verdict and no counts', () => {
    render(<FeasibilityBadge scope={SCOPE} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe('unknown');
    expect(badge.textContent).not.toMatch(/feasible/i);
    expect(badge.textContent).toContain('Unknown');
    expect(badge.textContent).toContain('No analysis yet');
  });

  it('never reports feasible from a zero unplayable count alone', () => {
    render(<FeasibilityBadge unplayableCount={0} hardCount={0} scope={SCOPE} />);
    expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('unknown');
  });

  it('says "Analysing…" instead of "No analysis yet" while a run is in flight', () => {
    render(<FeasibilityBadge pending scope={SCOPE} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe('unknown');
    expect(badge.textContent).toContain('Analysing…');
  });

  it('shows its scope line', () => {
    render(<FeasibilityBadge verdict={verdict('feasible', 'All events playable')} scope={SCOPE} />);
    expect(screen.getByTestId('verdict-scope').textContent).toBe(SCOPE);
  });

  it('renders every tier from the shared tier list', () => {
    expect(VERDICT_TIERS.map(t => t.level)).toEqual(['feasible', 'degraded', 'infeasible', 'unknown']);
  });
});
