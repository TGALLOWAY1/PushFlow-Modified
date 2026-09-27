/**
 * DifficultyBadge (S4.2, T27): an event's difficulty as a word, in the
 * timeline's colours (the --difficulty-* tokens its pill markers use). Hard
 * and Unplayable are filled, Easy and Medium outlined, so the fill is a second
 * cue besides the colour. The cost itself is in the tooltip, never the badge,
 * and an event with no cost reads "Not analysed", never "Easy" or "Infinity".
 */

import { type CSSProperties } from 'react';
import { type MomentCost } from '@/engine';
import { type DifficultyLevel } from '../../../types/executionPlan';

const LEVEL_STYLE: Record<DifficultyLevel, CSSProperties> = {
  Easy: { color: 'var(--status-ok)', borderColor: 'var(--status-ok-border)' },
  Medium: { color: 'var(--difficulty-medium)', borderColor: 'color-mix(in srgb, var(--difficulty-medium) 55%, transparent)' },
  Hard: { color: '#111827', backgroundColor: 'var(--difficulty-hard)', borderColor: 'var(--difficulty-hard)' },
  Unplayable: { color: '#111827', backgroundColor: 'var(--difficulty-unplayable)', borderColor: 'var(--difficulty-unplayable)' },
};

/** What the badge's tooltip says. */
export function difficultyTitle(cost: MomentCost | null): string {
  if (!cost) return 'Not analysed: none of its Sounds is on this layout’s pads';
  if (cost.difficulty === 'Unplayable') {
    return `Unplayable: ${cost.unplayableNoteCount} of ${cost.noteCount} ${cost.noteCount === 1 ? 'note' : 'notes'} can’t be played`;
  }
  return `${cost.difficulty} · cost ${cost.cost.toFixed(1)}, counted once for the event`;
}

export function DifficultyBadge({ cost, short = false, testId }: {
  cost: MomentCost | null;
  /** In a list row: "—" and "Med" instead of "Not analysed" and "Medium". */
  short?: boolean;
  testId?: string;
}) {
  const level = cost?.difficulty ?? null;
  const text = !level ? (short ? '—' : 'Not analysed')
    : level === 'Unplayable' ? '✗ Unplayable'
    : level === 'Medium' && short ? 'Med'
    : level;
  return (
    <span
      data-testid={testId}
      data-level={level ?? 'unanalysed'}
      title={difficultyTitle(cost)}
      className={`inline-flex items-center justify-center px-1.5 h-[18px] rounded-pf-sm border text-pf-micro font-semibold whitespace-nowrap flex-shrink-0 ${level ? '' : 'border-dashed border-[var(--border-strong)] text-[var(--text-tertiary)]'}`}
      style={level ? LEVEL_STYLE[level] : undefined}
    >
      {text}
    </span>
  );
}
