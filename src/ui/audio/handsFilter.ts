/**
 * Hands-separate practice (S4.4, T59): "Hands: Both / L / R".
 *
 * A rehearsal-only filter. With one hand chosen, the other hand's strikes are
 * silent and its pads dimmed; which hand strikes a note is the plan's (the
 * layout on screen's). A strike with no hand (a note no finger plays, or one
 * that can't be played) is kept in both filters: silencing what the plan
 * couldn't place would hide it. Session only, never saved, never an analysis
 * input: Playability and every verdict stay as they are.
 */

import { type FingerAssignment } from '../../types/executionPlan';

export type HandsFilter = 'both' | 'left' | 'right';

export const HANDS_FILTERS: ReadonlyArray<{ id: HandsFilter; label: string; short: string }> = [
  { id: 'both', label: 'Both hands', short: 'Both' },
  { id: 'left', label: 'Left hand only', short: 'L' },
  { id: 'right', label: 'Right hand only', short: 'R' },
];

export function isHandsFilter(value: unknown): value is HandsFilter {
  return HANDS_FILTERS.some(f => f.id === value);
}

/** Whether a strike by `hand` is heard, and drawn at full strength, under `filter`. */
export function inHandsFilter(hand: string | null | undefined, filter: HandsFilter): boolean {
  if (filter === 'both') return true;
  return hand !== (filter === 'left' ? 'right' : 'left');
}

/** Each planned note's hand, by its eventKey. */
export function handsByNote(assignments: readonly FingerAssignment[] | null | undefined): Map<string, FingerAssignment['assignedHand']> {
  const hands = new Map<string, FingerAssignment['assignedHand']>();
  for (const a of assignments ?? []) if (a.eventKey) hands.set(a.eventKey, a.assignedHand);
  return hands;
}
