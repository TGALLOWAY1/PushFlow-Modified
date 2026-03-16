/**
 * Passage Analyzer.
 *
 * Surfaces where difficulty concentrates in a performance
 * and explains why passages are hard.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section } from '../../types/performanceStructure';
import { type PassageDifficultyResult, scorePassagesFromSections, scorePassagesFixedWindow } from '../evaluation/passageDifficulty';

// ============================================================================
// Types
// ============================================================================

export interface PassageAnalysis {
  sectionName: string;
  sectionIndex: number;
  difficultyScore: number;
  dominantFactor: string;
  factorScores: Record<string, number>;
  density: number;
  eventCount: number;
  explanation: string;
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Analyzes passages and returns structured difficulty information.
 */
export function analyzePassages(
  result: ExecutionPlanResult,
  sections: Section[]
): PassageAnalysis[] {
  const passageResults = sections.length > 0
    ? scorePassagesFromSections(result.fingerAssignments, sections)
    : scorePassagesFixedWindow(result.fingerAssignments, 2.0);

  return passageResults.map((pr, idx) => {
    const section = sections[idx];
    const sectionName = section?.name ?? `Passage ${idx + 1}`;

    // Find dominant factor
    const factors = Object.entries(pr.factorScores)
      .filter(([k]) => k !== 'mixed')
      .sort((a, b) => b[1] - a[1]);
    const dominantFactor = factors[0]?.[0] ?? 'mixed';

    const explanation = buildExplanation(pr, dominantFactor, sectionName);

    return {
      sectionName,
      sectionIndex: idx,
      difficultyScore: pr.difficultyScore,
      dominantFactor,
      factorScores: pr.factorScores,
      density: pr.density,
      eventCount: pr.eventCount,
      explanation,
    };
  });
}

/**
 * Returns the top-K hardest passages with explanations.
 */
export function getHardestPassages(
  result: ExecutionPlanResult,
  sections: Section[],
  topK: number = 3
): PassageAnalysis[] {
  const all = analyzePassages(result, sections);
  return all.sort((a, b) => b.difficultyScore - a.difficultyScore).slice(0, topK);
}

// ============================================================================
// Explanation Builder
// ============================================================================

function buildExplanation(
  pr: PassageDifficultyResult,
  dominantFactor: string,
  sectionName: string
): string {
  const pct = (pr.difficultyScore * 100).toFixed(0);
  const parts: string[] = [`${sectionName} scores ${pct}% difficulty`];

  if (pr.difficultyScore < 0.2) {
    parts.push('— easy passage, no significant challenges');
  } else if (pr.difficultyScore < 0.45) {
    parts.push(`— moderate difficulty, mainly from ${formatFactor(dominantFactor)}`);
  } else if (pr.difficultyScore < 0.7) {
    parts.push(`— hard passage due to ${formatFactor(dominantFactor)}`);
    if (pr.density > 6) parts.push(`(high density: ${pr.density.toFixed(1)} events/sec)`);
  } else {
    parts.push(`— extremely difficult, dominated by ${formatFactor(dominantFactor)}`);
    if (pr.density > 6) parts.push(`(dense: ${pr.density.toFixed(1)} events/sec)`);
  }

  return parts.join(' ');
}

function formatFactor(factor: string): string {
  const labels: Record<string, string> = {
    movement: 'large hand movements',
    stretch: 'finger stretching',
    drift: 'hand drift from resting position',
    bounce: 'repeated same-finger usage',
    fatigue: 'finger fatigue accumulation',
    crossover: 'hand crossover constraints',
  };
  return labels[factor] ?? factor;
}
