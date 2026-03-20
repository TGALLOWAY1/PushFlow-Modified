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
        w-full text-left p-3 rounded-pf-lg border transition-all
        ${isSelected
          ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-muted)] ring-1 ring-[var(--accent-primary)]/20'
          : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank !== undefined && (
            <span className="pf-badge bg-[var(--bg-hover)] text-[var(--text-secondary)] font-mono">
              #{rank}
            </span>
          )}
          <span className="text-pf-base font-medium text-[var(--text-primary)]">
            {metadata.strategy ?? `Candidate ${candidate.id.slice(0, 6)}`}
          </span>
        </div>
        <span className={`text-pf-base font-mono ${difficultyColor(overall)}`}>
          {difficultyLabel(overall)}
        </span>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 text-pf-sm text-[var(--text-secondary)] mb-2.5">
        <span>{new Set(executionPlan.fingerAssignments.map(a => a.startTime)).size} events</span>
        <span>{executionPlan.unplayableCount} unplayable</span>
        <span className="tabular-nums">score: {executionPlan.score.toFixed(1)}</span>
        {metadata.seed !== undefined && <span className="tabular-nums">seed: {metadata.seed}</span>}
      </div>

      {/* Tradeoff mini bars */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        {PROFILE_KEYS.map(({ key, label }) => {
          const value = tradeoffProfile[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-pf-xs text-[var(--text-tertiary)] w-10">{label}</span>
              <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
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
