/**
 * PerformanceAnalysisPanel.
 *
 * Unified right-panel surface merging Analysis + Diagnostics.
 * Structure:
 * 1. Top controls (Learn more, Settings gear)
 * 2. Event-level difficulty visualization (stacked chart)
 * 3. Aggregate cost breakdown (horizontal bars)
 * 4. Candidate layout previews with actions
 */

import { useState, useMemo } from 'react';
import { useProject } from '../../state/ProjectContext';

import { LearnMoreModal } from './LearnMoreModal';
import { EventCostChart } from './EventCostChart';
import { CostBreakdownBars } from './CostBreakdownBars';
import { CandidatePreviewCard } from './CandidatePreviewCard';
import { CandidateCompare } from '../CandidateCompare';

interface PerformanceAnalysisPanelProps {
  onClose: () => void;
}

export function PerformanceAnalysisPanel({
  onClose,
}: PerformanceAnalysisPanelProps) {
  const { state, dispatch } = useProject();
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const activeResult = state.analysisResult;
  const hasCandidates = state.candidates.length > 0;

  const selectedCandidate = state.candidates.find(c => c.id === state.selectedCandidateId) ?? null;
  const compareCandidate = state.candidates.find(c => c.id === state.compareCandidateId) ?? null;

  // Get the candidate label for chart context
  const selectedCandidateLabel = useMemo(() => {
    if (!selectedCandidate) return undefined;
    const idx = state.candidates.indexOf(selectedCandidate);
    return `Candidate #${idx + 1}${selectedCandidate.metadata.strategy ? ` (${selectedCandidate.metadata.strategy})` : ''}`;
  }, [selectedCandidate, state.candidates]);

  // Current execution plan data (from active result or selected candidate)
  const currentPlan = activeResult?.executionPlan ?? selectedCandidate?.executionPlan;

  // Other candidates for comparison picking
  const otherCandidates = state.candidates.filter(c => c.id !== state.selectedCandidateId);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* ─── Top Controls ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-200">Performance Analysis</h3>
            {state.analysisStale && activeResult && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              onClick={() => setLearnMoreOpen(true)}
            >
              Learn more
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors text-sm"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </div>

        {/* ─── Scrollable Content ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Staleness warning */}
          {state.analysisStale && activeResult && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px]">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Analysis outdated — layout has changed since last run
            </div>
          )}

          {/* Empty state */}
          {!activeResult && !state.isProcessing && !hasCandidates && (
            <div className="text-xs text-gray-500 py-8 text-center">
              <div className="mb-2 text-gray-400">No analysis yet</div>
              Assign sounds to pads, then click <strong>Generate</strong> to create
              candidate solutions and analyze difficulty.
            </div>
          )}

          {/* Processing state */}
          {state.isProcessing && (
            <div className="text-xs text-blue-400 py-6 text-center animate-pulse">
              Generating candidate solutions...
            </div>
          )}

          {/* ─── Section 1: Event-Level Difficulty Chart ───────── */}
          {currentPlan && currentPlan.fingerAssignments.length > 0 && (
            <div className="border-b border-gray-800 pb-4">
              <EventCostChart
                fingerAssignments={currentPlan.fingerAssignments}
                candidateLabel={selectedCandidateLabel}
              />
            </div>
          )}

          {/* ─── Section 2: Aggregate Cost Breakdown ──────────── */}
          {currentPlan && (
            <div className="border-b border-gray-800 pb-4">
              <CostBreakdownBars metrics={currentPlan.averageMetrics} />

              {/* Quick stats row */}
              <div className="flex gap-2 mt-3">
                <QuickStat
                  label="Score"
                  value={currentPlan.score.toFixed(1)}
                  quality={currentPlan.score < 5 ? 'good' : currentPlan.score < 15 ? 'ok' : 'bad'}
                />
                <QuickStat
                  label="Events"
                  value={String(new Set(currentPlan.fingerAssignments.map(a => a.startTime)).size)}
                />
                <QuickStat
                  label="Hard"
                  value={String(currentPlan.hardCount)}
                  quality={currentPlan.hardCount === 0 ? 'good' : 'bad'}
                />
                {currentPlan.unplayableCount > 0 && (
                  <QuickStat
                    label="Unplayable"
                    value={String(currentPlan.unplayableCount)}
                    quality="bad"
                  />
                )}
              </div>
            </div>
          )}

          {/* ─── Section 3: Compare Mode ──────────────────────── */}
          {compareMode && selectedCandidate && (
            <div className="border-b border-gray-800 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                  Compare Candidates
                </h4>
                <button
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                  onClick={() => {
                    setCompareMode(false);
                    dispatch({ type: 'SET_COMPARE_CANDIDATE', payload: null });
                  }}
                >
                  Close
                </button>
              </div>

              {/* Comparison target picker */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Compare with:</span>
                <div className="flex gap-1">
                  {otherCandidates.map((c) => {
                    const globalIdx = state.candidates.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          c.id === state.compareCandidateId
                            ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                        onClick={() => dispatch({
                          type: 'SET_COMPARE_CANDIDATE',
                          payload: c.id === state.compareCandidateId ? null : c.id,
                        })}
                      >
                        #{globalIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {compareCandidate ? (
                <CandidateCompare candidateA={selectedCandidate} candidateB={compareCandidate} />
              ) : (
                <div className="text-xs text-gray-600 py-3 text-center">
                  Select a candidate above to compare.
                </div>
              )}
            </div>
          )}

          {/* ─── Section 4: Candidate Layout Previews ─────────── */}
          {hasCandidates && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                  Candidate Layout Comparison
                </h4>
                <button
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                  onClick={() => setViewAllOpen(true)}
                >
                  View All
                </button>
              </div>

              {/* Candidate grid - show up to 3 cards */}
              <div className="grid grid-cols-2 gap-2">
                {state.candidates.slice(0, 4).map((candidate, idx) => (
                  <CandidatePreviewCard
                    key={candidate.id}
                    candidate={candidate}
                    soundStreams={state.soundStreams}
                    rank={idx + 1}
                    isSelected={candidate.id === state.selectedCandidateId}
                    onSelect={() => {
                      dispatch({ type: 'SELECT_CANDIDATE', payload: candidate.id });
                      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
                    }}
                    onPromote={() => {
                      if (confirm('Promote this candidate to become the Active Layout? The current active layout will be auto-saved as a variant.')) {
                        dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
                      }
                    }}
                    onCompare={() => {
                      dispatch({ type: 'SELECT_CANDIDATE', payload: candidate.id });
                      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
                      setCompareMode(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Saved variants */}
          {state.savedVariants.length > 0 && (
            <div className="text-[10px] text-gray-600 pt-2 border-t border-gray-800">
              {state.savedVariants.length} saved variant{state.savedVariants.length !== 1 ? 's' : ''} available
            </div>
          )}
        </div>
      </div>

      {/* Learn More Modal */}
      <LearnMoreModal open={learnMoreOpen} onClose={() => setLearnMoreOpen(false)} />

      {/* View All Modal */}
      {viewAllOpen && (
        <ViewAllModal
          candidates={state.candidates}
          savedVariants={state.savedVariants}
          soundStreams={state.soundStreams}
          selectedId={state.selectedCandidateId}
          onSelect={(id) => {
            const candidate = state.candidates.find(c => c.id === id);
            if (candidate) {
              dispatch({ type: 'SELECT_CANDIDATE', payload: id });
              dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
            }
          }}
          onClose={() => setViewAllOpen(false)}
        />
      )}
    </>
  );
}

function QuickStat({ label, value, quality }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
}) {
  const colors = {
    good: 'text-green-400 border-green-500/20 bg-green-500/5',
    ok: 'text-gray-300 border-gray-700 bg-gray-800/50',
    bad: 'text-red-400 border-red-500/20 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-gray-300 border-gray-700 bg-gray-800/50';

  return (
    <div className={`px-2 py-1 rounded border text-[10px] ${style}`}>
      <span className="text-[9px] text-gray-500 uppercase mr-1">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ViewAllModal({ candidates, savedVariants, soundStreams, selectedId, onSelect, onClose }: {
  candidates: import('../../../types/candidateSolution').CandidateSolution[];
  savedVariants: import('../../../types/layout').Layout[];
  soundStreams: import('../../state/projectState').SoundStream[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-6 md:inset-x-auto md:max-w-3xl md:mx-auto z-[61] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">All Candidates & Saved Variants</h3>
          <button className="text-gray-500 hover:text-gray-300 text-lg" onClick={onClose}>&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {candidates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                Generated Candidates ({candidates.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {candidates.map((c, idx) => (
                  <CandidatePreviewCard
                    key={c.id}
                    candidate={c}
                    soundStreams={soundStreams}
                    rank={idx + 1}
                    isSelected={c.id === selectedId}
                    onSelect={() => onSelect(c.id)}
                    onPromote={() => {}}
                    onCompare={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {savedVariants.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                Saved Layout Variants ({savedVariants.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {savedVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-3"
                  >
                    <div className="text-[11px] text-gray-300 font-medium mb-1 truncate">
                      {variant.name}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {Object.keys(variant.padToVoice).length} pads assigned
                    </div>
                    {variant.savedAt && (
                      <div className="text-[10px] text-gray-600">
                        Saved: {new Date(variant.savedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidates.length === 0 && savedVariants.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              No candidates or saved variants yet. Generate candidates to get started.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
