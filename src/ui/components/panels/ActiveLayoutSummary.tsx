/**
 * ActiveLayoutSummary.
 *
 * Right-column top section showing the current layout status, scores,
 * constraint satisfaction, and contextual event details when an event
 * is selected.
 */

import { useState, useMemo } from 'react';
import { useProject } from '../../state/ProjectContext';
import { getDisplayedLayout, getDisplayedLayoutRole, getActiveStreams } from '../../state/projectState';
import { type FingerType, ALL_FINGERS } from '../../../types/fingerModel';
import { CostBreakdownBars } from './CostBreakdownBars';
import { EventCostChart } from './EventCostChart';
import { LearnMoreModal } from './LearnMoreModal';
import { buildSelectedTransitionModel } from '../../analysis/selectionModel';

/** Parse a constraint string like "L-Ix" into hand + finger. */
function parseConstraint(constraint: string): { hand: 'left' | 'right'; finger: FingerType } | null {
  const FINGER_MAP: Record<string, FingerType> = {
    Th: 'thumb', Ix: 'index', Md: 'middle', Rg: 'ring', Pk: 'pinky',
  };
  const match = constraint.match(/^([LR])-(\w+)$/);
  if (!match) return null;
  const hand = match[1] === 'L' ? 'left' as const : 'right' as const;
  const finger = FINGER_MAP[match[2]];
  if (!finger) return null;
  return { hand, finger };
}

/** Build a constraint string from hand + finger. */
function buildConstraintStr(hand: 'left' | 'right', finger: FingerType): string {
  const FINGER_ABBREV: Record<FingerType, string> = {
    thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
  };
  return `${hand === 'left' ? 'L' : 'R'}${FINGER_ABBREV[finger]}`;
}

export function ActiveLayoutSummary() {
  const { state, dispatch } = useProject();
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const displayedLayout = getDisplayedLayout(state);
  const layoutRole = getDisplayedLayoutRole(state);
  const activeStreams = getActiveStreams(state);
  const currentPlan = state.analysisResult?.executionPlan;
  const assignments = currentPlan?.fingerAssignments;

  // Selected event data
  const assignment = useMemo(() => {
    if (state.selectedEventIndex === null || !assignments) return null;
    return assignments.find(a => a.eventIndex === state.selectedEventIndex) ?? null;
  }, [state.selectedEventIndex, assignments]);

  // Transition data
  const transition = useMemo(
    () => buildSelectedTransitionModel(assignments ?? null, state.selectedEventIndex),
    [assignments, state.selectedEventIndex],
  );

  // Event detail helpers
  const stream = assignment ? activeStreams.find(s => s.originalMidiNote === assignment.noteNumber) : null;
  const padKey = assignment?.row !== undefined && assignment?.col !== undefined
    ? `${assignment.row},${assignment.col}`
    : null;
  const currentConstraint = padKey && displayedLayout ? displayedLayout.fingerConstraints[padKey] : undefined;
  const parsed = currentConstraint ? parseConstraint(currentConstraint) : null;
  const effectiveHand = parsed?.hand ?? (assignment?.assignedHand === 'Unplayable' ? null : assignment?.assignedHand ?? null);
  const effectiveFinger = parsed?.finger ?? assignment?.finger ?? null;

  const handleSetConstraint = (hand: 'left' | 'right', finger: FingerType) => {
    if (!padKey) return;
    dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey, constraint: buildConstraintStr(hand, finger) } });
  };

  const handleClearConstraint = () => {
    if (!padKey) return;
    dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey, constraint: null } });
  };

  const mappedCount = displayedLayout ? Object.keys(displayedLayout.padToVoice).length : 0;

  return (
    <>
      <div className="rounded-lg glass-panel flex flex-col overflow-hidden" style={{ maxHeight: '50vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Layout Summary</h3>
            {state.analysisStale && currentPlan && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
            )}
          </div>
          <button
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={() => setLearnMoreOpen(true)}
          >
            Learn more
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Layout identity */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-200 font-medium truncate">
              {displayedLayout?.name ?? 'No Layout'}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              layoutRole === 'working'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              {layoutRole === 'working' ? 'Draft' : 'Active'}
            </span>
          </div>

          {/* Quick stats */}
          {currentPlan ? (
            <div className="grid grid-cols-4 gap-1.5">
              <QuickStat
                label="Score"
                value={currentPlan.score.toFixed(1)}
                quality={currentPlan.score < 5 ? 'good' : currentPlan.score < 15 ? 'ok' : 'bad'}
              />
              <QuickStat
                label="Events"
                value={String(new Set(currentPlan.fingerAssignments.map(a => a.startTime)).size)}
              />
              <QuickStat
                label="Hard"
                value={String(currentPlan.hardCount)}
                quality={currentPlan.hardCount === 0 ? 'good' : 'bad'}
              />
              <QuickStat
                label="Unplay"
                value={String(currentPlan.unplayableCount)}
                quality={currentPlan.unplayableCount === 0 ? 'good' : 'bad'}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <QuickStat label="Mapped" value={`${mappedCount} pads`} />
              <QuickStat label="Sounds" value={String(activeStreams.length)} />
            </div>
          )}

          {/* Feasibility */}
          {currentPlan && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${
                currentPlan.unplayableCount === 0 ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-gray-400">
                {currentPlan.unplayableCount === 0
                  ? 'All events playable'
                  : `${currentPlan.unplayableCount} unplayable event${currentPlan.unplayableCount !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}

          {/* Cost breakdown bars */}
          {currentPlan && (
            <CostBreakdownBars metrics={currentPlan.averageMetrics} />
          )}

          {/* Event difficulty chart (collapsible) */}
          {currentPlan && currentPlan.fingerAssignments.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors mb-1"
                onClick={() => setChartOpen(!chartOpen)}
              >
                <span>{chartOpen ? '\u25BE' : '\u25B8'}</span>
                Event Difficulty Chart
              </button>
              {chartOpen && (
                <EventCostChart fingerAssignments={currentPlan.fingerAssignments} />
              )}
            </div>
          )}

          {/* ─── Selected Event Details ─────────────────────────── */}
          {assignment && (
            <div className="pt-2 border-t border-gray-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Selected Event</h4>
                <button
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                  onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
                >
                  Deselect
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <DetailChip label="Sound" value={stream?.name ?? `Note ${assignment.noteNumber}`} />
                <DetailChip label="Time" value={`${assignment.startTime.toFixed(3)}s`} />
                <DetailChip label="Pad" value={padKey ?? '—'} />
                <DetailChip
                  label="Hand"
                  value={effectiveHand ?? 'Unplayable'}
                  color={effectiveHand === 'left' ? 'text-blue-300' : effectiveHand === 'right' ? 'text-orange-300' : 'text-red-400'}
                />
                <DetailChip label="Finger" value={effectiveFinger ?? 'none'} />
                <DetailChip label="Cost" value={assignment.cost.toFixed(2)} />
              </div>

              {/* Finger constraint controls */}
              {padKey && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 w-10">Hand:</span>
                    <div className="flex gap-1">
                      {(['left', 'right'] as const).map(hand => (
                        <button
                          key={hand}
                          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                            effectiveHand === hand
                              ? hand === 'left' ? 'bg-blue-600/30 text-blue-300 border border-blue-500' : 'bg-orange-600/30 text-orange-300 border border-orange-500'
                              : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                          }`}
                          onClick={() => handleSetConstraint(hand, effectiveFinger ?? 'index')}
                        >
                          {hand === 'left' ? 'L' : 'R'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {ALL_FINGERS.map(finger => (
                        <button
                          key={finger}
                          className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                            effectiveFinger === finger
                              ? 'bg-gray-600 text-gray-200 border border-gray-500'
                              : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                          }`}
                          onClick={() => handleSetConstraint(effectiveHand ?? 'right', finger)}
                        >
                          {finger.slice(0, 2).toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {currentConstraint && (
                      <button
                        className="text-[9px] text-amber-400 hover:text-amber-300 ml-auto"
                        onClick={handleClearConstraint}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Transition Details ─────────────────────────────── */}
          {transition && transition.next && (
            <div className="pt-2 border-t border-gray-700/50 space-y-2">
              <h4 className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Transition</h4>
              <div className="grid grid-cols-4 gap-1.5">
                <DetailChip label="Delta" value={`${transition.timeDelta?.toFixed(3)}s`} />
                <DetailChip label="Holds" value={String(transition.sharedPadKeys.size)} />
                <DetailChip label="Moves" value={String(transition.fingerMoves.filter(m => m.fromPad && m.toPad && !m.isHold).length)} />
                <DetailChip label="Paths" value={String(transition.fingerMoves.length)} />
              </div>
              {transition.fingerMoves.length > 0 && (
                <div className="space-y-0.5">
                  {transition.fingerMoves.slice(0, 5).map(move => (
                    <div key={`${move.hand}-${move.finger}-${move.fromPad}-${move.toPad}`} className="flex items-center justify-between text-[10px]">
                      <span className={move.hand === 'left' ? 'text-blue-300' : 'text-orange-300'}>
                        {move.hand[0].toUpperCase()}-{move.finger.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-gray-500">
                        {move.fromPad ?? '—'} → {move.toPad ?? '—'}
                      </span>
                      <span className="text-gray-600 font-mono text-[9px]">
                        {move.isHold ? 'hold' : move.rawDistance?.toFixed(1) ?? 'new'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!currentPlan && !state.isProcessing && (
            <div className="text-[10px] text-gray-600 py-2 text-center">
              Assign sounds to pads, then <strong className="text-gray-400">Generate</strong> to analyze.
            </div>
          )}
        </div>
      </div>

      <LearnMoreModal open={learnMoreOpen} onClose={() => setLearnMoreOpen(false)} />
    </>
  );
}

function QuickStat({ label, value, quality }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
}) {
  const colors = {
    good: 'text-green-400 border-green-500/20 bg-green-500/5',
    ok: 'text-gray-300 border-gray-700 bg-gray-800/50',
    bad: 'text-red-400 border-red-500/20 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-gray-300 border-gray-700 bg-gray-800/50';

  return (
    <div className={`px-2 py-1 rounded border text-center ${style}`}>
      <div className="text-[8px] text-gray-500 uppercase">{label}</div>
      <div className="text-[11px] font-mono font-medium">{value}</div>
    </div>
  );
}

function DetailChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-gray-700/60 bg-gray-900/40 px-2 py-1">
      <div className="text-[8px] text-gray-500 uppercase">{label}</div>
      <div className={`text-[10px] font-medium ${color ?? 'text-gray-200'}`}>{value}</div>
    </div>
  );
}
