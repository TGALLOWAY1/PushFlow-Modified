/**
 * LayoutOptionsPanel.
 *
 * Right-column bottom section showing candidate solutions as selectable
 * cards with mini grid previews. Supports multi-select for comparison.
 */

import { useState } from 'react';
import { Dialog, useOverlayTitleId } from '../shared/Overlay';
import { useProject } from '../../state/ProjectContext';
import { useDraftReplacement } from '../../hooks/useDraftReplacement';
import { type Layout } from '../../../types/layout';
import { type SoundStream, RECOVERED_DRAFTS_CAP } from '../../state/projectState';
import { describeDroppedForLocks, describePinnedPlacements } from '@/engine';
import { CandidatePreviewCard } from './CandidatePreviewCard';
import { MiniGridPreview } from './MiniGridPreview';

interface LayoutOptionsPanelProps {
  selectedForCompare: Set<string>;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
  /** Re-runs candidate generation after a failure. */
  onRetryGenerate?: () => void;
}

export function LayoutOptionsPanel({
  selectedForCompare,
  onToggleCompare,
  onCompare,
  onRetryGenerate,
}: LayoutOptionsPanelProps) {
  const { state, dispatch } = useProject();
  const replaceDraft = useDraftReplacement();
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [editingLayoutName, setEditingLayoutName] = useState(false);
  const [layoutNameDraft, setLayoutNameDraft] = useState('');

  const hasCandidates = state.candidates.length > 0;
  const droppedForLocks = state.generationSummary?.droppedForLockViolations ?? 0;
  const pinnedPlacements = state.generationSummary?.pinnedPlacements ?? 0;
  const compareCount = selectedForCompare.size;

  return (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="section-header">
            Layouts
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
        {/* Inline error state — the top banner is easy to miss in a
            full-viewport editor, so failures also surface here where the
            user is looking after clicking Generate. */}
        {state.error && !state.isProcessing && (
          <div className="rounded-pf-md border border-red-500/20 bg-red-500/8 px-3 py-2.5 mb-2">
            <div className="text-pf-xs font-semibold text-red-400 mb-1">Generation failed</div>
            <div className="text-pf-xs text-red-400/80 mb-2 break-words">{state.error}</div>
            <div className="flex items-center gap-2">
              {onRetryGenerate && (
                <button
                  className="px-2 py-1 text-pf-xs rounded-pf-sm bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-colors"
                  onClick={onRetryGenerate}
                >
                  Retry
                </button>
              )}
              <button
                className="px-2 py-1 text-pf-xs rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasCandidates && !state.isProcessing && !state.error && (
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
                    data-testid="compare-toggle-active"
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

        {/* Candidates dropped for breaking a placement lock (canon section 11) */}
        {droppedForLocks > 0 && (
          <p data-testid="candidates-dropped-for-locks" role="note" className="text-pf-xs text-amber-300/90 px-0.5">
            {describeDroppedForLocks(droppedForLocks)}
          </p>
        )}
        {pinnedPlacements > 0 && (
          <p data-testid="candidates-pinned" role="note" className="text-pf-xs text-[var(--text-tertiary)] px-0.5">
            {describePinnedPlacements(pinnedPlacements)}
          </p>
        )}

        {/* Candidate list */}
        {hasCandidates && (
          <div className="flex flex-col gap-2">
            {/* Generate only proposes; the grid and the draft are untouched. */}
            <p data-testid="candidates-hint" className="text-pf-xs text-[var(--text-tertiary)] px-0.5">
              Preview #1 to try it on the grid. Your draft stays as it is until you do.
            </p>
            {state.candidates.map((candidate, idx) => (
              <CandidatePreviewCard
                key={candidate.id}
                candidate={candidate}
                soundStreams={state.soundStreams}
                rank={idx + 1}
                isSelected={candidate.id === state.selectedCandidateId}
                isCheckedForCompare={selectedForCompare.has(candidate.id)}
                onSelect={() => {
                  // Preview: selecting a candidate drives display via the selector
                  // layer (getDisplayedCandidate reads selectedCandidateId first), so
                  // analysisResult is not overwritten. APPLY_GENERATION makes the
                  // candidate the editable working layout, keeping a differing draft
                  // in Recovered drafts.
                  replaceDraft(
                    { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidate.id } },
                    { label: 'Use candidate', alsoDispatch: [{ type: 'SELECT_CANDIDATE', payload: candidate.id }] },
                  );
                }}
                onPromote={() => {
                  replaceDraft({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
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
          <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-header">
                Saved Variants ({state.savedVariants.length})
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {[...state.savedVariants].reverse().map((variant) => (
                <SavedVariantCard
                  key={variant.id}
                  variant={variant}
                  soundStreams={state.soundStreams}
                  onLoad={() => replaceDraft({ type: 'LOAD_SAVED_VARIANT', payload: { variantId: variant.id } })}
                  onPromote={() => replaceDraft({ type: 'PROMOTE_VARIANT', payload: { variantId: variant.id } })}
                  onDelete={() => dispatch({ type: 'DELETE_VARIANT', payload: { variantId: variant.id } })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recovered drafts: drafts kept automatically when an action replaced them */}
        {(state.recoveredDrafts ?? []).length > 0 && (
          <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] space-y-2" data-testid="recovered-drafts">
            <div className="flex items-center justify-between">
              <span className="section-header">
                Recovered drafts ({state.recoveredDrafts.length})
              </span>
            </div>
            <p className="text-pf-xs text-[var(--text-tertiary)] px-0.5">
              Kept when Preview, Load Draft or Promote replaced your draft. The newest {RECOVERED_DRAFTS_CAP} are kept.
            </p>
            <div className="flex flex-col gap-2">
              {[...state.recoveredDrafts].reverse().map((draft) => (
                <RecoveredDraftCard
                  key={draft.id}
                  draft={draft}
                  soundStreams={state.soundStreams}
                  onRestore={() => replaceDraft({ type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: draft.id } })}
                  onDelete={() => dispatch({ type: 'DELETE_RECOVERED_DRAFT', payload: { layoutId: draft.id } })}
                />
              ))}
            </div>
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
  const replaceDraft = useDraftReplacement();

  const titleId = useOverlayTitleId();

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      testId="view-all-dialog"
      className="fixed inset-8 z-[61] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden max-w-3xl mx-auto"
    >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h3 id={titleId} className="text-pf-lg font-semibold text-[var(--text-primary)]">All Candidates & Variants</h3>
          <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-lg" onClick={onClose} aria-label="Close">&times;</button>
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
                      // Display flows through the selector layer; no analysisResult overwrite.
                      replaceDraft(
                        { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: c.id } },
                        { label: 'Use candidate', alsoDispatch: [{ type: 'SELECT_CANDIDATE', payload: c.id }] },
                      );
                    }}
                    onPromote={() => {
                      if (confirm('Promote this candidate to become the Active Layout?')) {
                        replaceDraft({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: c.id } });
                      }
                    }}
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
                  <SavedVariantCard
                    key={variant.id}
                    variant={variant}
                    soundStreams={state.soundStreams}
                    onLoad={() => {
                      replaceDraft({ type: 'LOAD_SAVED_VARIANT', payload: { variantId: variant.id } });
                      onClose();
                    }}
                    onPromote={() => replaceDraft({ type: 'PROMOTE_VARIANT', payload: { variantId: variant.id } })}
                    onDelete={() => dispatch({ type: 'DELETE_VARIANT', payload: { variantId: variant.id } })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
    </Dialog>
  );
}

function SavedVariantCard({
  variant,
  soundStreams,
  onLoad,
  onPromote,
  onDelete,
}: {
  variant: Layout;
  soundStreams: SoundStream[];
  onLoad: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      data-testid="variant-row"
      data-variant-id={variant.id}
      className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-pf-sm text-[var(--text-primary)] font-medium truncate">{variant.name}</div>
          <div className="text-pf-xs text-[var(--text-tertiary)]">
            {Object.keys(variant.padToVoice).length} pads assigned
          </div>
          {variant.savedAt && (
            <div className="text-pf-xs text-[var(--text-tertiary)]">
              Saved {new Date(variant.savedAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <MiniGridPreview
            layout={variant}
            soundStreams={soundStreams}
            size={0.8}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          className="px-2 py-1 text-pf-xs rounded-pf-sm transition-colors bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25"
          onClick={onLoad}
        >
          Load Draft
        </button>
        <VariantPromoteButton onPromote={onPromote} />
        {confirmDelete ? (
          <>
            <button
              className="px-2 py-1 text-pf-xs rounded-pf-sm bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
            >
              Del
            </button>
            <button
              className="px-2 py-1 text-pf-xs rounded-pf-sm bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
              onClick={() => setConfirmDelete(false)}
            >
              Esc
            </button>
          </>
        ) : (
          <button
            className="px-2 py-1 text-pf-xs rounded-pf-sm transition-colors text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
            onClick={() => setConfirmDelete(true)}
            title="Delete variant"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

function RecoveredDraftCard({
  draft,
  soundStreams,
  onRestore,
  onDelete,
}: {
  draft: Layout;
  soundStreams: SoundStream[];
  onRestore: () => void;
  onDelete: () => void;
}) {
  const kept = draft.savedAt ? new Date(draft.savedAt) : null;
  return (
    <div
      data-testid="recovered-row"
      data-layout-id={draft.id}
      className="rounded-pf-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] p-3"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-pf-sm text-[var(--text-primary)] font-medium truncate">{draft.name}</div>
          <div className="text-pf-xs text-[var(--text-tertiary)]">
            {Object.keys(draft.padToVoice).length} pads assigned
          </div>
          {kept && (
            <div className="text-pf-xs text-[var(--text-tertiary)]">
              Kept {kept.toLocaleDateString()} {kept.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <MiniGridPreview layout={draft} soundStreams={soundStreams} size={0.8} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          className="px-2 py-1 text-pf-xs rounded-pf-sm transition-colors bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25"
          onClick={onRestore}
          title="Make this your Working/Test Layout again"
        >
          Restore
        </button>
        <button
          className="px-2 py-1 text-pf-xs rounded-pf-sm transition-colors text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
          onClick={onDelete}
          title="Delete recovered draft"
          aria-label="Delete recovered draft"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

function VariantPromoteButton({ onPromote }: { onPromote: () => void }) {
  const [confirmMode, setConfirmMode] = useState(false);
  
  return (
    <button
      className={`flex-1 px-2 py-1 text-pf-xs rounded-pf-sm transition-all ${
        confirmMode 
          ? 'bg-emerald-600 text-white shadow-inner flex items-center justify-center gap-1.5 border-emerald-400' 
          : 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25'
      }`}
      onClick={e => { 
        e.stopPropagation(); 
        if (confirmMode) {
          onPromote();
          setConfirmMode(false);
        } else {
          setConfirmMode(true);
          setTimeout(() => setConfirmMode(false), 3000);
        }
      }}
    >
      {confirmMode ? 'Confirm?' : 'Promote'}
    </button>
  );
}
