/**
 * The fingers the plan uses for each Sound (S5.1, T19): what the "Hand &
 * finger preference (soft)" control shows when no preference is set.
 *
 * The plan is the Execution Plan of the layout on screen. A Sound it plays
 * with one finger reads "L2"; with two, "L2/L3"; with more, "mixed", and the
 * control lists them, most-used first. The whole Sound's fingering counts, not
 * its first strike's (T19: the first assignment used to win).
 */

import { type FingerAssignment } from '../../types/executionPlan';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { fingerLabel } from '../../utils/fingerNotation';

export interface PlanFinger {
  hand: HandSide;
  finger: FingerType;
  /** "L2". */
  label: string;
  /** How many of the Sound's strikes the plan plays with it. */
  count: number;
}

export interface PlanFingers {
  /** Every finger the plan uses for the Sound, most strikes first (ties: the one used first). */
  fingers: PlanFinger[];
  /** "L2", "L2/L3", or "mixed" for three or more. */
  label: string;
}

/** "L2" for one finger, "L2/L3" for two, "mixed" for more. */
export function planFingersLabel(fingers: readonly Pick<PlanFinger, 'label'>[]): string {
  if (fingers.length <= 2) return fingers.map(f => f.label).join('/');
  return 'mixed';
}

const cache = new WeakMap<readonly FingerAssignment[], Map<string, PlanFingers>>();

/** The plan's fingers for every Sound it plays, by Sound id. Memoised per plan. */
export function planFingersBySound(assignments: readonly FingerAssignment[] | null | undefined): Map<string, PlanFingers> {
  if (!assignments) return new Map();
  const cached = cache.get(assignments);
  if (cached) return cached;

  const tallies = new Map<string, Map<string, PlanFinger & { first: number }>>();
  assignments.forEach((a, order) => {
    if (!a.voiceId || a.assignedHand === 'Unplayable') return;
    const label = fingerLabel(a.assignedHand, a.finger);
    if (!label) return;
    let tally = tallies.get(a.voiceId);
    if (!tally) tallies.set(a.voiceId, tally = new Map());
    const entry = tally.get(label);
    if (entry) entry.count++;
    else tally.set(label, { hand: a.assignedHand as HandSide, finger: a.finger as FingerType, label, count: 1, first: order });
  });

  const result = new Map<string, PlanFingers>();
  for (const [soundId, tally] of tallies) {
    const fingers = [...tally.values()]
      .sort((a, b) => b.count - a.count || a.first - b.first)
      .map(({ hand, finger, label, count }) => ({ hand, finger, label, count }));
    result.set(soundId, { fingers, label: planFingersLabel(fingers) });
  }
  cache.set(assignments, result);
  return result;
}
