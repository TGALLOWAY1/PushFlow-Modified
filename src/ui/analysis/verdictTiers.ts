/**
 * The verdict tiers FeasibilityBadge renders and Learn More explains, from one
 * list (invariant 2). 'unknown' is the honest answer when there is no analysis:
 * missing data never reads as 'Feasible'.
 */

import { type FeasibilityLevel } from '../../types/diagnostics';

export type VerdictLevel = FeasibilityLevel | 'unknown';

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
    description: 'At least one event can’t be played: a Sound has no pad, or no grip can reach its pads.',
    className: 'bg-[var(--status-bad-bg)] border-[var(--status-bad-border)] text-[var(--status-bad)]',
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
