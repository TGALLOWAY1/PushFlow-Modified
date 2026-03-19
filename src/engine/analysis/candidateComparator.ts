/**
 * Candidate Comparator.
 *
 * Explains why two candidates differ: layout differences,
 * passage-level cost deltas, and tradeoff dimension winners.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type CandidateSolution, type CandidateComparison } from '../../types/candidateSolution';

// ============================================================================
// Comparison
// ============================================================================

/**
 * Compares two candidate solutions and returns a structured comparison.
 */
export function compareCandidates(
  a: CandidateSolution,
  b: CandidateSolution
): CandidateComparison {
  const overallDelta =
    b.difficultyAnalysis.overallScore - a.difficultyAnalysis.overallScore;

  // Passage-level deltas
  const passageDeltas: CandidateComparison['passageDeltas'] = [];
  const maxPassages = Math.max(
    a.difficultyAnalysis.passages.length,
    b.difficultyAnalysis.passages.length
  );

  for (let i = 0; i < maxPassages; i++) {
    const pA = a.difficultyAnalysis.passages[i];
    const pB = b.difficultyAnalysis.passages[i];

    if (pA && pB) {
      const delta = pB.score - pA.score;
      const winner = delta > 0.01 ? 'A' : delta < -0.01 ? 'B' : 'tie';
      passageDeltas.push({
        sectionId: pA.section.id,
        deltaScore: delta,
        explanation: winner === 'tie'
          ? `${pA.section.name}: similar difficulty`
          : `${pA.section.name}: ${winner === 'A' ? 'A' : 'B'} is ${Math.abs(delta * 100).toFixed(0)}% easier`,
      });
    }
  }

  // Layout differences
  const layoutDifferences: CandidateComparison['layoutDifferences'] = [];
  const allPadKeys = new Set([
    ...Object.keys(a.layout.padToVoice),
    ...Object.keys(b.layout.padToVoice),
  ]);

  for (const pk of allPadKeys) {
    const voiceA = a.layout.padToVoice[pk];
    const voiceB = b.layout.padToVoice[pk];

    if (voiceA && !voiceB) {
      layoutDifferences.push({
        voiceId: voiceA.id,
        padInA: pk,
        padInB: 'unassigned',
        impact: `${voiceA.name} present in A at ${pk} but absent in B`,
      });
    } else if (!voiceA && voiceB) {
      layoutDifferences.push({
        voiceId: voiceB.id,
        padInA: 'unassigned',
        padInB: pk,
        impact: `${voiceB.name} present in B at ${pk} but absent in A`,
      });
    } else if (voiceA && voiceB && voiceA.id !== voiceB.id) {
      layoutDifferences.push({
        voiceId: voiceA.id,
        padInA: pk,
        padInB: pk,
        impact: `Pad ${pk}: ${voiceA.name} in A vs ${voiceB.name} in B`,
      });
    }
  }

  return {
    candidateA: a.id,
    candidateB: b.id,
    overallDelta,
    passageDeltas,
    layoutDifferences,
  };
}

/**
 * Summarizes a comparison in human-readable text.
 */
export function summarizeComparison(comparison: CandidateComparison): string {
  const parts: string[] = [];

  // Overall
  if (Math.abs(comparison.overallDelta) < 0.01) {
    parts.push('Overall difficulty is similar.');
  } else if (comparison.overallDelta > 0) {
    parts.push(`Candidate A is ${(comparison.overallDelta * 100).toFixed(0)}% easier overall.`);
  } else {
    parts.push(`Candidate B is ${(Math.abs(comparison.overallDelta) * 100).toFixed(0)}% easier overall.`);
  }

  // Passage highlights
  const significantDeltas = comparison.passageDeltas.filter(
    p => Math.abs(p.deltaScore) > 0.05
  );
  if (significantDeltas.length > 0) {
    parts.push(`${significantDeltas.length} passage(s) differ significantly.`);
  }

  // Layout differences
  if (comparison.layoutDifferences.length > 0) {
    parts.push(`${comparison.layoutDifferences.length} pad assignment(s) differ.`);
  }

  return parts.join(' ');
}
