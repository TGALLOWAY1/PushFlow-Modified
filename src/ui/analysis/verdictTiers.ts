/**
 * The verdict tiers FeasibilityBadge renders and Learn More explains, from one
 * list (invariant 2). 'unknown' is the honest answer when there is no analysis:
 * missing data never reads as 'Feasible'. 'unfinished' (S3.3, T25) is a partly
 * placed layout: only its placed Sounds' notes are scored, so it is work in
 * progress, not a failure; 'Infeasible' is kept for placed notes that can't be
 * played.
 */

import { type FeasibilityLevel, type FeasibilityVerdict } from '../../types/diagnostics';

export type VerdictLevel = FeasibilityLevel | 'unfinished' | 'unknown';

export interface VerdictTier {
  level: VerdictLevel;
  label: string;
  icon: string;
  /** What the tier means, for Learn More and tooltips. */
  description: string;
  /** Tailwind classes built on the --status-* tokens. */
  className: string;
}

export const VERDICT_TIERS: readonly VerdictTier[] = [
  {
    level: 'feasible',
    label: 'Feasible',
    icon: '✓',
    description: 'Every event can be played with a valid grip, keeping hand separation and one finger per Sound.',
    className: 'bg-[var(--status-ok-bg)] border-[var(--status-ok-border)] text-[var(--status-ok)]',
  },
  {
    level: 'degraded',
    label: 'Degraded',
    icon: '⚠',
    description: 'Playable, but with hard events, fallback grips, or strikes that had to break a hand rule.',
    className: 'bg-[var(--status-warn-bg)] border-[var(--status-warn-border)] text-[var(--status-warn)]',
  },
  {
    level: 'infeasible',
    label: 'Infeasible',
    icon: '✗',
    description: 'At least one event of the placed Sounds can’t be played: no grip reaches its pads, one finger would strike two pads, or a hand would have to move faster than it can.',
    className: 'bg-[var(--status-bad-bg)] border-[var(--status-bad-border)] text-[var(--status-bad)]',
  },
  {
    level: 'unfinished',
    label: 'Unfinished',
    icon: '◐',
    description: 'Some Sounds aren’t on the grid yet. Only the notes of placed Sounds are scored, and they play; the rest is judged once you place it.',
    className: 'bg-[var(--accent-muted)] border-dashed border-[var(--accent-primary-soft)] text-[var(--accent-primary-soft)]',
  },
  {
    level: 'unknown',
    label: 'Unknown',
    icon: '?',
    description: 'There is no analysis for this layout yet (or it is still running), so PushFlow makes no claim about it.',
    className: 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)]',
  },
];

export function verdictTier(level: VerdictLevel): VerdictTier {
  return VERDICT_TIERS.find(t => t.level === level) ?? VERDICT_TIERS[VERDICT_TIERS.length - 1];
}

/** How many of the Sounds in scope are on the grid (analysisScope's placement). */
export interface PlacementProgress {
  placed: number;
  total: number;
}

/** Some Sounds in scope are placed and some aren't. */
export function isUnfinished(placement: PlacementProgress | undefined): placement is PlacementProgress {
  return !!placement && placement.placed > 0 && placement.placed < placement.total;
}

/**
 * A layout's verdict level, from data that exists. Counts alone can prove a
 * layout infeasible or degraded, never feasible: 'feasible' also needs no
 * fallback grips and no broken hand rules. A partly placed layout whose placed
 * notes all play is 'unfinished'; placed notes that can't be played are
 * 'infeasible' however many Sounds are placed.
 */
export function verdictLevelFor({ verdict, unplayableCount, hardCount, placement }: {
  verdict?: FeasibilityVerdict;
  unplayableCount?: number;
  hardCount?: number;
  placement?: PlacementProgress;
}): VerdictLevel {
  const level: VerdictLevel = verdict?.level
    ?? (unplayableCount !== undefined && unplayableCount > 0
      ? 'infeasible'
      : hardCount !== undefined && hardCount > 0 ? 'degraded' : 'unknown');
  return (level === 'feasible' || level === 'degraded') && isUnfinished(placement) ? 'unfinished' : level;
}

/** "Unfinished · 5 of 7 Sounds placed"; the tier's label for every other level. */
export function verdictHeadline(level: VerdictLevel, placement?: PlacementProgress): string {
  const tier = verdictTier(level);
  return level === 'unfinished' && placement
    ? `${tier.label} · ${placement.placed} of ${placement.total} Sounds placed`
    : tier.label;
}
