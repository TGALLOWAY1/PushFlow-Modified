/**
 * CandidateSolution types.
 *
 * A candidate solution is a complete proposal containing:
 * - Static layout (pad assignments)
 * - Execution plan (finger assignments over time)
 * - Difficulty analysis
 * - Tradeoff profile for comparison
 */

import { type Layout } from './layout';
import { type ExecutionPlanResult } from './executionPlan';
import { type Section } from './performanceStructure';

/**
 * TradeoffProfile: Multi-dimensional quality assessment of a candidate.
 * All scores are 0-1, higher = better.
 */
export interface TradeoffProfile {
  /** How easy to play physically. */
  playability: number;
  /** How compact the layout is (voices clustered vs spread). */
  compactness: number;
  /** How balanced the workload is between hands. */
  handBalance: number;
  /** How smooth transitions are between events. */
  transitionEfficiency: number;
  /** How easy to learn and memorize the layout. */
  learnability: number;
  /** How well the layout works across all sections. */
  robustness: number;
}

/**
 * PassageDifficulty: Difficulty assessment for a specific section/passage.
 */
export interface PassageDifficulty {
  section: Section;
  /** Overall difficulty score for this passage (lower = easier). */
  score: number;
  /** Dominant difficulty factors. */
  dominantFactors: Array<{ factor: string; contribution: number }>;
  /** Hardest transitions within this passage. */
  hardestTransitions: Array<{
    fromEventIndex: number;
    toEventIndex: number;
    difficulty: number;
    explanation: string;
  }>;
}

/**
 * DifficultyAnalysis: Full difficulty breakdown for a candidate solution.
 */
export interface DifficultyAnalysis {
  /** Overall song-level difficulty score. */
  overallScore: number;
  /** Per-section difficulty. */
  passages: PassageDifficulty[];
  /** Binding constraints (things that limit quality). */
  bindingConstraints: string[];
}

/**
 * CandidateMetadata: How and why this candidate was generated.
 */
export interface CandidateMetadata {
  /** Generation strategy used. */
  strategy: string;
  /** RNG seed used. */
  seed: number;
  /** Generation time in ms. */
  generationTimeMs?: number;
  /** Optimization mode used for this candidate. */
  optimizationMode?: import('./engineConfig').OptimizationMode;
  /** Human-readable optimization summary. */
  optimizationSummary?: string;
}

/**
 * CandidateSolution: A complete proposal for a performance.
 *
 * This is a first-class output artifact of the system.
 */
export interface CandidateSolution {
  id: string;
  layout: Layout;
  executionPlan: ExecutionPlanResult;
  difficultyAnalysis: DifficultyAnalysis;
  tradeoffProfile: TradeoffProfile;
  metadata: CandidateMetadata;
}

/**
 * CandidateComparison: How two candidates differ.
 */
export interface CandidateComparison {
  candidateA: string; // ID
  candidateB: string; // ID
  /** Positive = B is easier. */
  overallDelta: number;
  passageDeltas: Array<{
    sectionId: string;
    deltaScore: number;
    explanation: string;
  }>;
  layoutDifferences: Array<{
    voiceId: string;
    padInA: string; // padKey
    padInB: string; // padKey
    impact: string;
  }>;
}
