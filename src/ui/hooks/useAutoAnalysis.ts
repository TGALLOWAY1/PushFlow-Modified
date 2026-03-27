/**
 * useAutoAnalysis.
 *
 * Watches for `analysisStale` flag in project state and debounces
 * a re-analysis using the beam solver (fast, count:1).
 *
 * Constraint handling (Phase 2):
 * - Placement locks (layout.placementLocks): hard constraints enforced by the
 *   mutation service — locked voices cannot be moved during candidate generation.
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
} from '../state/projectState';
import { createBeamSolver } from '../../engine/solvers/beamSolver';
import { type SolverConstraints } from '../../engine/solvers/types';
import { analyzeDifficulty, computeTradeoffProfile, classifyOptimizationDifficulty } from '../../engine/evaluation/difficultyScoring';
import { evaluatePerformance } from '../../engine/evaluation/canonicalEvaluator';
import { generateCandidates } from '../../engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../engine/optimization/greedyCandidatePipeline';
// Import adapters to ensure they self-register
import '../../engine/optimization/beamOptimizerAdapter';
import '../../engine/optimization/annealingOptimizerAdapter';
import '../../engine/optimization/greedyOptimizer';
import { buildPerformanceMoments, extractPadOwnership } from '../../engine/structure/momentBuilder';
import { getNeutralHandCenters } from '../../engine/prior/handPose';
import { generateId } from '../../utils/idGenerator';
import { type SolverConfig, type OptimizationMode } from '../../types/engineConfig';
import { type Performance } from '../../types/performance';
import { type FingerType } from '../../types/fingerModel';
import { type Layout } from '../../types/layout';
import { type CostToggles } from '../../types/costToggles';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { createDefaultPose0, getPose0PadsWithOffset, fingerIdToHandAndFingerType } from '../../engine/prior/naturalHandPose';
import { type FingerId, type NaturalHandPose } from '../../types/ergonomicPrior';
import { parseFingerConstraint } from '../../utils/fingerConstraints';

/**
 * Compute initial pad ownership from pose0 + layout.
 * For pads in the layout that match a pose0 finger position,
 * pre-assign the natural finger so the solver maintains consistent assignments.
 */
function computeInitialOwnership(
  pose0: NaturalHandPose,
  layout: Layout,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> | undefined {
  const posePads = getPose0PadsWithOffset(pose0, 0, true);
  const padToFinger = new Map<string, string>();
  for (const entry of posePads) {
    padToFinger.set(`${entry.row},${entry.col}`, entry.fingerId);
  }
  const ownership: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  let count = 0;
  for (const padKey of Object.keys(layout.padToVoice)) {
    const fingerId = padToFinger.get(padKey);
    if (fingerId) {
      const { hand, finger } = fingerIdToHandAndFingerType(fingerId as FingerId);
      ownership[padKey] = { hand, finger };
      count++;
    }
  }
  return count > 0 ? ownership : undefined;
}

/** User-facing mode selection: 'auto' delegates to classifyOptimizationDifficulty. */
export type GenerationMode = OptimizationMode | 'auto';

const AUTO_ANALYSIS_DEBOUNCE_MS = 1000;

/**
 * Build separated solver constraints from layout finger constraints.
 *
 * Finger constraints (per-pad) are SOFT preferences — the solver should
 * prefer them but may deviate for a better overall solution.
 *
 * The legacy `manualAssignments` parameter is preserved for backward
 * compatibility but new code should use the SolverConstraints structure.
 *
 * Uses voiceId for matching when available, falling back to noteNumber.
 */
function buildSolverConstraints(
  performance: Performance,
  layout: Layout,
): SolverConstraints {
  const constraints = layout.fingerConstraints;
  if (!constraints || Object.keys(constraints).length === 0) return {};

  // Build voiceId → {hand, finger} and noteNumber → {hand, finger} from pad constraints
  const voiceIdConstraints = new Map<string, { hand: 'left' | 'right'; finger: FingerType }>();
  const noteConstraints = new Map<number, { hand: 'left' | 'right'; finger: FingerType }>();
  for (const [padKey, constraintStr] of Object.entries(constraints)) {
    const voice = layout.padToVoice[padKey];
    if (!voice) continue;
    const parsed = parseFingerConstraint(constraintStr);
    if (!parsed) continue;
    if (voice.id) {
      voiceIdConstraints.set(voice.id, parsed);
    }
    if (voice.originalMidiNote != null) {
      noteConstraints.set(voice.originalMidiNote, parsed);
    }
  }
  if (voiceIdConstraints.size === 0 && noteConstraints.size === 0) return {};

  // Map each event to its soft preference by eventKey (voiceId-first, noteNumber-fallback)
  const softPreferences: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  for (const event of performance.events) {
    const constraint =
      (event.voiceId ? voiceIdConstraints.get(event.voiceId) : undefined) ??
      noteConstraints.get(event.noteNumber);
    if (constraint && event.eventKey) {
      softPreferences[event.eventKey] = constraint;
    }
  }

  return Object.keys(softPreferences).length > 0
    ? { softPreferences }
    : {};
}

/**
 * Build legacy manualAssignments from constraints for backward compatibility.
 * Converts soft preferences to hard assignments for the legacy solver path.
 * TODO: Remove once the solver natively handles SolverConstraints.
 */
function constraintsToManualAssignments(
  constraints: SolverConstraints,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> | undefined {
  // For now, soft preferences are still passed as hard assignments to preserve
  // existing solver behavior. The solver interface accepts both parameters —
  // when full soft-preference support is added, this function can be removed.
  const prefs = constraints.softPreferences;
  if (!prefs || Object.keys(prefs).length === 0) return undefined;
  return prefs;
}

export function useAutoAnalysis() {
  const { state, dispatch } = useProject();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'analyzing' | 'generating'>('idle');

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

    // Clear existing debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      abortRef.current = false;

      try {
        const performance = getActivePerformance(state);
        if (performance.events.length === 0) return;

        setAnalysisPhase('analyzing');
        dispatch({ type: 'SET_PROCESSING', payload: true });

        // If the layout has no pad assignments, the solver will handle initial placement.
        const effectiveLayout = layout;

        const defaultPose = createDefaultPose0();
        const solverConfig: SolverConfig = {
          instrumentConfig: state.instrumentConfig,
          layout: effectiveLayout,
          sourceLayoutRole: effectiveLayout.role,
          initialPadOwnership: computeInitialOwnership(defaultPose, effectiveLayout),
        };
        const solver = createBeamSolver(solverConfig);

        // Build solver constraints — finger constraints are soft preferences
        const solverConstraints = buildSolverConstraints(performance, effectiveLayout);
        const manualAssignments = constraintsToManualAssignments(solverConstraints);
        const executionPlan = await solver.solve(
          performance,
          { ...state.engineConfig, beamWidth: 15 }, // Fast mode
          manualAssignments,
        );

        if (abortRef.current) return;

        const difficultyAnalysis = analyzeDifficulty(executionPlan, state.sections);
        const tradeoffProfile = computeTradeoffProfile(executionPlan, difficultyAnalysis);

        const candidate = {
          id: generateId('auto'),
          layout: effectiveLayout,
          executionPlan,
          difficultyAnalysis,
          tradeoffProfile,
          metadata: { strategy: 'auto-analysis', seed: 0 },
        };

        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setAnalysisPhase('idle');
      } catch (err) {
        setAnalysisPhase('idle');
        if (!abortRef.current) {
          dispatch({ type: 'SET_PROCESSING', payload: false });
          dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Analysis failed' });
        }
      }
    }, AUTO_ANALYSIS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current = true;
    };
  }, [state.analysisStale, state.isProcessing, state.soundStreams, state.activeLayout, state.workingLayout, state.instrumentConfig, state.sections, state.engineConfig, dispatch]);

  // Full generation (manual trigger) — routes to selected optimizer method
  const generateFull = useCallback(async (mode: GenerationMode = 'fast') => {
    const activeStreams = getActiveStreams(state);
    const layout = getDisplayedLayout(state);
    if (activeStreams.length === 0 || !layout) return;

    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_MOVE_HISTORY', payload: { moves: null, trace: null } }); // Clear previous trace
    setAnalysisPhase('generating');
    setGenerationProgress('Preparing layout...');

    try {
      const performance = getActivePerformance(state);

      // If the layout has no pad assignments, the solver will handle initial placement.
      const effectiveLayout = layout;

      const method = state.optimizerMethod;

      // ── Route: Greedy diverse candidate pipeline ───────────
      if (method === 'greedy') {
        const neutralHandCenters = getNeutralHandCenters(effectiveLayout, state.instrumentConfig);

        setGenerationProgress('Greedy optimization: generating 4 diverse candidates...');

        const generationResult = await generateGreedyCandidates({
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
        });

        const candidates = generationResult.candidates;

        dispatch({ type: 'SET_CANDIDATES', payload: candidates });
        if (candidates.length > 0) {
          dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidates[0] });
          dispatch({ type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidates[0].id } });
        }

        setGenerationProgress(null);
        setAnalysisPhase('idle');
        dispatch({ type: 'SET_PROCESSING', payload: false });
        return candidates.length;
      }

      // ── Route: Legacy multi-candidate (beam / annealing) ────
      const resolvedMode: OptimizationMode = mode === 'auto'
        ? classifyOptimizationDifficulty(performance)
        : mode;

      const solverConstraints = buildSolverConstraints(performance, effectiveLayout);
      const manualAssignments = constraintsToManualAssignments(solverConstraints);

      const modeLabel = resolvedMode === 'deep' ? 'Thorough' : 'Quick';
      setGenerationProgress(`${modeLabel} optimization: generating 3 candidates...`);

      const defaultPose = createDefaultPose0();
      const generationResult = await generateCandidates(performance, defaultPose, {
        count: 3,
        optimizationMode: resolvedMode,
        engineConfig: state.engineConfig,
        instrumentConfig: state.instrumentConfig,
        sections: state.sections,
        manualAssignments,
        baseLayout: effectiveLayout,
        activeLayout: effectiveLayout,
      });

      setGenerationProgress('Ranking results...');
      dispatch({ type: 'SET_CANDIDATES', payload: generationResult.candidates });
      if (generationResult.candidates.length > 0) {
        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: generationResult.candidates[0] });
        dispatch({ type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: generationResult.candidates[0].id } });
      }
      setGenerationProgress(null);
      setAnalysisPhase('idle');
      return generationResult.candidates.length;
    } catch (err) {
      setGenerationProgress(null);
      setAnalysisPhase('idle');
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Generation failed' });
      return 0;
    }
  }, [state, dispatch]);

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
  const generateDisabledReason = !currentLayout
    ? 'No layout available'
    : activeStreams.length === 0
      ? 'No sounds loaded — import MIDI or create patterns first'
      : null;

  return { generateFull, calculateCost, generationProgress, analysisPhase, canGenerate, generateDisabledReason };
}
