/**
 * Which candidates are kept (S3.3, T30). Candidates are never saved (canon),
 * so a candidate survives the session only as a Saved Layout Variant, the
 * Active Layout or the draft with its pads. Leaving the project warns while
 * any candidate is unkept.
 */

import type { CandidateSolution } from '../../types/candidateSolution';
import { layoutIdentity, type ProjectState } from './projectState';

type KeepState = Pick<ProjectState, 'voiceConstraints' | 'savedVariants' | 'activeLayout' | 'workingLayout'>;

/** Whether a Saved Layout Variant, the Active Layout or the draft has this candidate's pads. */
export function isCandidateKept(state: KeepState, candidate: CandidateSolution): boolean {
  const identity = layoutIdentity(state, candidate.layout);
  return [state.activeLayout, state.workingLayout, ...state.savedVariants]
    .some(layout => !!layout && layoutIdentity(state, layout) === identity);
}

/** Whether a Saved Layout Variant has this candidate's pads (its row's Keep reads "Kept"). */
export function isCandidateSavedAsVariant(state: Pick<ProjectState, 'voiceConstraints' | 'savedVariants'>, candidate: CandidateSolution): boolean {
  const identity = layoutIdentity(state, candidate.layout);
  return state.savedVariants.some(v => layoutIdentity(state, v) === identity);
}

/** The candidates that would be lost if the project closed now. */
export function unkeptCandidates(state: KeepState & Pick<ProjectState, 'candidates'>): CandidateSolution[] {
  return state.candidates.filter(c => !isCandidateKept(state, c));
}
