/**
 * useAutoAnalysis.
 *
 * Watches for `analysisStale` flag in project state and debounces
 * a re-analysis using the beam solver (fast, count:1).
 *
 * Pad-level finger constraints (layout.fingerConstraints) are fed into the
 * solver as hard manualAssignments — every event at a constrained pad will
 * always be played by the specified hand/finger, with the solver planning the
 * full sequence around those constraints.
 *
 * Full multi-candidate generation is triggered manually via the toolbar button.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActivePerformance, getActiveLayout, getActiveStreams, type SoundStream } from '../state/projectState';
import { createBeamSolver } from '../../engine/solvers/beamSolver';
import { analyzeDifficulty, computeTradeoffProfile, classifyOptimizationDifficulty } from '../../engine/evaluation/difficultyScoring';
import { generateCandidates } from '../../engine/optimization/multiCandidateGenerator';
import { generateId } from '../../utils/idGenerator';
import { type SolverConfig, type OptimizationMode } from '../../types/engineConfig';
import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type FingerType } from '../../types/fingerModel';
import { type Layout } from '../../types/layout';

/** User-facing mode selection: 'auto' delegates to classifyOptimizationDifficulty. */
export type GenerationMode = OptimizationMode | 'auto';

const AUTO_ANALYSIS_DEBOUNCE_MS = 1000;

/** Parse constraint like "L-Ix" → { hand, finger }. */
function parseConstraint(c: string): { hand: 'left' | 'right'; finger: FingerType } | null {
  const FINGER_MAP: Record<string, FingerType> = {
    Th: 'thumb', Ix: 'index', Md: 'middle', Rg: 'ring', Pk: 'pinky',
  };
  const m = c.match(/^([LR])-(\w+)$/);
  if (!m) return null;
  const hand = m[1] === 'L' ? 'left' as const : 'right' as const;
  const finger = FINGER_MAP[m[2]];
  return finger ? { hand, finger } : null;
}

/**
 * Build a manualAssignments map from layout.fingerConstraints.
 *
 * For each constrained pad, every performance event whose noteNumber
 * matches that pad's voice is assigned the constrained hand/finger.
 * This is passed directly to solver.solve() so constraints are hard
 * constraints during beam search, not cosmetic post-processing.
 */
function buildManualAssignments(
  performance: Performance,
  layout: Layout,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> {
  const constraints = layout.fingerConstraints;
  if (!constraints || Object.keys(constraints).length === 0) return {};

  // Build noteNumber → {hand, finger} from pad constraints
  const noteConstraints = new Map<number, { hand: 'left' | 'right'; finger: FingerType }>();
  for (const [padKey, constraintStr] of Object.entries(constraints)) {
    const voice = layout.padToVoice[padKey];
    if (!voice || voice.originalMidiNote == null) continue;
    const parsed = parseConstraint(constraintStr);
    if (!parsed) continue;
    noteConstraints.set(voice.originalMidiNote, parsed);
  }
  if (noteConstraints.size === 0) return {};

  // Map each event to its constraint by eventKey
  const assignments: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  for (const event of performance.events) {
    const constraint = noteConstraints.get(event.noteNumber);
    if (constraint && event.eventKey) {
      assignments[event.eventKey] = constraint;
    }
  }
  return assignments;
}

/**
 * Builds a Layout by assigning each unmuted stream to its chromatic grid position.
 *
 * Uses the same formula as the solver's internal noteToGrid fallback:
 *   offset = noteNumber - bottomLeftNote
 *   row    = floor(offset / cols)
 *   col    = offset % cols
 *
 * Called by generateFull() when the active layout has no pad assignments yet,
 * so that "Generate from scratch" immediately shows pad positions on the grid.
 */
function buildAutoLayout(
  soundStreams: SoundStream[],
  instrumentConfig: InstrumentConfig,
  existingLayout: Layout,
): Layout {
  const padToVoice: Layout['padToVoice'] = {};

  for (const stream of soundStreams.filter(s => !s.muted)) {
    const offset = stream.originalMidiNote - instrumentConfig.bottomLeftNote;
    if (offset < 0) continue;
    const row = Math.floor(offset / instrumentConfig.cols);
    const col = offset % instrumentConfig.cols;
    if (row >= instrumentConfig.rows) continue;

    padToVoice[`${row},${col}`] = {
      id: stream.id,
      name: stream.name,
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: stream.originalMidiNote,
      color: stream.color,
    };
  }

  return {
    ...existingLayout,
    padToVoice,
    layoutMode: 'auto',
    scoreCache: null,
  };
}

export function useAutoAnalysis() {
  const { state, dispatch } = useProject();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  // Auto re-analysis: fast single-candidate when stale
  useEffect(() => {
    if (!state.analysisStale) return;
    // Skip auto-analysis while manual generation (generateFull) is running —
    // its results will arrive soon and override anything auto-analysis produces.
    if (state.isProcessing) return;

    const activeStreams = getActiveStreams(state);
    const layout = getActiveLayout(state);
    if (activeStreams.length === 0 || !layout || Object.keys(layout.padToVoice).length === 0) {
      return;
    }

    // Clear existing debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      abortRef.current = false;

      try {
        const performance = getActivePerformance(state);
        if (performance.events.length === 0) return;

        dispatch({ type: 'SET_PROCESSING', payload: true });

        const solverConfig: SolverConfig = {
          instrumentConfig: state.instrumentConfig,
          layout,
        };
        const solver = createBeamSolver(solverConfig);

        // Build hard constraints from layout — fed into solver, not post-processed
        const manualAssignments = buildManualAssignments(performance, layout);
        const executionPlan = await solver.solve(
          performance,
          { ...state.engineConfig, beamWidth: 15 }, // Fast mode
          Object.keys(manualAssignments).length > 0 ? manualAssignments : undefined,
        );

        if (abortRef.current) return;

        const difficultyAnalysis = analyzeDifficulty(executionPlan, state.sections);
        const tradeoffProfile = computeTradeoffProfile(executionPlan, difficultyAnalysis);

        const candidate = {
          id: generateId('auto'),
          layout,
          executionPlan,
          difficultyAnalysis,
          tradeoffProfile,
          metadata: { strategy: 'auto-analysis', seed: 0 },
        };

        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
        dispatch({ type: 'SET_PROCESSING', payload: false });
      } catch (err) {
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
  }, [state.analysisStale, state.isProcessing, state.soundStreams, state.layouts, state.activeLayoutId, state.instrumentConfig, state.sections, state.engineConfig, dispatch]);

  // Full multi-candidate generation (manual trigger)
  const generateFull = useCallback(async (mode: GenerationMode = 'fast') => {
    const activeStreams = getActiveStreams(state);
    const layout = getActiveLayout(state);
    if (activeStreams.length === 0 || !layout) return;

    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_PROCESSING', payload: true });
    setGenerationProgress('Preparing layout...');

    try {
      const performance = getActivePerformance(state);

      // If the layout has no pad assignments yet, auto-assign each unmuted stream
      // to its chromatic grid position (the same formula the solver uses internally
      // as a fallback). Dispatch BULK_ASSIGN_PADS so the grid immediately shows the
      // assignments — keeping generation tightly coupled to what's on screen.
      let effectiveLayout = layout;
      if (Object.keys(layout.padToVoice).length === 0) {
        effectiveLayout = buildAutoLayout(state.soundStreams, state.instrumentConfig, layout);
        dispatch({ type: 'BULK_ASSIGN_PADS', payload: effectiveLayout.padToVoice });
      }

      // Resolve 'auto' mode by classifying the performance
      const resolvedMode: OptimizationMode = mode === 'auto'
        ? classifyOptimizationDifficulty(performance)
        : mode;

      // Build hard constraints to pass through to each candidate's solver run
      const manualAssignments = buildManualAssignments(performance, effectiveLayout);

      const modeLabel = resolvedMode === 'deep' ? 'Thorough' : 'Quick';
      setGenerationProgress(`${modeLabel} optimization: generating 3 candidates...`);

      const candidates = await generateCandidates(performance, null, {
        count: 3,
        optimizationMode: resolvedMode,
        engineConfig: state.engineConfig,
        instrumentConfig: state.instrumentConfig,
        sections: state.sections,
        manualAssignments: Object.keys(manualAssignments).length > 0 ? manualAssignments : undefined,
        baseLayout: effectiveLayout,
      });

      setGenerationProgress('Ranking results...');
      dispatch({ type: 'SET_CANDIDATES', payload: candidates });
      if (candidates.length > 0) {
        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidates[0] });
      }
      setGenerationProgress(null);
    } catch (err) {
      setGenerationProgress(null);
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Generation failed' });
    }
  }, [state, dispatch]);

  // Precondition checks for Generate button
  const activeStreams = getActiveStreams(state);
  const currentLayout = getActiveLayout(state);
  const canGenerate = activeStreams.length > 0 && currentLayout !== null;
  const generateDisabledReason = !currentLayout
    ? 'No layout available'
    : activeStreams.length === 0
      ? 'No sounds loaded — import MIDI or create patterns first'
      : null;

  return { generateFull, generationProgress, canGenerate, generateDisabledReason };
}
