/**
 * CandidatePreviewCard.
 *
 * Compact preview of a candidate solution with mini grid,
 * summary metadata, selection checkbox for compare, and action buttons.
 */

import { type CandidateSolution } from '../../../types/candidateSolution';
import { type SoundStream } from '../../state/projectState';
import { MiniGridPreview } from './MiniGridPreview';

interface CandidatePreviewCardProps {
  candidate: CandidateSolution;
  soundStreams: SoundStream[];
  rank: number;
  isSelected: boolean;
  isCheckedForCompare: boolean;
  onSelect: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onToggleCompare: () => void;
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
  isCheckedForCompare,
  onSelect,
  onPromote,
  onDelete,
  onToggleCompare,
}: CandidatePreviewCardProps) {
  const overall = candidate.difficultyAnalysis.overallScore;
  const topDriver = topCostDriver(candidate.executionPlan.averageMetrics);

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer relative ${
        isSelected
          ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20'
          : 'border-gray-700/60 bg-gray-800/30 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      {/* Compare checkbox */}
      <button
        className={`absolute top-1.5 left-1.5 z-10 w-4 h-4 rounded border flex items-center justify-center transition-all ${
          isCheckedForCompare
            ? 'bg-purple-600 border-purple-500 text-white'
            : 'bg-gray-800/80 border-gray-600 text-transparent hover:border-gray-400'
        }`}
        onClick={e => { e.stopPropagation(); onToggleCompare(); }}
        title="Select for comparison"
      >
        {isCheckedForCompare && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
          </svg>
        )}
      </button>

      {/* Delete button */}
      <button
        className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete candidate"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
        </svg>
      </button>

      <div className="p-2.5">
        {/* Top row: rank + difficulty */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 ml-5">
            <span className="text-[10px] bg-gray-700/70 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              #{rank}
            </span>
            <span className="text-[10px] text-gray-400 truncate max-w-[80px]">
              {candidate.metadata.strategy ?? 'Candidate'}
            </span>
          </div>
          <span
            className="text-[10px] font-mono font-medium mr-5"
            style={{ color: difficultyColor(overall) }}
          >
            {difficultyLabel(overall)}
          </span>
        </div>

        {/* Optimization method */}
        {(candidate.metadata.optimizationMode || candidate.metadata.optimizationSummary) && (
          <div className="text-[9px] text-gray-500 ml-5 mb-1 truncate" title={candidate.metadata.optimizationSummary}>
            {candidate.metadata.optimizationSummary ?? candidate.metadata.optimizationMode}
          </div>
        )}

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

        {/* Feasibility warning */}
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
            className="flex-1 px-2 py-1 text-[10px] rounded transition-colors bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25"
            onClick={e => { e.stopPropagation(); onSelect(); }}
          >
            Load
          </button>
          <button
            className="flex-1 px-2 py-1 text-[10px] rounded transition-colors bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25"
            onClick={e => { e.stopPropagation(); onPromote(); }}
          >
            Promote
          </button>
        </div>
      </div>
    </div>
  );
}
