/**
 * The moment inspector, docked beside the grid (S4.2, T27). It replaces the
 * Selected event card the side panels showed.
 *
 * For the current moment (S4.3b: the selected event when stopped, the event at
 * the playhead while playing), under the plan of the layout on screen (the
 * state bar right above the grid and the dock names it; the scope line says
 * which Sounds the plan analysed):
 * - "Event 12 · 3.2.3" and its difficulty, costed once for the whole event;
 * - Prev hard / Next hard, Play from here and Rehearse, where they stay in
 *   view; while playing, Rehearse and a note that it follows the playhead;
 * - every strike, resolved by Sound id: the Sound, its finger ("L2") and its
 *   pad, and any Sound struck then that this layout doesn't place;
 * - one line on why it is as hard as it is, and one on the move to the next
 *   event (momentExplanation.ts);
 * - the five factors from FACTOR_META, or why it can't be played.
 */

import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { getDisplayedExecutionPlan, getInspectedLayout } from '../../state/projectState';
import { formatEventLabel, getEventTimeline, findSelectedEvent, resolveEventKey } from '../../analysis/eventTimeline';
import { useCurrentMoment } from '../../hooks/useCurrentMoment';
import { RehearseButton } from '../shared/RehearseButton';
import { buildSelectedTransitionModel } from '../../analysis/selectionModel';
import { explainMomentCost, explainMomentTransition } from '../../analysis/momentExplanation';
import { analysisScope, planSoundIds, scopeLineOf } from '../../analysis/analysisScope';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown } from '../../analysis/factorMeta';
import { sharedNamePrefix, withoutSharedPrefix } from '../../analysis/padLabels';
import { formatPadPosition } from '../../../utils/padPosition';
import { DifficultyBadge } from '../shared/DifficultyBadge';
import { HardEventStepper } from '../shared/HardEventStepper';
import { StrikeChip } from '../shared/StrikeChip';

export function MomentInspector() {
  const { state, dispatch } = useProject();
  const current = useCurrentMoment();
  const timeline = getEventTimeline(state);
  const plan = getDisplayedExecutionPlan(state);
  const assignments = plan?.fingerAssignments;
  const selected = useMemo(
    () => findSelectedEvent(timeline, assignments, current.key),
    [timeline, assignments, current.key],
  );
  const transition = useMemo(
    () => buildSelectedTransitionModel(timeline, assignments, current.key),
    [timeline, assignments, current.key],
  );
  const soundById = useMemo(() => new Map(state.soundStreams.map(s => [s.id, s])), [state.soundStreams]);
  const namePrefix = useMemo(() => sharedNamePrefix(state.soundStreams.map(s => s.name)), [state.soundStreams]);
  if (!selected) return null;

  const { event, notes, cost } = selected;
  const layout = getInspectedLayout(state);
  const scope = scopeLineOf(analysisScope(state.soundStreams, layout, assignments ? planSoundIds(assignments) : undefined));
  const why = explainMomentCost(cost);
  const nextEvent = transition?.nextIndex != null ? timeline.events[transition.nextIndex] ?? null : null;
  const factors = cost?.breakdown && cost.difficulty !== 'Unplayable' ? factorsFromBreakdown(cost.breakdown) : null;
  const max = factors ? Math.max(...FACTOR_KEYS.map(k => factors[k]), 0.01) : 1;

  // The transport's first window after Play includes its start (S4.3a), so
  // playing from the event itself sounds its notes (after the count-in set).
  const playFromHere = () => {
    dispatch({ type: 'SET_CURRENT_TIME', payload: event.startTime });
    dispatch({ type: 'SET_IS_PLAYING', payload: true });
  };
  // While playing, the event Stop will come back to: the user's pick, if any.
  const picked = current.following && !state.selectionFromPause ? resolveEventKey(timeline, state.selectedMomentKey) : null;

  return (
    <div
      data-testid="selected-event-card"
      data-following={current.following ? 'true' : undefined}
      role="group"
      aria-label={current.following ? 'Event at the playhead' : 'Selected event'}
      className="flex flex-col gap-2 min-w-0 border-t border-[var(--border-subtle)] pt-2"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <h3
            data-testid="selected-event-label"
            className="text-pf-sm font-semibold font-mono text-[var(--text-primary)] truncate"
            title={current.following ? 'The event at the playhead' : 'The selected event'}
          >
            {formatEventLabel(event, state.tempo)}
          </h3>
          <DifficultyBadge cost={cost} testId="moment-verdict" />
        </div>
        <div data-testid="verdict-scope" className="text-pf-micro text-[var(--text-tertiary)] truncate" title={scope}>{scope}</div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {current.following ? (
          // Playing: this follows the playhead with the grid (S4.3b, T10).
          <span data-testid="moment-playing-note" className="w-full text-pf-micro text-[var(--text-tertiary)]">
            {picked
              ? `Playing: this follows the playhead. Stop comes back to Event ${picked.index + 1}.`
              : 'Playing: this follows the playhead, and stays on the event where you stop.'}
          </span>
        ) : (
          <>
            <HardEventStepper testIdPrefix="dock" />
            <button
              type="button"
              data-testid="play-from-here"
              className="focus-ring inline-flex items-center gap-1 h-6 px-1.5 rounded-pf-sm border border-[var(--border-default)] bg-[var(--bg-card)] text-pf-micro font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title={`Play from ${formatEventLabel(event, state.tempo)}`}
              onClick={playFromHere}
            >
              <Play size={11} aria-hidden="true" />Play from here
            </button>
          </>
        )}
        <RehearseButton event={event} variant="split" testId="dock-rehearse" />
      </div>

      {/* Every strike, by Sound id: its finger and its pad. */}
      <ul data-testid="moment-strikes" aria-label="Strikes" className="flex flex-col gap-1">
        {event.soundIds.map(id => {
          const note = notes.find(n => n.voiceId === id) ?? null;
          const sound = soundById.get(id);
          const pad = note && note.row !== undefined && note.col !== undefined ? `${note.row},${note.col}` : null;
          return (
            <li key={id} data-testid="moment-strike" className="flex items-center justify-between gap-2 min-w-0">
              <StrikeChip sound={sound} shortName={sound ? withoutSharedPrefix(sound.name, namePrefix) : '?'} note={note} />
              <span className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
                {pad ? formatPadPosition(pad) : 'not placed'}
              </span>
            </li>
          );
        })}
      </ul>

      <p data-testid="moment-why" className="text-pf-xs text-[var(--text-secondary)] leading-snug">{why.text}</p>
      {transition && (
        <p data-testid="transition-preview" className="text-pf-xs text-[var(--text-tertiary)] leading-snug">
          {explainMomentTransition(transition, nextEvent ? `Event ${nextEvent.index + 1}` : null)}
        </p>
      )}

      {/* The five factors, from FACTOR_META (T20), for an event that plays. */}
      {factors && (
        <div className="flex flex-col gap-1" aria-label="Factors">
          {FACTOR_KEYS.map(key => {
            const meta = FACTOR_META[key];
            const value = factors[key];
            return (
              <div key={key} data-testid={`moment-factor-${key}`} className="flex items-center gap-1.5" title={meta.description}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                <span className="text-pf-micro text-[var(--text-secondary)] w-[76px] truncate">{meta.label}</span>
                <span className="flex-1 h-2 bg-[var(--bg-app)] rounded-pf-sm overflow-hidden">
                  <span
                    className="block h-full rounded-pf-sm"
                    style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`, backgroundColor: meta.color, opacity: 0.85 }}
                  />
                </span>
                <span className="text-pf-micro font-mono text-[var(--text-tertiary)] w-8 text-right">{value.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
