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
import { compositeScore } from './candidateRanker';
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
import { buildVoiceMap, type VoiceHint } from '../mapping/voiceMap';
import { applicableLocks, findLockViolations, pinsToHonour, fixedPlacements, withoutPins } from '../mapping/placementLocks';
import { getMaxSafeOffset, poseHasAssignments, fingerIdToHandAndFingerType, getPose0PadsWithOffset } from '../prior/naturalHandPose';
import { createAnnealingSolver } from './annealingSolver';
import { createBeamSolver } from '../solvers/beamSolver';
import { countRelaxedStrikes } from '../evaluation/constraintRelaxation';
import { analyzeDifficulty, computeTradeoffProfile } from '../evaluation/difficultyScoring';
import {
  buildBaselineDiffSummary,
  filterTrivialDuplicates,
  buildGenerationSummary,
} from '../analysis/diversityMeasurement';
import { generateId } from '../../utils/idGenerator';
import { generateGreedyCandidates } from './greedyCandidatePipeline';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute initial pad ownership from pose0 + layout.
 * For each pad in the layout that corresponds to a pose0 finger position,
 * pre-assign the natural finger. This prevents the solver from picking
 * a random finger for the first hit and locking a sub-optimal assignment.
 */
function computeInitialPadOwnership(
  pose0: NaturalHandPose,
  layout: Layout,
  offsetRow: number = 0,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> {
  const ownership: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  const posePads = getPose0PadsWithOffset(pose0, offsetRow, true);

  // Build a map of pad position → fingerId from pose0
  const padToFinger = new Map<string, string>();
  for (const entry of posePads) {
    padToFinger.set(`${entry.row},${entry.col}`, entry.fingerId);
  }

  // For each pad in the layout, if it matches a pose0 position, assign that finger
  for (const padKey of Object.keys(layout.padToVoice)) {
    const fingerId = padToFinger.get(padKey);
    if (fingerId) {
      const { hand, finger } = fingerIdToHandAndFingerType(fingerId as import('../../types/ergonomicPrior').FingerId);
      ownership[padKey] = { hand, finger };
    }
  }

  return ownership;
}

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
  /**
   * Optimization method to use for candidate generation.
   * - undefined / 'beam-annealing': existing beam/annealing path (default)
   * - 'greedy': greedy candidate pipeline with diverse seed+update pairings
   */
  optimizationMethod?: 'beam-annealing' | 'greedy';
  /**
   * Evaluation config for methods that need direct canonical evaluator access.
   * Required when optimizationMethod is 'greedy'.
   */
  evaluationConfig?: import('../../types/evaluationConfig').EvaluationConfig;
  /**
   * Cost toggles for the optimizer. Required when optimizationMethod is 'greedy'.
   */
  costToggles?: import('../../types/costToggles').CostToggles;
  /**
   * The project's Sounds (name, colour, id) for Sounds that have no pad yet, so
   * a seeded layout can place them by identity. Matched by id, never by pitch.
   */
  voiceHints?: ReadonlyArray<VoiceHint>;
  /**
   * Placed Sounds every candidate must keep on their pads without a lock
   * (T15): those with no events in the performance, which in the app are the
   * muted Sounds (see pinnedPlacements). Honoured like locks while optimizing,
   * then removed from each candidate's placementLocks again.
   */
  pinnedPlacements?: Record<string, string>;
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
 * Locked Sounds stay on their locked pads (canon section 11) and the locks are
 * carried into the result. The other voices keep the base layout's reading
 * order (row by row, left to right — never pitch, invariant 5) and are packed
 * into a tight rectangular block, centred in the target zone and at most 4
 * columns wide (matching natural hand span), skipping any locked pad inside it.
 *
 * Returns null if the voices can't fit in the target zone, or if the result
 * would be identical to the base layout.
 */
function generateCompactLayout(
  baseLayout: Layout,
  zone: 'right' | 'left',
  rows: number,
  cols: number,
): Layout | null {
  const entries = Object.entries(baseLayout.padToVoice);
  if (entries.length === 0) return null;

  const knownIds = new Set(entries.map(([, voice]) => voice.id));
  const locks = applicableLocks(baseLayout.placementLocks, knownIds);

  const padToVoice: Layout['padToVoice'] = {};
  const occupied = new Set<string>();
  const honouredLocks: Record<string, string> = {};
  for (const [voiceId, lockedPad] of Object.entries(locks)) {
    const voice = entries.find(([, v]) => v.id === voiceId)?.[1];
    if (!voice || occupied.has(lockedPad)) continue;
    padToVoice[lockedPad] = voice;
    occupied.add(lockedPad);
    honouredLocks[voiceId] = lockedPad;
  }

  // Unlocked voices in the base layout's reading order.
  const byPad = (key: string) => {
    const [row, col] = key.split(',').map(Number);
    return row * cols + col;
  };
  const movable = entries
    .filter(([, voice]) => !honouredLocks[voice.id])
    .sort(([a], [b]) => byPad(a) - byPad(b))
    .map(([, voice]) => voice);

  // Calculate cluster dimensions: prefer wide over tall (natural hand shape)
  const count = entries.length;
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

  const blockPads: string[] = [];
  for (let r = 0; r < clusterRows; r++) {
    for (let c = 0; c < clusterCols; c++) {
      const key = `${anchorRow + r},${anchorCol + c}`;
      if (!occupied.has(key)) blockPads.push(key);
    }
  }
  if (blockPads.length < movable.length) return null; // Locked pads leave no room
  movable.forEach((voice, i) => {
    padToVoice[blockPads[i]] = voice;
  });

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
    placementLocks: honouredLocks,
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
  // Greedy candidate pipeline: diverse seed+update pairings
  if (config.optimizationMethod === 'greedy' && config.evaluationConfig && config.costToggles) {
    return generateGreedyCandidates({
      performance,
      instrumentConfig: config.instrumentConfig,
      engineConfig: config.engineConfig,
      evaluationConfig: config.evaluationConfig,
      costToggles: config.costToggles,
      baseLayout: config.baseLayout,
      activeLayout: config.activeLayout,
      sections: config.sections,
      count: config.count ?? 4,
      // Pins (muted placed Sounds) must reach greedy through this entry too.
      pinnedPlacements: config.pinnedPlacements,
    });
  }

  const count = config.count ?? 3;
  const strategies = generateStrategies(pose0, count);
  const candidates: CandidateSolution[] = [];

  // Every Sound by identity (layout voices first, then the project's Sounds),
  // and the locks a candidate must honour: those whose Sound exists.
  const voices = buildVoiceMap(performance, config.baseLayout, config.voiceHints);
  const knownVoiceIds = new Set<string>(voices.keys());
  for (const voice of Object.values(config.baseLayout?.padToVoice ?? {})) knownVoiceIds.add(voice.id);
  const locks = applicableLocks(config.baseLayout?.placementLocks, knownVoiceIds);
  // Placed Sounds with no events (muted) stay where they are: they ride along
  // as locks while optimizing and leave each candidate's locks again below.
  const pins = pinsToHonour(config.pinnedPlacements, locks, knownVoiceIds);
  const fixed = fixedPlacements(locks, pins);
  const baseLayout = Object.keys(pins).length > 0 && config.baseLayout
    ? { ...config.baseLayout, placementLocks: fixed }
    : config.baseLayout;
  let droppedForLocks = 0;

  for (const strategy of strategies) {
    const startTime = Date.now();

    // Build the layout for this candidate
    let layout: Layout;
    const ls = strategy.layoutStrategy;

    if (ls.type === 'pose0-offset') {
      // Pose0-based: seed a layout from the natural hand pose with this offset.
      // Sounds are placed by identity, locked Sounds first on their locked pads,
      // and the locks travel with the seeded layout.
      layout = pose0 && poseHasAssignments(pose0)
        ? seedLayoutFromPose0(performance, pose0, ls.offsetRow, {
            voices,
            placementLocks: fixed,
            baseLayout,
            soundOrder: config.voiceHints?.map(hint => hint.id),
          })
        : baseLayout ?? {
            id: generateId('layout'),
            name: `Generated Layout (${strategy.name})`,
            padToVoice: {},
            fingerConstraints: {},
            placementLocks: {},
            scoreCache: null,
            role: 'working' as const,
          };
    } else if (ls.type === 'compact' && baseLayout) {
      // Compact: cluster voices in a hand zone
      const compact = generateCompactLayout(
        baseLayout,
        ls.zone,
        config.instrumentConfig.rows,
        config.instrumentConfig.cols,
      );
      layout = compact ?? baseLayout; // Fall back if compact layout can't be generated
    } else {
      // Baseline or no base layout
      layout = baseLayout ?? {
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

    const hasLayout = Object.keys(layout.padToVoice).length > 0;

    // Pre-seed pad ownership from pose0 when available — this ensures the solver
    // uses the natural finger for each pad from the first event, preventing
    // ownership conflicts from random grip selection. Both the annealing ("Thorough")
    // and beam-only ("Quick") paths get it, so Thorough no longer starts from a
    // worse footing than Quick.
    const offsetRow = strategy.layoutStrategy.type === 'pose0-offset'
      ? strategy.layoutStrategy.offsetRow
      : 0;
    const initialPadOwnership = (pose0 && poseHasAssignments(pose0) && hasLayout)
      ? computeInitialPadOwnership(pose0, layout, offsetRow)
      : undefined;

    if (shouldAnneal && Object.keys(layout.padToVoice).length > 0) {
      // Run annealing to optimize layout + execution jointly
      const solverConfig: SolverConfig = {
        instrumentConfig: config.instrumentConfig,
        layout,
        seed: strategy.seed,
        annealingConfig,
        initialPadOwnership,
      };
      const solver = createAnnealingSolver(solverConfig);
      executionPlan = await solver.solve(performance, candidateEngineConfig, config.manualAssignments);
      finalLayout = solver.getBestLayout() ?? layout;
    } else {
      // Run beam search only (no annealing requested or empty layout)
      const solverConfig: SolverConfig = {
        instrumentConfig: config.instrumentConfig,
        layout: hasLayout ? layout : null,
        // Strict: pitch must never stand in for a placement the user has not made.
      mappingResolverMode: 'strict',
        initialPadOwnership,
      };
      const solver = createBeamSolver(solverConfig);
      executionPlan = await solver.solve(performance, candidateEngineConfig, config.manualAssignments);
    }

    // Post-validation: a candidate that moved a locked Sound is dropped, and
    // the list header says so. A surviving candidate keeps the layout its plan
    // was computed on (the seed and the compact layouts already carry the
    // locks they honour), so the plan's layout binding still matches it.
    if (findLockViolations(fixed, finalLayout).length > 0) {
      droppedForLocks++;
      continue;
    }

    // A pin is not a lock the user set: it leaves the candidate's locks, and
    // the plan follows the cleaned layout.
    ({ layout: finalLayout, executionPlan } = withoutPins(finalLayout, executionPlan, pins));

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

  // Filter candidates with excessive unplayable assignments (>25% of events).
  // The previous strict filter (any unplayable → reject) was overly aggressive
  // and discarded valid candidates for simple patterns. The beam solver already
  // handles hand/zone assignment, so we don't second-guess zone violations here.
  const valid = filtered.filter(c => {
    const totalEvents = c.executionPlan.fingerAssignments.length;
    if (totalEvents === 0) return true;
    const unplayableRatio = c.executionPlan.unplayableCount / totalEvents;
    return unplayableRatio <= 0.25;
  });

  // If all candidates were filtered, keep the best normalized plan score.
  const selected = valid.length > 0
    ? valid
    : [...filtered].sort((a, b) => b.executionPlan.score - a.executionPlan.score).slice(0, 1);

  // Rank before returning, feasibility first: the cards are numbered and the app
  // auto-applies the first one, so generation order must not decide which
  // candidate is presented as the recommendation.
  const finalCandidates = [...selected].sort((a, b) => {
    const unplayableA = a.executionPlan.unplayableMomentCount ?? a.executionPlan.unplayableCount;
    const unplayableB = b.executionPlan.unplayableMomentCount ?? b.executionPlan.unplayableCount;
    if (unplayableA !== unplayableB) return unplayableA - unplayableB;
    // Then by the structural rules: a candidate whose plan keeps hand
    // separation and one finger per sound outranks one that has to break them.
    const relaxedA = countRelaxedStrikes(a.executionPlan);
    const relaxedB = countRelaxedStrikes(b.executionPlan);
    if (relaxedA !== relaxedB) return relaxedA - relaxedB;
    // Order by the score PRINTED on the card. Ranking by the composite tradeoff
    // score instead left the list visibly contradicting itself — #1 showing 94.0
    // above a #2 showing 95.5 — so the numbering gave the user no reason to trust
    // the order. Composite score is still what diversity selection uses to choose
    // WHICH candidates to offer; it just must not decide how they are presented.
    if (b.executionPlan.score !== a.executionPlan.score) {
      return b.executionPlan.score - a.executionPlan.score;
    }
    return compositeScore(b.tradeoffProfile) - compositeScore(a.tradeoffProfile);
  });

  // Build generation summary (includes low-diversity explanation)
  const summary = buildGenerationSummary(
    candidates.length + droppedForLocks,
    duplicatesRemoved,
    finalCandidates,
    activeLayout,
    droppedForLocks,
    Object.keys(pins).length,
  );

  return { candidates: finalCandidates, summary };
}
