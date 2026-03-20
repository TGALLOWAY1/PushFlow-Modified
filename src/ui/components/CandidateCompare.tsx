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
        <span className="text-pf-base font-medium text-blue-400">{labelA}</span>
        <span className="text-[var(--text-tertiary)] text-pf-sm">vs</span>
        <span className="text-pf-base font-medium text-purple-400">{labelB}</span>
      </div>

      {/* Tradeoff comparison bars */}
      <div className="space-y-2.5">
        {(Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>).map(dim => {
          const valA = candidateA.tradeoffProfile[dim as keyof CandidateSolution['tradeoffProfile']];
          const valB = candidateB.tradeoffProfile[dim as keyof CandidateSolution['tradeoffProfile']];
          const diff = valA - valB;

          return (
            <div key={dim} className="flex items-center gap-2">
              <span className="w-24 text-pf-sm text-[var(--text-secondary)]">{DIMENSION_LABELS[dim]}</span>
              {/* Bar A */}
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2.5 bg-[var(--bg-hover)] rounded-full overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-blue-500/60 rounded-full"
                    style={{ width: `${valA * 100}%` }}
                  />
                </div>
                <span className="text-pf-xs text-[var(--text-tertiary)] w-8 text-right font-mono tabular-nums">
                  {(valA * 100).toFixed(0)}
                </span>
              </div>
              {/* Delta */}
              <span className={`text-pf-xs font-mono w-8 text-center tabular-nums ${
                diff > 0.05 ? 'text-blue-400' : diff < -0.05 ? 'text-purple-400' : 'text-[var(--text-tertiary)]'
              }`}>
                {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}
              </span>
              {/* Bar B */}
              <div className="flex-1 flex items-center gap-1">
                <span className="text-pf-xs text-[var(--text-tertiary)] w-8 font-mono tabular-nums">
                  {(valB * 100).toFixed(0)}
                </span>
                <div className="flex-1 h-2.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500/60 rounded-full"
                    style={{ width: `${valB * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layout differences */}
      <div className="text-pf-sm text-[var(--text-secondary)] space-y-1">
        <div>Layout differences: {comparison.layoutDifferences.length} pads changed</div>
        {comparison.layoutDifferences.length > 0 && (
          <div>
            Affected sounds: {[...new Set(comparison.layoutDifferences.map(d => d.voiceId))].join(', ')}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-pf-md text-pf-sm text-[var(--text-primary)] whitespace-pre-line">
        {summary}
      </div>
    </div>
  );
}
