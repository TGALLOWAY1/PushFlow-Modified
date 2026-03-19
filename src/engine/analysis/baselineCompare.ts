/**
 * Baseline-Aware Compare (Phase 5).
 *
 * Explains what changed between two layout states using canonical diagnostics.
 * Supports three compare modes aligned to the V3 workflow:
 *   1. Working vs Active — "what did my edits do?"
 *   2. Candidate vs Active — "how does this proposal differ from baseline?"
 *   3. Candidate vs Candidate — "which proposal is better?"
 *
 * All comparisons use canonical DiagnosticFactors from Phase 3
 * and layout diversity metrics from Phase 4.
 */

import { type Layout } from '../../types/layout';
import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type DiagnosticFactors } from '../../types/diagnostics';
import { type CandidateSolution } from '../../types/candidateSolution';
import { computeLayoutDiversity, classifyDiversityLevel } from './diversityMeasurement';

// ============================================================================
// Types
// ============================================================================

/** Which workflow comparison mode is being used. */
export type CompareMode =
  | 'working-vs-active'
  | 'candidate-vs-active'
  | 'candidate-vs-candidate';

/** Per-factor delta: positive means B is worse (higher cost). */
export interface FactorDelta {
  factor: keyof Omit<DiagnosticFactors, 'total'>;
  label: string;
  deltaValue: number;
  /** Which side wins on this factor. */
  winner: 'A' | 'B' | 'tie';
  /** Human-readable explanation of the delta. */
  explanation: string;
}

/** Complete baseline-aware comparison result. */
export interface BaselineComparison {
  mode: CompareMode;
  /** Label for side A (e.g., "Active Layout", "Candidate A"). */
  labelA: string;
  /** Label for side B (e.g., "Working Layout", "Candidate B"). */
  labelB: string;
  /** Layout diversity metrics between the two layouts. */
  layoutChanges: {
    voicesMoved: number;
    totalVoices: number;
    diversityLevel: string;
  };
  /** Per-factor canonical diagnostics deltas. */
  factorDeltas: FactorDelta[];
  /** Overall score delta (positive = B is worse). */
  totalDelta: number;
  /** Which side is better overall. */
  overallWinner: 'A' | 'B' | 'tie';
  /** Feasibility level for each side. */
  feasibility: {
    levelA: string;
    levelB: string;
    changed: boolean;
  };
  /** Human-readable summary of the comparison. */
  summary: string;
}

// ============================================================================
// Factor Labels
// ============================================================================

const FACTOR_LABELS: Record<keyof Omit<DiagnosticFactors, 'total'>, string> = {
  transition: 'Transition difficulty',
  gripNaturalness: 'Grip naturalness',
  alternation: 'Same-finger alternation',
  handBalance: 'Hand balance',
  constraintPenalty: 'Constraint penalties',
};

// ============================================================================
// Core Compare
// ============================================================================

/**
 * Compares two execution plans using canonical diagnostics.
 *
 * Both plans must have diagnostics populated (Phase 3).
 * Uses layout diversity from Phase 4 to explain placement changes.
 */
export function compareWithDiagnostics(
  layoutA: Layout,
  planA: ExecutionPlanResult,
  layoutB: Layout,
  planB: ExecutionPlanResult,
  mode: CompareMode,
  labelA: string,
  labelB: string,
): BaselineComparison {
  // Layout diversity
  const diversity = computeLayoutDiversity(layoutB, layoutA);
  const diversityLevel = classifyDiversityLevel(diversity);

  // Diagnostics factors
  const factorsA = planA.diagnostics?.factors;
  const factorsB = planB.diagnostics?.factors;

  const factorDeltas: FactorDelta[] = [];
  const factorKeys: (keyof Omit<DiagnosticFactors, 'total'>)[] = [
    'transition', 'gripNaturalness', 'alternation', 'handBalance', 'constraintPenalty',
  ];

  if (factorsA && factorsB) {
    for (const key of factorKeys) {
      const delta = factorsB[key] - factorsA[key];
      const absDelta = Math.abs(delta);
      const winner = absDelta < 0.01 ? 'tie' as const : delta < 0 ? 'B' as const : 'A' as const;

      factorDeltas.push({
        factor: key,
        label: FACTOR_LABELS[key],
        deltaValue: delta,
        winner,
        explanation: buildFactorExplanation(key, delta, winner, labelA, labelB),
      });
    }
  }

  // Total delta
  const totalA = factorsA?.total ?? planA.score;
  const totalB = factorsB?.total ?? planB.score;
  const totalDelta = totalB - totalA;
  const overallWinner = Math.abs(totalDelta) < 0.01 ? 'tie' as const
    : totalDelta < 0 ? 'B' as const : 'A' as const;

  // Feasibility
  const feasLevelA = planA.diagnostics?.feasibility.level ?? 'unknown';
  const feasLevelB = planB.diagnostics?.feasibility.level ?? 'unknown';

  // Summary
  const summary = buildComparisonSummary(
    mode, labelA, labelB, diversity.voicesMoved, diversity.totalVoices,
    factorDeltas, totalDelta, overallWinner,
    feasLevelA, feasLevelB,
  );

  return {
    mode,
    labelA,
    labelB,
    layoutChanges: {
      voicesMoved: diversity.voicesMoved,
      totalVoices: diversity.totalVoices,
      diversityLevel,
    },
    factorDeltas,
    totalDelta,
    overallWinner,
    feasibility: {
      levelA: feasLevelA,
      levelB: feasLevelB,
      changed: feasLevelA !== feasLevelB,
    },
    summary,
  };
}

// ============================================================================
// Workflow-Specific Compare Functions
// ============================================================================

/**
 * Compares a Working/Test Layout against the Active Layout.
 * Answers: "what did my edits do to playability?"
 */
export function compareWorkingVsActive(
  activeLayout: Layout,
  activePlan: ExecutionPlanResult,
  workingLayout: Layout,
  workingPlan: ExecutionPlanResult,
): BaselineComparison {
  return compareWithDiagnostics(
    activeLayout, activePlan,
    workingLayout, workingPlan,
    'working-vs-active',
    'Active Layout',
    'Working Layout',
  );
}

/**
 * Compares a Candidate Solution against the Active Layout.
 * Answers: "how does this proposal differ from my current setup?"
 */
export function compareCandidateVsActive(
  activeLayout: Layout,
  activePlan: ExecutionPlanResult,
  candidate: CandidateSolution,
): BaselineComparison {
  return compareWithDiagnostics(
    activeLayout, activePlan,
    candidate.layout, candidate.executionPlan,
    'candidate-vs-active',
    'Active Layout',
    `Candidate (${candidate.metadata.strategy})`,
  );
}

/**
 * Compares two Candidate Solutions directly.
 * Answers: "which proposal is better?"
 */
export function compareCandidateVsCandidate(
  candidateA: CandidateSolution,
  candidateB: CandidateSolution,
): BaselineComparison {
  return compareWithDiagnostics(
    candidateA.layout, candidateA.executionPlan,
    candidateB.layout, candidateB.executionPlan,
    'candidate-vs-candidate',
    `Candidate (${candidateA.metadata.strategy})`,
    `Candidate (${candidateB.metadata.strategy})`,
  );
}

// ============================================================================
// Explanation Builders
// ============================================================================

function buildFactorExplanation(
  factor: keyof Omit<DiagnosticFactors, 'total'>,
  delta: number,
  winner: 'A' | 'B' | 'tie',
  labelA: string,
  labelB: string,
): string {
  if (winner === 'tie') {
    return `${FACTOR_LABELS[factor]}: similar between both layouts.`;
  }

  const better = winner === 'A' ? labelA : labelB;
  const absDelta = Math.abs(delta);

  const magnitude = absDelta > 5 ? 'significantly' : absDelta > 1 ? 'moderately' : 'slightly';

  return `${FACTOR_LABELS[factor]}: ${better} is ${magnitude} better (delta: ${absDelta.toFixed(2)}).`;
}

function buildComparisonSummary(
  _mode: CompareMode,
  labelA: string,
  labelB: string,
  voicesMoved: number,
  totalVoices: number,
  factorDeltas: FactorDelta[],
  totalDelta: number,
  overallWinner: 'A' | 'B' | 'tie',
  feasLevelA: string,
  feasLevelB: string,
): string {
  const parts: string[] = [];

  // Layout changes
  if (voicesMoved === 0) {
    parts.push('No pad assignment changes.');
  } else {
    parts.push(`${voicesMoved} of ${totalVoices} voice(s) moved.`);
  }

  // Overall winner
  if (overallWinner === 'tie') {
    parts.push('Overall difficulty is similar.');
  } else {
    const better = overallWinner === 'A' ? labelA : labelB;
    parts.push(`${better} has lower overall difficulty (delta: ${Math.abs(totalDelta).toFixed(2)}).`);
  }

  // Factor highlights — show top 2 non-tie factors
  const significantFactors = factorDeltas
    .filter(f => f.winner !== 'tie')
    .sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue))
    .slice(0, 2);

  if (significantFactors.length > 0) {
    const highlights = significantFactors.map(f => {
      const better = f.winner === 'A' ? labelA : labelB;
      return `${f.label} favors ${better}`;
    });
    parts.push(`Key differences: ${highlights.join('; ')}.`);
  }

  // Feasibility change
  if (feasLevelA !== feasLevelB && feasLevelA !== 'unknown' && feasLevelB !== 'unknown') {
    parts.push(`Feasibility changed: ${feasLevelA} → ${feasLevelB}.`);
  }

  return parts.join(' ');
}
