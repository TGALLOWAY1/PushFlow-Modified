// @vitest-environment happy-dom
/**
 * FeasibilityBadge component test (roadmap P0 "Component tests", criterion P0-4;
 * S1b.1 criterion P1b-2a).
 *
 * Missing data reads "Unknown" (or "Analysing..." while a run is in flight),
 * never "Feasible" (T07, repro C6), and every verdict carries its scope line.
 * A partly placed layout reads "Unfinished" (S3.3, T25), and "Infeasible" is
 * kept for placed notes that can't be played.
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
    expect(VERDICT_TIERS.map(t => t.level)).toEqual(['feasible', 'degraded', 'infeasible', 'unfinished', 'unknown']);
  });

  // S3.3 (T25): a partly placed layout is unfinished, not failed.
  describe('Unfinished', () => {
    const counts = { events: 20, notes: 26, hard: 0, unplayable: 0, unplayableNotes: 0 };

    it('reads "Unfinished · 3 of 7 Sounds placed" when the placed notes all play, never "Feasible"', () => {
      render(<FeasibilityBadge verdict={verdict('feasible', 'All playable')} scope={SCOPE} counts={counts} placement={{ placed: 3, total: 7 }} />);
      const badge = screen.getByTestId('verdict-badge');
      expect(badge.getAttribute('data-level')).toBe('unfinished');
      expect(screen.getByTestId('verdict-headline').textContent).toBe('Unfinished · 3 of 7 Sounds placed');
      expect(badge.textContent).toContain('Scoring covers the 26 notes you can play so far');
      expect(badge.textContent).not.toMatch(/feasible/i);
    });

    it('keeps the hard events of the placed notes in its summary (Degraded placed material)', () => {
      render(<FeasibilityBadge verdict={verdict('degraded', 'Hard')} scope={SCOPE} counts={{ ...counts, hard: 2 }} placement={{ placed: 5, total: 7 }} />);
      expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('unfinished');
      expect(screen.getByTestId('verdict-badge').textContent).toContain('Scoring covers the 26 notes you can play so far · 2 hard events');
    });

    it('is Infeasible, never Unfinished, when a placed note can\'t be played', () => {
      render(<FeasibilityBadge verdict={verdict('infeasible', 'x')} scope={SCOPE} counts={{ ...counts, unplayable: 1, unplayableNotes: 2 }} placement={{ placed: 3, total: 7 }} />);
      expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('infeasible');
      expect(screen.getByTestId('verdict-headline').textContent).toBe('Infeasible');
    });

    it('is not Unfinished when everything in scope is placed, or when there is no analysis yet', () => {
      render(<FeasibilityBadge verdict={verdict('feasible', 'All playable')} scope={SCOPE} counts={counts} placement={{ placed: 7, total: 7 }} />);
      expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('feasible');
      cleanup();
      render(<FeasibilityBadge scope={SCOPE} placement={{ placed: 3, total: 7 }} />);
      expect(screen.getByTestId('verdict-badge').getAttribute('data-level')).toBe('unknown');
    });
  });
});
