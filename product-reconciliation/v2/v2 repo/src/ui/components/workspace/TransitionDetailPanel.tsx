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

  const currentNotes = transition.current.assignments.map(a => a.noteNumber);
  const nextNotes = transition.next.assignments.map(a => a.noteNumber);
  const nextMetrics = transition.next.assignments[0]?.costBreakdown;
  const movementCount = transition.fingerMoves.filter(move => move.fromPad && move.toPad && !move.isHold).length;

  return (
    <div className="p-3 rounded-lg glass-panel space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-gray-500 font-medium">Selected Transition</h4>
        <span className="text-[10px] text-sky-300/80">
          {transition.timeDelta?.toFixed(3)}s
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <TransitionField label="Current" value={`t=${transition.current.startTime.toFixed(3)}s`} />
        <TransitionField label="Next" value={`t=${transition.next.startTime.toFixed(3)}s`} />
        <TransitionField label="Pads Held" value={String(transition.sharedPadKeys.size)} />
        <TransitionField label="Finger Moves" value={String(movementCount)} />
      </div>

      <div className="text-[10px] text-gray-400">
        Notes: {currentNotes.join(', ')} → {nextNotes.join(', ')}
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-gray-500">Finger Paths</span>
        {transition.fingerMoves.length === 0 ? (
          <div className="text-[11px] text-gray-600">No tracked finger movement.</div>
        ) : (
          <div className="space-y-1">
            {transition.fingerMoves.map(move => (
              <div key={`${move.hand}-${move.finger}-${move.fromPad}-${move.toPad}`} className="flex items-center justify-between text-[11px]">
                <span className={move.hand === 'left' ? 'text-blue-300' : 'text-orange-300'}>
                  {move.hand[0].toUpperCase()}-{move.finger.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-gray-400">
                  {move.fromPad ?? '—'} → {move.toPad ?? '—'}
                </span>
                <span className="text-gray-500 font-mono">
                  {move.isHold ? 'hold' : move.rawDistance?.toFixed(2) ?? 'new'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {nextMetrics && (
        <div className="pt-2 border-t border-gray-700/50 space-y-1">
          <span className="text-[10px] text-gray-500">Next-event pressure</span>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-400">
            <TransitionMetric label="Move" value={nextMetrics.movement} />
            <TransitionMetric label="Stretch" value={nextMetrics.stretch} />
            <TransitionMetric label="Drift" value={nextMetrics.drift} />
            <TransitionMetric label="Bounce" value={nextMetrics.bounce} />
            <TransitionMetric label="Fatigue" value={nextMetrics.fatigue} />
            <TransitionMetric label="Cross" value={nextMetrics.crossover} />
          </div>
        </div>
      )}
    </div>
  );
}

function TransitionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-700/60 bg-gray-900/40 px-2 py-1.5">
      <div className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-gray-200 font-medium">{value}</div>
    </div>
  );
}

function TransitionMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-gray-900/40 px-2 py-1">
      <div className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-gray-200 font-mono">{value.toFixed(2)}</div>
    </div>
  );
}
