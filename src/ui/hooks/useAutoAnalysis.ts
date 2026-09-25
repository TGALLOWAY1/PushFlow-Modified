/**
 * useAutoAnalysis.
 *
 * Watches for `analysisStale` flag in project state and debounces
 * a re-analysis using the beam solver (fast, count:1).
 *
 * Constraint handling (Phase 2):
 * - Placement locks (layout.placementLocks): hard constraints. Every method
 *   pre-places locked Sounds and never moves them, and a candidate that would
 *   break a lock is dropped (the candidate list says so).
 * - Finger constraints (layout.fingerConstraints): soft preferences passed via
 *   SolverConstraints.softPreferences — the solver biases toward them but may
 *   deviate for a globally better solution.
 *
 * Full multi-candidate generation is triggered manually via the toolbar button.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import {
  getActivePerformance,
  getAnalysisForLayout,
  getDisplayedCandidate,
  getDisplayedLayout,
  getActiveStreams,
  type GenerationRunRecord,
} from '../state/projectState';
import { type RunControl, isGenerationCancelled, throwIfCancelled } from '@/engine';
import { type CandidateSolution } from '../../types/candidateSolution';
import { createGenerationProgressStore } from './generationProgress';
import { classifyOptimizationDifficulty } from '../../engine/evaluation/difficultyScoring';
import { evaluatePerformance } from '../../engine/evaluation/canonicalEvaluator';
import { generateCandidates, type CandidateGenerationResult } from '../../engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../engine/optimization/greedyCandidatePipeline';
import { pinnedPlacements } from '../../engine/mapping/placementLocks';
import { analyzeLayout, buildSolverConstraints, constraintsToManualAssignments } from '../analysis/analyzeLayout';
import { rememberAnalysis } from '../analysis/analysisCache';
import { analysisKeyFor } from '../analysis/layoutAnalysis';
// Import adapters to ensure they self-register
import '../../engine/optimization/beamOptimizerAdapter';
import '../../engine/optimization/annealingOptimizerAdapter';
import '../../engine/optimization/greedyOptimizer';
import { buildPerformanceMoments, extractPadOwnership } from '../../engine/structure/momentBuilder';
import { getNeutralHandCenters } from '../../engine/prior/handPose';
import { type OptimizationMode } from '../../types/engineConfig';
import { type CostToggles } from '../../types/costToggles';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { createDefaultPose0 } from '../../engine/prior/naturalHandPose';

/** User-facing mode selection: 'auto' delegates to classifyOptimizationDifficulty. */
export type GenerationMode = OptimizationMode | 'auto';

const AUTO_ANALYSIS_DEBOUNCE_MS = 1000;

export interface AutoAnalysisOptions {
  /** The clock for Generate's budgets, elapsed time and ETA (tests inject one). */
  now?: () => number;
}

/**
 * A completed run's stop reason: 'time_budget' when any candidate used its
 * whole time limit (Thorough), else 'completed'.
 */
function completedRunStopReason(candidates: CandidateSolution[]): GenerationRunRecord['stopReason'] {
  return candidates.some(c => c.stopReason === 'time_budget') ? 'time_budget' : 'completed';
}

export function useAutoAnalysis(options: AutoAnalysisOptions = {}) {
  const { state, dispatch } = useProject();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'analyzing' | 'generating'>('idle');
  // Generate's progress lives outside project state, so a report re-renders
  // only the pill that shows it (see generationProgress.ts).
  const [generationProgress] = useState(createGenerationProgressStore);
  // The run in flight; Cancel aborts it (T35).
  const runRef = useRef<AbortController | null>(null);
  const clock = options.now;

  // Leaving the project stops a run in flight rather than letting it finish unseen.
  useEffect(() => () => runRef.current?.abort(), []);

  // Auto re-analysis: fast single-candidate when stale
  useEffect(() => {
    if (!state.analysisStale) return;
    // Skip auto-analysis while manual generation (generateFull) is running —
    // its results will arrive soon and override anything auto-analysis produces.
    if (state.isProcessing) return;

    const activeStreams = getActiveStreams(state);
    const layout = getDisplayedLayout(state);
    if (activeStreams.length === 0 || !layout) {
      return;
    }

    // An empty grid has nothing to analyse. Running the solver against one produced
    // a verdict of "Infeasible — 48 unmapped, 48 unplayable, score 0%", which is the
    // first thing a user saw after importing a MIDI file. It reads as a damning
    // judgement on their layout when the truth is simply that no sounds have been
    // placed yet, and the product forbids placing them automatically. Clear the
    // analysis instead and let the UI ask for placements.
    if (Object.keys(layout.padToVoice).length === 0) {
      // SET_ANALYSIS_RESULT also clears analysisStale, so this settles rather than
      // re-triggering on every render.
      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: null });
      return;
    }

    // Clear existing debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      abortRef.current = false;

      try {
        const performance = getActivePerformance(state);
        if (performance.events.length === 0) return;

        setAnalysisPhase('analyzing');
        dispatch({ type: 'SET_PROCESSING', payload: true });

        const candidate = await analyzeLayout({
          performance,
          layout,
          instrumentConfig: state.instrumentConfig,
          engineConfig: state.engineConfig,
          sections: state.sections,
        });

        if (abortRef.current) {
          // The effect cleanup aborted this run mid-solve. The re-run effect is
          // blocked while isProcessing is true, so failing to reset here would
          // permanently wedge auto-analysis for the rest of the session.
          dispatch({ type: 'SET_PROCESSING', payload: false });
          setAnalysisPhase('idle');
          return;
        }

        // Also serves Compare and later inspection of this exact layout (T08).
        rememberAnalysis(analysisKeyFor(state, layout), candidate);
        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setAnalysisPhase('idle');
      } catch (err) {
        setAnalysisPhase('idle');
        dispatch({ type: 'SET_PROCESSING', payload: false });
        if (!abortRef.current) {
          dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Analysis failed' });
        }
      }
    }, AUTO_ANALYSIS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current = true;
    };
  }, [state.analysisStale, state.isProcessing, state.soundStreams, state.activeLayout, state.workingLayout, state.instrumentConfig, state.sections, state.engineConfig, dispatch]);

  // Full generation (manual trigger) — routes to selected optimizer method.
  //
  // Progress, Cancel and one commit (T35): the run reports progress to the
  // toolbar's pill, Cancel aborts it at its next yield, and its results are
  // dispatched together only once it has finished. A cancelled run dispatches
  // no candidates, summary or trace (the previous ones stay), records
  // stopReason 'cancelled' in lastGenerationRun, and raises no error banner.
  const generateFull = useCallback(async (mode: GenerationMode = 'fast') => {
    const activeStreams = getActiveStreams(state);
    const layout = getDisplayedLayout(state);
    // One run at a time (Generate is disabled while one is in flight).
    if (activeStreams.length === 0 || !layout || runRef.current) return 0;

    const controller = new AbortController();
    runRef.current = controller;
    const now = clock ?? Date.now;
    const started = now();
    const method = state.optimizerMethod;
    const runControl: RunControl = { signal: controller.signal, now, onProgress: generationProgress.report };
    const recordRun = (record: Omit<GenerationRunRecord, 'method' | 'elapsedMs'>) => dispatch({
      type: 'SET_GENERATION_RUN',
      payload: { ...record, method, elapsedMs: now() - started },
    });

    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_GENERATION_RUN', payload: null });
    setAnalysisPhase('generating');
    generationProgress.start(method);

    try {
      const performance = getActivePerformance(state);

      // If the layout has no pad assignments, the solver will handle initial placement.
      const effectiveLayout = layout;

      // Generate never removes a placed Sound (invariant 7, T15): a placed Sound
      // whose events are not in this performance (a muted Sound) keeps its pad
      // in every candidate, pinned for the run rather than locked.
      const pinned = pinnedPlacements(effectiveLayout, performance);

      let generationResult: CandidateGenerationResult;

      // ── Route: Greedy diverse candidate pipeline ───────────
      if (method === 'greedy') {
        const neutralHandCenters = getNeutralHandCenters(effectiveLayout, state.instrumentConfig);

        generationResult = await generateGreedyCandidates({
          performance,
          instrumentConfig: state.instrumentConfig,
          engineConfig: state.engineConfig,
          evaluationConfig: {
            restingPose: state.engineConfig.restingPose,
            stiffness: state.engineConfig.stiffness,
            instrumentConfig: state.instrumentConfig,
            neutralHandCenters,
          },
          costToggles: state.costToggles,
          constraints: buildSolverConstraints(performance, effectiveLayout),
          baseLayout: effectiveLayout,
          activeLayout: effectiveLayout,
          sections: state.sections,
          count: 4,
          strategy: state.greedyStrategy,
          voiceHints: state.soundStreams,
          pinnedPlacements: pinned,
          runControl,
        });
      } else {
        // ── Route: Legacy multi-candidate (beam / annealing) ────
        const resolvedMode: OptimizationMode = mode === 'auto'
          ? classifyOptimizationDifficulty(performance)
          : mode;

        const solverConstraints = buildSolverConstraints(performance, effectiveLayout);
        const manualAssignments = constraintsToManualAssignments(solverConstraints);

        const defaultPose = createDefaultPose0();
        generationResult = await generateCandidates(performance, defaultPose, {
          count: 3,
          optimizationMode: resolvedMode,
          engineConfig: state.engineConfig,
          instrumentConfig: state.instrumentConfig,
          sections: state.sections,
          manualAssignments,
          baseLayout: effectiveLayout,
          activeLayout: effectiveLayout,
          // Sounds with no pad yet, by identity, so a seeded candidate can place them.
          voiceHints: state.soundStreams,
          pinnedPlacements: pinned,
          runControl,
        });
      }

      // A Cancel that arrived after the engine's last check still discards the run.
      throwIfCancelled(controller.signal);

      // Generate only proposes: the candidates fill the list, and the draft,
      // the grid and the draft's analysis are left alone (invariant 7). The
      // list, its summary, the trace and the run record land together, in one
      // synchronous batch. The trace panel starts on the top candidate's own
      // trace and stop reason (T33; every candidate carries its own).
      const { candidates, summary } = generationResult;
      const top = candidates[0];
      dispatch({ type: 'SET_CANDIDATES', payload: candidates });
      dispatch({ type: 'SET_GENERATION_SUMMARY', payload: summary });
      dispatch({
        type: 'SET_MOVE_HISTORY',
        payload: {
          moves: top?.moveHistory ?? null,
          trace: top?.iterationTrace ?? null,
          stopReason: top?.stopReason,
        },
      });
      recordRun({ outcome: 'completed', stopReason: completedRunStopReason(candidates), candidateCount: candidates.length });
      return candidates.length;
    } catch (err) {
      if (isGenerationCancelled(err)) {
        // Cancelled, not failed: no error banner, and nothing from the run is kept.
        recordRun({ outcome: 'cancelled', stopReason: 'cancelled', candidateCount: 0 });
        return 0;
      }
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Generation failed' });
      recordRun({ outcome: 'failed', stopReason: null, candidateCount: 0 });
      return 0;
    } finally {
      // CLAUDE.md requires isProcessing be reset on every path: success, error
      // and cancel. The beam and annealing branch once returned without
      // clearing it, so the spinner ran forever and every control gated on
      // isProcessing stayed disabled until a page reload.
      runRef.current = null;
      dispatch({ type: 'SET_PROCESSING', payload: false });
      generationProgress.finish();
      setAnalysisPhase('idle');
    }
  }, [state, dispatch, clock, generationProgress]);

  /** Cancels the Generate in flight (T35); it stops at its next yield and commits nothing. */
  const cancelGeneration = useCallback(() => {
    runRef.current?.abort();
  }, []);

  // Calculate Cost: evaluate current layout + assignment with given toggles
  const calculateCost = useCallback(async (costToggles: CostToggles) => {
    const layout = getDisplayedLayout(state);
    const displayedCandidate = getDisplayedCandidate(state)
      ?? getAnalysisForLayout(state, layout);
    if (!layout || Object.keys(layout.padToVoice).length === 0) {
      dispatch({ type: 'SET_ERROR', payload: 'Place sounds on the grid before calculating cost.' });
      return;
    }

    const performance = getActivePerformance(state);
    if (performance.events.length === 0) return;

    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Build moments from performance events
      const moments = buildPerformanceMoments(performance.events);
      if (moments.length === 0) return;

      // Get pad-finger assignment from the currently displayed analysis context.
      let padFingerAssignment: PadFingerAssignment = {};
      if (displayedCandidate?.executionPlan?.padFingerOwnership) {
        padFingerAssignment = displayedCandidate.executionPlan.padFingerOwnership;
      } else if (displayedCandidate?.executionPlan?.fingerAssignments) {
        const { ownership } = extractPadOwnership(displayedCandidate.executionPlan.fingerAssignments);
        padFingerAssignment = ownership;
      }

      // If no assignment available, we can't evaluate — need to run solver first
      if (Object.keys(padFingerAssignment).length === 0) {
        dispatch({ type: 'SET_ERROR', payload: 'No finger assignment available. Run Generate first to create an initial assignment.' });
        return;
      }

      // Build evaluation config
      const neutralHandCenters = getNeutralHandCenters(layout, state.instrumentConfig);
      const evaluationConfig = {
        restingPose: state.engineConfig.restingPose,
        stiffness: state.engineConfig.stiffness,
        instrumentConfig: state.instrumentConfig,
        neutralHandCenters,
      };

      const result = evaluatePerformance({
        moments,
        layout,
        padFingerAssignment,
        config: evaluationConfig,
        costToggles,
      });

      dispatch({ type: 'SET_MANUAL_COST_RESULT', payload: result });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Cost calculation failed' });
    }
  }, [state, dispatch]);

  // Precondition checks for Generate button
  const activeStreams = getActiveStreams(state);
  const currentLayout = getDisplayedLayout(state);
  const canGenerate = activeStreams.length > 0 && currentLayout !== null;
  // Shown next to the disabled button (T31), so it stays short.
  const generateDisabledReason = !currentLayout
    ? 'No layout yet'
    : activeStreams.length === 0
      ? 'Import MIDI or build a pattern first'
      : null;

  return {
    generateFull,
    cancelGeneration,
    calculateCost,
    generationProgress,
    analysisPhase,
    canGenerate,
    generateDisabledReason,
  };
}
