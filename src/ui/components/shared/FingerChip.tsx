/**
 * FingerChip (S4.2, T42): a finger written "L2", with the hand's colour as a
 * tint and an edge under the letters and the finger's name in the tooltip.
 * The text stays neutral, so it reads on any tint (T64), and the letter is the
 * second cue besides the colour.
 */

import { type CSSProperties } from 'react';
import { fingerLabel, fingerName, handColor } from '../../../utils/fingerNotation';

/** The chip look for a hand: a light tint and a 2 px edge in the hand's colour. */
export function fingerChipStyle(hand: unknown): CSSProperties {
  const color = handColor(hand);
  if (!color) return { backgroundColor: 'var(--bg-hover)' };
  return {
    backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
    boxShadow: `inset 0 -2px 0 ${color}`,
  };
}

export function FingerChip({ hand, finger, suggestion = false, className = '', testId }: {
  hand: unknown;
  finger: unknown;
  /** The solver's choice, not the user's: drawn at reduced opacity. */
  suggestion?: boolean;
  className?: string;
  testId?: string;
}) {
  const label = fingerLabel(hand, finger);
  if (!label) return null;
  return (
    <span
      data-testid={testId}
      data-finger={label}
      title={suggestion ? `${fingerName(hand, finger)} (the plan's choice)` : fingerName(hand, finger)}
      className={`inline-flex items-center justify-center px-1 h-[18px] rounded-pf-sm text-pf-micro font-mono font-semibold text-[var(--text-primary)] ${className}`}
      style={{ ...fingerChipStyle(hand), opacity: suggestion ? 0.6 : 1 }}
    >
      {label}
    </span>
  );
}
