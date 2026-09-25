/**
 * E2E test hook (window.__pf).
 *
 * Gives Playwright specs a read-only view of project state and a few dispatch
 * helpers, so specs never have to read React internals. It is installed only
 * when the app is built or served with VITE_E2E set; ProjectProvider guards the
 * call with import.meta.env.VITE_E2E, so production builds drop this module
 * entirely (checked by scripts/check-no-test-hook.mjs).
 */

import { hashLayout } from '@/engine';
import {
  getDisplayedExecutionPlan,
  resolveInspectedLayout,
  type InspectedLayoutKind,
  type ProjectAction,
  type ProjectState,
} from '../state/projectState';
import { scoringCounts, type ScoringCounts } from '../analysis/scoringClient';
import { peekLayoutAnalysis } from '../analysis/layoutAnalysis';
import type { Layout } from '../../types/layout';
import type { ExecutionPlanResult } from '../../types/executionPlan';

export interface E2EHookSource {
  state: ProjectState;
  dispatch: (action: ProjectAction) => void;
  undo: () => void;
  redo: () => void;
  undoDepth: number;
  redoDepth: number;
}

/** A few scalar fields, cheap to poll (state() copies the whole project, candidates included). */
export interface PfStatus {
  isProcessing: boolean;
  analysisStale: boolean;
  hasAnalysis: boolean;
  candidateIds: string[];
  soundCount: number;
  hasWorkingLayout: boolean;
  isPlaying: boolean;
  currentTime: number;
  selectedEventIndex: number | null;
  selectedMomentIndex: number | null;
  /** The Sound armed for click-to-place, and the selected pad (S2.4). */
  armedStreamId: string | null;
  selectedPadKey: string | null;
  loopEnabled: boolean;
  playbackRate: number;
}

/** The layout on screen (S3.2): its role, its id (a candidate's id for a candidate) and whether it is read-only. */
export interface PfInspected {
  kind: InspectedLayoutKind;
  id: string;
  readOnly: boolean;
}

/** One note of a plan, as a timeline pill shows it: "L2", or '' when it has no finger. */
export interface PfFingering {
  eventKey: string | null;
  voiceId: string | null;
  startTime: number;
  finger: string;
}

/** A layout of this project: the one on screen, or one by role and id. */
export type PfLayoutRef = 'shown' | { kind: InspectedLayoutKind; id: string };

export interface PfTestHook {
  /** Deep copy of the current project state; mutating it changes nothing. */
  state(): ProjectState;
  /** Small status summary for polling; prefer it to state() in expect.poll loops. */
  status(): PfStatus;
  /**
   * Layout hash of the Active Layout, the Working/Test Layout (null if none),
   * the layout on screen (the inspected one, S3.2), or a layout by role and id
   * (null if there is none).
   */
  layoutHash(which?: 'active' | 'working' | PfLayoutRef): string | null;
  /** The layout on screen (S3.2). */
  inspected(): PfInspected;
  /**
   * A plan's fingering, note by note: the plan on screen ('shown', what the
   * grid and the timeline draw), or a layout's own plan read straight from the
   * per-layout analysis cache (null until it has been scored).
   */
  fingering(which?: PfLayoutRef): PfFingering[] | null;
  /** Number of undo and redo steps currently available. */
  history(): { undo: number; redo: number };
  dispatch(action: ProjectAction): void;
  undo(): void;
  redo(): void;
  /** How many layouts were scored in the scoring worker and in-process so far (S3.1). */
  scoring(): ScoringCounts;
}

declare global {
  interface Window {
    __pf?: PfTestHook;
  }
}

/** Installs window.__pf, reading through `get` so it always sees the latest render. Returns an uninstaller. */
export function installE2EHook(get: () => E2EHookSource): () => void {
  const hook: PfTestHook = {
    state: () => structuredClone(get().state),
    status() {
      const s = get().state;
      return {
        isProcessing: s.isProcessing,
        analysisStale: s.analysisStale,
        hasAnalysis: !!s.analysisResult,
        candidateIds: s.candidates.map(c => c.id),
        soundCount: s.soundStreams.length,
        hasWorkingLayout: s.workingLayout !== null,
        isPlaying: s.isPlaying,
        currentTime: s.currentTime,
        selectedEventIndex: s.selectedEventIndex,
        selectedMomentIndex: s.selectedMomentIndex,
        armedStreamId: s.armedStreamId,
        selectedPadKey: s.selectedPadKey,
        loopEnabled: s.loopEnabled,
        playbackRate: s.playbackRate,
      };
    },
    layoutHash(which = 'shown') {
      const state = get().state;
      if (which === 'active') return hashLayout(state.activeLayout);
      if (which === 'working') return state.workingLayout ? hashLayout(state.workingLayout) : null;
      if (which === 'shown') return hashLayout(resolveInspectedLayout(state).layout);
      const layout = layoutByRef(state, which);
      return layout ? hashLayout(layout) : null;
    },
    inspected() {
      const state = get().state;
      const shown = resolveInspectedLayout(state);
      return { kind: shown.role, id: shown.candidate?.id ?? shown.layout.id, readOnly: shown.readOnly };
    },
    fingering(which = 'shown') {
      const state = get().state;
      if (which === 'shown') return fingeringOf(getDisplayedExecutionPlan(state));
      const layout = layoutByRef(state, which);
      return layout ? fingeringOf(peekLayoutAnalysis(state, layout)?.analysis.executionPlan ?? null) : null;
    },
    history: () => ({ undo: get().undoDepth, redo: get().redoDepth }),
    dispatch: action => get().dispatch(action),
    undo: () => get().undo(),
    redo: () => get().redo(),
    scoring: () => scoringCounts(),
  };
  window.__pf = hook;
  return () => {
    if (window.__pf === hook) delete window.__pf;
  };
}

function layoutByRef(state: ProjectState, ref: { kind: InspectedLayoutKind; id: string }): Layout | null {
  switch (ref.kind) {
    case 'active': return state.activeLayout;
    case 'working': return state.workingLayout;
    case 'candidate': return state.candidates.find(c => c.id === ref.id)?.layout ?? null;
    case 'variant': return state.savedVariants.find(v => v.id === ref.id) ?? null;
    case 'recovered': return (state.recoveredDrafts ?? []).find(l => l.id === ref.id) ?? null;
  }
}

const FINGER_NUMBER: Record<string, string> = { thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5' };

/** A plan's notes labelled exactly as a timeline pill labels them (hand letter + finger number). */
function fingeringOf(plan: ExecutionPlanResult | null): PfFingering[] | null {
  if (!plan) return null;
  return plan.fingerAssignments.map(a => {
    const finger = a.finger as string | null;
    const label = finger && finger !== 'unassigned' ? FINGER_NUMBER[finger] ?? finger : '';
    const hand = a.assignedHand === 'left' ? 'L' : a.assignedHand === 'right' ? 'R' : '';
    return {
      eventKey: a.eventKey ?? null,
      voiceId: a.voiceId ?? null,
      startTime: a.startTime,
      finger: label ? `${hand}${label}` : '',
    };
  });
}
