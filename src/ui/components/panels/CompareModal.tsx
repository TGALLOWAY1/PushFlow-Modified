/**
 * CompareModal.
 *
 * Full overlay for comparing two candidate solutions side-by-side.
 * Shows grids, tradeoff metrics, scores, and allows promoting.
 */

import { useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { CompareGridView } from '../CompareGridView';
import { CandidateCompare } from '../CandidateCompare';
import { type CandidateSolution } from '../../../types/candidateSolution';

interface CompareModalProps {
  candidateIds: string[];
  onClose: () => void;
}

/**
 * Build a synthetic CandidateSolution from the active layout for comparison.
 * Uses the latest analysis result if available, otherwise builds a minimal stub.
 */
function buildActiveCandidate(state: ReturnType<typeof useProject>['state']): CandidateSolution {
  const plan = state.analysisResult?.executionPlan ?? {
    score: 0, unplayableCount: 0, hardCount: 0,
    fingerAssignments: [], fingerUsageStats: {}, fatigueMap: {},
    averageDrift: 0, averageMetrics: {
      fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0,
      handBalance: 0, constraintPenalty: 0, total: 0,
    },
  };
  const diffAnalysis = state.analysisResult?.difficultyAnalysis ?? {
    overallScore: 0, passages: [], bindingConstraints: [],
  };
  const tradeoff = state.analysisResult?.tradeoffProfile ?? {
    playability: 0, compactness: 0, handBalance: 0, transitionEfficiency: 0,
  };
  return {
    id: '__active__',
    layout: state.activeLayout,
    executionPlan: plan,
    difficultyAnalysis: diffAnalysis,
    tradeoffProfile: tradeoff,
    metadata: { strategy: 'Active Layout', seed: 0 },
  };
}

export function CompareModal({ candidateIds, onClose }: CompareModalProps) {
  const { state, dispatch } = useProject();

  // Find candidates from IDs — handle special '__active__' ID
  const allCandidates = state.candidates;
  const activeSynthetic = buildActiveCandidate(state);

  const comparableCandidates = candidateIds
    .map(id => {
      if (id === '__active__') return activeSynthetic;
      return allCandidates.find(c => c.id === id);
    })
    .filter((c): c is CandidateSolution => c !== undefined);

  // Allow picking which two to compare if more than 2 selected
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, comparableCandidates.length - 1));

  const candidateA = comparableCandidates[leftIdx] ?? null;
  const candidateB = comparableCandidates[rightIdx] ?? null;

  if (!candidateA || !candidateB) {
    return (
      <>
        <div className="fixed inset-0 z-[70] bg-black/60" onClick={onClose} />
        <div className="fixed inset-8 z-[71] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex items-center justify-center">
          <div className="text-gray-500 text-sm">Not enough candidates to compare.</div>
        </div>
      </>
    );
  }

  const handlePromote = (candidate: CandidateSolution) => {
    if (candidate.id === '__active__') return; // Can't promote active to active
    if (confirm('Promote this candidate to become the Active Layout? The current active layout will be auto-saved as a variant.')) {
      dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
      // Don't close — remaining candidates are preserved so the user can keep comparing
    }
  };

  const getLabelForCandidate = (c: CandidateSolution) => {
    if (c.id === '__active__') return 'Active Layout';
    const idx = allCandidates.indexOf(c) + 1;
    return `#${idx} ${c.metadata.strategy ?? 'Candidate'}`;
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" onClick={onClose} />
      <div className="fixed inset-6 z-[71] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-200">Compare Layouts</h3>
          <div className="flex items-center gap-3">
            {comparableCandidates.length > 2 && (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span>Left:</span>
                <select
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded px-1 py-0.5"
                  value={leftIdx}
                  onChange={e => setLeftIdx(Number(e.target.value))}
                >
                  {comparableCandidates.map((c, i) => (
                    <option key={c.id} value={i} disabled={i === rightIdx}>
                      {getLabelForCandidate(c)}
                    </option>
                  ))}
                </select>
                <span>Right:</span>
                <select
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded px-1 py-0.5"
                  value={rightIdx}
                  onChange={e => setRightIdx(Number(e.target.value))}
                >
                  {comparableCandidates.map((c, i) => (
                    <option key={c.id} value={i} disabled={i === leftIdx}>
                      {getLabelForCandidate(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="text-gray-500 hover:text-gray-300 text-lg transition-colors" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Side-by-side grids */}
          <CompareGridView
            candidateA={candidateA}
            candidateB={candidateB}
            voices={state.soundStreams}
            candidateALabel={getLabelForCandidate(candidateA)}
            candidateBLabel={getLabelForCandidate(candidateB)}
          />

          {/* Tradeoff comparison */}
          <CandidateCompare candidateA={candidateA} candidateB={candidateB} />

          {/* Score comparison table */}
          <div className="grid grid-cols-2 gap-4">
            <ComparisonCard
              candidate={candidateA}
              label={getLabelForCandidate(candidateA)}
              onPromote={() => handlePromote(candidateA)}
              isActive={candidateA.id === '__active__'}
            />
            <ComparisonCard
              candidate={candidateB}
              label={getLabelForCandidate(candidateB)}
              onPromote={() => handlePromote(candidateB)}
              isActive={candidateB.id === '__active__'}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function ComparisonCard({
  candidate,
  label,
  onPromote,
  isActive = false,
}: {
  candidate: CandidateSolution;
  label: string;
  onPromote: () => void;
  isActive?: boolean;
}) {
  const plan = candidate.executionPlan;
  const diff = candidate.difficultyAnalysis;

  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-200">{label}</span>
        <span className={`text-[11px] font-mono font-medium ${
          diff.overallScore <= 0.2 ? 'text-green-400' :
          diff.overallScore <= 0.45 ? 'text-yellow-400' :
          diff.overallScore <= 0.7 ? 'text-orange-400' : 'text-red-400'
        }`}>
          {diff.overallScore <= 0.2 ? 'Easy' :
           diff.overallScore <= 0.45 ? 'Moderate' :
           diff.overallScore <= 0.7 ? 'Hard' : 'Extreme'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded bg-gray-900/40 px-2 py-1.5">
          <div className="text-[9px] text-gray-500 uppercase">Score</div>
          <div className="text-gray-200 font-mono">{plan.score.toFixed(1)}</div>
        </div>
        <div className="rounded bg-gray-900/40 px-2 py-1.5">
          <div className="text-[9px] text-gray-500 uppercase">Unplayable</div>
          <div className={`font-mono ${plan.unplayableCount === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {plan.unplayableCount}
          </div>
        </div>
        <div className="rounded bg-gray-900/40 px-2 py-1.5">
          <div className="text-[9px] text-gray-500 uppercase">Hard Events</div>
          <div className="text-gray-200 font-mono">{plan.hardCount}</div>
        </div>
        <div className="rounded bg-gray-900/40 px-2 py-1.5">
          <div className="text-[9px] text-gray-500 uppercase">Balance</div>
          <div className="text-gray-200 font-mono">{candidate.tradeoffProfile.handBalance.toFixed(2)}</div>
        </div>
      </div>

      {/* Tradeoff bars */}
      <div className="space-y-1">
        {([
          ['Playability', candidate.tradeoffProfile.playability],
          ['Compactness', candidate.tradeoffProfile.compactness],
          ['Balance', candidate.tradeoffProfile.handBalance],
          ['Transitions', candidate.tradeoffProfile.transitionEfficiency],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-16">{label}</span>
            <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500/60 rounded-full"
                style={{ width: `${(value * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-mono w-7 text-right">
              {(value * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {!isActive && (
        <button
          className="w-full px-3 py-1.5 text-[11px] rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors font-medium"
          onClick={onPromote}
        >
          Promote to Active
        </button>
      )}
    </div>
  );
}
