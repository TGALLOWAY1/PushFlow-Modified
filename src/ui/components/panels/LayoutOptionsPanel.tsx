/**
 * LayoutOptionsPanel.
 *
 * Right-column bottom section showing candidate solutions as selectable
 * cards with mini grid previews. Supports multi-select for comparison.
 */

import { useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { CandidatePreviewCard } from './CandidatePreviewCard';
import { MiniGridPreview } from './MiniGridPreview';

interface LayoutOptionsPanelProps {
  selectedForCompare: Set<string>;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
}

export function LayoutOptionsPanel({
  selectedForCompare,
  onToggleCompare,
  onCompare,
}: LayoutOptionsPanelProps) {
  const { state, dispatch } = useProject();
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [editingLayoutName, setEditingLayoutName] = useState(false);
  const [layoutNameDraft, setLayoutNameDraft] = useState('');

  const hasCandidates = state.candidates.length > 0;
  const compareCount = selectedForCompare.size;

  return (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="section-header">
            Layout Options
          </h3>
          {hasCandidates && (
            <span className="text-pf-xs text-[var(--text-tertiary)]">{state.candidates.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {compareCount >= 2 && (
            <button
              className="px-2 py-0.5 text-pf-xs rounded-pf-sm bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              onClick={onCompare}
            >
              Compare ({compareCount})
            </button>
          )}
          {state.candidates.length > 4 && (
            <button
              className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => setViewAllOpen(true)}
            >
              View all
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Empty state */}
        {!hasCandidates && !state.isProcessing && (
          <div className="text-pf-xs text-[var(--text-tertiary)] py-6 text-center">
            Click <strong className="text-[var(--text-secondary)]">Generate</strong> to create candidate layouts.
          </div>
        )}

        {/* Processing state */}
        {state.isProcessing && (
          <div className="text-pf-xs text-blue-400 py-6 text-center animate-pulse">
            Generating candidates...
          </div>
        )}

        {/* Active Layout card */}
        {Object.keys(state.activeLayout.padToVoice).length > 0 && (
          <div
            className={`rounded-pf-lg border-2 border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20 cursor-pointer mb-2 ${
              !state.selectedCandidateId ? 'ring-2 ring-emerald-400/30' : ''
            }`}
            onClick={() => {
              dispatch({ type: 'SELECT_CANDIDATE', payload: null });
            }}
          >
            <div className="p-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Compare checkbox */}
                  <div
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedForCompare.has('__active__')
                        ? 'bg-purple-600 border-purple-500'
                        : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompare('__active__');
                    }}
                  >
                    {selectedForCompare.has('__active__') && (
                      <span className="text-pf-micro text-white font-bold">{'\u2713'}</span>
                    )}
                  </div>
                  <span className="text-pf-xs font-semibold text-emerald-400 uppercase tracking-wider">Active</span>
                </div>
                {editingLayoutName ? (
                  <input
                    autoFocus
                    className="text-pf-xs text-[var(--text-primary)] bg-[var(--bg-input)] border border-[var(--border-default)] rounded-pf-sm px-1 py-0.5 outline-none focus:border-[var(--accent-primary)] ml-2 w-28"
                    value={layoutNameDraft}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setLayoutNameDraft(e.target.value)}
                    onBlur={() => {
                      const trimmed = layoutNameDraft.trim();
                      if (trimmed && trimmed !== state.activeLayout.name) {
                        dispatch({ type: 'RENAME_LAYOUT', payload: { target: 'active', name: trimmed } });
                      }
                      setEditingLayoutName(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingLayoutName(false);
                    }}
                  />
                ) : (
                  <span
                    className="text-pf-xs text-[var(--text-secondary)] truncate ml-2 hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setLayoutNameDraft(state.activeLayout.name);
                      setEditingLayoutName(true);
                    }}
                    title="Double-click to rename"
                  >
                    {state.activeLayout.name}
                  </span>
                )}
              </div>
              <div className="flex justify-center mb-2">
                <MiniGridPreview
                  layout={state.activeLayout}
                  soundStreams={state.soundStreams}
                  highlighted={!state.selectedCandidateId}
                />
              </div>
              <div className="text-pf-xs text-[var(--text-tertiary)] px-0.5">
                {Object.keys(state.activeLayout.padToVoice).length} pads assigned
              </div>
            </div>
          </div>
        )}

        {/* Candidate list */}
        {hasCandidates && (
          <div className="flex flex-col gap-2">
            {state.candidates.map((candidate, idx) => (
              <CandidatePreviewCard
                key={candidate.id}
                candidate={candidate}
                soundStreams={state.soundStreams}
                rank={idx + 1}
                isSelected={candidate.id === state.selectedCandidateId}
                isCheckedForCompare={selectedForCompare.has(candidate.id)}
                onSelect={() => {
                  dispatch({ type: 'SELECT_CANDIDATE', payload: candidate.id });
                  dispatch({ type: 'SET_ANALYSIS_RESULT', payload: candidate });
                }}
                onPromote={() => {
                  if (confirm('Promote this candidate to become the Active Layout? The current active layout will be auto-saved as a variant.')) {
                    dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
                  }
                }}
                onDelete={() => {
                  dispatch({ type: 'DELETE_CANDIDATE', payload: { candidateId: candidate.id } });
                }}
                onToggleCompare={() => onToggleCompare(candidate.id)}
              />
            ))}
          </div>
        )}

        {/* Saved variants */}
        {state.savedVariants.length > 0 && (
          <div className="text-pf-xs text-[var(--text-tertiary)] pt-3 mt-3 border-t border-[var(--border-subtle)]">
            {state.savedVariants.length} saved variant{state.savedVariants.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* View All Modal */}
      {viewAllOpen && (
        <ViewAllOverlay
          onClose={() => setViewAllOpen(false)}
        />
      )}
    </div>
  );
}

function ViewAllOverlay({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useProject();

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-8 z-[61] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden max-w-3xl mx-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-pf-lg font-semibold text-[var(--text-primary)]">All Candidates & Variants</h3>
          <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-lg" onClick={onClose}>&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {state.candidates.length > 0 && (
            <div className="mb-6">
              <h4 className="section-header mb-3">
                Generated Candidates ({state.candidates.length})
              </h4>
              <div className="flex flex-col gap-3">
                {state.candidates.map((c, idx) => (
                  <CandidatePreviewCard
                    key={c.id}
                    candidate={c}
                    soundStreams={state.soundStreams}
                    rank={idx + 1}
                    isSelected={c.id === state.selectedCandidateId}
                    isCheckedForCompare={false}
                    onSelect={() => {
                      dispatch({ type: 'SELECT_CANDIDATE', payload: c.id });
                      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: c });
                    }}
                    onPromote={() => {}}
                    onDelete={() => {
                      dispatch({ type: 'DELETE_CANDIDATE', payload: { candidateId: c.id } });
                    }}
                    onToggleCompare={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {state.savedVariants.length > 0 && (
            <div>
              <h4 className="section-header mb-3">
                Saved Variants ({state.savedVariants.length})
              </h4>
              <div className="flex flex-col gap-3">
                {state.savedVariants.map((variant) => (
                  <div key={variant.id} className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                    <div className="text-pf-sm text-[var(--text-primary)] font-medium mb-1 truncate">{variant.name}</div>
                    <div className="text-pf-xs text-[var(--text-tertiary)]">
                      {Object.keys(variant.padToVoice).length} pads assigned
                    </div>
                    {variant.savedAt && (
                      <div className="text-pf-xs text-[var(--text-tertiary)]">
                        Saved: {new Date(variant.savedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
