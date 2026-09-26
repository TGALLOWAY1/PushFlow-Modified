/**
 * CompareModal.
 *
 * Full overlay for comparing two layouts side-by-side: grids, tradeoff
 * metrics and scores, with Promote and Keep. Each side names its own subject
 * with a SubjectChip (S3.2): "Active · Default" or "Candidate B · Natural hand
 * pose".
 *
 * Compare on the cache (S3.3, T08 full): both sides are analysed the one way
 * every layout on screen is, their plan and Playability from the per-layout
 * cache (or solved through it, "Analysing…"), never a stub and never a
 * candidate's own optimizer plan, so Compare reads the same numbers as the
 * rows, the draft and the variants (Q5). Promote is the one Promote (at once,
 * with an Undo toast) and closes Compare; Keep saves a candidate as a variant.
 * Compare itself writes nothing.
 */

import { useState, type ReactNode } from 'react';
import { useProject } from '../../state/ProjectContext';
import { useLayoutActions } from '../../hooks/useLayoutActions';
import { useLayoutAnalysis, type LayoutAnalysisState } from '../../analysis/layoutAnalysis';
import { ACTIVE_COMPARE_ID } from '../../state/compareSet';
import { CompareGridView } from '../CompareGridView';
import { Dialog, useOverlayTitleId } from '../shared/Overlay';
import { CandidateCompare } from '../CandidateCompare';
import { type CandidateSolution } from '../../../types/candidateSolution';
import { type Layout } from '../../../types/layout';
import { type LayoutScore } from '@/engine';
import { candidateSubject, layoutSubject, type LayoutSubject } from '../../state/layoutSubject';
import { isCandidateSavedAsVariant } from '../../state/keptCandidates';
import { SubjectChip } from '../shared/SubjectChip';
import { momentDifficultyCounts } from '../../analysis/momentCounts';
import { TRADEOFF_DIMENSIONS } from '../../analysis/factorMeta';
import { formatPlanScore, playabilityTooltip } from '../../analysis/planScore';

interface CompareModalProps {
  candidateIds: string[];
  onClose: () => void;
}

/** One side of Compare: the Active Layout, or a candidate. */
interface CompareSide {
  id: string;
  layout: Layout;
  subject: LayoutSubject;
  /** The candidate, for a candidate side (its letter, Keep and Promote). */
  candidate: CandidateSolution | null;
}

/** A side's layout with its plan from the per-layout cache, as the grid and the tradeoff table read it. */
function analysedSide(side: CompareSide, analysis: CandidateSolution): CandidateSolution {
  return {
    ...analysis,
    id: side.id,
    layout: side.layout,
    metadata: side.candidate?.metadata ?? { strategy: 'Active Layout', seed: 0 },
  };
}

export function CompareModal({ candidateIds, onClose }: CompareModalProps) {
  const { state } = useProject();
  const layoutActions = useLayoutActions();
  const titleId = useOverlayTitleId();

  const sides: CompareSide[] = candidateIds.flatMap((id): CompareSide[] => {
    if (id === ACTIVE_COMPARE_ID) {
      return [{ id, layout: state.activeLayout, subject: layoutSubject(state.activeLayout, 'active'), candidate: null }];
    }
    const candidate = state.candidates.find(c => c.id === id);
    return candidate ? [{ id, layout: candidate.layout, subject: candidateSubject(state, candidate), candidate }] : [];
  });

  // Allow picking which two to compare if more than 2 selected
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, sides.length - 1));
  const sideA = sides[leftIdx] ?? null;
  const sideB = sides[rightIdx] ?? null;
  // Both sides on the one yardstick, from the per-layout cache (S3.1, S3.3).
  const scoredA = useLayoutAnalysis(sideA?.layout ?? null);
  const scoredB = useLayoutAnalysis(sideB?.layout ?? null);

  const labelFor = (side: CompareSide) => (side.candidate ? `${side.subject.chip} · ${side.subject.name}` : 'Active Layout');

  function promote(side: CompareSide) {
    if (!side.candidate) return; // The Active Layout is already Active.
    layoutActions.promote({ kind: 'candidate', id: side.candidate.id });
    // The promoted layout is now Active, so this pair would compare a layout
    // with itself: close; the Promote toast says what happened (T08).
    onClose();
  }
  const keep = (side: CompareSide) => { if (side.candidate) layoutActions.keep(side.candidate.id); };
  const kept = (side: CompareSide) => !!side.candidate && isCandidateSavedAsVariant(state, side.candidate);

  if (!sideA || !sideB || sideA === sideB) {
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

  const picker = sides.length > 2 && (
    <div className="flex items-center gap-2 text-pf-sm text-[var(--text-secondary)]">
      <span>Left:</span>
      <select
        className="pf-select text-pf-sm px-1 py-0.5"
        value={leftIdx}
        onChange={e => setLeftIdx(Number(e.target.value))}
        aria-label="Left layout"
      >
        {sides.map((s, i) => (
          <option key={s.id} value={i} disabled={i === rightIdx}>{labelFor(s)}</option>
        ))}
      </select>
      <span>Right:</span>
      <select
        className="pf-select text-pf-sm px-1 py-0.5"
        value={rightIdx}
        onChange={e => setRightIdx(Number(e.target.value))}
        aria-label="Right layout"
      >
        {sides.map((s, i) => (
          <option key={s.id} value={i} disabled={i === leftIdx}>{labelFor(s)}</option>
        ))}
      </select>
    </div>
  );

  const card = (side: CompareSide, scored: LayoutAnalysisState) => (scored.status === 'ready'
    ? (
      <ComparisonCard
        side={side}
        analysis={scored.analysis}
        score={scored.score}
        kept={kept(side)}
        onPromote={() => promote(side)}
        onKeep={() => keep(side)}
      />
    )
    : <PendingCard side={side} state={scored} />);

  if (scoredA.status !== 'ready' || scoredB.status !== 'ready') {
    // A side still analysing, or that couldn't be analysed, keeps its own card
    // beside the other; the grids and tradeoff bars need both plans.
    return (
      <Dialog
        onClose={onClose}
        labelledBy={titleId}
        testId="compare-dialog"
        backdropClassName="fixed inset-0 z-[70] bg-black/60"
        className="fixed inset-6 z-[71] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden"
      >
        <CompareHeader titleId={titleId} onClose={onClose}>{picker}</CompareHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            {card(sideA, scoredA)}
            {card(sideB, scoredB)}
          </div>
        </div>
      </Dialog>
    );
  }

  const analysedA = analysedSide(sideA, scoredA.analysis);
  const analysedB = analysedSide(sideB, scoredB.analysis);

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      testId="compare-dialog"
      backdropClassName="fixed inset-0 z-[70] bg-black/60"
      className="fixed inset-6 z-[71] rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col overflow-hidden"
    >
        <CompareHeader titleId={titleId} onClose={onClose}>{picker}</CompareHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Side-by-side grids: pads from each layout, fingers from its plan */}
          <CompareGridView
            candidateA={analysedA}
            candidateB={analysedB}
            voices={state.soundStreams}
            candidateALabel={labelFor(sideA)}
            candidateBLabel={labelFor(sideB)}
          />

          {/* Tradeoff comparison */}
          <CandidateCompare candidateA={analysedA} candidateB={analysedB} labelA={labelFor(sideA)} labelB={labelFor(sideB)} sounds={state.soundStreams} />

          {/* Score comparison table */}
          <div className="grid grid-cols-2 gap-4">
            {card(sideA, scoredA)}
            {card(sideB, scoredB)}
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

/** A side before its analysis is ready: analysing, failed, or nothing placed. */
function PendingCard({ side, state }: { side: CompareSide; state: LayoutAnalysisState }) {
  const what = side.candidate ? side.subject.chip : 'the Active Layout';
  const text = state.status === 'error'
    ? `Couldn't analyse ${what}`
    : state.status === 'empty'
      ? `${side.candidate ? side.subject.chip : 'Active Layout'} · nothing to analyse`
      : `Analysing ${side.candidate ? side.subject.chip : 'Active'}…`;
  return (
    <div
      data-testid="compare-card"
      data-candidate-id={side.id}
      data-status={state.status}
      role={state.status === 'error' ? 'alert' : 'status'}
      className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2"
    >
      <SubjectChip subject={side.subject} testId="compare-subject" />
      <div className={`text-pf-sm ${state.status === 'error' ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>{text}</div>
      {state.status === 'error' && <div className="text-pf-xs text-[var(--text-tertiary)] break-words">{state.message}</div>}
    </div>
  );
}

function ComparisonCard({
  side,
  analysis,
  score,
  kept,
  onPromote,
  onKeep,
}: {
  side: CompareSide;
  /** Its plan from the per-layout cache. */
  analysis: CandidateSolution;
  /** Its Playability on the one yardstick (S3.1): the number its row, the draft and a variant of it show. */
  score: LayoutScore;
  kept: boolean;
  onPromote: () => void;
  onKeep: () => void;
}) {
  const plan = analysis.executionPlan;
  const diff = analysis.difficultyAnalysis;
  // Events are moments for both solvers (T23).
  const counts = momentDifficultyCounts(plan.fingerAssignments);

  return (
    <div
      data-testid="compare-card"
      data-candidate-id={side.id}
      data-status="ready"
      className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <SubjectChip subject={side.subject} testId="compare-subject" />
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
        <div className="rounded-pf-sm bg-[var(--bg-panel)] px-2 py-1.5" title={playabilityTooltip(score.playability)}>
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Score</div>
          <div data-testid="compare-score" className="text-[var(--text-primary)] font-mono">
            {formatPlanScore(score.playability)}
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
        {TRADEOFF_DIMENSIONS.map(({ key, label, description }) => ({ key, label, description, value: analysis.tradeoffProfile[key] })).map(({ key, label, description, value }) => (
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

      {side.candidate && (
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="compare-promote"
            className="flex-1 px-3 py-1.5 text-pf-sm rounded-pf-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors font-medium"
            onClick={onPromote}
          >
            Promote to Active
          </button>
          <button
            type="button"
            data-testid="compare-keep"
            disabled={kept}
            className="flex-1 px-3 py-1.5 text-pf-sm rounded-pf-md border bg-accent-primary/15 border-accent-primary/30 text-[var(--accent-primary-soft)] hover:bg-accent-primary/25 transition-colors font-medium disabled:opacity-60 disabled:cursor-default"
            title={kept ? `${side.subject.chip} is kept as a Saved Layout Variant` : `Keep ${side.subject.chip} as a Saved Layout Variant`}
            onClick={onKeep}
          >
            {kept ? 'Kept' : 'Keep'}
          </button>
        </div>
      )}
    </div>
  );
}
