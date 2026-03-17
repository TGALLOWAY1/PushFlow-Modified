/**
 * CandidateCard Component.
 *
 * Summary card for a single candidate solution showing tradeoff profile.
 */

import { type CandidateSolution } from '../../types/candidateSolution';

interface CandidateCardProps {
  candidate: CandidateSolution;
  isSelected: boolean;
  rank?: number;
  onClick: () => void;
}

const PROFILE_KEYS: Array<{ key: keyof CandidateSolution['tradeoffProfile']; label: string }> = [
  { key: 'playability', label: 'Play' },
  { key: 'compactness', label: 'Compact' },
  { key: 'handBalance', label: 'Balance' },
  { key: 'transitionEfficiency', label: 'Trans' },
];

function difficultyLabel(score: number): string {
  if (score <= 0.2) return 'Easy';
  if (score <= 0.45) return 'Moderate';
  if (score <= 0.7) return 'Hard';
  return 'Extreme';
}

function difficultyColor(score: number): string {
  if (score <= 0.2) return 'text-green-400';
  if (score <= 0.45) return 'text-yellow-400';
  if (score <= 0.7) return 'text-orange-400';
  return 'text-red-400';
}

export function CandidateCard({ candidate, isSelected, rank, onClick }: CandidateCardProps) {
  const { difficultyAnalysis, tradeoffProfile, executionPlan, metadata } = candidate;
  const overall = difficultyAnalysis.overallScore;

  return (
    <button
      className={`
        w-full text-left p-3 rounded-lg border transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank !== undefined && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">
              #{rank}
            </span>
          )}
          <span className="text-sm font-medium text-gray-200">
            {metadata.strategy ?? `Candidate ${candidate.id.slice(0, 6)}`}
          </span>
        </div>
        <span className={`text-sm font-mono ${difficultyColor(overall)}`}>
          {difficultyLabel(overall)}
        </span>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 text-[11px] text-gray-400 mb-2">
        <span>{new Set(executionPlan.fingerAssignments.map(a => a.startTime)).size} events</span>
        <span>{executionPlan.unplayableCount} unplayable</span>
        <span>score: {executionPlan.score.toFixed(1)}</span>
        {metadata.seed !== undefined && <span>seed: {metadata.seed}</span>}
      </div>

      {/* Tradeoff mini bars */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        {PROFILE_KEYS.map(({ key, label }) => {
          const value = tradeoffProfile[key];
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 w-10">{label}</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${value * 100}%`,
                    backgroundColor: value > 0.7 ? '#22c55e' : value > 0.4 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}
