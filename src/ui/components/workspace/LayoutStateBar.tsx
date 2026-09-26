/**
 * The layout-state bar (S3.2, T03): the fixed, unscaled strip above the grid
 * that always says which layout is on screen and what can be done with it.
 *
 * - A SubjectChip: the role chip (its own colour and icon: Active,
 *   Working/Test, Candidate A, Saved variant, Recovered draft) and the name.
 * - Under the name, the diff against Active ("3 pads vs Active", plus against
 *   your draft when one differs) and freshness: "Up to date", or "Updating…"
 *   once the analysis has been pending for about 1.5 s (a quick re-analysis
 *   never flickers).
 * - Only that role's actions. Your draft: Promote, Save variant, Discard. A
 *   candidate, variant or recovered draft (read-only): Use as my draft, Promote
 *   (not for a recovered draft), Keep as variant (a candidate) and Back to my
 *   draft. Active while a draft differs: "Viewing Active · your draft is kept"
 *   and Back to my draft.
 * - The S2.4 placing hints (nothing placed yet, the armed Sound) for the
 *   layout being edited, and a one-time note on the first candidate shown.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import {
  getAnalysisForLayout,
  getActiveTrace,
  isReplayingTrace,
  resolveInspectedLayout,
  type ProjectState,
  type ResolvedInspection,
} from '../../state/projectState';
import { inspectedSubject, shownLayoutDiff } from '../../state/layoutSubject';
import { isCandidateSavedAsVariant } from '../../state/keptCandidates';
import { type LayoutAnalysisState } from '../../analysis/layoutAnalysis';
import { suggestVariantName } from '../../state/variantNames';
import { uniqueName } from '../../../utils/uniqueName';
import { generateId } from '../../../utils/idGenerator';
import { SubjectChip } from '../shared/SubjectChip';
import { IconButton } from '../shared/IconButton';
import { useToast } from '../shared/Toast';
import { SaveVariantPopover } from './SaveVariantPopover';
import { UseAsDraftButton } from './UseAsDraftButton';
import { useLayoutActions, type PromoteSource } from '../../hooks/useLayoutActions';
import { USE_AS_DRAFT_HINT } from '../../hooks/useReadOnlyHint';
import { lifecycleLabel } from '../../state/lifecycleActions';

/** How long an analysis may be pending before the bar says "Updating…". */
export const UPDATING_AFTER_MS = 1500;

/** Per viewer: the note explaining "Use as my draft" has been seen (dismissed or acted on). */
const COACH_KEY = 'pushflow:coach:use-as-draft';

function coachSeen(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

function markCoachSeen(): void {
  try {
    localStorage.setItem(COACH_KEY, '1');
  } catch {
    // Blocked storage: the note may show again next time; nothing else changes.
  }
}

/** True once `on` has held for `ms`. */
function useLateFlag(on: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const timer = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on && late;
}

export type Freshness = 'up-to-date' | 'updating' | null;

/**
 * Whether the plan on screen describes the layout on screen. The layout being
 * edited reads the draft's auto-analysis; a read-only one its cache entry
 * (`scoring`). Pending for under 1.5 s keeps the last word said about the same
 * layout, so a quick re-analysis after an edit never flickers.
 */
function useFreshness(state: ProjectState, shown: ResolvedInspection, scoring: LayoutAnalysisState): Freshness {
  const placed = Object.keys(shown.layout.padToVoice).length > 0 && state.soundStreams.some(s => !s.muted && s.events.length > 0);
  let pending = false;
  let hasPlan = false;
  if (shown.readOnly) {
    pending = scoring.status === 'analysing';
    hasPlan = scoring.status === 'ready';
  } else if (placed) {
    hasPlan = !!getAnalysisForLayout(state, shown.layout);
    pending = !state.error && (state.analysisStale || !hasPlan);
  }
  const settled: Freshness = hasPlan ? 'up-to-date' : null;
  // The last settled word, per layout (edits keep the draft's id; another layout starts afresh).
  const subjectKey = `${shown.role}:${shown.layout.id}`;
  const lastWord = useRef<{ key: string; word: Freshness }>({ key: subjectKey, word: settled });
  if (!pending) lastWord.current = { key: subjectKey, word: settled };
  const late = useLateFlag(pending, UPDATING_AFTER_MS);
  if (late) return 'updating';
  if (!pending) return settled;
  return lastWord.current.key === subjectKey ? lastWord.current.word : null;
}

const ACTION = 'h-7 px-2 rounded-pf-sm border text-pf-micro font-semibold whitespace-nowrap flex-shrink-0 transition-colors focus-ring';
const PRIMARY = `${ACTION} bg-role-candidate/20 border-role-candidate/50 text-[var(--text-primary)] hover:bg-role-candidate/30`;
const PROMOTE = `${ACTION} bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30`;
const KEEP = `${ACTION} bg-accent-primary/80 hover:bg-accent-primary text-white border-accent-primary/30`;
const SUBTLE = `${ACTION} bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`;

export function LayoutStateBar({ hint, scoring, onVariantSaved }: {
  /** The placing hint for the layout being edited (nothing placed, the armed Sound). */
  hint?: ReactNode;
  /** The read-only layout's cache entry (useInspectedAnalysis), for freshness. */
  scoring: LayoutAnalysisState;
  /** A variant was saved or kept: show it (the Layouts tab, scrolled to its card). */
  onVariantSaved?: (variantId: string) => void;
}) {
  const { state, dispatch, undo, undoLabel } = useProject();
  const toast = useToast();
  // The one Promote and one Keep every surface shares (S3.3).
  const layoutActions = useLayoutActions();
  const shown = resolveInspectedLayout(state);
  const subject = inspectedSubject(state);
  const freshness = useFreshness(state, shown, scoring);
  const replaying = isReplayingTrace(state);

  // A toast with Undo is offered only while its step is the one Undo reverts.
  const undoToast = useRef<{ id: number; label: string } | null>(null);
  useEffect(() => {
    if (undoToast.current && undoLabel !== undoToast.current.label) {
      toast.dismiss(undoToast.current.id);
      undoToast.current = null;
    }
  }, [undoLabel, toast]);
  const confirm = (message: string, stepLabel: string) => {
    if (undoToast.current) toast.dismiss(undoToast.current.id);
    undoToast.current = { id: toast.show({ message, action: { label: 'Undo', onClick: undo } }), label: stepLabel };
  };

  // The note on the first candidate shown (Q4: Generate shows candidate A read-only).
  const [coachDone, setCoachDone] = useState(coachSeen);
  const showCoach = !coachDone && shown.role === 'candidate' && !replaying;
  const finishCoach = () => {
    markCoachSeen();
    setCoachDone(true);
  };
  /** An action taken on a candidate means its note has done its job. */
  const onCandidateActed = () => {
    if (shown.role === 'candidate') finishCoach();
  };

  // Save variant asks for a name first (T29).
  const saveRef = useRef<HTMLButtonElement>(null);
  const [saveAt, setSaveAt] = useState<{ x: number; y: number } | null>(null);
  const saveVariant = (requested: string) => {
    const variantId = generateId('variant');
    const name = uniqueName(requested, state.savedVariants.map(v => v.name));
    dispatch({ type: 'SAVE_AS_VARIANT', payload: { name, source: 'working', variantId } });
    setSaveAt(null);
    toast.show({ message: `Saved variant "${name}"` });
    onVariantSaved?.(variantId);
  };

  const back = () => {
    onCandidateActed();
    dispatch({ type: 'INSPECT_LAYOUT', payload: null });
  };

  /** Promote from the bar: the one Promote (at once, one undo step, a toast with Undo). */
  const promote = (source: PromoteSource) => {
    onCandidateActed();
    layoutActions.promote(source);
  };

  // Discard is confirmed by a toast with Undo. Finger preferences live in
  // voiceConstraints and survive Discard (decision Q2), and the toast says so.
  const discard = () => {
    const keepsPreferences = Object.values(state.voiceConstraints).some(c => c.hand || c.finger);
    dispatch({ type: 'DISCARD_WORKING_LAYOUT' });
    confirm(keepsPreferences ? 'Draft discarded · Finger preferences kept' : 'Draft discarded', 'Discard');
  };

  const keepCandidate = () => {
    const candidate = shown.candidate;
    if (!candidate) return;
    finishCoach();
    const variantId = layoutActions.keep(candidate.id);
    if (variantId) onVariantSaved?.(variantId);
  };

  const backLabel = state.workingLayout ? lifecycleLabel('back') : 'Back to Active';
  const backButton = (
    <button type="button" data-testid="state-bar-back" className={SUBTLE} onClick={back} title="Show the layout you are editing again">
      {backLabel}
    </button>
  );

  let detail: ReactNode = null;
  let actions: ReactNode = null;
  if (replaying) {
    // A step of the optimizer trace is on the grid, read-only (T33); Esc, or
    // Exit replay, shows the layout on screen again (the input table's
    // exit-replay row).
    const trace = getActiveTrace(state) ?? [];
    detail = (
      <span data-testid="state-bar-replay">
        Replaying step {(state.moveHistoryIndex ?? 0) + 1}/{trace.length} {'·'} Esc to exit
      </span>
    );
    actions = (
      <button type="button" data-testid="state-bar-exit-replay" className={SUBTLE}
        onClick={() => dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: null })}
        title="Show the layout on screen again (Esc)">
        Exit replay
      </button>
    );
  } else {
    const diff = shownLayoutDiff(state);
    detail = shown.role === 'active' && shown.readOnly
      ? <span data-testid="state-bar-diff" title={diff ?? undefined}>Viewing Active {'·'} your draft is kept</span>
      : (diff || freshness) && (
        <>
          {diff && <span data-testid="state-bar-diff" title={diff}>{diff}</span>}
          {diff && freshness && ' · '}
          {freshness && (
            <span data-testid="state-bar-freshness" data-freshness={freshness}>
              {freshness === 'updating' ? 'Updating…' : 'Up to date'}
            </span>
          )}
        </>
      );
    if (showCoach) {
      const note = `Read-only · ${USE_AS_DRAFT_HINT} it; your draft stays as it is`;
      // The whole note on hover, where a narrow window cuts it short.
      detail = (
        <span data-testid="state-bar-coach" role="note" className="text-role-candidate" title={note}>
          {note}
        </span>
      );
    }

    switch (shown.role) {
      case 'working':
        actions = (
          <>
            <button type="button" data-testid="state-bar-promote" className={PROMOTE}
              onClick={() => promote({ kind: 'working' })}
              title="Make this layout the new Active Layout">
              {lifecycleLabel('promote')}
            </button>
            <button
              ref={saveRef}
              type="button"
              data-testid="save-variant"
              className={KEEP}
              aria-haspopup="dialog"
              aria-expanded={saveAt !== null}
              onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setSaveAt(prev => (prev ? null : { x: r.left, y: r.bottom + 6 }));
              }}
              title="Keep this layout as a named variant, without changing the Active Layout"
            >
              {lifecycleLabel('save-variant')}
            </button>
            {saveAt && (
              <SaveVariantPopover
                x={saveAt.x}
                y={saveAt.y}
                defaultName={suggestVariantName(state.workingLayout?.name ?? state.activeLayout.name, state.savedVariants.map(v => v.name))}
                returnFocusTo={saveRef.current}
                onSave={saveVariant}
                onClose={() => setSaveAt(null)}
              />
            )}
            <button type="button" data-testid="state-bar-discard"
              className={`${SUBTLE} hover:!bg-red-900/30 hover:!text-red-300 hover:!border-red-500/30`}
              onClick={discard} title="Discard working changes">
              {lifecycleLabel('discard')}
            </button>
          </>
        );
        break;
      case 'active':
        actions = shown.readOnly ? backButton : null;
        break;
      case 'candidate': {
        const candidate = shown.candidate!;
        const kept = isCandidateSavedAsVariant(state, candidate);
        actions = (
          <>
            <span onClickCapture={finishCoach} className="contents">
              <UseAsDraftButton source={{ kind: 'candidate', id: candidate.id }} testId="state-bar-use" className={PRIMARY} />
            </span>
            <button type="button" data-testid="state-bar-promote" className={PROMOTE}
              onClick={() => promote({ kind: 'candidate', id: candidate.id })}
              title={`Make ${subject.chip} the new Active Layout`}>
              {lifecycleLabel('promote')}
            </button>
            <button type="button" data-testid="state-bar-keep" className={`${KEEP} disabled:opacity-60 disabled:cursor-default`} onClick={keepCandidate}
              disabled={kept}
              title={kept ? `${subject.chip} is kept as a Saved Layout Variant` : `Keep ${subject.chip} as a Saved Layout Variant, named after how it was made`}>
              {kept ? 'Kept' : lifecycleLabel('keep')}
            </button>
            {backButton}
          </>
        );
        break;
      }
      case 'variant':
        actions = (
          <>
            <UseAsDraftButton source={{ kind: 'variant', id: shown.layout.id }} testId="state-bar-use" className={PRIMARY} />
            <button type="button" data-testid="state-bar-promote" className={PROMOTE}
              onClick={() => promote({ kind: 'variant', id: shown.layout.id })}
              title={`Make "${subject.name}" the new Active Layout`}>
              {lifecycleLabel('promote')}
            </button>
            {backButton}
          </>
        );
        break;
      case 'recovered':
        actions = (
          <>
            <UseAsDraftButton source={{ kind: 'recovered', id: shown.layout.id }} testId="state-bar-use" className={PRIMARY} />
            {backButton}
          </>
        );
        break;
    }
  }

  const showHint = !!hint && !shown.readOnly && !replaying;
  return (
    <div
      data-testid="state-bar"
      data-role={subject.role}
      data-chip={subject.chip}
      data-name={subject.name}
      data-read-only={shown.readOnly || replaying ? 'true' : undefined}
      role="region"
      aria-label="Layout on screen"
      className={`w-full h-full flex items-center gap-2 px-2 rounded-pf-md border min-w-0 ${
        shown.role === 'candidate'
          ? 'border-role-candidate/40 bg-role-candidate/5'
          : shown.readOnly ? 'border-[var(--border-default)] bg-bg-card/60' : 'border-transparent'
      }`}
    >
      <SubjectChip
        subject={subject}
        detail={showHint ? undefined : detail || undefined}
        testId="state-bar-subject"
        className={showHint ? 'flex-shrink-0 max-w-[40%]' : 'flex-1'}
      />
      {showCoach && (
        <IconButton label="Got it" testId="state-bar-coach-dismiss" onClick={finishCoach}>
          <X size={12} />
        </IconButton>
      )}
      {showHint && <span className="flex-1 min-w-0 flex items-center">{hint}</span>}
      {actions && <span className="flex items-center gap-1.5 flex-shrink-0">{actions}</span>}
    </div>
  );
}
