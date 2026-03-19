/**
 * CandidatePreviewCard.
 *
 * Compact preview of a candidate solution with mini grid,
 * summary metadata, and action buttons.
 */

import { type CandidateSolution } from '../../../types/candidateSolution';
import { type SoundStream } from '../../state/projectState';
import { MiniGridPreview } from './MiniGridPreview';

interface CandidatePreviewCardProps {
  candidate: CandidateSolution;
  soundStreams: SoundStream[];
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  onPromote: () => void;
  onCompare: () => void;
}

function difficultyLabel(score: number): string {
  if (score <= 0.2) return 'Easy';
  if (score <= 0.45) return 'Moderate';
  if (score <= 0.7) return 'Hard';
  return 'Extreme';
}

function difficultyColor(score: number): string {
  if (score <= 0.2) return '#22c55e';
  if (score <= 0.45) return '#eab308';
  if (score <= 0.7) return '#f97316';
  return '#ef4444';
}

function topCostDriver(metrics: { fingerPreference: number; handShapeDeviation: number; transitionCost: number; handBalance: number; constraintPenalty: number }): string {
  const factors: Array<[string, number]> = [
    ['Stretch', metrics.fingerPreference + metrics.handShapeDeviation],
    ['Movement', metrics.transitionCost],
    ['Balance', metrics.handBalance],
    ['Constraint', metrics.constraintPenalty],
  ];
  factors.sort((a, b) => b[1] - a[1]);
  return factors[0][0];
}

export function CandidatePreviewCard({
  candidate,
  soundStreams,
  rank,
  isSelected,
  onSelect,
  onPromote,
  onCompare,
}: CandidatePreviewCardProps) {
  const overall = candidate.difficultyAnalysis.overallScore;
  const topDriver = topCostDriver(candidate.executionPlan.averageMetrics);

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20'
          : 'border-gray-700/60 bg-gray-800/30 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="p-2.5">
        {/* Top row: rank + difficulty */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-gray-700/70 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              #{rank}
            </span>
            <span className="text-[11px] text-gray-400 truncate max-w-[80px]">
              {candidate.metadata.strategy ?? `Candidate`}
            </span>
          </div>
          <span
            className="text-[11px] font-mono font-medium"
            style={{ color: difficultyColor(overall) }}
          >
            {difficultyLabel(overall)}
          </span>
        </div>

        {/* Grid preview */}
        <div className="flex justify-center mb-2">
          <MiniGridPreview
            layout={candidate.layout}
            soundStreams={soundStreams}
            highlighted={isSelected}
          />
        </div>

        {/* Summary metadata */}
        <div className="flex justify-between text-[10px] text-gray-500 mb-2 px-0.5">
          <span>Score: {candidate.executionPlan.score.toFixed(1)}</span>
          <span>Top: {topDriver}</span>
        </div>

        {/* Feasibility warning with reason summary */}
        {candidate.executionPlan.unplayableCount > 0 && (
          <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 mb-2">
            {candidate.executionPlan.unplayableCount} unplayable
            {candidate.executionPlan.rejectionReasons && (() => {
              const counts: Record<string, number> = {};
              for (const reasons of Object.values(candidate.executionPlan.rejectionReasons)) {
                for (const r of reasons) counts[r] = (counts[r] || 0) + 1;
              }
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
              const SHORT_LABELS: Record<string, string> = {
                unmapped: 'unmapped', zone_conflict: 'zone conflict',
                ownership_conflict: 'ownership', speed_limit: 'speed',
                no_valid_grip: 'no grip', beam_exhausted: 'no solution path',
              };
              return top ? <span className="text-red-400/60"> ({SHORT_LABELS[top[0]] ?? top[0]})</span> : null;
            })()}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            className="flex-1 px-2 py-1 text-[10px] rounded transition-colors bg-green-600/15 border border-green-500/30 text-green-400 hover:bg-green-600/25"
            onClick={e => { e.stopPropagation(); onPromote(); }}
          >
            Promote to Active
          </button>
          <button
            className="px-2 py-1 text-[10px] rounded transition-colors bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
            onClick={e => { e.stopPropagation(); onCompare(); }}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}
