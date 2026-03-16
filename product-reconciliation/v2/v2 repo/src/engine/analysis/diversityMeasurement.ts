/**
 * Diversity Measurement (Phase 4).
 *
 * Measures how different a candidate layout is from the Active Layout baseline.
 * Used for:
 * - Trivial-duplicate filtering (reject cosmetically identical candidates)
 * - Low-diversity explanation (tell the user why candidates are similar)
 * - Baseline diff summaries (per-candidate human-readable change descriptions)
 *
 * Key concept: diversity is measured by voice placement changes, not layout identity.
 * Two layouts with different IDs but the same voice→pad mapping are identical.
 */

import { type Layout } from '../../types/layout';
import { type TradeoffProfile, type CandidateSolution } from '../../types/candidateSolution';
import {
  type LayoutDiversityMetrics,
  type VoicePlacementDiff,
  type DiversityLevel,
  type BaselineDiffSummary,
  type CandidateGenerationSummary,
} from '../../types/candidateSolution';

// ============================================================================
// Layout Diversity Metrics
// ============================================================================

/**
 * Parses a "row,col" pad key into numeric coordinates.
 */
function parsePadKey(key: string): { row: number; col: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
}

/**
 * Computes Manhattan distance between two pad keys.
 * Returns null if either key is invalid.
 */
function padManhattanDistance(padA: string, padB: string): number | null {
  const a = parsePadKey(padA);
  const b = parsePadKey(padB);
  if (!a || !b) return null;
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Builds a voice→pad lookup from a layout's padToVoice mapping.
 * Returns Map<voiceId, padKey>.
 */
function buildVoiceToPad(layout: Layout): Map<string, string> {
  const map = new Map<string, string>();
  for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
    map.set(voice.id, padKey);
  }
  return map;
}

/**
 * Computes quantitative diversity metrics between a candidate layout
 * and the Active Layout baseline.
 *
 * Measures diversity by voice placement: how many voices moved,
 * how far they moved, and which ones changed.
 */
export function computeLayoutDiversity(
  candidate: Layout,
  baseline: Layout,
): LayoutDiversityMetrics {
  const baselineVoiceToPad = buildVoiceToPad(baseline);
  const candidateVoiceToPad = buildVoiceToPad(candidate);

  // Collect all voice IDs from both layouts
  const allVoiceIds = new Set([
    ...baselineVoiceToPad.keys(),
    ...candidateVoiceToPad.keys(),
  ]);

  const placementDiffs: VoicePlacementDiff[] = [];
  let voicesMoved = 0;
  let totalDisplacement = 0;
  let maxDisplacement = 0;

  for (const voiceId of allVoiceIds) {
    const baselinePad = baselineVoiceToPad.get(voiceId) ?? null;
    const candidatePad = candidateVoiceToPad.get(voiceId) ?? null;

    // Voice is in the same place — not moved
    if (baselinePad === candidatePad) continue;

    const distance = baselinePad && candidatePad
      ? padManhattanDistance(baselinePad, candidatePad)
      : null;

    // Get voice name from whichever layout has it
    const voiceName =
      (baselinePad && baseline.padToVoice[baselinePad]?.name) ??
      (candidatePad && candidate.padToVoice[candidatePad]?.name) ??
      voiceId;

    voicesMoved++;
    if (distance !== null) {
      totalDisplacement += distance;
      maxDisplacement = Math.max(maxDisplacement, distance);
    }

    placementDiffs.push({
      voiceId,
      voiceName,
      baselinePad,
      candidatePad,
      manhattanDistance: distance,
    });
  }

  const totalVoices = allVoiceIds.size;
  const moveFraction = totalVoices > 0 ? voicesMoved / totalVoices : 0;
  const averageDisplacement = voicesMoved > 0 ? totalDisplacement / voicesMoved : 0;

  return {
    voicesMoved,
    totalVoices,
    moveFraction,
    averageDisplacement,
    maxDisplacement,
    placementDiffs,
  };
}

// ============================================================================
// Diversity Level Classification
// ============================================================================

/**
 * Thresholds for diversity level classification.
 * These are conservative — we'd rather show a low-diversity warning
 * than silently return cosmetically identical candidates.
 */
const DIVERSITY_THRESHOLDS = {
  /** 0 voices moved → identical. */
  identical: 0,
  /** ≤1 voice moved OR ≤5% of voices → trivial change. */
  trivialMaxMoved: 1,
  trivialMaxFraction: 0.05,
  /** ≤20% of voices moved → low diversity. */
  lowMaxFraction: 0.20,
  /** ≤50% of voices moved → moderate diversity. */
  moderateMaxFraction: 0.50,
};

/**
 * Classifies the diversity level of a layout relative to baseline.
 */
export function classifyDiversityLevel(metrics: LayoutDiversityMetrics): DiversityLevel {
  if (metrics.voicesMoved === DIVERSITY_THRESHOLDS.identical) {
    return 'identical';
  }

  if (
    metrics.voicesMoved <= DIVERSITY_THRESHOLDS.trivialMaxMoved ||
    metrics.moveFraction <= DIVERSITY_THRESHOLDS.trivialMaxFraction
  ) {
    return 'trivial';
  }

  if (metrics.moveFraction <= DIVERSITY_THRESHOLDS.lowMaxFraction) {
    return 'low';
  }

  if (metrics.moveFraction <= DIVERSITY_THRESHOLDS.moderateMaxFraction) {
    return 'moderate';
  }

  return 'high';
}

// ============================================================================
// Trivial Duplicate Detection
// ============================================================================

/**
 * Checks if two candidates are trivial duplicates of each other.
 *
 * Two candidates are trivial duplicates when their layouts produce
 * identical or near-identical voice→pad mappings, regardless of layout ID.
 */
export function isTrivialDuplicate(a: CandidateSolution, b: CandidateSolution): boolean {
  const metrics = computeLayoutDiversity(a.layout, b.layout);
  const level = classifyDiversityLevel(metrics);
  return level === 'identical' || level === 'trivial';
}

/**
 * Filters out trivial duplicates from a candidate list.
 * Keeps the first occurrence (by index) and removes later duplicates.
 * Returns [filtered candidates, count removed].
 */
export function filterTrivialDuplicates(
  candidates: CandidateSolution[],
): [CandidateSolution[], number] {
  const kept: CandidateSolution[] = [];
  let removed = 0;

  for (const candidate of candidates) {
    const isDuplicate = kept.some(existing => isTrivialDuplicate(existing, candidate));
    if (isDuplicate) {
      removed++;
    } else {
      kept.push(candidate);
    }
  }

  return [kept, removed];
}

// ============================================================================
// Baseline Diff Summary
// ============================================================================

/**
 * Generates a human-readable summary of how a candidate differs from baseline.
 */
function generateDiffSummaryText(
  metrics: LayoutDiversityMetrics,
  level: DiversityLevel,
): string {
  if (level === 'identical') {
    return 'Identical to the Active Layout — no placement changes.';
  }

  if (level === 'trivial') {
    if (metrics.voicesMoved === 1) {
      const diff = metrics.placementDiffs[0];
      return `Only 1 voice moved: ${diff.voiceName} (${diff.baselinePad ?? 'new'} → ${diff.candidatePad ?? 'removed'}).`;
    }
    return `Trivial change: ${metrics.voicesMoved} of ${metrics.totalVoices} voices moved.`;
  }

  const parts: string[] = [];
  parts.push(`${metrics.voicesMoved} of ${metrics.totalVoices} voices moved`);

  if (metrics.averageDisplacement > 0) {
    parts.push(`avg displacement ${metrics.averageDisplacement.toFixed(1)} pads`);
  }

  if (level === 'low') {
    return `Low diversity: ${parts.join(', ')}.`;
  }

  return `${parts.join(', ')}.`;
}

/**
 * Computes tradeoff deltas between a candidate and the baseline candidate.
 * Positive = candidate is better on that dimension.
 */
function computeTradeoffDeltas(
  candidateProfile: TradeoffProfile,
  baselineProfile: TradeoffProfile,
): Partial<Record<keyof TradeoffProfile, number>> {
  const deltas: Partial<Record<keyof TradeoffProfile, number>> = {};
  const dimensions: (keyof TradeoffProfile)[] = [
    'playability', 'compactness', 'handBalance',
    'transitionEfficiency', 'learnability', 'robustness',
  ];

  for (const dim of dimensions) {
    const delta = candidateProfile[dim] - baselineProfile[dim];
    if (Math.abs(delta) > 0.005) {
      deltas[dim] = delta;
    }
  }

  return deltas;
}

/**
 * Builds a complete BaselineDiffSummary for a candidate.
 */
export function buildBaselineDiffSummary(
  candidate: CandidateSolution,
  baseline: Layout,
  baselineProfile?: TradeoffProfile,
): BaselineDiffSummary {
  const metrics = computeLayoutDiversity(candidate.layout, baseline);
  const diversityLevel = classifyDiversityLevel(metrics);
  const summary = generateDiffSummaryText(metrics, diversityLevel);

  const tradeoffDeltas = baselineProfile
    ? computeTradeoffDeltas(candidate.tradeoffProfile, baselineProfile)
    : undefined;

  return {
    metrics,
    diversityLevel,
    summary,
    tradeoffDeltas,
  };
}

// ============================================================================
// Low-Diversity Explanation
// ============================================================================

/**
 * Generates an explanation for why the candidate set has low diversity.
 *
 * Common reasons:
 * - All voices are locked (placement locks prevent movement)
 * - Very few voices to rearrange
 * - The grid is too constrained for meaningful alternatives
 */
export function explainLowDiversity(
  candidates: CandidateSolution[],
  baseline: Layout,
): string | undefined {
  if (candidates.length === 0) {
    return 'No candidates were generated.';
  }

  // Check if all candidates have low/trivial/identical diversity
  const diversityLevels = candidates.map(c => {
    const metrics = computeLayoutDiversity(c.layout, baseline);
    return classifyDiversityLevel(metrics);
  });

  const allLowOrBelow = diversityLevels.every(
    l => l === 'identical' || l === 'trivial' || l === 'low',
  );

  if (!allLowOrBelow) return undefined;

  // Diagnose why
  const voiceCount = Object.keys(baseline.padToVoice).length;
  const lockCount = Object.keys(baseline.placementLocks ?? {}).length;

  if (voiceCount === 0) {
    return 'The Active Layout has no voice assignments, so no meaningful alternatives can be generated.';
  }

  if (lockCount > 0 && lockCount >= voiceCount * 0.8) {
    return `${lockCount} of ${voiceCount} voices have placement locks, leaving little room for meaningful alternatives.`;
  }

  if (voiceCount <= 2) {
    return `Only ${voiceCount} voice(s) to arrange — there are very few distinct placement options.`;
  }

  return 'The generated layouts are structurally similar. The current voice set and grid constraints limit the diversity of alternatives.';
}

/**
 * Builds a CandidateGenerationSummary for the entire generation run.
 */
export function buildGenerationSummary(
  candidatesGenerated: number,
  duplicatesRemoved: number,
  finalCandidates: CandidateSolution[],
  baseline: Layout,
): CandidateGenerationSummary {
  const lowDiversityExplanation = explainLowDiversity(finalCandidates, baseline);

  return {
    candidatesGenerated,
    duplicatesRemoved,
    candidatesReturned: finalCandidates.length,
    isLowDiversity: lowDiversityExplanation !== undefined,
    lowDiversityExplanation,
  };
}
