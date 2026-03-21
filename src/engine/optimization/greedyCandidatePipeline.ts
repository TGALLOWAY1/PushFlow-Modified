/**
 * Greedy Candidate Pipeline.
 *
 * Orchestrates diverse candidate generation using the greedy optimizer
 * with pluggable seed generators and update policies.
 *
 * Pipeline:
 * 1. Extract sound features (shared across all candidates)
 * 2. Generate 13+ internal candidates across 4 families
 * 3. Evaluate all with canonical evaluator
 * 4. Select 4 diverse finalists (quality + novelty)
 * 5. Attach explanation cards
 * 6. Compute baseline diversity diffs
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { type Section } from '../../types/performanceStructure';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type CostToggles, ALL_COSTS_ENABLED } from '../../types/costToggles';
import {
  type CandidateSolution,
  type CandidateMetadata,
  type CandidateExplanation,
} from '../../types/candidateSolution';
import { type OptimizerInput } from './optimizerInterface';
import { type SolverConstraints } from '../solvers/types';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type SoundFeatureMap, extractSoundFeatures } from '../structure/soundFeatures';
import { type SeedContext, SEED_GENERATORS } from './seedGenerators';
import { UPDATE_POLICIES } from './updatePolicies';
import { type GreedyRunOptions, GreedyOptimizer } from './greedyOptimizer';
import { analyzeDifficulty, computeTradeoffProfile } from '../evaluation/difficultyScoring';
import { compositeScore } from './candidateRanker';
import {
  computeLayoutDiversity,
  buildBaselineDiffSummary,
  filterTrivialDuplicates,
  buildGenerationSummary,
} from '../analysis/diversityMeasurement';
import { generateId } from '../../utils/idGenerator';
import { createSeededRng } from '../../utils/seededRng';
import { type CandidateGenerationResult } from './multiCandidateGenerator';

// ============================================================================
// Types
// ============================================================================

/**
 * Input configuration for greedy candidate pipeline.
 */
export interface GreedyCandidateInput {
  performance: Performance;
  instrumentConfig: InstrumentConfig;
  engineConfig: EngineConfiguration;
  evaluationConfig: EvaluationConfig;
  costToggles?: CostToggles;
  constraints?: SolverConstraints;
  baseLayout?: Layout;
  activeLayout?: Layout;
  sections?: Section[];
  /** Number of finalists to return. Default: 4. */
  count?: number;
  /** Maximum iterations per internal greedy run. Default: 100. */
  maxIterationsPerRun?: number;
}

/**
 * Definition of a candidate family (seed + update policy pairing).
 */
interface CandidateFamily {
  name: string;
  seedKey: string;
  updateKey: string;
  /** Number of internal variants to generate for this family. */
  seedCount: number;
  /** Description for "best for" explanation. */
  bestForDescription: string;
}

/**
 * Internal scored candidate with family metadata.
 */
interface ScoredCandidate {
  candidate: CandidateSolution;
  familyName: string;
  qualityScore: number;
  seedIndex: number;
}

// ============================================================================
// Candidate Family Definitions
// ============================================================================

const CANDIDATE_FAMILIES: CandidateFamily[] = [
  {
    name: 'Natural Pose Anchor',
    seedKey: 'natural-pose',
    updateKey: 'strict-greedy',
    seedCount: 3,
    bestForDescription: 'comfort and learnability',
  },
  {
    name: 'Clustered Motif Layout',
    seedKey: 'cluster',
    updateKey: 'adjacency-preserving',
    seedCount: 3,
    bestForDescription: 'memorability and phrase consistency',
  },
  {
    name: 'Coordination-Optimized',
    seedKey: 'coordination',
    updateKey: 'transition-aware',
    seedCount: 3,
    bestForDescription: 'fast alternation and rhythmic flow',
  },
  {
    name: 'Exploratory Variant',
    seedKey: 'novelty',
    updateKey: 'soft-greedy',
    seedCount: 4,
    bestForDescription: 'discovering unconventional but efficient structures',
  },
];

// ============================================================================
// Pipeline
// ============================================================================

/**
 * Generate diverse greedy candidates.
 *
 * Produces 4 finalists from 13+ internal candidates using
 * quality + diversity frontier selection.
 */
export async function generateGreedyCandidates(
  input: GreedyCandidateInput,
): Promise<CandidateGenerationResult> {
  const count = input.count ?? 4;
  const maxIter = input.maxIterationsPerRun ?? 100;
  const costToggles = input.costToggles ?? ALL_COSTS_ENABLED;
  const sections = input.sections ?? [];

  // Phase 1: Extract sound features (shared across all candidates)
  const features = extractSoundFeatures(input.performance.events, sections);

  if (features.size === 0) {
    return { candidates: [], summary: null };
  }

  // Build voice map from base layout or performance events
  const voices = buildVoiceMap(input.performance, input.baseLayout);

  // Phase 2: Generate internal candidates
  const allScored: ScoredCandidate[] = [];
  const optimizer = new GreedyOptimizer();

  for (const family of CANDIDATE_FAMILIES) {
    const seedGen = SEED_GENERATORS[family.seedKey];
    const updatePolicy = UPDATE_POLICIES[family.updateKey];

    if (!seedGen || !updatePolicy) continue;

    for (let seedIdx = 0; seedIdx < family.seedCount; seedIdx++) {
      const seed = 42 + seedIdx * 7919; // Prime-offset seeds for diversity
      const rng = createSeededRng(seed);

      // Generate seed layout
      const seedCtx: SeedContext = {
        features,
        voices,
        instrumentConfig: input.instrumentConfig,
        placementLocks: input.baseLayout?.placementLocks ?? {},
        rng,
        baseLayout: input.baseLayout,
      };

      const seedLayout = seedGen.generate(seedCtx);

      // Skip if seed layout has no voices placed
      if (Object.keys(seedLayout.padToVoice).length === 0) continue;

      // Build optimizer input
      const optimizerInput: OptimizerInput = {
        performance: input.performance,
        layout: input.baseLayout ?? seedLayout,
        costToggles,
        constraints: input.constraints ?? { hardAssignments: {}, softPreferences: {} },
        config: {
          engineConfig: input.engineConfig,
          maxIterations: maxIter,
          seed,
          restartCount: 0,
          sections,
        },
        evaluationConfig: input.evaluationConfig,
        instrumentConfig: input.instrumentConfig,
      };

      const runOptions: GreedyRunOptions = {
        seedLayout,
        updatePolicy,
      };

      try {
        const result = await optimizer.optimize(optimizerInput, runOptions);

        // Build CandidateSolution
        const difficultyAnalysis = analyzeDifficulty(result.executionPlan, sections);
        const tradeoffProfile = computeTradeoffProfile(result.executionPlan, difficultyAnalysis);

        const metadata: CandidateMetadata = {
          strategy: `${family.name} (seed ${seedIdx + 1})`,
          seed,
          generationTimeMs: result.telemetry.wallClockMs,
          optimizationMode: undefined,
          optimizationSummary: `Greedy ${updatePolicy.name}: ${result.telemetry.iterationsCompleted} moves, cost ${result.diagnostics.total.toFixed(2)}`,
          candidateFamily: family.name,
        };

        const candidate: CandidateSolution = {
          id: generateId('candidate'),
          layout: result.layout,
          executionPlan: result.executionPlan,
          difficultyAnalysis,
          tradeoffProfile,
          metadata,
        };

        const qualityScore = compositeScore(tradeoffProfile);

        allScored.push({
          candidate,
          familyName: family.name,
          qualityScore,
          seedIndex: seedIdx,
        });
      } catch {
        // Skip failed candidates silently
        continue;
      }
    }
  }

  if (allScored.length === 0) {
    return { candidates: [], summary: null };
  }

  // Phase 3: Diversity-aware finalist selection
  const finalists = selectDiverseFinalists(allScored, count);

  // Phase 4: Attach explanations
  for (const scored of finalists) {
    const family = CANDIDATE_FAMILIES.find(f => f.name === scored.familyName);
    if (family) {
      scored.candidate.metadata.explanation = buildExplanation(
        scored, family, finalists, features,
      );
    }
  }

  // Phase 5: Baseline diversity diffs
  const candidates = finalists.map(f => f.candidate);

  if (input.activeLayout) {
    const baselineCandidate = candidates[0]; // Best quality candidate is first
    const baselineProfile = baselineCandidate?.tradeoffProfile;

    for (const candidate of candidates) {
      candidate.baselineDiff = buildBaselineDiffSummary(
        candidate,
        input.activeLayout,
        baselineProfile,
      );
    }
  }

  // Phase 6: Filter trivial duplicates and build summary
  const [filtered, duplicatesRemoved] = filterTrivialDuplicates(candidates);

  // Filter excessive unplayables (>25%)
  const valid = filtered.filter(c => {
    const totalEvents = c.executionPlan.fingerAssignments.length;
    if (totalEvents === 0) return true;
    const unplayableRatio = c.executionPlan.unplayableCount / totalEvents;
    return unplayableRatio <= 0.25;
  });

  const finalCandidates = valid.length > 0
    ? valid
    : [...filtered].sort((a, b) => a.executionPlan.score - b.executionPlan.score).slice(0, 1);

  const summary = input.activeLayout
    ? buildGenerationSummary(
        allScored.length,
        duplicatesRemoved,
        finalCandidates,
        input.activeLayout,
      )
    : null;

  return { candidates: finalCandidates, summary };
}

// ============================================================================
// Diversity-Aware Finalist Selection
// ============================================================================

/**
 * Select diverse finalists using quality + novelty bonus.
 *
 * Algorithm:
 * 1. Start with highest-quality candidate
 * 2. For each remaining slot, pick candidate maximizing quality + λ * novelty
 * 3. Novelty = min diversity vs all already-selected finalists
 */
function selectDiverseFinalists(
  candidates: ScoredCandidate[],
  count: number,
): ScoredCandidate[] {
  if (candidates.length <= count) return [...candidates];

  const λ = 0.3; // Quality-diversity tradeoff

  // Normalize quality scores to [0, 1]
  const maxQ = Math.max(...candidates.map(c => c.qualityScore), 0.001);
  const minQ = Math.min(...candidates.map(c => c.qualityScore));
  const qRange = Math.max(maxQ - minQ, 0.001);

  const selected: ScoredCandidate[] = [];
  const remaining = [...candidates];

  // Start with highest quality
  remaining.sort((a, b) => b.qualityScore - a.qualityScore);
  selected.push(remaining.shift()!);

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestPortfolioValue = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const normalizedQ = (remaining[i].qualityScore - minQ) / qRange;

      // Novelty = minimum diversity vs all selected finalists
      let minDiversity = Infinity;
      for (const sel of selected) {
        const diversity = computeLayoutDiversity(
          remaining[i].candidate.layout,
          sel.candidate.layout,
        );
        minDiversity = Math.min(minDiversity, diversity.moveFraction);
      }

      const portfolioValue = normalizedQ + λ * minDiversity;

      if (portfolioValue > bestPortfolioValue) {
        bestPortfolioValue = portfolioValue;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

// ============================================================================
// Explanation Builder
// ============================================================================

/**
 * Build a structured explanation for a finalist candidate.
 */
function buildExplanation(
  scored: ScoredCandidate,
  family: CandidateFamily,
  allFinalists: ScoredCandidate[],
  _features: SoundFeatureMap,
): CandidateExplanation {
  const profile = scored.candidate.tradeoffProfile;
  const otherProfiles = allFinalists
    .filter(f => f.candidate.id !== scored.candidate.id)
    .map(f => f.candidate.tradeoffProfile);

  // Determine what this candidate wins at
  const wonBecause: string[] = [];
  const dimensions: Array<{ key: keyof typeof profile; label: string }> = [
    { key: 'playability', label: 'playability' },
    { key: 'transitionEfficiency', label: 'transition efficiency' },
    { key: 'compactness', label: 'layout compactness' },
    { key: 'handBalance', label: 'hand balance' },
  ];

  for (const dim of dimensions) {
    const isLeader = otherProfiles.every(o => profile[dim.key] >= o[dim.key] - 0.02);
    if (isLeader && profile[dim.key] > 0.3) {
      wonBecause.push(`strongest ${dim.label}`);
    }
  }

  // Add cost-based reasons from execution plan
  const plan = scored.candidate.executionPlan;
  if (plan.unplayableCount === 0) {
    wonBecause.push('all events playable');
  }
  if (plan.score < 5) {
    wonBecause.push('low overall difficulty');
  }

  // Limit to top 3
  if (wonBecause.length === 0) {
    wonBecause.push(`good ${family.bestForDescription}`);
  }

  // Determine main tradeoff
  let tradeoff = 'balanced across all dimensions';
  let weakestDim = '';
  let weakestVal = Infinity;
  for (const dim of dimensions) {
    if (profile[dim.key] < weakestVal) {
      weakestVal = profile[dim.key];
      weakestDim = dim.label;
    }
  }
  if (weakestVal < 0.4 && weakestDim) {
    tradeoff = `lower ${weakestDim}`;
  }

  // Distinctive trait: what differentiates this candidate most from others
  let distinctiveTrait = family.bestForDescription;
  if (otherProfiles.length > 0) {
    let maxDiff = 0;
    let bestDimLabel = '';
    for (const dim of dimensions) {
      const avgOther = otherProfiles.reduce((s, o) => s + o[dim.key], 0) / otherProfiles.length;
      const diff = profile[dim.key] - avgOther;
      if (diff > maxDiff) {
        maxDiff = diff;
        bestDimLabel = dim.label;
      }
    }
    if (maxDiff > 0.05 && bestDimLabel) {
      distinctiveTrait = `highest ${bestDimLabel} among finalists`;
    }
  }

  return {
    bestFor: family.bestForDescription,
    wonBecause: wonBecause.slice(0, 3),
    tradeoff,
    distinctiveTrait,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a voice map from layout and/or performance events.
 */
function buildVoiceMap(
  performance: Performance,
  baseLayout?: Layout,
): Map<string, Voice> {
  const voices = new Map<string, Voice>();

  // Voices from layout take priority
  if (baseLayout) {
    for (const voice of Object.values(baseLayout.padToVoice)) {
      voices.set(voice.id, voice);
    }
  }

  // Fill in from performance events
  for (const event of performance.events) {
    const id = event.voiceId ?? String(event.noteNumber);
    if (!voices.has(id)) {
      voices.set(id, {
        id,
        name: `Sound ${event.noteNumber}`,
        sourceType: 'midi_track',
        sourceFile: '',
        originalMidiNote: event.noteNumber,
        color: '#888888',
      });
    }
  }

  return voices;
}
