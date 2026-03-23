/**
 * MoveTracePanel.
 *
 * Displays the move-by-move optimization trace from interpretable
 * optimizers (e.g., greedy hill climbing). Each move shows:
 * - Iteration number
 * - Move description (plain English)
 * - Cost before/after and delta
 * - Affected voice + pad
 *
 * Supports step-through mode with forward/back navigation.
 */

import { useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type OptimizerMove, type OptimizationIteration, type StopReason } from '../../../engine/optimization/optimizerInterface';

interface MoveTracePanelProps {
  moves?: OptimizerMove[] | null;
  trace?: OptimizationIteration[] | null;
  stopReason?: StopReason;
}

const STOP_REASON_LABELS: Record<StopReason, string> = {
  no_improving_move: 'Reached local minimum (no improving move found)',
  iteration_cap: 'Hit maximum iteration limit',
  local_minimum: 'Reached local minimum',
  infeasible_neighborhood: 'All neighboring moves violate constraints',
  completed: 'Optimization completed normally',
  aborted: 'Optimization was cancelled',
};

const PHASE_LABELS: Record<string, string> = {
  'init-layout': 'Layout Init',
  'init-fingers': 'Finger Init',
  'hill-climb': 'Hill Climb',
};

export function MoveTracePanel({ moves, trace, stopReason }: MoveTracePanelProps) {
  const { state, dispatch } = useProject();
  const [expandedMove, setExpandedMove] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);

  if (!moves?.length && !trace?.length) return null;

  const validTrace = trace ?? [];
  const validMoves = moves ?? [];
  const isUsingTrace = validTrace.length > 0;

  const filteredTrace = isUsingTrace
    ? (filterPhase ? validTrace.filter(t => t.phase === filterPhase) : validTrace)
    : [];

  const filteredMoves = !isUsingTrace
    ? (filterPhase ? validMoves.filter(m => m.phase === filterPhase) : validMoves)
    : [];

  const totalSteps = isUsingTrace ? filteredTrace.length : filteredMoves.length;

  const hillClimbMoves = isUsingTrace 
    ? validTrace.filter(t => t.phase === 'hill-climb')
    : validMoves.filter(m => m.phase === 'hill-climb');

  const initMoves = isUsingTrace
    ? validTrace.filter(t => t.phase === 'init-layout')
    : validMoves.filter(m => m.phase === 'init-layout');

  const totalImprovement = isUsingTrace
    ? (hillClimbMoves as OptimizationIteration[]).reduce((sum, t) => sum + Math.abs(t.netDelta), 0)
    : (hillClimbMoves as OptimizerMove[]).reduce((sum, m) => sum + Math.abs(m.costDelta), 0);

  // Phase counts
  const phaseCounts = {
    'init-layout': initMoves.length,
    'init-fingers': isUsingTrace 
      ? validTrace.filter(t => t.phase === 'init-fingers').length
      : validMoves.filter(m => m.phase === 'init-fingers').length,
    'hill-climb': hillClimbMoves.length,
  };

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h4 className="section-header">
          Optimization Trace
        </h4>
        <span className="text-pf-xs text-[var(--text-tertiary)]">
          {isUsingTrace ? validTrace.length : validMoves.length} step{(isUsingTrace ? validTrace.length : validMoves.length) !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="px-2 py-1.5 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Placements</div>
          <div className="text-pf-sm font-mono text-[var(--text-primary)]">{phaseCounts['init-layout']}</div>
        </div>
        <div className="px-2 py-1.5 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Improvements</div>
          <div className="text-pf-sm font-mono text-[var(--text-primary)]">{phaseCounts['hill-climb']}</div>
        </div>
        <div className="px-2 py-1.5 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-pf-micro text-[var(--text-tertiary)] uppercase">Cost Saved</div>
          <div className="text-pf-sm font-mono text-green-400">
            {totalImprovement > 0 ? `-${totalImprovement.toFixed(2)}` : '0'}
          </div>
        </div>
      </div>

      {/* Stop reason */}
      {stopReason && (
        <div className="text-pf-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
          {STOP_REASON_LABELS[stopReason] ?? stopReason}
        </div>
      )}

      {/* Phase filter */}
      <div className="flex gap-1">
        <FilterChip
          label="All"
          active={filterPhase === null}
          onClick={() => setFilterPhase(null)}
        />
        <FilterChip
          label="Init"
          count={phaseCounts['init-layout']}
          active={filterPhase === 'init-layout'}
          onClick={() => setFilterPhase(filterPhase === 'init-layout' ? null : 'init-layout')}
        />
        <FilterChip
          label="Hill Climb"
          count={phaseCounts['hill-climb']}
          active={filterPhase === 'hill-climb'}
          onClick={() => setFilterPhase(filterPhase === 'hill-climb' ? null : 'hill-climb')}
        />
      </div>

      {/* Step-through controls */}
      <div className="flex items-center gap-2">
        <button
          className="pf-btn-ghost px-2 py-1 text-pf-xs disabled:opacity-30"
          disabled={state.moveHistoryIndex === null || state.moveHistoryIndex <= 0}
          onClick={() => {
            const idx = state.moveHistoryIndex ?? 0;
            dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: Math.max(0, idx - 1) });
          }}
        >
          &larr; Prev
        </button>
        <span className="text-pf-xs text-[var(--text-tertiary)] flex-1 text-center truncate px-2">
          {state.moveHistoryIndex !== null
            ? `Step ${state.moveHistoryIndex + 1} / ${totalSteps}`
            : 'Click a iteration to trace logic on grid'}
        </span>
        <button
          className="pf-btn-ghost px-2 py-1 text-pf-xs disabled:opacity-30"
          disabled={state.moveHistoryIndex === null || state.moveHistoryIndex >= totalSteps - 1}
          onClick={() => {
            const idx = state.moveHistoryIndex ?? -1;
            dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: Math.max(0, Math.min(totalSteps - 1, idx + 1)) });
          }}
        >
          Next &rarr;
        </button>
        {state.moveHistoryIndex !== null && (
          <button
            className="pf-btn-ghost px-2 py-1 text-pf-xs"
            onClick={() => dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: null })}
          >
            Reset
          </button>
        )}
      </div>

      {/* Move list */}
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {isUsingTrace
          ? filteredTrace.map((iteration, idx) => (
              <TraceRow
                key={`trace-${idx}`}
                iteration={iteration}
                isActive={state.moveHistoryIndex === idx}
                isExpanded={expandedMove === idx}
                onClick={() => {
                  setExpandedMove(expandedMove === idx ? null : idx);
                  dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: idx });
                }}
              />
            ))
          : filteredMoves.map((move, idx) => (
              <MoveRow
                key={`move-${idx}`}
                move={move}
                isActive={state.moveHistoryIndex === idx}
                isExpanded={expandedMove === idx}
                onClick={() => {
                  setExpandedMove(expandedMove === idx ? null : idx);
                  dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: idx });
                }}
              />
            ))}
      </div>
    </div>
  );
}

function TraceRow({
  iteration,
  isActive,
  isExpanded,
  onClick,
}: {
  iteration: OptimizationIteration;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const deltaColor = iteration.netDelta < -0.01
    ? 'text-green-400'
    : iteration.netDelta > 0.01
      ? 'text-red-400'
      : 'text-[var(--text-tertiary)]';

  const phaseLabel = iteration.phase ? PHASE_LABELS[iteration.phase] ?? iteration.phase : '';

  return (
    <div
      className={`rounded-pf-sm px-2 py-1.5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-cyan-600/15 border border-cyan-500/30 ring-1 ring-cyan-500/50'
          : 'bg-[var(--bg-card)] border border-transparent hover:bg-[var(--bg-hover)]'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Phase badge */}
        {phaseLabel && (
          <span className={`text-pf-micro px-1 py-0.5 rounded-pf-sm ${
            iteration.phase === 'hill-climb' ? 'bg-blue-500/15 text-blue-400'
              : iteration.phase === 'init-layout' ? 'bg-purple-500/15 text-purple-400'
                : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]'
          }`}>
            {phaseLabel}
          </span>
        )}

        {/* Description */}
        <span className="text-pf-xs text-[var(--text-primary)] flex-1 truncate">
          {iteration.summary}
        </span>

        {/* Cost delta */}
        {iteration.netDelta !== 0 && (
          <span className={`text-pf-xs font-mono whitespace-nowrap ${deltaColor}`}>
            {iteration.netDelta < 0 ? '' : '+'}{iteration.netDelta.toFixed(3)}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] space-y-2 text-pf-xs">
          <div className="text-[var(--text-tertiary)] font-medium uppercase text-pf-micro">Move Evaluation Details</div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-[var(--bg-panel)] p-1.5 rounded-sm">
              <span className="text-[var(--text-tertiary)] block text-pf-micro">Cost Before</span>
              <span className="font-mono text-pf-xs text-amber-500/90">{iteration.scoreBefore.toFixed(2)}</span>
            </div>
            <div className="bg-[var(--bg-panel)] p-1.5 rounded-sm">
              <span className="text-[var(--text-tertiary)] block text-pf-micro">Cost After</span>
              <span className="font-mono text-pf-xs text-green-500/90">{iteration.scoreAfter.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="text-[var(--text-tertiary)] font-medium uppercase text-pf-micro mt-3 mb-1">Top Candidate Moves</div>
          <div className="space-y-1">
            {[...iteration.candidateMoves]
              .sort((a,b) => a.deltaTotal - b.deltaTotal)
              .slice(0, 4)
              .map((c, i) => (
              <div key={i} className={`flex items-center justify-between p-1 rounded-sm ${c.accepted ? 'bg-blue-500/10 text-blue-300' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
                <span className="truncate pr-2">{c.description}</span>
                <span className={`font-mono ${c.accepted ? 'font-bold' : ''}`}>
                  {c.deltaTotal < 0 ? '' : '+'}{c.deltaTotal.toFixed(2)}
                </span>
              </div>
            ))}
            {iteration.candidateMoves.length > 4 && (
              <div className="text-center text-pf-micro text-[var(--text-tertiary)] pt-1">
                + {iteration.candidateMoves.length - 4} more evaluated...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MoveRow({
  move,
  isActive,
  isExpanded,
  onClick,
}: {
  move: OptimizerMove;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const deltaColor = move.costDelta < -0.01
    ? 'text-green-400'
    : move.costDelta > 0.01
      ? 'text-red-400'
      : 'text-[var(--text-tertiary)]';

  const phaseLabel = move.phase ? PHASE_LABELS[move.phase] ?? move.phase : '';

  return (
    <div
      className={`rounded-pf-sm px-2 py-1.5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-cyan-600/15 border border-cyan-500/30'
          : 'bg-[var(--bg-card)] border border-transparent hover:bg-[var(--bg-hover)]'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Phase badge */}
        {phaseLabel && (
          <span className={`text-pf-micro px-1 py-0.5 rounded-pf-sm ${
            move.phase === 'hill-climb' ? 'bg-blue-500/15 text-blue-400'
              : move.phase === 'init-layout' ? 'bg-purple-500/15 text-purple-400'
                : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]'
          }`}>
            {phaseLabel}
          </span>
        )}

        {/* Description */}
        <span className="text-pf-xs text-[var(--text-primary)] flex-1 truncate">
          {move.description}
        </span>

        {/* Cost delta */}
        {move.costDelta !== 0 && (
          <span className={`text-pf-xs font-mono ${deltaColor}`}>
            {move.costDelta < 0 ? '' : '+'}{move.costDelta.toFixed(3)}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] space-y-1 text-pf-xs text-[var(--text-tertiary)]">
          {move.affectedVoice && (
            <div>Sound: <span className="text-[var(--text-secondary)]">{move.affectedVoice}</span></div>
          )}
          {move.affectedPad && (
            <div>Pad: <span className="text-[var(--text-secondary)]">{move.affectedPad}</span></div>
          )}
          <div>Reason: <span className="text-[var(--text-secondary)]">{move.reason}</span></div>
          {move.rejectedAlternatives != null && move.rejectedAlternatives > 0 && (
            <div>Alternatives considered: <span className="text-[var(--text-secondary)]">{move.rejectedAlternatives}</span></div>
          )}
          {move.costBefore > 0 && (
            <div>Cost: <span className="text-[var(--text-secondary)]">{move.costBefore.toFixed(2)} → {move.costAfter.toFixed(2)}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`px-2 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
        active
          ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-400'
          : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
      }`}
      onClick={onClick}
    >
      {label}{count != null ? ` (${count})` : ''}
    </button>
  );
}
