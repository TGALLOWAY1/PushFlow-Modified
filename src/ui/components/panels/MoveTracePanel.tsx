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
import { type OptimizerMove, type StopReason } from '../../../engine/optimization/optimizerInterface';

interface MoveTracePanelProps {
  moves: OptimizerMove[];
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

export function MoveTracePanel({ moves, stopReason }: MoveTracePanelProps) {
  const { state, dispatch } = useProject();
  const [expandedMove, setExpandedMove] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);

  if (moves.length === 0) return null;

  const filteredMoves = filterPhase
    ? moves.filter(m => m.phase === filterPhase)
    : moves;

  const hillClimbMoves = moves.filter(m => m.phase === 'hill-climb');
  const initMoves = moves.filter(m => m.phase === 'init-layout');
  const totalImprovement = hillClimbMoves.reduce((sum, m) => sum + Math.abs(m.costDelta), 0);

  // Phase counts
  const phaseCounts = {
    'init-layout': initMoves.length,
    'init-fingers': moves.filter(m => m.phase === 'init-fingers').length,
    'hill-climb': hillClimbMoves.length,
  };

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
          Optimization Trace
        </h4>
        <span className="text-[10px] text-gray-600">
          {moves.length} step{moves.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700">
          <div className="text-[9px] text-gray-500 uppercase">Placements</div>
          <div className="text-[11px] font-mono text-gray-300">{phaseCounts['init-layout']}</div>
        </div>
        <div className="px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700">
          <div className="text-[9px] text-gray-500 uppercase">Improvements</div>
          <div className="text-[11px] font-mono text-gray-300">{phaseCounts['hill-climb']}</div>
        </div>
        <div className="px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700">
          <div className="text-[9px] text-gray-500 uppercase">Cost Saved</div>
          <div className="text-[11px] font-mono text-green-400">
            {totalImprovement > 0 ? `-${totalImprovement.toFixed(2)}` : '0'}
          </div>
        </div>
      </div>

      {/* Stop reason */}
      {stopReason && (
        <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
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
          className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 disabled:opacity-30"
          disabled={state.moveHistoryIndex === null || state.moveHistoryIndex <= 0}
          onClick={() => {
            const idx = state.moveHistoryIndex ?? 0;
            dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: Math.max(0, idx - 1) });
          }}
        >
          &larr; Prev
        </button>
        <span className="text-[10px] text-gray-500">
          {state.moveHistoryIndex !== null
            ? `Step ${state.moveHistoryIndex + 1} / ${filteredMoves.length}`
            : 'Click a move to step through'}
        </span>
        <button
          className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 disabled:opacity-30"
          disabled={state.moveHistoryIndex === null || state.moveHistoryIndex >= filteredMoves.length - 1}
          onClick={() => {
            const idx = state.moveHistoryIndex ?? -1;
            dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: Math.min(filteredMoves.length - 1, idx + 1) });
          }}
        >
          Next &rarr;
        </button>
        {state.moveHistoryIndex !== null && (
          <button
            className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
            onClick={() => dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: null })}
          >
            Reset
          </button>
        )}
      </div>

      {/* Move list */}
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {filteredMoves.map((move, idx) => (
          <MoveRow
            key={idx}
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
      : 'text-gray-500';

  const phaseLabel = move.phase ? PHASE_LABELS[move.phase] ?? move.phase : '';

  return (
    <div
      className={`rounded px-2 py-1.5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-cyan-600/15 border border-cyan-500/30'
          : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Phase badge */}
        {phaseLabel && (
          <span className={`text-[9px] px-1 py-0.5 rounded ${
            move.phase === 'hill-climb' ? 'bg-blue-500/15 text-blue-400'
              : move.phase === 'init-layout' ? 'bg-purple-500/15 text-purple-400'
                : 'bg-gray-700 text-gray-500'
          }`}>
            {phaseLabel}
          </span>
        )}

        {/* Description */}
        <span className="text-[10px] text-gray-300 flex-1 truncate">
          {move.description}
        </span>

        {/* Cost delta */}
        {move.costDelta !== 0 && (
          <span className={`text-[10px] font-mono ${deltaColor}`}>
            {move.costDelta < 0 ? '' : '+'}{move.costDelta.toFixed(3)}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-700/50 space-y-1 text-[10px] text-gray-500">
          {move.affectedVoice && (
            <div>Sound: <span className="text-gray-400">{move.affectedVoice}</span></div>
          )}
          {move.affectedPad && (
            <div>Pad: <span className="text-gray-400">{move.affectedPad}</span></div>
          )}
          <div>Reason: <span className="text-gray-400">{move.reason}</span></div>
          {move.rejectedAlternatives != null && move.rejectedAlternatives > 0 && (
            <div>Alternatives considered: <span className="text-gray-400">{move.rejectedAlternatives}</span></div>
          )}
          {move.costBefore > 0 && (
            <div>Cost: <span className="text-gray-400">{move.costBefore.toFixed(2)} → {move.costAfter.toFixed(2)}</span></div>
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
      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
        active
          ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-400'
          : 'bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300'
      }`}
      onClick={onClick}
    >
      {label}{count != null ? ` (${count})` : ''}
    </button>
  );
}
