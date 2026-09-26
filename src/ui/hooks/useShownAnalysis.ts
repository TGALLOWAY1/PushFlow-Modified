/**
 * The analysis the Analysis panels show for the layout on screen (S3.3, T14).
 *
 * While a re-solve is pending (an edit, a mute, a tempo change), the previous
 * plan and Score of the same layout stay on screen, dimmed (`updating`), and
 * the panels never fall back to their empty state for the moment the new plan
 * takes. The previous numbers are only ever the same subject's: the layout
 * being edited (Active or your draft, whose pads the edits change), or one
 * read-only layout; inspecting another layout never borrows them.
 */

import { useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedCandidate, resolveInspectedLayout } from '../state/projectState';
import { useLayoutAnalysis, type LayoutAnalysisState } from '../analysis/layoutAnalysis';
import type { CandidateSolution } from '../../types/candidateSolution';

type ReadyScore = Extract<LayoutAnalysisState, { status: 'ready' }>;

export interface ShownAnalysis {
  /** The plan to show: the fresh one, or the previous one while a re-solve is pending. */
  candidate: CandidateSolution | null;
  /** The layout's Score (Playability), likewise. */
  score: LayoutAnalysisState;
  /** A re-solve is pending: what is shown is the previous analysis, to be drawn dimmed. */
  updating: boolean;
}

export function useShownAnalysis(): ShownAnalysis {
  const { state } = useProject();
  const shown = resolveInspectedLayout(state);
  const scored = useLayoutAnalysis(shown.layout);
  const fresh = getDisplayedCandidate(state);

  const subject = shown.readOnly ? `${shown.role}:${shown.candidate?.id ?? shown.layout.id}` : 'edited';
  const hasPads = Object.keys(shown.layout.padToVoice).length > 0;
  const pending = hasPads && (shown.readOnly
    ? scored.status === 'analysing'
    : !state.error && state.analysisStale);

  const last = useRef<{ subject: string; candidate: CandidateSolution | null; score: ReadyScore | null }>({
    subject, candidate: null, score: null,
  });
  if (last.current.subject !== subject) last.current = { subject, candidate: null, score: null };
  if (fresh) last.current.candidate = fresh;
  if (scored.status === 'ready') last.current.score = scored;

  const candidate = fresh ?? (pending ? last.current.candidate : null);
  const score = pending && scored.status === 'analysing' && last.current.score ? last.current.score : scored;
  return { candidate, score, updating: pending && (candidate !== null || score.status === 'ready') };
}
