/**
 * Constraint relaxation summary.
 *
 * Hand-zone separation and one finger per Sound are hard rules. The solver
 * relaxes them only when it finds no plan that keeps them, and flags every
 * strike that breaks one (`FingerAssignment.relaxedConstraints`). This module
 * turns those per-strike flags into the plan-level summary the UI shows, so a
 * relaxation is stated up front rather than left for the user to discover in
 * the timeline.
 */

import {
  type ConstraintRelaxationSummary,
  type FingerAssignment,
  type SoundRelaxation,
} from '../../types/executionPlan';
import { type FingerType } from '../../types/fingerModel';
import { MOMENT_EPSILON } from '../../types/performanceEvent';

const FINGER_NUMBER: Record<FingerType, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

/** "L2"-style label for a hand + finger, as used across the UI. */
function fingerLabel(hand: 'left' | 'right', finger: FingerType): string {
  return `${hand === 'left' ? 'L' : 'R'}${FINGER_NUMBER[finger]}`;
}

/**
 * Summarises which strikes of a plan break the structural rules.
 *
 * Moments are counted the way the solver groups them — strikes within
 * MOMENT_EPSILON of the moment's first strike belong to it — so the relaxed
 * moment count matches what the timeline shows as one moment.
 */
export function summarizeConstraintRelaxation(
  fingerAssignments: FingerAssignment[],
): ConstraintRelaxationSummary {
  let handZoneStrikes = 0;
  let fingerOwnershipStrikes = 0;
  const perSound = new Map<string, SoundRelaxation & { fingerCounts: Map<string, number> }>();

  const played = fingerAssignments.filter(
    (fa): fa is FingerAssignment & { assignedHand: 'left' | 'right'; finger: FingerType } =>
      fa.assignedHand !== 'Unplayable' && fa.finger !== null,
  );

  // Every finger a Sound was played with, relaxed or not, so a Sound that
  // needed a second finger can be shown with both.
  for (const fa of played) {
    const soundId = fa.voiceId ?? String(fa.noteNumber);
    let entry = perSound.get(soundId);
    if (!entry) {
      entry = {
        soundId,
        noteNumber: fa.noteNumber,
        handZoneStrikes: 0,
        fingerOwnershipStrikes: 0,
        fingersUsed: [],
        fingerCounts: new Map(),
      };
      perSound.set(soundId, entry);
    }
    const label = fingerLabel(fa.assignedHand, fa.finger);
    entry.fingerCounts.set(label, (entry.fingerCounts.get(label) ?? 0) + 1);

    const relaxed = fa.relaxedConstraints ?? [];
    if (relaxed.includes('hand-zone')) {
      handZoneStrikes++;
      entry.handZoneStrikes++;
    }
    if (relaxed.includes('finger-ownership')) {
      fingerOwnershipStrikes++;
      entry.fingerOwnershipStrikes++;
    }
  }

  // Count relaxed moments using the solver's own grouping rule.
  const ordered = [...played].sort((a, b) => a.startTime - b.startTime);
  let relaxedMomentCount = 0;
  let momentStart = -Infinity;
  let momentRelaxed = false;
  for (const fa of ordered) {
    if (fa.startTime - momentStart > MOMENT_EPSILON) {
      if (momentRelaxed) relaxedMomentCount++;
      momentStart = fa.startTime;
      momentRelaxed = false;
    }
    if ((fa.relaxedConstraints?.length ?? 0) > 0) momentRelaxed = true;
  }
  if (momentRelaxed) relaxedMomentCount++;

  const sounds: SoundRelaxation[] = [...perSound.values()]
    .filter(entry => entry.handZoneStrikes + entry.fingerOwnershipStrikes > 0)
    .map(({ fingerCounts, ...entry }) => ({
      ...entry,
      fingersUsed: [...fingerCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([label]) => label),
    }))
    .sort((a, b) =>
      (b.handZoneStrikes + b.fingerOwnershipStrikes) - (a.handZoneStrikes + a.fingerOwnershipStrikes)
      || a.soundId.localeCompare(b.soundId));

  return {
    mode: handZoneStrikes + fingerOwnershipStrikes > 0 ? 'relaxed' : 'strict',
    handZoneStrikes,
    fingerOwnershipStrikes,
    relaxedMomentCount,
    sounds,
  };
}

/**
 * Number of strikes in a plan that break a structural rule. Plans without a
 * summary (produced before the rules were tracked) count as zero.
 */
export function countRelaxedStrikes(
  plan: { constraintRelaxation?: ConstraintRelaxationSummary },
): number {
  const summary = plan.constraintRelaxation;
  return summary ? summary.handZoneStrikes + summary.fingerOwnershipStrikes : 0;
}
