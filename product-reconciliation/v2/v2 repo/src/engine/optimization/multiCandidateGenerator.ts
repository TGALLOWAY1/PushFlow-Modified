/**
 * Multi-Candidate Generator.
 *
 * Produces diverse candidate solutions by generating genuinely different
 * voice-to-pad layouts, then running the beam solver on each to find the
 * best finger assignments.
 *
 * Strategy:
 *   Candidate 1 — baseline: user's current layout, standard engine config.
 *   Candidate 2 — compact-right: voices clustered tightly in the right-hand zone.
 *   Candidate 3 — compact-left: voices clustered tightly in the left-hand zone.
 *
 * Compact layouts eliminate stretch/reachability issues by placing all voices
 * on adjacent pads — the solver then finds the optimal finger assignments
 * for each arrangement.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type Layout } from '../../types/layout';
import {
  type CandidateSolution,
  type CandidateMetadata,
  type CandidateGenerationSummary,
} from '../../types/candidateSolution';
import { type NaturalHandPose } from '../../types/ergonomicPrior';
import { type EngineConfiguration } from '../../types/engineConfig';
import {
  type SolverConfig,
  type OptimizationMode,
  FAST_ANNEALING_CONFIG,
  DEEP_ANNEALING_CONFIG,
} from '../../types/engineConfig';
import { type Section } from '../../types/performanceStructure';
import { type FingerType } from '../../types/fingerModel';
import { seedLayoutFromPose0 } from '../mapping/seedFromPose';
import { getMaxSafeOffset, poseHasAssignments } from '../prior/naturalHandPose';
import { createAnnealingSolver } from './annealingSolver';
import { createBeamSolver } from '../solvers/beamSolver';
import { analyzeDifficulty, computeTradeoffProfile } from '../evaluation/difficultyScoring';
import {
  buildBaselineDiffSummary,
  filterTrivialDuplicates,
  buildGenerationSummary,
} from '../analysis/diversityMeasurement';
import { generateId } from '../../utils/idGenerator';

// ============================================================================
// Configuration
// ============================================================================

export interface CandidateGenerationConfig {
  /** Number of candidates to generate. Default: 3. */
  count?: number;
  /**
   * Whether to run annealing optimization (slower but better). Default: false.
   * @deprecated Use `optimizationMode` instead. If `optimizationMode` is set, this is ignored.
   */
  useAnnealing?: boolean;
  /**
   * Optimization mode: 'fast' (annealing with conservative budget) or 'deep'
   * (annealing with restarts and larger budget). When set, overrides `useAnnealing`.
   * Default: undefined (falls back to `useAnnealing` for backward compatibility).
   */
  optimizationMode?: OptimizationMode;
  /** Base engine configuration. */
  engineConfig: EngineConfiguration;
  /** Instrument configuration. */
  instrumentConfig: InstrumentConfig;
  /** Performance sections for difficulty analysis. */
  sections?: Section[];
  /**
   * Hard finger constraints keyed by event.eventKey.
   * Each constrained event is forced to the specified hand/finger during solving.
   * Built from layout.fingerConstraints by the caller.
   */
  manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>;
  /**
   * Starting layout to use when pose0 is null.
   * When provided, the solver uses this layout's pad assignments rather than
   * creating an empty layout, so candidates reflect the user's current grid.
   */
  baseLayout?: Layout;
  /**
   * Phase 4: Active Layout baseline for diversity measurement.
   * When provided, each candidate gets a baselineDiff summary and
   * trivial duplicates are filtered out.
   */
  activeLayout?: Layout;
}

// ============================================================================
// Layout Strategy Types
// ============================================================================

type LayoutStrategy =
  | { type: 'baseline' }
  | { type: 'compact'; zone: 'right' | 'left' }
  | { type: 'pose0-offset'; offsetRow: number };

interface CandidateStrategy {
  name: string;
  seed: number;
  layoutStrategy: LayoutStrategy;
  /** Multiplier applied to engineConfig.stiffness for this candidate. */
  stiffnessMult: number;
}

// ============================================================================
// Compact Layout Generation
// ============================================================================

/**
 * Generates a compact layout by clustering all voices from the base layout
 * into adjacent pads within a hand zone.
 *
 * Voices are sorted by MIDI note (low → high) and packed into a tight
 * rectangular block, centered in the target zone. The block is at most
 * 4 columns wide (matching natural hand span).
 *
 * Returns null if the voices can't fit in the target zone.
 */
function generateCompactLayout(
  baseLayout: Layout,
  zone: 'right' | 'left',
  rows: number,
  cols: number,
): Layout | null {
  const voices = Object.values(baseLayout.padToVoice);
  if (voices.length === 0) return null;

  // Sort voices by MIDI note for consistent left-to-right ordering
  const sorted = [...voices].sort(
    (a, b) => (a.originalMidiNote ?? 0) - (b.originalMidiNote ?? 0),
  );

  // Calculate cluster dimensions: prefer wide over tall (natural hand shape)
  const count = sorted.length;
  const clusterCols = Math.min(count, 4);
  const clusterRows = Math.ceil(count / clusterCols);

  // Zone boundaries
  const zoneColStart = zone === 'left' ? 0 : 4;
  const zoneColEnd = zone === 'left' ? 3 : 7;
  const zoneWidth = zoneColEnd - zoneColStart + 1;

  // Center the cluster within the zone
  if (clusterCols > zoneWidth) return null; // Can't fit
  const anchorCol = zoneColStart + Math.floor((zoneWidth - clusterCols) / 2);
  const anchorRow = Math.floor((rows - clusterRows) / 2);

  if (anchorRow < 0 || anchorRow + clusterRows > rows) return null;
  if (anchorCol < 0 || anchorCol + clusterCols > cols) return null;

  const padToVoice: Layout['padToVoice'] = {};
  let i = 0;
  for (let r = 0; r < clusterRows && i < count; r++) {
    for (let c = 0; c < clusterCols && i < count; c++) {
      padToVoice[`${anchorRow + r},${anchorCol + c}`] = sorted[i];
      i++;
    }
  }

  // Check that the new layout is actually different from the base
  const baseKeys = new Set(Object.keys(baseLayout.padToVoice));
  const newKeys = new Set(Object.keys(padToVoice));
  if (
    baseKeys.size === newKeys.size &&
    [...baseKeys].every(k => newKeys.has(k))
  ) {
    // Same pad positions — check if voice assignments also match
    const sameVoices = [...baseKeys].every(
      k => baseLayout.padToVoice[k]?.id === padToVoice[k]?.id,
    );
    if (sameVoices) return null; // Identical layout, no point generating
  }

  return {
    ...baseLayout,
    id: generateId('layout'),
    padToVoice,
    fingerConstraints: {},
    scoreCache: null,
    layoutMode: 'optimized' as const,
  };
}

// ============================================================================
// Strategy Generation
// ============================================================================

/**
 * Generates diverse strategies for candidate generation.
 *
 * When pose0 is available, uses traditional offset-based strategies.
 * When pose0 is null (normal Generate button), produces:
 *   1. Baseline — original layout
 *   2. Compact-right — voices clustered in right-hand zone
 *   3. Compact-left — voices clustered in left-hand zone
 */
function generateStrategies(
  pose0: NaturalHandPose | null,
  count: number,
): CandidateStrategy[] {
  if (pose0 && poseHasAssignments(pose0)) {
    // Pose0-based strategies: vary row offsets
    const maxOffset = getMaxSafeOffset(pose0, true);
    const offsets = [0];
    if (maxOffset >= 1) offsets.push(1);
    if (maxOffset >= 2) offsets.push(2);

    const strategies: CandidateStrategy[] = [];
    let seed = 42;
    for (let i = 0; i < count; i++) {
      strategies.push({
        name: `pose0-offset-${offsets[i % offsets.length]}`,
        seed,
        layoutStrategy: { type: 'pose0-offset', offsetRow: offsets[i % offsets.length] },
        stiffnessMult: 1.0,
      });
      seed += 7;
    }
    return strategies;
  }

  // Normal case: baseline + compact alternatives
  const strategies: CandidateStrategy[] = [
    {
      name: 'baseline',
      seed: 42,
      layoutStrategy: { type: 'baseline' },
      stiffnessMult: 1.0,
    },
    {
      name: 'compact-right',
      seed: 49,
      layoutStrategy: { type: 'compact', zone: 'right' },
      stiffnessMult: 1.0,
    },
    {
      name: 'compact-left',
      seed: 56,
      layoutStrategy: { type: 'compact', zone: 'left' },
      stiffnessMult: 1.0,
    },
  ];

  return strategies.slice(0, count);
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generates multiple diverse candidate solutions for a performance.
 *
 * Each candidate uses a fundamentally different layout strategy to explore
 * the solution space. Compact layouts reduce stretch and reachability
 * problems by placing voices on adjacent pads.
 */
/**
 * Result of candidate generation including diversity metadata.
 */
export interface CandidateGenerationResult {
  candidates: CandidateSolution[];
  summary: CandidateGenerationSummary | null;
}

export async function generateCandidates(
  performance: Performance,
  pose0: NaturalHandPose | null,
  config: CandidateGenerationConfig,
): Promise<CandidateGenerationResult> {
  const count = config.count ?? 3;
  const strategies = generateStrategies(pose0, count);
  const candidates: CandidateSolution[] = [];

  for (const strategy of strategies) {
    const startTime = Date.now();

    // Build the layout for this candidate
    let layout: Layout;
    const ls = strategy.layoutStrategy;

    if (ls.type === 'pose0-offset') {
      // Pose0-based: seed layout from natural hand pose with offset
      layout = pose0 && poseHasAssignments(pose0)
        ? seedLayoutFromPose0(performance, pose0, ls.offsetRow)
        : config.baseLayout ?? {
            id: generateId('layout'),
            name: `Generated Layout (${strategy.name})`,
            padToVoice: {},
            fingerConstraints: {},
            placementLocks: {},
            scoreCache: null,
            role: 'working' as const,
          };
    } else if (ls.type === 'compact' && config.baseLayout) {
      // Compact: cluster voices in a hand zone
      const compact = generateCompactLayout(
        config.baseLayout,
        ls.zone,
        config.instrumentConfig.rows,
        config.instrumentConfig.cols,
      );
      layout = compact ?? config.baseLayout; // Fall back if compact layout can't be generated
    } else {
      // Baseline or no base layout
      layout = config.baseLayout ?? {
        id: generateId('layout'),
        name: `Generated Layout (${strategy.name})`,
        padToVoice: {},
        fingerConstraints: {},
        placementLocks: {},
        scoreCache: null,
        role: 'working' as const,
      };
    }

    // Per-candidate stiffness variation
    const candidateEngineConfig: EngineConfiguration = {
      ...config.engineConfig,
      stiffness: Math.max(0.05, Math.min(0.95, config.engineConfig.stiffness * strategy.stiffnessMult)),
    };

    let executionPlan;
    let finalLayout = layout;

    // Determine whether to use annealing and which config.
    // Only 'deep' mode uses annealing (thousands of iterations).
    // 'fast' mode uses beam search only for near-instant results.
    const shouldAnneal = config.optimizationMode === 'deep'
      || (config.optimizationMode === undefined && (config.useAnnealing ?? false));

    const annealingConfig = config.optimizationMode === 'deep'
      ? DEEP_ANNEALING_CONFIG
      : FAST_ANNEALING_CONFIG;

    if (shouldAnneal && Object.keys(layout.padToVoice).length > 0) {
      // Run annealing to optimize layout + execution jointly
      const solverConfig: SolverConfig = {
        instrumentConfig: config.instrumentConfig,
        layout,
        seed: strategy.seed,
        annealingConfig,
      };
      const solver = createAnnealingSolver(solverConfig);
      executionPlan = await solver.solve(performance, candidateEngineConfig);
      finalLayout = solver.getBestLayout() ?? layout;
    } else {
      // Run beam search only (no annealing requested or empty layout)
      const solverConfig: SolverConfig = {
        instrumentConfig: config.instrumentConfig,
        layout: Object.keys(layout.padToVoice).length > 0 ? layout : null,
        mappingResolverMode: 'allow-fallback',
      };
      const solver = createBeamSolver(solverConfig);
      executionPlan = await solver.solve(performance, candidateEngineConfig, config.manualAssignments);
    }

    const sections = config.sections ?? [];
    const difficultyAnalysis = analyzeDifficulty(executionPlan, sections);
    const tradeoffProfile = computeTradeoffProfile(executionPlan, difficultyAnalysis);

    const metadata: CandidateMetadata = {
      strategy: strategy.name,
      seed: strategy.seed,
      generationTimeMs: Date.now() - startTime,
      optimizationMode: config.optimizationMode,
      optimizationSummary: config.optimizationMode
        ? `${config.optimizationMode === 'deep' ? 'Deep' : 'Quick'} optimization (${annealingConfig.iterations} iterations, ${annealingConfig.restartCount} restarts)`
        : undefined,
    };

    candidates.push({
      id: generateId('candidate'),
      layout: finalLayout,
      executionPlan,
      difficultyAnalysis,
      tradeoffProfile,
      metadata,
    });
  }

  // Phase 4: Baseline-aware diversity processing
  const activeLayout = config.activeLayout;

  if (!activeLayout) {
    // No baseline to compare against — return raw candidates
    return { candidates, summary: null };
  }

  // Find the baseline candidate's tradeoff profile (first candidate, which uses the baseline strategy)
  const baselineCandidate = candidates.find(c => c.metadata.strategy === 'baseline');
  const baselineProfile = baselineCandidate?.tradeoffProfile;

  // Attach baseline diff summaries to each candidate
  for (const candidate of candidates) {
    candidate.baselineDiff = buildBaselineDiffSummary(
      candidate,
      activeLayout,
      baselineProfile,
    );
  }

  // Filter trivial duplicates
  const [filtered, duplicatesRemoved] = filterTrivialDuplicates(candidates);

  // Filter out candidates that violate hard constraints (Unplayable assignments)
  const valid = filtered.filter(c => {
    if (c.executionPlan.unplayableCount > 0) return false;
    // Check zone violations: left hand should not be on right-only pads and vice versa
    for (const a of c.executionPlan.fingerAssignments) {
      if (a.assignedHand === 'Unplayable') return false;
      if (a.col === undefined) continue;
      // Left hand valid: cols 0-4, Right hand valid: cols 3-7
      if (a.assignedHand === 'left' && a.col > 4) return false;
      if (a.assignedHand === 'right' && a.col < 3) return false;
      // Thumb topology: for left hand thumb should be on lower row than other fingers
      // For right hand same — but this is hard to check post-hoc without full grip context
      // so we only filter the obvious zone violations here
    }
    return true;
  });

  // If all candidates were filtered, keep the best one anyway (least violations)
  const finalCandidates = valid.length > 0 ? valid : filtered.slice(0, 1);

  // Build generation summary (includes low-diversity explanation)
  const summary = buildGenerationSummary(
    candidates.length,
    duplicatesRemoved,
    finalCandidates,
    activeLayout,
  );

  return { candidates: finalCandidates, summary };
}
