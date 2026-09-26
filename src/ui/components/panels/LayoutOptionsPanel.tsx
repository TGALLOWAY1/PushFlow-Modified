/**
 * LayoutOptionsPanel.
 *
 * Right-column bottom section showing candidate solutions as selectable
 * cards with mini grid previews. Supports multi-select for comparison.
 * Every row can be inspected (S3.2): Inspect shows the Active Layout, a
 * candidate, a saved variant or a recovered draft on the grid, read-only, and
 * writes nothing. "Edit as draft" is a variant's "Use as my draft".
 *
 * Candidates are grouped by run (S3.3, T30): each Generate adds a run ("Run 2
 * · Quick · 1 min ago"); older runs fold into "Earlier runs", with "Clear older
 * runs". Every candidate row has Keep (save it as a variant) and the one
 * Promote; a candidate made for an earlier version of the performance is
 * marked stale.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Dialog, useOverlayTitleId } from '../shared/Overlay';
import { useProject } from '../../state/ProjectContext';
import { useDraftReplacement } from '../../hooks/useDraftReplacement';
import { useLayoutActions } from '../../hooks/useLayoutActions';
import { type Layout } from '../../../types/layout';
import { type CandidateSolution } from '../../../types/candidateSolution';
import { type SoundStream, type InspectedLayoutRef, type ProjectState, RECOVERED_DRAFTS_CAP, resolveInspectedLayout } from '../../state/projectState';
import { describeDroppedForLocks, describePinnedPlacements } from '@/engine';
import { CandidatePreviewCard } from './CandidatePreviewCard';
import { MiniGridPreview } from './MiniGridPreview';
import { LayoutScoreLine } from './LayoutScoreLine';
import { layoutLabel } from '../../state/layoutLabels';
import {
  candidateLetterFor,
  isCandidateStale,
  runAge,
  runLabel,
  runViews,
  type RunView,
} from '../../state/candidateRuns';
import { isCandidateSavedAsVariant } from '../../state/keptCandidates';
import { UseAsDraftButton } from '../workspace/UseAsDraftButton';

/** Said over every candidate list (T30): candidates are never saved. */
export const CANDIDATES_CAPTION = 'Candidates are temporary · Save the ones you like as variants';

/** The time, refreshed now and then, for "1 min ago". */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "Run 2 · Quick · 1 min ago". */
export function runTitle(view: RunView, now: number): string {
  if (!view.run) return 'Candidates';
  return `Run ${view.run.number} · ${runLabel(view.candidates)} · ${runAge(view.run.createdAt, now)}`;
}

/** The small "Inspect" button every layout row has (S3.2). */
function InspectButton({ current, onClick, testId, what }: { current: boolean; onClick: () => void; testId: string; what: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={current ? 'true' : undefined}
      className={`px-2 py-1 text-pf-xs rounded-pf-sm transition-colors border ${
        current
          ? 'bg-[var(--bg-active)] border-[var(--border-strong)] text-[var(--text-primary)]'
          : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      }`}
      title={current ? `${what} is on the grid` : `Show ${what} on the grid, read-only: your draft stays as it is`}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      Inspect
    </button>
  );
}

interface LayoutOptionsPanelProps {
  selectedForCompare: Set<string>;
  /** Two or more distinct layouts are selected (T08). */
  compareEnabled?: boolean;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
  /** Re-runs candidate generation after a failure. */
  onRetryGenerate?: () => void;
  /** A candidate was kept as a variant: show it. */
  onVariantSaved?: (variantId: string) => void;
}

/** One run's candidates, under its title. */
function RunGroup({ view, now, state, isInspected, isChecked, onInspect, onPromote, onKeep, onDelete, onToggleCompare }: {
  view: RunView;
  now: number;
  state: ProjectState;
  isInspected: (c: CandidateSolution) => boolean;
  isChecked: (c: CandidateSolution) => boolean;
  onInspect: (c: CandidateSolution) => void;
  onPromote: (c: CandidateSolution) => void;
  onKeep: (c: CandidateSolution) => void;
  onDelete: (c: CandidateSolution) => void;
  onToggleCompare: (c: CandidateSolution) => void;
}) {
  const title = runTitle(view, now);
  // One run, one performance: its candidates are stale together.
  const stale = !!view.candidates[0] && isCandidateStale(state, view.candidates[0].id);
  return (
    <section data-testid="candidate-run" data-run={view.run?.number} aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5 min-w-0">
        <span data-testid="candidate-run-title" className="text-pf-xs font-semibold text-[var(--text-secondary)] truncate">{title}</span>
        {stale && (
          <span className="text-pf-micro text-[var(--status-warn)] whitespace-nowrap" title="The notes or the tempo changed since this run">
            · performance changed since
          </span>
        )}
      </div>
      {view.candidates.map(candidate => (
        <CandidatePreviewCard
          key={candidate.id}
          candidate={candidate}
          soundStreams={state.soundStreams}
          letter={candidateLetterFor(state, candidate.id)}
          isInspected={isInspected(candidate)}
          isCheckedForCompare={isChecked(candidate)}
          stale={stale}
          kept={isCandidateSavedAsVariant(state, candidate)}
          onInspect={() => onInspect(candidate)}
          onPromote={() => onPromote(candidate)}
          onKeep={() => onKeep(candidate)}
          onDelete={() => onDelete(candidate)}
          onToggleCompare={() => onToggleCompare(candidate)}
        />
      ))}
    </section>
  );
}

export function LayoutOptionsPanel({
  selectedForCompare,
  compareEnabled = selectedForCompare.size >= 2,
  onToggleCompare,
  onCompare,
  onRetryGenerate,
  onVariantSaved,
}: LayoutOptionsPanelProps) {
  const { state, dispatch } = useProject();
  const replaceDraft = useDraftReplacement();
  const layoutActions = useLayoutActions();
  const now = useNow(30_000);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [editingLayoutName, setEditingLayoutName] = useState(false);
  const [layoutNameDraft, setLayoutNameDraft] = useState('');
  // The layout on screen (S3.2), so its row is marked.
  const shown = resolveInspectedLayout(state);
  const inspect = (ref: InspectedLayoutRef | null) => dispatch({ type: 'INSPECT_LAYOUT', payload: ref });
  const activeShown = shown.role === 'active';

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
          {compareEnabled && (
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
            <strong className="text-[var(--text-secondary)]">Generate</strong> proposes alternative layouts to inspect, compare and keep.
          </div>
        )}

        {/* Processing state */}
        {state.isProcessing && (
          <div className="text-pf-xs text-blue-400 py-6 text-center animate-pulse">
            Generating candidates...
          </div>
        )}

        {/* Active Layout card: a click shows Active (read-only while your draft differs from it) */}
        {Object.keys(state.activeLayout.padToVoice).length > 0 && (
          <div
            data-testid="active-row"
            data-inspected={activeShown ? 'true' : undefined}
            className={`rounded-pf-lg border-2 border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20 cursor-pointer mb-2 ${
              activeShown ? 'ring-2 ring-emerald-400/30' : ''
            }`}
            onClick={() => inspect({ kind: 'active', id: state.activeLayout.id })}
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
                    data-testid="active-layout-name"
                    className="text-pf-xs text-[var(--text-secondary)] truncate ml-2 hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setLayoutNameDraft(state.activeLayout.name);
                      setEditingLayoutName(true);
                    }}
                    title="Double-click to rename"
                  >
                    {layoutLabel(state.activeLayout, { role: 'active' })}
                  </span>
                )}
              </div>
              <div className="flex justify-center mb-2">
                <MiniGridPreview
                  layout={state.activeLayout}
                  soundStreams={state.soundStreams}
                  highlighted={activeShown}
                />
              </div>
              <div className="flex items-end justify-between gap-2 px-0.5">
                <div className="space-y-0.5 min-w-0">
                  <LayoutScoreLine layout={state.activeLayout} testId="active-score" />
                  <div className="text-pf-xs text-[var(--text-tertiary)]">
                    {Object.keys(state.activeLayout.padToVoice).length} pads assigned
                  </div>
                </div>
                <InspectButton
                  testId="active-inspect"
                  what="the Active Layout"
                  current={activeShown}
                  onClick={() => inspect({ kind: 'active', id: state.activeLayout.id })}
                />
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

        {/* Candidate list, by run (S3.3) */}
        {hasCandidates && (() => {
          const [current, ...earlier] = runViews(state);
          const group = (view: RunView) => (
            <RunGroup
              key={view.run?.id ?? 'loose'}
              view={view}
              now={now}
              state={state}
              isInspected={c => shown.candidate?.id === c.id}
              isChecked={c => selectedForCompare.has(c.id)}
              onInspect={c => inspect({ kind: 'candidate', id: c.id })}
              onPromote={c => layoutActions.promote({ kind: 'candidate', id: c.id })}
              onKeep={c => {
                const variantId = layoutActions.keep(c.id);
                if (variantId) onVariantSaved?.(variantId);
              }}
              onDelete={c => dispatch({ type: 'DELETE_CANDIDATE', payload: { candidateId: c.id } })}
              onToggleCompare={c => onToggleCompare(c.id)}
            />
          );
          return (
            <div className="flex flex-col gap-2">
              <p data-testid="candidates-caption" className="text-pf-xs font-medium text-[var(--text-secondary)] px-0.5">
                {CANDIDATES_CAPTION}
              </p>
              {/* Generate only proposes (Q4): candidate A is shown read-only, and the draft is untouched. */}
              <p data-testid="candidates-hint" className="text-pf-xs text-[var(--text-tertiary)] px-0.5">
                Inspect a candidate to see it on the grid, read-only. Use as my draft to edit it; your draft stays as it is until you do.
              </p>
              {current && group(current)}
              {earlier.length > 0 && (
                <div data-testid="earlier-runs" className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      data-testid="earlier-runs-toggle"
                      aria-expanded={earlierOpen}
                      className="inline-flex items-center gap-1 min-h-[24px] text-pf-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-ring rounded-pf-sm"
                      onClick={() => setEarlierOpen(open => !open)}
                    >
                      {earlierOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                      Earlier runs ({earlier.length})
                    </button>
                    <button
                      type="button"
                      data-testid="clear-older-runs"
                      className="min-h-[24px] px-2 text-pf-xs rounded-pf-sm text-[var(--text-tertiary)] hover:text-red-300 hover:bg-red-500/10 focus-ring"
                      title="Remove the earlier runs and their candidates; kept variants stay"
                      onClick={() => dispatch({ type: 'CLEAR_OLDER_RUNS' })}
                    >
                      Clear older runs
                    </button>
                  </div>
                  {earlierOpen && earlier.map(group)}
                </div>
              )}
            </div>
          );
        })()}

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
                  isInspected={shown.role === 'variant' && shown.layout.id === variant.id}
                  onInspect={() => inspect({ kind: 'variant', id: variant.id })}
                  onPromote={() => layoutActions.promote({ kind: 'variant', id: variant.id })}
                  onDelete={() => dispatch({ type: 'DELETE_VARIANT', payload: { variantId: variant.id } })}
                  onRename={name => dispatch({ type: 'RENAME_LAYOUT', payload: { target: 'variant', variantId: variant.id, name } })}
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
              Kept when Use as my draft, Edit as draft or Promote replaced your draft. The newest {RECOVERED_DRAFTS_CAP} are kept.
            </p>
            <div className="flex flex-col gap-2">
              {[...state.recoveredDrafts].reverse().map((draft) => (
                <RecoveredDraftCard
                  key={draft.id}
                  draft={draft}
                  soundStreams={state.soundStreams}
                  isInspected={shown.role === 'recovered' && shown.layout.id === draft.id}
                  onInspect={() => inspect({ kind: 'recovered', id: draft.id })}
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
  const layoutActions = useLayoutActions();
  const shown = resolveInspectedLayout(state);

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
                {state.candidates.map(c => (
                  <CandidatePreviewCard
                    key={c.id}
                    candidate={c}
                    soundStreams={state.soundStreams}
                    letter={candidateLetterFor(state, c.id)}
                    isInspected={shown.candidate?.id === c.id}
                    isCheckedForCompare={false}
                    stale={isCandidateStale(state, c.id)}
                    kept={isCandidateSavedAsVariant(state, c)}
                    onInspect={() => {
                      dispatch({ type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: c.id } });
                      onClose();
                    }}
                    // The one Promote (S3.3): at once, with an Undo toast; no confirm().
                    onPromote={() => layoutActions.promote({ kind: 'candidate', id: c.id })}
                    onKeep={() => layoutActions.keep(c.id)}
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
                    isInspected={shown.role === 'variant' && shown.layout.id === variant.id}
                    onInspect={() => {
                      dispatch({ type: 'INSPECT_LAYOUT', payload: { kind: 'variant', id: variant.id } });
                      onClose();
                    }}
                    onPromote={() => layoutActions.promote({ kind: 'variant', id: variant.id })}
                    onDelete={() => dispatch({ type: 'DELETE_VARIANT', payload: { variantId: variant.id } })}
                    onRename={name => dispatch({ type: 'RENAME_LAYOUT', payload: { target: 'variant', variantId: variant.id, name } })}
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
  isInspected,
  onInspect,
  onPromote,
  onDelete,
  onRename,
}: {
  variant: Layout;
  soundStreams: SoundStream[];
  /** It is the layout on screen. */
  isInspected: boolean;
  onInspect: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);

  return (
    <div
      data-testid="variant-row"
      data-variant-id={variant.id}
      data-inspected={isInspected ? 'true' : undefined}
      className={`rounded-pf-lg border bg-[var(--bg-card)] p-3 ${isInspected ? 'border-role-variant ring-1 ring-role-variant/30' : 'border-[var(--border-subtle)]'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 space-y-0.5">
          {renaming ? (
            <VariantNameField
              name={variant.name}
              onDone={name => {
                setRenaming(false);
                if (name && name !== variant.name) onRename(name);
              }}
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span data-testid="variant-name" className="text-pf-sm text-[var(--text-primary)] font-medium truncate" title={variant.name} onDoubleClick={() => setRenaming(true)}>
                {variant.name}
              </span>
              <button
                type="button"
                data-testid="variant-rename"
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                aria-label={`Rename ${variant.name}`}
                title="Rename"
                onClick={() => setRenaming(true)}
              >
                <Pencil size={11} aria-hidden="true" />
              </button>
            </div>
          )}
          <LayoutScoreLine layout={variant} testId="variant-score" />
          <div className="text-pf-xs text-[var(--text-tertiary)]">
            {Object.keys(variant.padToVoice).length} pads assigned
            {variant.savedAt ? ` · Saved ${new Date(variant.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
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
        <InspectButton testId="variant-inspect" what={`"${variant.name}"`} current={isInspected} onClick={onInspect} />
        {/* "Load draft" became "Edit as draft": it asks before replacing a differing draft (S3.2). */}
        <UseAsDraftButton
          source={{ kind: 'variant', id: variant.id }}
          label="Edit as draft"
          testId="variant-edit"
          title="Make this variant your Working/Test Layout, to edit it"
          className="px-2 py-1 text-pf-xs rounded-pf-sm transition-colors bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25"
        />
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

/** Renames a variant in place: Enter keeps the name, Escape cancels. */
function VariantNameField({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(name);
  const [finished, setFinished] = useState(false);
  const finish = (value: string | null) => {
    if (finished) return;
    setFinished(true);
    onDone(value);
  };
  return (
    <input
      data-testid="variant-name-input"
      aria-label="Variant name"
      className="pf-input w-full text-pf-sm"
      value={draft}
      autoFocus
      onFocus={e => e.currentTarget.select()}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(draft.trim() || null);
        if (e.key === 'Escape') finish(null);
      }}
      onBlur={() => finish(draft.trim() || null)}
    />
  );
}

function RecoveredDraftCard({
  draft,
  soundStreams,
  isInspected,
  onInspect,
  onRestore,
  onDelete,
}: {
  draft: Layout;
  soundStreams: SoundStream[];
  /** It is the layout on screen. */
  isInspected: boolean;
  onInspect: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const kept = draft.savedAt ? new Date(draft.savedAt) : null;
  return (
    <div
      data-testid="recovered-row"
      data-layout-id={draft.id}
      data-inspected={isInspected ? 'true' : undefined}
      className={`rounded-pf-lg border border-dashed bg-[var(--bg-card)] p-3 ${isInspected ? 'border-role-working' : 'border-[var(--border-default)]'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div data-testid="recovered-name" className="text-pf-sm text-[var(--text-primary)] font-medium truncate">{layoutLabel(draft)}</div>
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
        <InspectButton testId="recovered-inspect" what={`"${layoutLabel(draft)}"`} current={isInspected} onClick={onInspect} />
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

/** The one Promote (S3.3): at once, with an Undo toast; no timed "Confirm?". */
function VariantPromoteButton({ onPromote }: { onPromote: () => void }) {
  return (
    <button
      type="button"
      data-testid="variant-promote"
      className="flex-1 px-2 py-1 text-pf-xs rounded-pf-sm transition-colors bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25"
      title="Make this variant the new Active Layout (Undo brings the old one back)"
      onClick={e => { e.stopPropagation(); onPromote(); }}
    >
      Promote
    </button>
  );
}
