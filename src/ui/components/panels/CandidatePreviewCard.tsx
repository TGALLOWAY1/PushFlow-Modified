/**
 * CandidatePreviewCard.
 *
 * Compact preview of a candidate solution with mini grid,
 * summary metadata, selection checkbox for compare, and action buttons.
 */

import { useState } from 'react';
import { type CandidateSolution } from '../../../types/candidateSolution';
import { type SoundStream } from '../../state/projectState';
import { MiniGridPreview } from './MiniGridPreview';
import { formatPlanScore, getPlanScoreSummary } from '../../analysis/planScore';

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
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const overall = candidate.difficultyAnalysis.overallScore;
  const topDriver = topCostDriver(candidate.executionPlan.averageMetrics);

  return (
    <div
      className={`rounded-pf-lg border transition-all cursor-pointer relative ${
        isSelected
          ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-default)]'
      }`}
      onClick={onSelect}
    >
      {/* Compare checkbox */}
      <button
        className={`absolute top-1.5 left-1.5 z-10 w-4 h-4 rounded-pf-sm border flex items-center justify-center transition-all ${
          isCheckedForCompare
            ? 'bg-purple-600 border-purple-500 text-white'
            : 'bg-[var(--bg-card)] border-[var(--border-default)] text-transparent hover:border-[var(--border-strong)]'
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
      <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
        {confirmDelete ? (
          <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
            <button
              className="w-4 h-4 rounded-pf-sm flex items-center justify-center bg-red-600 text-white hover:bg-red-500"
              onClick={e => { e.stopPropagation(); onDelete(); setConfirmDelete(false); }}
              title="Confirm Delete"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" /></svg>
            </button>
            <button
              className="w-4 h-4 rounded-pf-sm flex items-center justify-center bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
              title="Cancel"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" /></svg>
            </button>
          </div>
        ) : (
          <button
            className="w-4 h-4 rounded-pf-sm flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            title="Delete candidate"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-2.5">
        {/* Top row: rank + difficulty */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 ml-5">
            <span className="text-pf-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-pf-sm font-mono">
              #{rank}
            </span>
            <span className="text-pf-xs text-[var(--text-secondary)] truncate max-w-[80px]">
              {candidate.metadata.strategy ?? 'Candidate'}
            </span>
          </div>
          <span
            className="text-pf-xs font-mono font-medium mr-5"
            style={{ color: difficultyColor(overall) }}
          >
            {difficultyLabel(overall)}
          </span>
        </div>

        {/* Optimization method */}
        {(candidate.metadata.optimizationMode || candidate.metadata.optimizationSummary) && (
          <div className="text-pf-micro text-[var(--text-tertiary)] ml-5 mb-1 truncate" title={candidate.metadata.optimizationSummary}>
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

        {/* Candidate family tag */}
        {candidate.metadata.candidateFamily && (
          <div className="text-pf-micro text-[var(--text-tertiary)] bg-[var(--bg-hover)] rounded-pf-sm px-1.5 py-0.5 mb-1.5 ml-0.5 inline-block">
            {candidate.metadata.candidateFamily}
          </div>
        )}

        {/* Summary metadata */}
        <div className="flex justify-between text-pf-xs text-[var(--text-tertiary)] mb-2 px-0.5">
          <span title={getPlanScoreSummary(candidate.executionPlan.score)}>Score: {formatPlanScore(candidate.executionPlan.score)}</span>
          <span>Top: {topDriver}</span>
        </div>

        {/* Explanation card */}
        {candidate.metadata.explanation && (
          <div className="text-pf-micro text-[var(--text-tertiary)] bg-[var(--bg-hover)] rounded-pf-sm px-1.5 py-1 mb-2 space-y-0.5">
            <div>
              <span className="text-[var(--text-secondary)]">Best for: </span>
              {candidate.metadata.explanation.bestFor}
            </div>
            {candidate.metadata.explanation.wonBecause.length > 0 && (
              <div>
                <span className="text-[var(--text-secondary)]">Why: </span>
                {candidate.metadata.explanation.wonBecause.join(', ')}
              </div>
            )}
            <div>
              <span className="text-[var(--text-secondary)]">Tradeoff: </span>
              {candidate.metadata.explanation.tradeoff}
            </div>
          </div>
        )}

        {/* Feasibility warning */}
        {candidate.executionPlan.unplayableCount > 0 && (
          <div className="text-pf-xs text-red-400 bg-red-500/10 rounded-pf-sm px-1.5 py-0.5 mb-2">
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
            className="flex-1 px-2 py-1 text-pf-xs rounded-pf-sm transition-colors bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25"
            onClick={e => { e.stopPropagation(); onSelect(); }}
          >
            Preview
          </button>
          <button
            className={`flex-1 px-2 py-1 text-pf-xs rounded-pf-sm transition-all ${
              confirmPromote 
                ? 'bg-emerald-600 text-white shadow-inner flex items-center justify-center gap-1.5 scale-[1.02] border-emerald-400' 
                : 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25'
            }`}
            onClick={e => { 
              e.stopPropagation(); 
              if (confirmPromote) {
                onPromote();
                setConfirmPromote(false);
              } else {
                setConfirmPromote(true);
                // Auto-reset after 3s
                setTimeout(() => setConfirmPromote(false), 3000);
              }
            }}
          >
            {confirmPromote ? (
              <>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" /></svg>
                Confirm?
              </>
            ) : 'Promote'}
          </button>
        </div>
      </div>
    </div>
  );
}
