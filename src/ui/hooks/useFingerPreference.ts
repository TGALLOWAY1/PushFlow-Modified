/**
 * A Sound's "Hand & finger preference (soft)" (S5.1, T19): its preference, the
 * fingers the plan of the layout on screen uses for it, and the setter every
 * surface's control calls.
 *
 * The preference lives in voiceConstraints, the one source of truth
 * (invariant 6); SET_VOICE_CONSTRAINT re-derives the pads' fingerConstraints.
 * It belongs to the Sound, not to a layout, so it can be set while a
 * read-only layout is inspected (S3.2) and survives Discard (decision Q2).
 */

import { useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan, type ProjectState } from '../state/projectState';
import { planFingersBySound, type PlanFingers } from '../analysis/planFingers';
import { type FingerType } from '../../types/fingerModel';
import type { FingerAssignmentValue } from '../components/shared/FingerAssignmentInput';

type VoiceConstraint = ProjectState['voiceConstraints'][string] | undefined;

/** The preference a Sound's constraint holds: a hand and a finger, or none. */
export function preferenceOf(constraint: VoiceConstraint): FingerAssignmentValue | null {
  if (!constraint?.hand || !constraint.finger) return null;
  return { hand: constraint.hand, finger: constraint.finger as FingerType };
}

/** The plan's fingers for every Sound, on the layout on screen. */
export function usePlanFingers(): Map<string, PlanFingers> {
  const { state } = useProject();
  return planFingersBySound(getDisplayedExecutionPlan(state)?.fingerAssignments);
}

/** Sets (or, with null, clears) a Sound's preference: one undo step, "Finger preference". */
export function useSetFingerPreference(): (soundId: string, value: FingerAssignmentValue | null) => void {
  const { dispatch } = useProject();
  return useCallback((soundId, value) => {
    dispatch({
      type: 'SET_VOICE_CONSTRAINT',
      payload: { streamId: soundId, hand: value?.hand ?? null, finger: value?.finger ?? null },
    });
  }, [dispatch]);
}

export interface FingerPreference {
  value: FingerAssignmentValue | null;
  plan: PlanFingers | null;
  onChange: (value: FingerAssignmentValue | null) => void;
}

/** One Sound's preference and plan, ready for FingerAssignmentInput. */
export function useFingerPreference(soundId: string | null | undefined): FingerPreference {
  const { state } = useProject();
  const plans = usePlanFingers();
  const set = useSetFingerPreference();
  const onChange = useCallback((value: FingerAssignmentValue | null) => {
    if (soundId) set(soundId, value);
  }, [soundId, set]);
  return {
    value: soundId ? preferenceOf(state.voiceConstraints[soundId]) : null,
    plan: soundId ? plans.get(soundId) ?? null : null,
    onChange,
  };
}
