/**
 * The layout actions every surface shares (S3.3): one Promote (T13) and one
 * Keep (T30).
 *
 * Promote serves the state bar, a candidate row, a variant row, View all and
 * Compare. It acts at once, as one undo step, and a toast says what became
 * Active, its verdict and any Sounds not placed ("Promoted Candidate B to
 * Active Layout · Feasible · 2 Sounds not placed"), with Undo. The replaced
 * Active is auto-saved as a variant and a differing draft is kept in Recovered
 * drafts (the reducer). The plan the user reviewed, the layout's own plan from
 * the per-layout cache, travels with the action and is rebound to the new
 * Active, so every entry point leaves the same Active Layout and plan.
 *
 * Keep saves a candidate as a Saved Layout Variant named after how it was made
 * (candidates themselves are never saved), with an Undo toast.
 *
 * The workspace mounts LayoutActionsProvider, so a toast's Undo is withdrawn
 * once its step is no longer the one Undo reverts, even after the card that
 * started it has gone (a promoted candidate leaves the list). The provider also
 * warns before the page unloads while unkept candidates exist.
 */

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useProject } from '../state/ProjectContext';
import { useToast } from '../components/shared/Toast';
import { type ProjectAction, type ProjectState } from '../state/projectState';
import { candidateName, candidateSubject } from '../state/layoutSubject';
import { unkeptCandidates } from '../state/keptCandidates';
import { peekLayoutAnalysis } from '../analysis/layoutAnalysis';
import { analysisScope, planSoundIds } from '../analysis/analysisScope';
import { verdictLevelFor, verdictTier } from '../analysis/verdictTiers';
import { draftKeptBy } from './useDraftReplacement';
import { uniqueName } from '../../utils/uniqueName';
import { generateId } from '../../utils/idGenerator';
import type { Layout } from '../../types/layout';
import type { CandidateSolution } from '../../types/candidateSolution';

export type PromoteSource =
  | { kind: 'working' }
  | { kind: 'candidate'; id: string }
  | { kind: 'variant'; id: string };

export interface LayoutActions {
  /** Makes the layout the Active Layout, at once, with an Undo toast. */
  promote: (source: PromoteSource) => void;
  /** Saves a candidate as a Saved Layout Variant; returns the variant's id. */
  keep: (candidateId: string) => string | null;
}

/** The undo step names these actions make (historyLabels.ts). */
const PROMOTE_STEP = 'Promote';
const KEEP_STEP = 'Save as variant';

interface Prepared {
  action: Extract<ProjectAction, { type: 'PROMOTE_WORKING_LAYOUT' | 'PROMOTE_CANDIDATE' | 'PROMOTE_VARIANT' }>;
  /** How the toast names it: "your draft", "Candidate B", "\"Wide hands\"". */
  what: string;
  layout: Layout;
  reviewed: CandidateSolution | null;
}

function prepare(state: ProjectState, source: PromoteSource): Prepared | null {
  if (source.kind === 'working') {
    if (!state.workingLayout) return null;
    const reviewed = peekLayoutAnalysis(state, state.workingLayout)?.analysis ?? null;
    return { action: { type: 'PROMOTE_WORKING_LAYOUT', payload: { reviewed } }, what: 'your draft', layout: state.workingLayout, reviewed };
  }
  if (source.kind === 'candidate') {
    const candidate = state.candidates.find(c => c.id === source.id);
    if (!candidate) return null;
    const reviewed = peekLayoutAnalysis(state, candidate.layout)?.analysis ?? null;
    return {
      action: { type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id, reviewed } },
      what: candidateSubject(state, candidate).chip,
      layout: candidate.layout,
      reviewed,
    };
  }
  const variant = state.savedVariants.find(v => v.id === source.id);
  if (!variant) return null;
  const reviewed = peekLayoutAnalysis(state, variant)?.analysis ?? null;
  return { action: { type: 'PROMOTE_VARIANT', payload: { variantId: variant.id, reviewed } }, what: `"${variant.name}"`, layout: variant, reviewed };
}

/**
 * The toast's summary: the verdict of the plan that was reviewed and the
 * Sounds the new Active leaves unplaced (T31: Promote shows the verdict and
 * warns about unplaced Sounds).
 */
export function promoteSummary(state: ProjectState, layout: Layout, reviewed: CandidateSolution | null): string[] {
  const plan = reviewed?.executionPlan;
  const scope = analysisScope(state.soundStreams, layout, plan ? planSoundIds(plan.fingerAssignments) : undefined);
  const parts: string[] = [];
  if (plan) {
    const level = verdictLevelFor({ verdict: plan.diagnostics?.feasibility, placement: scope.placement });
    if (level !== 'unknown') parts.push(verdictTier(level).label);
  }
  if (scope.unplaced > 0) parts.push(`${scope.unplaced} ${scope.unplaced === 1 ? 'Sound' : 'Sounds'} not placed`);
  return parts;
}

function useLayoutActionsImpl(): LayoutActions {
  const { state, dispatch, undo, undoLabel } = useProject();
  const toast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;

  // A toast's Undo is offered only while its step is the one Undo reverts.
  const undoToast = useRef<{ id: number; step: string } | null>(null);
  useEffect(() => {
    if (undoToast.current && undoLabel !== undoToast.current.step) {
      toast.dismiss(undoToast.current.id);
      undoToast.current = null;
    }
  }, [undoLabel, toast]);
  const confirm = useCallback((message: string, step: string) => {
    if (undoToast.current) toast.dismiss(undoToast.current.id);
    undoToast.current = { id: toast.show({ message, action: { label: 'Undo', onClick: undo } }), step };
  }, [toast, undo]);

  const promote = useCallback((source: PromoteSource) => {
    const current = stateRef.current;
    const prepared = prepare(current, source);
    if (!prepared) return;
    const keptDraft = prepared.action.type !== 'PROMOTE_WORKING_LAYOUT' && !!draftKeptBy(current, prepared.action).keptId;
    dispatch(prepared.action);
    const parts = [
      `Promoted ${prepared.what} to Active Layout`,
      ...promoteSummary(current, prepared.layout, prepared.reviewed),
      ...(keptDraft ? ['your draft is in Recovered drafts'] : []),
    ];
    confirm(parts.join(' · '), PROMOTE_STEP);
  }, [dispatch, confirm]);

  const keep = useCallback((candidateId: string) => {
    const current = stateRef.current;
    const candidate = current.candidates.find(c => c.id === candidateId);
    if (!candidate) return null;
    const variantId = generateId('variant');
    const name = uniqueName(candidateName(candidate), current.savedVariants.map(v => v.name));
    dispatch({ type: 'SAVE_AS_VARIANT', payload: { name, source: 'candidate', candidateId, variantId } });
    confirm(`Kept ${candidateSubject(current, candidate).chip} as the variant "${name}"`, KEEP_STEP);
    return variantId;
  }, [dispatch, confirm]);

  return { promote, keep };
}

const LayoutActionsContext = createContext<LayoutActions | null>(null);

/** Warns before the page unloads while a candidate would be lost (T30). */
function useUnkeptCandidatesWarning(): void {
  const { state } = useProject();
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (unkeptCandidates(stateRef.current).length === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
}

/** Mounted once, around the workspace. */
export function LayoutActionsProvider({ children }: { children: ReactNode }) {
  const actions = useLayoutActionsImpl();
  useUnkeptCandidatesWarning();
  return <LayoutActionsContext.Provider value={actions}>{children}</LayoutActionsContext.Provider>;
}

/** Promote and Keep; the workspace's shared instance when there is one. */
export function useLayoutActions(): LayoutActions {
  const shared = useContext(LayoutActionsContext);
  const local = useLayoutActionsImpl();
  return shared ?? local;
}
