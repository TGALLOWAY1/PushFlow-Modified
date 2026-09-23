// @vitest-environment happy-dom
/**
 * FeasibilityBadge component test (roadmap P0 "Component tests", criterion P0-4).
 *
 * The last case is expected-fail: with no verdict and no counts the badge
 * defaults to a green "Feasible · All events playable" (T07, repro C6).
 * S1b.1 fixes the default and removes the `.fails` marker.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeasibilityBadge } from '@/ui/components/panels/CostBreakdownBars';
import type { FeasibilityVerdict } from '@/types';

function verdict(level: FeasibilityVerdict['level'], summary: string): FeasibilityVerdict {
  return { level, summary, reasons: [] };
}

describe('FeasibilityBadge', () => {
  it.each([
    ['feasible', 'All events playable'],
    ['degraded', 'Playable with hard passages'],
    ['infeasible', '3 unplayable events'],
  ] as const)('renders the %s tier from a verdict', (level, summary) => {
    render(<FeasibilityBadge verdict={verdict(level, summary)} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe(level);
    expect(badge.textContent).toContain(level);
    expect(badge.textContent).toContain(summary);
  });

  it('renders infeasible from an unplayable count alone', () => {
    render(<FeasibilityBadge unplayableCount={2} />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).toBe('infeasible');
    expect(badge.textContent).toContain('2 unplayable events');
  });

  // Expected-fail until S1b.1 (T07): missing data must read "Unknown", never "Feasible".
  it.fails('never reports feasible when it has no verdict and no counts', () => {
    render(<FeasibilityBadge />);
    const badge = screen.getByTestId('verdict-badge');
    expect(badge.getAttribute('data-level')).not.toBe('feasible');
    expect(badge.textContent).not.toMatch(/feasible/i);
  });
});
