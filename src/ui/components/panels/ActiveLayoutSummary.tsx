/**
 * ActiveLayoutSummary.
 *
 * Right-column top section showing the current layout status, scores,
 * constraint satisfaction, and contextual event details when an event
 * is selected.
 */

import { useState, useMemo } from 'react';
import { useProject } from '../../state/ProjectContext';
import {
  getDisplayedCandidate,
  getDisplayedLayout,
  getDisplayedLayoutRole,
  getActiveStreams,
  getSelectedCandidate,
} from '../../state/projectState';
import { type FingerType, ALL_FINGERS } from '../../../types/fingerModel';
import { type ConstraintRelaxationSummary } from '../../../types/executionPlan';
import { CostBreakdownBars, FeasibilityBadge } from './CostBreakdownBars';
import { SelectedEventCard } from './SelectedEventCard';
import { findSelectedMoment } from '../../analysis/selectedMoment';
import { analysisScopeLine, planSoundIds } from '../../analysis/analysisScope';
import { EventCostChart } from './EventCostChart';
import { LearnMoreModal } from './LearnMoreModal';
import { buildSelectedTransitionModel } from '../../analysis/selectionModel';
import { scoreTile } from '../../analysis/planScore';
import { useLayoutAnalysis } from '../../analysis/layoutAnalysis';
import { formatFingerConstraint, parseFingerConstraint } from '../../../utils/fingerConstraints';
import { formatPadLocator, formatPadPosition } from '../../../utils/padPosition';
import { formatBarBeat, formatMilliseconds, formatSeconds } from '../../../utils/musicalTime';
import { SoundLabel } from '../shared/SoundLabel';
import { momentDifficultyCounts } from '../../analysis/momentCounts';

export function ActiveLayoutSummary() {
  const { state, dispatch } = useProject();
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const displayedLayout = getDisplayedLayout(state);
  const displayedCandidate = getDisplayedCandidate(state);
  const layoutRole = getDisplayedLayoutRole(state);
  const activeStreams = getActiveStreams(state);
  const currentPlan = displayedCandidate?.executionPlan;
  const assignments = currentPlan?.fingerAssignments;
  // The Score is the Playability of the layout the grid shows (S3.1), from the
  // one yardstick, whichever plan the panel is showing.
  const layoutScore = useLayoutAnalysis(getSelectedCandidate(state)?.layout ?? displayedLayout);

  // Selected event data
  const assignment = useMemo(() => {
    if (state.selectedEventIndex === null || !assignments) return null;
    return assignments.find(a => a.eventIndex === state.selectedEventIndex) ?? null;
  }, [state.selectedEventIndex, assignments]);

  // The selected event's whole moment, costed once (never summed per note).
  const selectedMoment = useMemo(
    () => findSelectedMoment(assignments, state.selectedEventIndex),
    [assignments, state.selectedEventIndex],
  );
  // The plan's own scope (see analysisScope.ts); the live scope when there is no plan.
  const scope = analysisScopeLine(
    state.soundStreams,
    displayedLayout,
    currentPlan ? planSoundIds(currentPlan.fingerAssignments) : undefined,
  );

  // Transition data
  const transition = useMemo(
    () => buildSelectedTransitionModel(assignments ?? null, state.selectedEventIndex),
    [assignments, state.selectedEventIndex],
  );

  // Event detail helpers
  // The event's Sound, by identity and never by pitch (invariant 5).
  const stream = assignment?.voiceId ? activeStreams.find(s => s.id === assignment.voiceId) ?? null : null;
  const padKey = assignment?.row !== undefined && assignment?.col !== undefined
    ? `${assignment.row},${assignment.col}`
    : null;
  const currentConstraint = padKey && displayedLayout ? displayedLayout.fingerConstraints[padKey] : undefined;
  const parsed = currentConstraint ? parseFingerConstraint(currentConstraint) : null;
  const effectiveHand = parsed?.hand ?? (assignment?.assignedHand === 'Unplayable' ? null : assignment?.assignedHand ?? null);
  const effectiveFinger = parsed?.finger ?? assignment?.finger ?? null;

  const handleSetConstraint = (hand: 'left' | 'right', finger: FingerType) => {
    if (!padKey) return;
    dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey, constraint: formatFingerConstraint(hand, finger) } });
  };

  const handleClearConstraint = () => {
    if (!padKey) return;
    dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey, constraint: null } });
  };

  const mappedCount = displayedLayout ? Object.keys(displayedLayout.padToVoice).length : 0;
  // Events are moments for both solvers (T23); a plan's own counts mix notes and moments.
  const counts = useMemo(() => momentDifficultyCounts(currentPlan?.fingerAssignments), [currentPlan]);

  return (
    <>
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="section-header">Layout Summary</h3>
            {state.analysisStale && !state.selectedCandidateId && currentPlan && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Analysis outdated" />
            )}
          </div>
          <button
            className="text-pf-xs text-[var(--accent-primary-soft)] hover:text-[var(--text-primary)] transition-colors"
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
              <QuickStat label="Score" testId="analysis-score" {...scoreTile(layoutScore)} />
              <QuickStat
                label="Events"
                value={String(counts.events)}
                subtitle={`${counts.events} events · ${counts.notes} notes`}
              />
              <QuickStat
                label="Hard"
                value={String(counts.hard)}
                quality={counts.hard === 0 ? 'good' : 'bad'}
                subtitle="Events that are hard to play"
              />
              <QuickStat
                label="Unplay"
                value={String(counts.unplayable)}
                quality={counts.unplayable === 0 ? 'good' : 'bad'}
                subtitle={`${counts.unplayable} events with a note that can't be played (${counts.unplayableNotes} of ${counts.notes} notes)`}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <QuickStat label="Mapped" value={`${mappedCount} pads`} />
                <QuickStat label="Sounds" value={String(activeStreams.length)} />
              </div>

              {/* No analysis means no claim: 'Unknown', never 'Feasible'. */}
              {mappedCount > 0 && <FeasibilityBadge pending={state.isProcessing} scope={scope} />}

              {/* An empty grid is not an unplayable layout — it is an unfinished one.
                  Say so; the grid's state bar offers the starting point (T44). */}
              {mappedCount === 0 && activeStreams.length > 0 && (
                <div data-testid="summary-nothing-placed" className="rounded-pf-sm border border-[var(--border-default)] bg-bg-card/60 p-2.5">
                  <p className="text-pf-xs text-[var(--text-secondary)] leading-relaxed">
                    No Sounds are on the grid yet, so there is nothing to analyse. Place {activeStreams.length === 1 ? 'your Sound' : `your ${activeStreams.length} Sounds`} by
                    clicking one and then a pad, or by dragging, or use Suggest a starting layout above the grid.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Three-layer cost breakdown: feasibility + ergonomics + difficulty */}
          {currentPlan && (
            <>
            <StructuralRulesStatus
              relaxation={currentPlan.constraintRelaxation}
              streams={activeStreams}
              hasFingerChoices={activeStreams.some(s => !!state.voiceConstraints[s.id]?.finger)}
            />

            <WhatIsLimitingThis
              constraints={displayedCandidate?.difficultyAnalysis?.bindingConstraints}
              infeasibleSounds={currentPlan.diagnostics?.infeasibleSounds}
              streams={activeStreams}
            />

            <CostBreakdownBars
              metrics={currentPlan.averageMetrics}
              diagnostics={currentPlan.diagnostics}
              hardCount={counts.hard}
              unplayableCount={counts.unplayable}
              mediumCount={counts.medium}
              unplayableNotes={counts.unplayableNotes}
              noteCount={counts.notes}
              events={counts.events}
              scope={scope}
            />

            {selectedMoment && (
              <SelectedEventCard selected={selectedMoment} tempo={state.tempo} scope={scope} />
            )}
            </>
          )}

          {/* Event difficulty chart (collapsible) */}
          {currentPlan && currentPlan.fingerAssignments.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-1"
                onClick={() => setChartOpen(!chartOpen)}
              >
                <span className="text-pf-micro" aria-hidden="true">{chartOpen ? '\u25BE' : '\u25B8'}</span>
                Event difficulty chart
              </button>
              {chartOpen && (
                <EventCostChart
                  fingerAssignments={currentPlan.fingerAssignments}
                  tempo={state.tempo}
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
                <h4 className="section-header">Selected note</h4>
                <button
                  className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
                >
                  Deselect
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <DetailChip label="Sound" value={stream?.name ?? 'Unknown Sound'} />
                <DetailChip label="Time" value={formatBarBeat(assignment.startTime, state.tempo)} title={formatSeconds(assignment.startTime)} />
                <DetailChip label="Pad" value={padKey ? formatPadPosition(padKey) : '—'} />
                <DetailChip
                  label="Hand"
                  value={effectiveHand ?? 'Unplayable'}
                  color={effectiveHand === 'left' ? 'text-blue-300' : effectiveHand === 'right' ? 'text-orange-300' : 'text-red-400'}
                />
                <DetailChip label="Finger" value={effectiveFinger ?? 'none'} />
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
                <DetailChip label="Gap" value={transition.timeDelta != null ? formatMilliseconds(transition.timeDelta) : '—'} />
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
                        {move.fromPad ? formatPadLocator(move.fromPad) : '—'} → {move.toPad ? formatPadLocator(move.toPad) : '—'}
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
              Analysis updates automatically as you place Sounds · <strong className="text-[var(--text-secondary)]">Generate</strong> proposes alternatives.
            </div>
          )}
        </div>
      </div>

      <LearnMoreModal open={learnMoreOpen} onClose={() => setLearnMoreOpen(false)} />
    </>
  );
}

function QuickStat({ label, value, quality, subtitle, wording = false, testId }: {
  label: string;
  value: string;
  quality?: 'good' | 'ok' | 'bad';
  subtitle?: string;
  /** The value is words ("Scoring…"), not a number: smaller, so it fits the tile. */
  wording?: boolean;
  testId?: string;
}) {
  const colors = {
    good: 'text-green-400 border-green-500/15 bg-green-500/5',
    ok: 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]',
    bad: 'text-red-400 border-red-500/15 bg-red-500/5',
  };
  const style = quality ? colors[quality] : 'text-[var(--text-primary)] border-[var(--border-default)] bg-[var(--bg-card)]';

  return (
    <div className={`px-2 py-1.5 rounded-pf-md border text-center ${style}`} title={subtitle} data-testid={testId}>
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className={wording ? 'text-pf-micro leading-[18px] text-[var(--text-secondary)] whitespace-nowrap' : 'text-pf-sm font-mono font-medium tabular-nums'}>{value}</div>
    </div>
  );
}

function DetailChip({ label, value, color, title }: { label: string; value: string; color?: string; title?: string }) {
  return (
    <div className="rounded-pf-sm border border-[var(--border-subtle)] bg-bg-card/60 px-2 py-1.5" title={title}>
      <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      <div className={`text-pf-xs font-medium ${color ?? 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}

/**
 * Whether the plan keeps the two structural rules — each hand on its own side
 * of the grid, and one finger per sound — and, if not, exactly where it gives way.
 *
 * The rules are hard: the engine breaks them only when no plan can keep them
 * (or when the user's own finger choice asks for it). Saying so up front is what
 * lets a user trust a clean plan, and find the few exceptions in a relaxed one
 * without scanning the timeline pill by pill.
 */
function StructuralRulesStatus({
  relaxation,
  streams,
  hasFingerChoices,
}: {
  relaxation?: ConstraintRelaxationSummary;
  streams: Array<{ id: string; name: string; color?: string }>;
  /** Whether the user set a finger for any sound — then that may be the cause. */
  hasFingerChoices: boolean;
}) {
  if (!relaxation) return null;

  if (relaxation.mode === 'strict') {
    return (
      <div
        className="text-pf-xs text-emerald-400/80 flex items-center gap-1.5"
        title="Each hand stays in its own zone (left: the left five columns, right: the right five) and every sound is played by one finger for the whole performance."
      >
        <span>{'\u2713'}</span>
        <span>Hands stay on their own side {'\u00b7'} one finger per sound</span>
      </div>
    );
  }

  return (
    <div className="rounded-pf-sm border border-violet-400/30 bg-violet-500/5 p-2.5 space-y-1.5">
      <div className="text-pf-xs font-semibold text-violet-300">
        Fingering rules relaxed
      </div>
      <p className="text-pf-xs text-[var(--text-tertiary)] leading-relaxed">
        No plan keeps both rules for this layout{hasFingerChoices ? ' with your finger choices' : ''}, so {relaxation.relaxedMomentCount === 1
          ? 'one moment breaks'
          : `${relaxation.relaxedMomentCount} moments break`} one. These strikes are outlined in the timeline.
      </p>
      <ul className="space-y-0.5">
        {relaxation.handZoneStrikes > 0 && (
          <li className="text-pf-xs text-[var(--text-secondary)]">
            Hand separation: {relaxation.handZoneStrikes} strike{relaxation.handZoneStrikes === 1 ? '' : 's'} outside the hand{'\u2019'}s zone
          </li>
        )}
        {relaxation.fingerOwnershipStrikes > 0 && (
          <li className="text-pf-xs text-[var(--text-secondary)]">
            One finger per sound: {relaxation.fingerOwnershipStrikes} strike{relaxation.fingerOwnershipStrikes === 1 ? '' : 's'} on another finger
          </li>
        )}
      </ul>
      <div className="pt-1 space-y-0.5">
        {relaxation.sounds.slice(0, 5).map(sound => {
          // Lead with the sound's own finger — the one to memorise — and list any
          // stand-ins after it, so "R3 + R2" can no longer hide which is the rule.
          const others = sound.fingersUsed.filter(f => f !== sound.ownerFinger);
          return (
            <div key={sound.soundId} className="flex justify-between gap-2 text-pf-xs">
              <SoundLabel id={sound.soundId} sounds={streams} className="text-[var(--text-secondary)]" />
              <span className="font-mono text-[var(--text-tertiary)] whitespace-nowrap">
                {sound.ownerFinger
                  ? <>
                      <span className="text-[var(--text-secondary)]" title={sound.ownerIsUserChoice ? 'Your finger choice for this sound' : 'This sound\u2019s own finger'}>
                        {sound.ownerFinger}{sound.ownerIsUserChoice ? '*' : ''}
                      </span>
                      {others.length > 0 ? ` \u2192 also ${others.join(', ')}` : ''}
                    </>
                  : sound.fingersUsed.join(' + ')}
                {sound.handZoneStrikes > 0 ? ` \u00b7 ${sound.handZoneStrikes} cross-zone` : ''}
                {sound.fingerOwnershipStrikes > 0 ? ` \u00b7 ${sound.fingerOwnershipStrikes} re-fingered` : ''}
              </span>
            </div>
          );
        })}
        {relaxation.sounds.length > 5 && (
          <div className="text-pf-xs text-[var(--text-quaternary)]">
            +{relaxation.sounds.length - 5} more sound{relaxation.sounds.length - 5 === 1 ? '' : 's'}
          </div>
        )}
        {relaxation.sounds.some(sound => sound.ownerIsUserChoice) && (
          <div className="text-pf-micro text-[var(--text-quaternary)]">* your finger choice</div>
        )}
      </div>
    </div>
  );
}

/**
 * "What is limiting this layout" — the engine's own plain-English reasons.
 *
 * The canon asks for event-level explanation, and the engine already produces
 * exactly the sentences a user can act on ("45 Hard events (94% of total) — grip
 * or stretch limit reached", "Average drift 3.7 — hands frequently far from home
 * positions"). None of it reached the screen: the user saw factor bars and a
 * score and had to infer the cause. Numbers say a layout is worse; these say why.
 */
function WhatIsLimitingThis({
  constraints,
  infeasibleSounds,
  streams,
}: {
  constraints?: string[];
  infeasibleSounds?: Array<{ soundId: string; violationCount: number; totalEvents: number }>;
  streams: Array<{ id: string; name: string; color?: string }>;
}) {
  const hasConstraints = constraints && constraints.length > 0;
  const hasSounds = infeasibleSounds && infeasibleSounds.length > 0;
  if (!hasConstraints && !hasSounds) return null;

  return (
    <div className="rounded-pf-sm border border-[var(--border-default)] bg-bg-card/50 p-2.5 space-y-1.5">
      <div className="text-pf-xs font-semibold text-[var(--text-secondary)]">
        What is limiting this layout
      </div>
      {hasConstraints && (
        <ul className="space-y-1">
          {constraints!.map((reason, i) => (
            <li key={i} className="text-pf-xs text-[var(--text-tertiary)] leading-relaxed flex gap-1.5">
              <span className="text-[var(--text-quaternary)]">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
      {hasSounds && (
        <div className="pt-1 space-y-0.5">
          <div className="text-pf-micro uppercase text-[var(--text-quaternary)]">
            Sounds that cannot be played
          </div>
          {infeasibleSounds!.slice(0, 5).map(entry => (
            <div key={entry.soundId} className="flex justify-between text-pf-xs">
              <SoundLabel id={entry.soundId} sounds={streams} className="text-[var(--text-secondary)]" />
              <span className="font-mono text-[var(--text-tertiary)]" title={`${entry.violationCount} of ${entry.totalEvents} notes can't be played`}>
                {entry.violationCount}/{entry.totalEvents}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
