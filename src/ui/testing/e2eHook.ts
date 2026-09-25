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
import type { ProjectAction, ProjectState, GenerationRunRecord } from '../state/projectState';
import type { CandidateSolution } from '../../types/candidateSolution';

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

/** The last Generate and each candidate's trace, without the traces themselves (S3.4). */
export interface PfGeneration {
  isProcessing: boolean;
  lastRun: GenerationRunRecord | null;
  /** What the trace panel reads when no candidate is previewed. */
  trace: { moveCount: number; iterationCount: number; stopReason: string | null };
  candidates: Array<{
    id: string;
    strategy: string;
    stopReason: string | null;
    moveCount: number;
    iterationCount: number;
    annealingSteps: number;
    hasBeamSummary: boolean;
  }>;
}

export interface PfTestHook {
  /**
   * Deep copy of the current project state, without the optimizer traces
   * (candidates' iterationTrace and annealingTrace, and the session's
   * iterationTrace), which can be hundreds of MB after a greedy run; read those
   * through generation(). Mutating the copy changes nothing.
   */
  state(): ProjectState;
  /** Small status summary for polling; prefer it to state() in expect.poll loops. */
  status(): PfStatus;
  /** The last Generate: its record, the trace panel's source and each candidate's trace sizes. */
  generation(): PfGeneration;
  /** Layout hash of the Active Layout, the Working/Test Layout (null if none), or whichever is shown. */
  layoutHash(which?: 'active' | 'working' | 'shown'): string | null;
  /** Number of undo and redo steps currently available. */
  history(): { undo: number; redo: number };
  dispatch(action: ProjectAction): void;
  undo(): void;
  redo(): void;
}

declare global {
  interface Window {
    __pf?: PfTestHook;
  }
}

/** A candidate without its bulky traces (the move history is small and kept). */
function withoutBulkyTraces(candidate: CandidateSolution): CandidateSolution {
  const copy: CandidateSolution = { ...candidate, executionPlan: { ...candidate.executionPlan } };
  delete copy.iterationTrace;
  delete copy.annealingTrace;
  delete copy.executionPlan.annealingTrace;
  return copy;
}

/** Installs window.__pf, reading through `get` so it always sees the latest render. Returns an uninstaller. */
export function installE2EHook(get: () => E2EHookSource): () => void {
  const hook: PfTestHook = {
    state() {
      const s = get().state;
      return structuredClone({
        ...s,
        iterationTrace: null,
        candidates: s.candidates.map(withoutBulkyTraces),
        analysisResult: s.analysisResult ? withoutBulkyTraces(s.analysisResult) : null,
      });
    },
    generation() {
      const s = get().state;
      return structuredClone({
        isProcessing: s.isProcessing,
        lastRun: s.lastGenerationRun,
        trace: {
          moveCount: s.moveHistory?.length ?? 0,
          iterationCount: s.iterationTrace?.length ?? 0,
          stopReason: s.moveHistoryStopReason,
        },
        candidates: s.candidates.map(c => ({
          id: c.id,
          strategy: c.metadata.strategy,
          stopReason: c.stopReason ?? null,
          moveCount: c.moveHistory?.length ?? 0,
          iterationCount: c.iterationTrace?.length ?? 0,
          annealingSteps: c.annealingTrace?.length ?? 0,
          hasBeamSummary: !!c.beamSummary,
        })),
      });
    },
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
      const { activeLayout, workingLayout } = get().state;
      if (which === 'active') return hashLayout(activeLayout);
      if (which === 'working') return workingLayout ? hashLayout(workingLayout) : null;
      return hashLayout(workingLayout ?? activeLayout);
    },
    history: () => ({ undo: get().undoDepth, redo: get().redoDepth }),
    dispatch: action => get().dispatch(action),
    undo: () => get().undo(),
    redo: () => get().redo(),
  };
  window.__pf = hook;
  return () => {
    if (window.__pf === hook) delete window.__pf;
  };
}
