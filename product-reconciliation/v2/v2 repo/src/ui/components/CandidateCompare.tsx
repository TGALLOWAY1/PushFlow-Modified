/**
 * CandidateCompare Component.
 *
 * Side-by-side comparison of two candidate solutions.
 */

import { type CandidateSolution } from '../../types/candidateSolution';
import { compareCandidates, summarizeComparison } from '../../engine/analysis/candidateComparator';

interface CandidateCompareProps {
  candidateA: CandidateSolution;
  candidateB: CandidateSolution;
}

const DIMENSION_LABELS: Record<string, string> = {
  playability: 'Playability',
  compactness: 'Compactness',
  handBalance: 'Hand Balance',
  transitionEfficiency: 'Transitions',
  learnability: 'Learnability',
  robustness: 'Robustness',
};

export function CandidateCompare({ candidateA, candidateB }: CandidateCompareProps) {
  const comparison = compareCandidates(candidateA, candidateB);
  const summary = summarizeComparison(comparison);

  const labelA = candidateA.metadata.strategy ?? `A (${candidateA.id.slice(0, 6)})`;
  const labelB = candidateB.metadata.strategy ?? `B (${candidateB.id.slice(0, 6)})`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-blue-400">{labelA}</span>
        <span className="text-gray-500 text-xs">vs</span>
        <span className="text-sm font-medium text-purple-400">{labelB}</span>
      </div>

      {/* Tradeoff comparison bars */}
      <div className="space-y-2">
        {(Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>).map(dim => {
          const valA = candidateA.tradeoffProfile[dim as keyof CandidateSolution['tradeoffProfile']];
          const valB = candidateB.tradeoffProfile[dim as keyof CandidateSolution['tradeoffProfile']];
          const diff = valA - valB;

          return (
            <div key={dim} className="flex items-center gap-2">
              <span className="w-24 text-[11px] text-gray-400">{DIMENSION_LABELS[dim]}</span>
              {/* Bar A */}
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-blue-500/70 rounded-l"
                    style={{ width: `${valA * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-8 text-right font-mono">
                  {(valA * 100).toFixed(0)}
                </span>
              </div>
              {/* Delta */}
              <span className={`text-[10px] font-mono w-8 text-center ${
                diff > 0.05 ? 'text-blue-400' : diff < -0.05 ? 'text-purple-400' : 'text-gray-600'
              }`}>
                {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}
              </span>
              {/* Bar B */}
              <div className="flex-1 flex items-center gap-1">
                <span className="text-[10px] text-gray-500 w-8 font-mono">
                  {(valB * 100).toFixed(0)}
                </span>
                <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500/70 rounded-r"
                    style={{ width: `${valB * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layout differences */}
      <div className="text-[11px] text-gray-400 space-y-1">
        <div>Layout differences: {comparison.layoutDifferences.length} pads changed</div>
        {comparison.layoutDifferences.length > 0 && (
          <div>
            Affected voices: {[...new Set(comparison.layoutDifferences.map(d => d.voiceId))].join(', ')}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-2 bg-gray-800/50 rounded text-[11px] text-gray-300 whitespace-pre-line">
        {summary}
      </div>
    </div>
  );
}
