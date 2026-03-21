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

/** Parse a constraint string like "L2" or "L-Ix" (legacy) into hand + finger. */
function parseConstraint(constraint: string): { hand: 'left' | 'right'; finger: FingerType } | null {
  // "L2" format (canonical)
  const matchNum = constraint.match(/^([LlRr])([1-5])$/);
  if (matchNum) {
    const hand = matchNum[1].toUpperCase() === 'L' ? 'left' as const : 'right' as const;
    const fingerMap: Record<string, FingerType> = {
      '1': 'thumb', '2': 'index', '3': 'middle', '4': 'ring', '5': 'pinky',
    };
    return { hand, finger: fingerMap[matchNum[2]] };
  }
  // "L-Ix" format (legacy)
  const FINGER_MAP: Record<string, FingerType> = {
    Th: 'thumb', Ix: 'index', Md: 'middle', Rg: 'ring', Pk: 'pinky',
  };
  const matchDash = constraint.match(/^([LR])-(\w+)$/);
  if (matchDash) {
    const hand = matchDash[1] === 'L' ? 'left' as const : 'right' as const;
    const finger = FINGER_MAP[matchDash[2]];
    if (finger) return { hand, finger };
  }
  return null;
}

/** Build a constraint string from hand + finger in canonical "L2" format. */
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

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

  // All assignments for the selected event (for per-event cost breakdown)
  const selectedEventAssignments = useMemo(() => {
    if (state.selectedEventIndex === null || !assignments) return null;
    const selected = assignments.filter(a => a.eventIndex === state.selectedEventIndex);
    return selected.length > 0 ? selected : null;
  }, [state.selectedEventIndex, assignments]);

  // Per-event aggregated metrics
  const selectedEventMetrics = useMemo(() => {
    if (!selectedEventAssignments) return null;
    const metrics = {
      fingerPreference: 0,
      handShapeDeviation: 0,
      transitionCost: 0,
      handBalance: 0,
      constraintPenalty: 0,
      total: 0,
    };
    for (const a of selectedEventAssignments) {
      if (a.costBreakdown) {
        metrics.fingerPreference += a.costBreakdown.fingerPreference;
        metrics.handShapeDeviation += a.costBreakdown.handShapeDeviation;
        metrics.transitionCost += a.costBreakdown.transitionCost;
        metrics.handBalance += a.costBreakdown.handBalance;
        metrics.constraintPenalty += a.costBreakdown.constraintPenalty;
        metrics.total += a.costBreakdown.total;
      } else {
        metrics.transitionCost += a.cost;
        metrics.total += a.cost;
      }
    }
    return metrics;
  }, [selectedEventAssignments]);

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
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="section-header">Layout Summary</h3>
            {state.analysisStale && currentPlan && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
            )}
          </div>
          <button
            className="text-pf-xs text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors"
            onClick={() => setLearnMoreOpen(true)}
          >
            Learn more
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Layout identity */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                className="pf-input text-pf-sm font-medium w-40"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = nameDraft.trim();
                  if (trimmed && trimmed !== displayedLayout?.name) {
                    dispatch({ type: 'RENAME_LAYOUT', payload: { target: layoutRole === 'working' ? 'working' : 'active', name: trimmed } });
                  }
                  setEditingName(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
            ) : (
              <span
                className="text-pf-sm text-[var(--text-primary)] font-medium truncate editable-field transition-colors"
                onDoubleClick={() => {
                  setNameDraft(displayedLayout?.name ?? '');
                  setEditingName(true);
                }}
                title="Double-click to rename"
              >
                {displayedLayout?.name ?? 'No Layout'}
              </span>
            )}
            <span className={`pf-badge ${
              layoutRole === 'working'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
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

          {/* Three-layer cost breakdown: feasibility + ergonomics + difficulty */}
          {currentPlan && (
            <CostBreakdownBars
              metrics={selectedEventMetrics ?? currentPlan.averageMetrics}
              diagnostics={selectedEventMetrics ? undefined : currentPlan.diagnostics}
              hardCount={selectedEventMetrics ? undefined : currentPlan.hardCount}
              unplayableCount={selectedEventMetrics ? undefined : currentPlan.unplayableCount}
              eventLabel={selectedEventMetrics && state.selectedEventIndex !== null
                ? `Event ${state.selectedEventIndex + 1} (t=${assignment?.startTime.toFixed(3) ?? '?'}s)`
                : undefined}
            />
          )}

          {/* Event difficulty chart (collapsible) */}
          {currentPlan && currentPlan.fingerAssignments.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-1"
                onClick={() => setChartOpen(!chartOpen)}
              >
                <span className="text-[8px]">{chartOpen ? '\u25BE' : '\u25B8'}</span>
                Event Difficulty Chart
              </button>
              {chartOpen && (
                <EventCostChart
                  fingerAssignments={currentPlan.fingerAssignments}
                  selectedEventIndex={state.selectedEventIndex}
                  onEventClick={(idx) => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                />
              )}
            </div>
          )}

          {/* ─── Selected Event Details ─────────────────────────── */}
          {assignment && (
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="section-header">Selected Event</h4>
                <button
                  className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
                >
                  Deselect
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
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
                    <span className="text-pf-micro text-[var(--text-tertiary)] w-10">Hand:</span>
                    <div className="flex gap-1">
                      {(['left', 'right'] as const).map(hand => (
                        <button
                          key={hand}
                          className={`px-2 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
                            effectiveHand === hand
                              ? hand === 'left' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40' : 'bg-orange-600/20 text-orange-300 border border-orange-500/40'
                              : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-secondary)]'
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
                          className={`px-1.5 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
                            effectiveFinger === finger
                              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-strong)]'
                              : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-secondary)]'
                          }`}
                          onClick={() => handleSetConstraint(effectiveHand ?? 'right', finger)}
                        >
                          {finger.slice(0, 2).toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {currentConstraint && (
                      <button
                        className="text-pf-micro text-amber-400 hover:text-amber-300 ml-auto transition-colors"
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
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
              <h4 className="section-header">Transition</h4>
              <div className="grid grid-cols-4 gap-1.5">
                <DetailChip label="Delta" value={`${transition.timeDelta?.toFixed(3)}s`} />
                <DetailChip label="Holds" value={String(transition.sharedPadKeys.size)} />
                <DetailChip label="Moves" value={String(transition.fingerMoves.filter(m => m.fromPad && m.toPad && !m.isHold).length)} />
                <DetailChip label="Paths" value={String(transition.fingerMoves.length)} />
              </div>
              {transition.fingerMoves.length > 0 && (
                <div className="space-y-0.5">
                  {transition.fingerMoves.slice(0, 5).map(move => (
                    <div key={`${move.hand}-${move.finger}-${move.fromPad}-${move.toPad}`} className="flex items-center justify-between text-pf-xs">
                      <span className={move.hand === 'left' ? 'text-blue-300' : 'text-orange-300'}>
                        {move.hand[0].toUpperCase()}-{move.finger.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        {move.fromPad ?? '—'} → {move.toPad ?? '—'}
                      </span>
                      <span className="text-[var(--text-tertiary)] font-mono text-pf-micro">
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
            <div className="text-pf-xs text-[var(--text-tertiary)] py-4 text-center">
              Assign sounds to pads, then <strong className="text-[var(--text-secondary)]">Generate</strong> to analyze.
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
    good: 'text-green-400 border-green-500/15 bg-green-500/5',
    ok: 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]',
    bad: 'text-red-400 border-red-500/15 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]';

  return (
    <div className={`px-2 py-1.5 rounded-pf-md border text-center ${style}`}>
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className="text-pf-sm font-mono font-medium tabular-nums">{value}</div>
    </div>
  );
}

function DetailChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-pf-sm border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 px-2 py-1.5">
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className={`text-pf-xs font-medium ${color ?? 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}
