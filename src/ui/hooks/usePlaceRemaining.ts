/**
 * "Place remaining N Sounds" (S3.3, T37; decision Q4).
 *
 * It never places anything itself. It proposes one Candidate Solution,
 * "Remaining placed": the layout being edited with every unplaced Sound in
 * scope put where Suggest a starting layout would put it (natural hand-pose
 * pads, busiest Sound first), and every placed Sound exactly where it is, so
 * locks hold. The candidate is added as a run and shown read-only like a
 * Generate run's candidate A; "Use as my draft" applies it as one undo step.
 * Its plan and Score come from the per-layout cache, so they are the numbers it
 * shows as the draft.
 */

import { useCallback, useRef, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, withRemainingPlaced } from '../state/projectState';
import { REMAINING_PLACED_STRATEGY } from '../state/candidateRuns';
import { analysisScope } from '../analysis/analysisScope';
import { analyseLayoutCached } from '../analysis/layoutAnalysis';
import { cloneLayout, type Layout } from '../../types/layout';
import type { CandidateSolution } from '../../types/candidateSolution';
import { generateId } from '../../utils/idGenerator';

export interface PlaceRemaining {
  /** Unplaced Sounds in scope on the layout being edited. */
  count: number;
  /** The candidate is being scored. */
  busy: boolean;
  placeRemaining: () => Promise<void>;
}

/** "Place remaining 2 Sounds". */
export function placeRemainingLabel(count: number): string {
  return `Place remaining ${count} ${count === 1 ? 'Sound' : 'Sounds'}`;
}

export function usePlaceRemaining(): PlaceRemaining {
  const { state, dispatch } = useProject();
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const edited = getDisplayedLayout(state) ?? state.activeLayout;
  const count = analysisScope(state.soundStreams, edited).unplaced;

  const placeRemaining = useCallback(async () => {
    const current = stateRef.current;
    const base = getDisplayedLayout(current) ?? current.activeLayout;
    const clone: Layout = {
      ...cloneLayout(base, generateId('remaining'), base.name, 'working'),
      provenance: `candidate:${REMAINING_PLACED_STRATEGY}`,
    };
    const layout = withRemainingPlaced(current, clone);
    if (layout === clone) return;
    const placed = Object.keys(layout.padToVoice).length - Object.keys(base.padToVoice).length;
    setBusy(true);
    try {
      const { analysis } = await analyseLayoutCached(current, layout);
      const candidate: CandidateSolution = {
        id: generateId('candidate'),
        layout,
        executionPlan: analysis.executionPlan,
        difficultyAnalysis: analysis.difficultyAnalysis,
        tradeoffProfile: analysis.tradeoffProfile,
        metadata: {
          strategy: REMAINING_PLACED_STRATEGY,
          seed: 0,
          optimizationSummary: `Placed the ${placed} remaining ${placed === 1 ? 'Sound' : 'Sounds'} on natural hand-pose pads, busiest first; your placed Sounds stay where they are`,
        },
      };
      dispatch({ type: 'ADD_CANDIDATE_RUN', payload: [candidate] });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Could not place the remaining Sounds' });
    } finally {
      setBusy(false);
    }
  }, [dispatch]);

  return { count, busy, placeRemaining };
}
