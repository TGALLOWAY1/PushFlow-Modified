/**
 * TransitionDetailPanel.
 *
 * Compact transition summary shown below EventDetailPanel when an event
 * is selected and a next event exists. Shows only the most useful info:
 * time gap, finger moves, and holds — no dense metrics grid.
 */

import { useMemo } from 'react';
import { useProject } from '../../state/ProjectContext';
import { buildSelectedTransitionModel } from '../../analysis/selectionModel';

export function TransitionDetailPanel() {
  const { state } = useProject();
  const assignments = state.analysisResult?.executionPlan.fingerAssignments ?? null;

  const transition = useMemo(
    () => buildSelectedTransitionModel(assignments, state.selectedEventIndex),
    [assignments, state.selectedEventIndex],
  );

  if (!transition || !transition.next) {
    return null;
  }

  const movementCount = transition.fingerMoves.filter(move => move.fromPad && move.toPad && !move.isHold).length;
  const holdCount = transition.fingerMoves.filter(move => move.isHold).length;

  return (
    <div className="px-3 py-2 rounded-lg glass-panel">
      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        <span className="text-gray-500 font-medium">Next event</span>
        <span className="text-sky-300/80 font-mono">{transition.timeDelta?.toFixed(3)}s</span>
        <span>{movementCount} move{movementCount !== 1 ? 's' : ''}</span>
        {holdCount > 0 && <span>{holdCount} hold{holdCount !== 1 ? 's' : ''}</span>}
        <span>{transition.sharedPadKeys.size} shared pad{transition.sharedPadKeys.size !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
