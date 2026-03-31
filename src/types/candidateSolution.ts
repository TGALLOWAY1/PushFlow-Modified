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
  /** How well the layout preserves structural group relationships (0-1). */
  structuralCoherence: number;
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
  /** Candidate family identity (for greedy diverse candidates). */
  candidateFamily?: string;
  /** Structured explanation of why this candidate was selected. */
  explanation?: CandidateExplanation;
}

/**
 * CandidateExplanation: Structured rationale for a finalist candidate.
 *
 * Provides a human-readable explanation card that the UI can display.
 */
export interface CandidateExplanation {
  /** What this candidate is best for. E.g. "comfort and learnability". */
  bestFor: string;
  /** Top 2-3 reasons it was selected. */
  wonBecause: string[];
  /** Main tradeoff or downside. */
  tradeoff: string;
  /** How it differs from the nearest other candidate. */
  distinctiveTrait: string;
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
  /**
   * Phase 4: Baseline-relative diversity summary.
   * Present when the candidate was generated with a baseline Active Layout.
   * Explains what changed and how different this candidate is.
   */
  baselineDiff?: BaselineDiffSummary;
  /** Detailed iteration-by-iteration trace for the Visual Debugger. */
  iterationTrace?: import('../engine/optimization/optimizerInterface').OptimizationIteration[];
}

// ============================================================================
// Baseline-relative diversity (Phase 4)
// ============================================================================

/**
 * VoicePlacementDiff: How a single voice's placement differs from the baseline.
 */
export interface VoicePlacementDiff {
  voiceId: string;
  voiceName: string;
  /** Pad key in the baseline layout, or null if absent. */
  baselinePad: string | null;
  /** Pad key in the candidate layout, or null if absent. */
  candidatePad: string | null;
  /** Manhattan distance between the two pads (null if either is absent). */
  manhattanDistance: number | null;
}

/**
 * LayoutDiversityMetrics: Quantitative measurement of how different
 * a candidate layout is from the Active Layout baseline.
 *
 * Used for trivial-duplicate filtering and low-diversity explanations.
 */
export interface LayoutDiversityMetrics {
  /** Number of voices whose pad position changed. */
  voicesMoved: number;
  /** Total number of voices in the baseline. */
  totalVoices: number;
  /** Fraction of voices that moved (0–1). */
  moveFraction: number;
  /** Average Manhattan distance of moved voices (0 if none moved). */
  averageDisplacement: number;
  /** Maximum Manhattan distance of any moved voice (0 if none moved). */
  maxDisplacement: number;
  /** Per-voice placement diffs (only for moved voices). */
  placementDiffs: VoicePlacementDiff[];
}

/**
 * DiversityLevel: Coarse classification of how different a candidate is.
 */
export type DiversityLevel = 'identical' | 'trivial' | 'low' | 'moderate' | 'high';

/**
 * BaselineDiffSummary: Human-readable explanation of how a candidate
 * differs from the Active Layout baseline.
 *
 * Attached to each CandidateSolution so the UI can explain diversity.
 */
export interface BaselineDiffSummary {
  /** Quantitative diversity metrics. */
  metrics: LayoutDiversityMetrics;
  /** Coarse diversity level. */
  diversityLevel: DiversityLevel;
  /** Human-readable summary of what changed. */
  summary: string;
  /** Which tradeoff dimensions improved/degraded vs baseline. */
  tradeoffDeltas?: Partial<Record<keyof TradeoffProfile, number>>;
}

/**
 * CandidateGenerationSummary: Metadata about the entire generation run.
 *
 * Includes low-diversity explanation when candidates are too similar.
 */
export interface CandidateGenerationSummary {
  /** Total candidates generated before filtering. */
  candidatesGenerated: number;
  /** Candidates removed as trivial duplicates. */
  duplicatesRemoved: number;
  /** Candidates remaining after filtering. */
  candidatesReturned: number;
  /** Whether the candidate set has low diversity. */
  isLowDiversity: boolean;
  /** Explanation when diversity is low (why candidates are similar). */
  lowDiversityExplanation?: string;
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
