/**
 * CompareModal.
 *
 * Full overlay for comparing two candidate solutions side-by-side.
 * Shows grids, tradeoff metrics, scores, and allows promoting. Each side names
 * its own subject with a SubjectChip (S3.2): "Active · Default" or
 * "Candidate B · Natural hand pose".
 */

import { useState, type ReactNode } from 'react';
import { useProject } from '../../state/ProjectContext';
import { useDraftReplacement } from '../../hooks/useDraftReplacement';
import { useLayoutAnalysis, type LayoutAnalysisState } from '../../analysis/layoutAnalysis';
import { useToast } from '../shared/Toast';
import { ACTIVE_COMPARE_ID } from '../../state/compareSet';
import { CompareGridView } from '../CompareGridView';
import { Dialog, useOverlayTitleId } from '../shared/Overlay';
import { CandidateCompare } from '../CandidateCompare';
import { type CandidateSolution } from '../../../types/candidateSolution';
import { candidateSubject, layoutSubject, type LayoutSubject } from '../../state/layoutSubject';
import { SubjectChip } from '../shared/SubjectChip';
import { momentDifficultyCounts } from '../../analysis/momentCounts';
import { TRADEOFF_DIMENSIONS } from '../../analysis/factorMeta';
import { formatPlanScore, playabilityTooltip, PLAYABILITY_TOOLTIP, SCORE_FAILED_TEXT, SCORING_TEXT } from '../../analysis/planScore';

interface CompareModalProps {
  candidateIds: string[];
  onClose: () => void;
}


export function CompareModal({ candidateIds, onClose }: CompareModalProps) {
  const { state } = useProject();
  const replaceDraft = useDraftReplacement();
  const toast = useToast();
  const titleId = useOverlayTitleId();

  // The Active side is analysed for real: its plan and score from the
  // per-layout cache, or a solve through it ('Analysing Active…'). Never a
  // zero stub (T08); a failed solve reads "Couldn't analyse".
  const wantsActive = candidateIds.includes(ACTIVE_COMPARE_ID);
  const activeAnalysis = useLayoutAnalysis(wantsActive ? state.activeLayout : null);
  const activeCandidate: CandidateSolution | null = activeAnalysis.status === 'ready'
    ? {
      ...activeAnalysis.analysis,
      id: ACTIVE_COMPARE_ID,
      layout: state.activeLayout,
      metadata: { strategy: 'Active Layout', seed: 0 },
    }
    : null;

  // Find candidates from IDs; the Active side is a placeholder until analysed.
  const allCandidates = state.candidates;
  const comparable = candidateIds
    .map(id => (id === ACTIVE_COMPARE_ID ? (activeCandidate ?? ACTIVE_COMPARE_ID) : allCandidates.find(c => c.id === id)))
    .filter((c): c is CandidateSolution | typeof ACTIVE_COMPARE_ID => c !== undefined);

  function handlePromote(candidate: CandidateSolution) {
    if (candidate.id === ACTIVE_COMPARE_ID) return; // Can't promote active to active
    if (confirm('Promote this candidate to become the Active Layout? The current active layout will be auto-saved as a variant.')) {
      const label = subjectFor(candidate).chip;
      replaceDraft({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: candidate.id } });
      // The promoted layout is now Active, so this pair would compare a layout
      // with itself: close, and say what happened (T08).
      onClose();
      toast.show({ message: `Promoted ${label} to Active Layout` });
    }
  }

  /** Each side's own subject: the Active Layout, or a candidate by its letter. */
  function subjectFor(c: CandidateSolution | typeof ACTIVE_COMPARE_ID): LayoutSubject {
    if (typeof c === 'string' || c.id === ACTIVE_COMPARE_ID) return layoutSubject(state.activeLayout, 'active');
    return candidateSubject(allCandidates, c);
  }

  function labelFor(c: CandidateSolution | typeof ACTIVE_COMPARE_ID) {
    if (typeof c === 'string' || c.id === ACTIVE_COMPARE_ID) return 'Active Layout';
    const subject = subjectFor(c);
    return `${subject.chip} \u00b7 ${subject.name}`;
  }

  // Allow picking which two to compare if more than 2 selected
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, comparable.length - 1));

  const sideA = comparable[leftIdx] ?? null;
  const sideB = comparable[rightIdx] ?? null;

  if (sideA && sideB && (typeof sideA === 'string' || typeof sideB === 'string')) {
    // One side is the Active Layout, still analysing or failed.
    const other = typeof sideA === 'string' ? sideB : sideA;
    return (
      <Dialog
        onClose={onClose}
        labelledBy={titleId}
        testId="compare-dialog"
        backdropClassName="fixed inset-0 z-[70] bg-black/60"
        className="fixed inset-6 z-[71] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden"
      >
        <CompareHeader titleId={titleId} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            <ActivePendingCard state={activeAnalysis} subject={subjectFor(ACTIVE_COMPARE_ID)} />
            {typeof other === 'string'
              ? <ActivePendingCard state={activeAnalysis} subject={subjectFor(ACTIVE_COMPARE_ID)} />
              : <ComparisonCard candidate={other} subject={subjectFor(other)} onPromote={() => handlePromote(other)} />}
          </div>
        </div>
      </Dialog>
    );
  }

  const candidateA = typeof sideA === 'string' ? null : sideA;
  const candidateB = typeof sideB === 'string' ? null : sideB;

  if (!candidateA || !candidateB) {
    // Every Compare state has a heading, a Close button and Escape (T06, T08).
    return (
      <Dialog
        onClose={onClose}
        labelledBy={titleId}
        testId="compare-dialog"
        backdropClassName="fixed inset-0 z-[70] bg-black/60"
        className="fixed inset-8 z-[71] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden"
      >
        <CompareHeader titleId={titleId} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] text-pf-lg">
          Not enough layouts to compare.
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      testId="compare-dialog"
      backdropClassName="fixed inset-0 z-[70] bg-black/60"
      className="fixed inset-6 z-[71] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden"
    >
        <CompareHeader titleId={titleId} onClose={onClose}>
            {comparable.length > 2 && (
              <div className="flex items-center gap-2 text-pf-sm text-[var(--text-secondary)]">
                <span>Left:</span>
                <select
                  className="pf-select text-pf-sm px-1 py-0.5"
                  value={leftIdx}
                  onChange={e => setLeftIdx(Number(e.target.value))}
                  aria-label="Left layout"
                >
                  {comparable.map((c, i) => (
                    <option key={typeof c === 'string' ? c : c.id} value={i} disabled={i === rightIdx}>
                      {labelFor(c)}
                    </option>
                  ))}
                </select>
                <span>Right:</span>
                <select
                  className="pf-select text-pf-sm px-1 py-0.5"
                  value={rightIdx}
                  onChange={e => setRightIdx(Number(e.target.value))}
                  aria-label="Right layout"
                >
                  {comparable.map((c, i) => (
                    <option key={typeof c === 'string' ? c : c.id} value={i} disabled={i === leftIdx}>
                      {labelFor(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}
        </CompareHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Side-by-side grids */}
          <CompareGridView
            candidateA={candidateA}
            candidateB={candidateB}
            voices={state.soundStreams}
            candidateALabel={labelFor(candidateA)}
            candidateBLabel={labelFor(candidateB)}
          />

          {/* Tradeoff comparison */}
          <CandidateCompare candidateA={candidateA} candidateB={candidateB} labelA={labelFor(candidateA)} labelB={labelFor(candidateB)} sounds={state.soundStreams} />

          {/* Score comparison table */}
          <div className="grid grid-cols-2 gap-4">
            <ComparisonCard
              candidate={candidateA}
              subject={subjectFor(candidateA)}
              onPromote={() => handlePromote(candidateA)}
              isActive={candidateA.id === ACTIVE_COMPARE_ID}
            />
            <ComparisonCard
              candidate={candidateB}
              subject={subjectFor(candidateB)}
              onPromote={() => handlePromote(candidateB)}
              isActive={candidateB.id === ACTIVE_COMPARE_ID}
            />
          </div>
        </div>
    </Dialog>
  );
}

function CompareHeader({ titleId, onClose, children }: { titleId: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
      <h3 id={titleId} className="text-pf-lg font-semibold text-[var(--text-primary)]">Compare Layouts</h3>
      <div className="flex items-center gap-3">
        {children}
        <button
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-lg transition-colors"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          data-testid="compare-close"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

/** The Active side before its analysis is ready: analysing, failed, or nothing placed. */
function ActivePendingCard({ state, subject }: { state: LayoutAnalysisState; subject: LayoutSubject }) {
  const text = state.status === 'error'
    ? "Couldn't analyse the Active Layout"
    : state.status === 'empty'
      ? 'Active Layout · nothing to analyse'
      : 'Analysing Active\u2026';
  return (
    <div
      data-testid="compare-card"
      data-candidate-id={ACTIVE_COMPARE_ID}
      data-status={state.status}
      role={state.status === 'error' ? 'alert' : 'status'}
      className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2"
    >
      <SubjectChip subject={subject} testId="compare-subject" />
      <div className={`text-pf-sm ${state.status === 'error' ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>{text}</div>
      {state.status === 'error' && <div className="text-pf-xs text-[var(--text-tertiary)] break-words">{state.message}</div>}
    </div>
  );
}

function ComparisonCard({
  candidate,
  subject,
  onPromote,
  isActive = false,
}: {
  candidate: CandidateSolution;
  /** This side's own subject (S3.2). */
  subject: LayoutSubject;
  onPromote: () => void;
  isActive?: boolean;
}) {
  const plan = candidate.executionPlan;
  const diff = candidate.difficultyAnalysis;
  // Events are moments for both solvers (T23).
  const counts = momentDifficultyCounts(plan.fingerAssignments);
  // The Score is the layout's Playability on the one yardstick (S3.1): the
  // number its row, the draft and a variant of it show.
  const scored = useLayoutAnalysis(candidate.layout);

  return (
    <div
      data-testid="compare-card"
      data-candidate-id={candidate.id}
      className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <SubjectChip subject={subject} testId="compare-subject" />
        <span className={`text-pf-sm font-mono font-medium flex-shrink-0 ${
          diff.overallScore <= 0.2 ? 'text-green-400' :
          diff.overallScore <= 0.45 ? 'text-yellow-400' :
          diff.overallScore <= 0.7 ? 'text-orange-400' : 'text-red-400'
        }`}>
          {diff.overallScore <= 0.2 ? 'Easy' :
           diff.overallScore <= 0.45 ? 'Moderate' :
           diff.overallScore <= 0.7 ? 'Hard' : 'Extreme'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-pf-xs">
        <div
          className="rounded-pf-sm bg-[var(--bg-panel)] px-2 py-1.5"
          title={scored.status === 'ready' ? playabilityTooltip(scored.score.playability) : scored.status === 'error' ? scored.message : PLAYABILITY_TOOLTIP}
        >
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Score</div>
          <div data-testid="compare-score" className="text-[var(--text-primary)] font-mono">
            {scored.status === 'ready'
              ? formatPlanScore(scored.score.playability)
              : scored.status === 'error'
                ? SCORE_FAILED_TEXT
                : scored.status === 'empty' ? '—' : SCORING_TEXT}
          </div>
        </div>
        <div className="rounded-pf-sm bg-[var(--bg-panel)] px-2 py-1.5">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Unplayable events</div>
          <div className={`font-mono ${counts.unplayable === 0 ? 'text-green-400' : 'text-red-400'}`} title={`${counts.unplayableNotes} of ${counts.notes} notes can't be played`}>
            {counts.unplayable}
          </div>
        </div>
        <div className="rounded-pf-sm bg-[var(--bg-panel)] px-2 py-1.5">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Hard events</div>
          <div className="text-[var(--text-primary)] font-mono">{counts.hard}</div>
        </div>
        <div className="rounded-pf-sm bg-[var(--bg-panel)] px-2 py-1.5">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Events</div>
          <div className="text-[var(--text-primary)] font-mono">{counts.events}</div>
        </div>
      </div>

      {/* Tradeoff bars: scores out of 100, higher is better */}
      <div className="space-y-1">
        {TRADEOFF_DIMENSIONS.map(({ key, label, description }) => ({ key, label, description, value: candidate.tradeoffProfile[key] })).map(({ key, label, description, value }) => (
          <div key={key} className="flex items-center gap-2" title={description}>
            <span className="text-pf-micro text-[var(--text-tertiary)] w-24">{label}</span>
            <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500/60 rounded-full"
                style={{ width: `${(value * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="text-pf-micro text-[var(--text-secondary)] font-mono w-7 text-right">
              {(value * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {!isActive && (
        <button
          className="w-full px-3 py-1.5 text-pf-sm rounded-pf-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors font-medium"
          onClick={onPromote}
        >
          Promote to Active
        </button>
      )}
    </div>
  );
}
