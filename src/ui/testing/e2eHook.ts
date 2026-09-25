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
import type { ProjectAction, ProjectState } from '../state/projectState';

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

export interface PfTestHook {
  /** Deep copy of the current project state; mutating it changes nothing. */
  state(): ProjectState;
  /** Small status summary for polling; prefer it to state() in expect.poll loops. */
  status(): PfStatus;
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
