/**
 * CandidateCompare Component.
 *
 * Side-by-side comparison of two candidate solutions.
 */

import { type CandidateSolution } from '../../types/candidateSolution';
import { compareCandidates, summarizeComparison } from '../../engine/analysis/candidateComparator';
import { describeLayoutDiff, layoutDiff } from '../analysis/layoutDiff';
import { SoundLabel, type SoundRef } from './shared/SoundLabel';
import { formatPadLocator } from '../../utils/padPosition';
import { TRADEOFF_DIMENSIONS } from '../analysis/factorMeta';

interface CandidateCompareProps {
  candidateA: CandidateSolution;
  candidateB: CandidateSolution;
  /** How each side is named in Compare ("Active Layout", "#2 Compact, left hand"). */
  labelA: string;
  labelB: string;
  /** The project's Sounds, so every id reads as a name with its colour (T20). */
  sounds: readonly SoundRef[];
}

export function CandidateCompare({ candidateA, candidateB, labelA, labelB, sounds }: CandidateCompareProps) {
  const comparison = compareCandidates(candidateA, candidateB);
  const summary = summarizeComparison(comparison);
  const diff = layoutDiff(candidateA.layout, candidateB.layout);


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="text-pf-base font-medium text-blue-400">{labelA}</span>
        <span className="text-[var(--text-tertiary)] text-pf-sm">vs</span>
        <span className="text-pf-base font-medium text-purple-400">{labelB}</span>
      </div>

      {/* Tradeoff comparison bars: scores out of 100, higher is better */}
      <div className="space-y-2.5">
        <div className="text-pf-micro text-[var(--text-tertiary)]">Tradeoff scores out of 100 · higher is better</div>
        {TRADEOFF_DIMENSIONS.map(({ key: dim, label, description }) => {
          const valA = candidateA.tradeoffProfile[dim];
          const valB = candidateB.tradeoffProfile[dim];
          const diff = valA - valB;

          return (
            <div key={dim} className="flex items-center gap-2" title={description}>
              <span className="w-24 text-pf-sm text-[var(--text-secondary)]">{label}</span>
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

      {/* Layout differences: Sounds by name and colour, never by id (T20, P2-12). */}
      <div data-testid="compare-layout-differences" className="text-pf-sm text-[var(--text-secondary)] space-y-1">
        <div>Layout differences: {describeLayoutDiff(diff)}</div>
        {diff.moves.length > 0 && (
          <ul className="space-y-0.5">
            {diff.moves.map(move => (
              <li key={move.soundId} className="flex items-center gap-2 text-pf-xs">
                <SoundLabel id={move.soundId} sounds={sounds} className="text-[var(--text-primary)]" />
                <span className="text-[var(--text-tertiary)] font-mono">
                  {move.from ? formatPadLocator(move.from) : 'not placed'} → {move.to ? formatPadLocator(move.to) : 'not placed'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary */}
      <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-pf-md text-pf-sm text-[var(--text-primary)] whitespace-pre-line">
        {summary}
      </div>
    </div>
  );
}
