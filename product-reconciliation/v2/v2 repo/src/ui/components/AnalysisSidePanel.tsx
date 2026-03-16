/**
 * AnalysisSidePanel.
 *
 * Shows analysis results: difficulty heatmap, constraints, candidate switching,
 * and comparison. Displayed to the right of the grid in the editor.
 */

import { useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { CandidateCompare } from './CandidateCompare';
import { type CandidateSolution } from '../../types/candidateSolution';

type PanelTab = 'analysis' | 'compare';

export function AnalysisSidePanel() {
  const { state, dispatch } = useProject();
  const [tab, setTab] = useState<PanelTab>('analysis');
  const compareId = state.compareCandidateId;
  const setCompareId = (id: string | null) => dispatch({ type: 'SET_COMPARE_CANDIDATE', payload: id });

  const activeResult = state.analysisResult;
  const hasCandidates = state.candidates.length > 0;

  // Find compare candidate
  const selectedCandidate = state.candidates.find(c => c.id === state.selectedCandidateId) ?? null;
  const compareCandidate = state.candidates.find(c => c.id === compareId) ?? null;

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 text-xs">
        <button
          className={`px-2 py-1 rounded ${tab === 'analysis' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => { setTab('analysis'); setCompareId(null); }}
        >
          Analysis
        </button>
        {hasCandidates && (
          <button
            className={`px-2 py-1 rounded ${tab === 'compare' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => setTab('compare')}
          >
            Compare
          </button>
        )}
      </div>

      {/* Analysis tab */}
      {tab === 'analysis' && (
        <div className="space-y-3">
          {/* No analysis yet */}
          {!activeResult && !state.isProcessing && (
            <div className="text-xs text-gray-500 py-4 text-center">
              Assign sounds to pads, or click Generate to auto-assign and analyze.
            </div>
          )}

          {/* Candidate switcher (when multiple candidates exist) */}
          {hasCandidates && (
            <div className="space-y-1 pt-2 border-t border-gray-800">
              <span className="text-[10px] text-gray-500">Candidates ({state.candidates.length})</span>
              <div className="flex flex-wrap gap-1">
                {state.candidates.map((c, i) => {
                  const isActive = c.id === state.selectedCandidateId;
                  const score = c.difficultyAnalysis.overallScore;
                  return (
                    <button
                      key={c.id}
                      className={`
                        px-2 py-1 text-[11px] rounded transition-colors
                        ${isActive
                          ? 'bg-blue-600/30 border border-blue-500 text-blue-300'
                          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'}
                      `}
                      onClick={() => {
                        dispatch({ type: 'SELECT_CANDIDATE', payload: c.id });
                        dispatch({ type: 'SET_ANALYSIS_RESULT', payload: c });
                      }}
                    >
                      #{i + 1} {(score * 100).toFixed(0)}%
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare tab */}
      {tab === 'compare' && hasCandidates && selectedCandidate && (
        <CompareContent
          candidates={state.candidates}
          selectedCandidate={selectedCandidate}
          compareCandidate={compareCandidate}
          compareId={compareId}
          onCompareIdChange={setCompareId}
        />
      )}
    </div>
  );
}

function CompareContent({
  candidates,
  selectedCandidate,
  compareCandidate,
  compareId,
  onCompareIdChange,
}: {
  candidates: CandidateSolution[];
  selectedCandidate: CandidateSolution;
  compareCandidate: CandidateSolution | null;
  compareId: string | null;
  onCompareIdChange: (id: string | null) => void;
}) {
  const others = candidates.filter(c => c.id !== selectedCandidate.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Compare with:</span>
        <div className="flex gap-1">
          {others.map(c => (
            <button
              key={c.id}
              className={`px-2 py-1 text-[11px] rounded transition-colors ${
                c.id === compareId
                  ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => onCompareIdChange(c.id === compareId ? null : c.id)}
            >
              #{candidates.indexOf(c) + 1}
            </button>
          ))}
        </div>
      </div>

      {compareCandidate ? (
        <CandidateCompare candidateA={selectedCandidate} candidateB={compareCandidate} />
      ) : (
        <div className="text-gray-500 text-xs py-4 text-center">
          Select a candidate above to compare.
        </div>
      )}
    </div>
  );
}
