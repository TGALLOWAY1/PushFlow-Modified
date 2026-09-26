/**
 * MoveTracePanel: how the candidate on screen was found (T33).
 *
 * Titled "How candidate B was found · Stopped: <reason>", it renders every
 * method's trace:
 * - Greedy: the move-by-move trace, with phase filtering (only phases that
 *   had steps), step-through replay on the grid and cost tracking. Each step's
 *   before, after and change agree and are said in words ("−44.3 cost ·
 *   better").
 * - Annealing: the cost and temperature over every iteration, with accepted
 *   moves (AnnealingTraceChart).
 * - Beam: a summary of the search (it keeps no step history).
 *
 * It is bound to project state: PerformanceWorkspace passes state.moveHistory,
 * state.iterationTrace, state.moveHistoryStopReason and state.traceSubject,
 * which the reducer keeps on the inspected candidate's trace, else the run's
 * candidate A's or the promoted candidate's. The replay step is
 * state.moveHistoryIndex, an index into the whole list.
 */

import { useId, useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type TraceSubject } from '../../state/projectState';
import { type OptimizerMove, type OptimizationIteration, type StopReason } from '../../../engine/optimization/optimizerInterface';
import { type BeamSearchSummary } from '../../../types/candidateSolution';
import { stopReasonText } from '../../analysis/stopReason';
import { strategyLabel } from '../../analysis/strategyLabels';
import { formatDuration } from '../../hooks/generationProgress';
import {
  PHASE_LABELS,
  costChange,
  hillClimbChange,
  phaseCounts,
  signedChange,
  startingCost,
  stepChange,
  traceSteps,
  type CostChange,
  type TracePhase,
  type TraceStep,
} from '../../analysis/traceSummary';
import { ToggleButton } from '../shared/ToggleButton';
import { AnnealingTraceChart } from './AnnealingTraceChart';

interface MoveTracePanelProps {
  moves?: OptimizerMove[] | null;
  trace?: OptimizationIteration[] | null;
  /** Why the run stopped ("Stopped: time limit reached"); unknown strings are shown as they are. */
  stopReason?: StopReason | string | null;
  /** Whose trace it is, and the rest of it (annealing snapshots, a beam summary): state.traceSubject. */
  subject?: TraceSubject | null;
}

export type TraceMethod = 'greedy' | 'annealing' | 'beam';

const BETTER = 'text-[var(--status-ok)]';
const WORSE = 'text-[var(--status-bad)]';

function tone(change: Pick<CostChange, 'direction'>): string {
  return change.direction === 'better' ? BETTER : change.direction === 'worse' ? WORSE : 'text-[var(--text-tertiary)]';
}

/** "How candidate B was found"; a trace with no candidate names none. */
export function traceTitle(letter: string | null | undefined): string {
  return letter ? `How candidate ${letter} was found` : 'How this layout was found';
}

export function MoveTracePanel({ moves, trace, stopReason, subject }: MoveTracePanelProps) {
  const titleId = useId();
  const steps = useMemo(() => traceSteps(moves, trace), [moves, trace]);
  const annealing = subject?.annealing?.length ? subject.annealing : null;
  const beam = subject?.beam ?? null;
  if (steps.length === 0 && !annealing && !beam) return null;
  const method: TraceMethod = steps.length > 0 ? 'greedy' : annealing ? 'annealing' : 'beam';

  return (
    <section
      data-testid="trace-panel"
      data-method={method}
      data-candidate-id={subject?.candidateId ?? undefined}
      aria-labelledby={titleId}
      className="space-y-2.5"
    >
      <h4 id={titleId} data-testid="trace-title" className="text-pf-sm font-semibold text-[var(--text-primary)] leading-snug">
        {traceTitle(subject?.letter)}
        {stopReason && (
          <>
            {' · '}
            <span data-testid="trace-stop-reason" className="font-normal text-[var(--text-secondary)]">{stopReasonText(stopReason)}</span>
          </>
        )}
      </h4>
      {method === 'greedy' && <GreedyTrace steps={steps} />}
      {method === 'annealing' && annealing && <AnnealingTraceChart trace={annealing} />}
      {method === 'beam' && beam && <BeamTrace beam={beam} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Greedy
// ---------------------------------------------------------------------------

function GreedyTrace({ steps }: { steps: TraceStep[] }) {
  const { state, dispatch } = useProject();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<TracePhase | null>(null);

  const phases = phaseCounts(steps);
  // A filter for a phase the trace no longer has shows everything.
  const filter = filterPhase && phases.some(p => p.phase === filterPhase) ? filterPhase : null;
  const visible = filter ? steps.filter(s => s.phase === filter) : steps;
  const climb = hillClimbChange(steps);
  const start = climb ? null : startingCost(steps);
  const replayable = steps.some(s => s.iteration);

  const index = state.moveHistoryIndex;
  const current = index !== null && index < steps.length ? index : null;
  const next = visible.find(s => current === null || s.index > current);
  const prev = [...visible].reverse().find(s => current !== null && s.index < current);
  const select = (i: number | null) => dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: i });

  return (
    <>
      <p data-testid="trace-summary" className="text-pf-xs text-[var(--text-secondary)]">
        {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        {climb && (
          <>
            {' · '}cost {climb.change.before} → {climb.change.after}{' · '}
            <span className={tone(climb.change)}>{climb.change.words}</span>
          </>
        )}
        {start !== null && <>{' · '}starting cost {costChange(start, start).after}</>}
      </p>

      {/* Phase filter: only phases that had steps, and only when there is a choice. */}
      {phases.length > 1 && (
        <div role="group" aria-label="Show the steps of one phase" className="flex flex-wrap gap-1" data-testid="trace-phases">
          <ToggleButton
            label={`All (${steps.length})`}
            pressed={filter === null}
            onPressedChange={() => setFilterPhase(null)}
            testId="trace-phase-all"
          />
          {phases.map(({ phase, count }) => (
            <ToggleButton
              key={phase}
              label={`${PHASE_LABELS[phase]} (${count})`}
              pressed={filter === phase}
              onPressedChange={on => setFilterPhase(on ? phase : null)}
              testId={`trace-phase-${phase}`}
            />
          ))}
        </div>
      )}

      {/* Step-through: a step of the iteration trace replays on the grid, read-only. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="pf-btn-ghost min-h-[24px] px-2 text-pf-xs disabled:opacity-30 focus-ring"
          disabled={!prev}
          onClick={() => prev && select(prev.index)}
        >
          &larr; Prev
        </button>
        <span data-testid="trace-step" className="text-pf-xs text-[var(--text-tertiary)] flex-1 text-center truncate px-1">
          {current !== null
            ? `Step ${current + 1} / ${steps.length}`
            : replayable ? 'Pick a step to replay it' : 'Pick a step for its details'}
        </span>
        <button
          type="button"
          className="pf-btn-ghost min-h-[24px] px-2 text-pf-xs disabled:opacity-30 focus-ring"
          disabled={!next}
          onClick={() => next && select(next.index)}
        >
          Next &rarr;
        </button>
        {current !== null && (
          <button
            type="button"
            data-testid="trace-exit-replay"
            className="pf-btn-ghost min-h-[24px] px-2 text-pf-xs focus-ring"
            onClick={() => select(null)}
            title="Show the layout on screen again (Esc)"
          >
            Exit replay
          </button>
        )}
      </div>

      <ol data-testid="trace-steps" className="max-h-[300px] overflow-y-auto space-y-1">
        {visible.map(step => (
          <StepRow
            key={step.index}
            step={step}
            active={current === step.index}
            expanded={expanded === step.index}
            showPhase={phases.length > 1}
            onClick={() => {
              setExpanded(expanded === step.index ? null : step.index);
              select(step.index);
            }}
          />
        ))}
      </ol>
    </>
  );
}

/** A step's change, or null for steps that carry no cost change (placement, finger setup). */
function changeOf(step: TraceStep): CostChange | null {
  if (step.phase === 'init-layout' || step.phase === 'init-fingers') return null;
  return stepChange(step.after, step.delta);
}

function StepRow({ step, active, expanded, showPhase, onClick }: {
  step: TraceStep;
  active: boolean;
  expanded: boolean;
  showPhase: boolean;
  onClick: () => void;
}) {
  const change = changeOf(step);
  return (
    <li
      data-testid="trace-row"
      data-step={step.index}
      data-active={active ? 'true' : undefined}
      className={`rounded-pf-sm border transition-colors ${
        active
          ? 'bg-cyan-600/15 border-cyan-500/30 ring-1 ring-cyan-500/50'
          : 'bg-[var(--bg-card)] border-transparent hover:bg-[var(--bg-hover)]'
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-current={active ? 'step' : undefined}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left focus-ring rounded-pf-sm"
        onClick={onClick}
      >
        {showPhase && step.phase && (
          <span className={`text-pf-micro px-1 py-0.5 rounded-pf-sm flex-shrink-0 ${
            step.phase === 'hill-climb' ? 'bg-blue-500/15 text-blue-300'
              : step.phase === 'init-layout' ? 'bg-purple-500/15 text-purple-300'
                : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
          }`}>
            {PHASE_LABELS[step.phase]}
          </span>
        )}
        <span className="text-pf-xs text-[var(--text-primary)] flex-1 truncate">{step.description}</span>
        {change && change.direction !== 'same' && (
          <span data-testid="trace-row-change" className={`text-pf-xs font-mono whitespace-nowrap ${tone(change)}`} title={change.words}>
            {change.change}
          </span>
        )}
      </button>
      {expanded && <StepDetail step={step} change={change} />}
    </li>
  );
}

function StepDetail({ step, change }: { step: TraceStep; change: CostChange | null }) {
  const move = step.move;
  const iteration = step.iteration;
  return (
    <div className="mx-2 mb-1.5 pt-1.5 border-t border-[var(--border-subtle)] space-y-1 text-pf-xs text-[var(--text-tertiary)]">
      {change && (
        <div data-testid="trace-row-cost">
          Cost <span className="font-mono text-[var(--text-secondary)]">{change.before} → {change.after}</span>
          {' · '}<span className={tone(change)}>{change.words}</span>
        </div>
      )}
      {step.phase === 'init-fingers' && Number.isFinite(step.after) && (
        <div>Starting cost <span className="font-mono text-[var(--text-secondary)]">{costChange(step.after, step.after).after}</span></div>
      )}
      {move?.affectedVoice && <div>Sound: <span className="text-[var(--text-secondary)]">{move.affectedVoice}</span></div>}
      {move?.affectedPad && <div>Pad: <span className="text-[var(--text-secondary)]">{move.affectedPad}</span></div>}
      {move?.reason && <div>Reason: <span className="text-[var(--text-secondary)]">{move.reason}</span></div>}
      {move?.rejectedAlternatives != null && move.rejectedAlternatives > 0 && (
        <div>Other moves considered: <span className="text-[var(--text-secondary)]">{move.rejectedAlternatives}</span></div>
      )}
      {iteration && iteration.candidateMoves.length > 0 && (
        <>
          <div className="text-[var(--text-tertiary)] font-medium">
            {step.phase === 'init-layout' ? 'Pads it weighed (lower placement score is better)' : 'Moves it weighed (change in cost)'}
          </div>
          <ul className="space-y-0.5">
            {[...iteration.candidateMoves]
              .sort((a, b) => a.deltaTotal - b.deltaTotal)
              .slice(0, 4)
              .map((c, i) => (
                <li key={i} className={`flex items-center justify-between gap-2 px-1 rounded-sm ${c.accepted ? 'bg-blue-500/10 text-blue-200' : 'text-[var(--text-secondary)]'}`}>
                  <span className="truncate">{c.accepted ? 'Chosen: ' : ''}{c.description}</span>
                  <span className="font-mono">
                    {step.phase === 'init-layout' ? c.deltaTotal.toFixed(2) : signedChange(c.deltaTotal)}
                  </span>
                </li>
              ))}
          </ul>
          {iteration.candidateMoves.length > 4 && (
            <div className="text-pf-micro">and {iteration.candidateMoves.length - 4} more</div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beam
// ---------------------------------------------------------------------------

function took(ms: number): string {
  return ms < 1000 ? 'under a second' : formatDuration(ms);
}

function BeamTrace({ beam }: { beam: BeamSearchSummary }) {
  return (
    <p data-testid="trace-beam" className="text-pf-xs text-[var(--text-secondary)] leading-relaxed">
      Beam search fingered {beam.noteCount} {beam.noteCount === 1 ? 'note' : 'notes'} on its starting layout
      ({strategyLabel(beam.layoutStrategy)}), keeping the {beam.beamWidth} best hand positions at each step, in{' '}
      {took(beam.wallClockMs)}. It searches fingerings for a fixed layout, so it has no step-by-step history.
    </p>
  );
}
