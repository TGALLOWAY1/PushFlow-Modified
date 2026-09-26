/**
 * EventsPanel.
 *
 * Temporal event navigator for the workspace: the project's Performance
 * Events (everything struck at one instant), numbered and keyed by the shared
 * event timeline (S4.1), so row 12 is Event 12 on the grid, the timeline and
 * the chart too. Every event is listed and selectable, including one whose
 * Sounds aren't placed yet (its cost reads "—").
 *
 * Selecting an event dispatches SELECT_EVENT with its momentKey; the grid, the
 * timeline and the chart read the same key. ↑/↓ and j/k step through the list
 * while focus is in it, and the selected row scrolls into view.
 *
 * Costs come from the plan of the layout on screen (S3.2), which the
 * SubjectChip at the top names.
 */

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan } from '../state/projectState';
import { summarizeMomentCost, type MomentCost } from '@/engine';
import { useInputHandler } from '../input/inputRegistry';
import { formatBarBeat } from '../../utils/musicalTime';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown } from '../analysis/factorMeta';
import { formatEventLabel, getEventTimeline, planNotesByEvent, resolveEventKey, type TimelineEvent } from '../analysis/eventTimeline';
import { inspectedSubject } from '../state/layoutSubject';
import { SubjectChip } from './shared/SubjectChip';

// ─── Component ───────────────────────────────────────────────────────────────

export function EventsPanel({
  onionSkin,
  onToggleOnionSkin,
}: {
  onionSkin: boolean;
  onToggleOnionSkin: () => void;
}) {
  const { state, dispatch } = useProject();
  const listRef = useRef<HTMLDivElement>(null);

  const timeline = getEventTimeline(state);
  const events = timeline.events;
  const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
  const selectedIdx = resolveEventKey(timeline, state.selectedMomentKey)?.index ?? null;

  const selectEvent = useCallback((event: TimelineEvent) => {
    dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
  }, [dispatch]);

  // ↑/↓ and j/k step through the list while focus is in it (the input table's
  // events-list-keys row; the listener skips selects, text fields and menus).
  useInputHandler('events-list-keys', e => {
    // Nothing while playing (T61 slice).
    if (state.isPlaying || events.length === 0) return false;
    const currentIdx = selectedIdx ?? -1;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      selectEvent(events[Math.min(currentIdx + 1, events.length - 1)]!);
    } else {
      selectEvent(events[Math.max(currentIdx - 1, 0)]!);
    }
  });

  // Auto-scroll selected event row into view (V1 pattern)
  useEffect(() => {
    if (selectedIdx === null || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-moment-index="${selectedIdx}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  // Per-event cost, read once per event: every note of an event carries the
  // whole event's cost, so summing them made a chord cost more per note it had.
  const eventCosts = useMemo(() => {
    const map = new Map<number, MomentCost>();
    for (const [index, notes] of planNotesByEvent(timeline, assignments)) map.set(index, summarizeMomentCost(notes));
    return map;
  }, [timeline, assignments]);

  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-pf-sm text-[var(--text-tertiary)]">
        No events. Import MIDI or compose a pattern.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Whose costs these are (S3.2). */}
      <div className="px-1 pb-0.5">
        <SubjectChip subject={inspectedSubject(state)} testId="events-subject" />
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-pf-xs text-[var(--text-tertiary)]">
          {events.length} events
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className={`w-5 h-5 flex items-center justify-center rounded-pf-sm transition-colors ${
              onionSkin ? 'text-sky-300 bg-sky-500/15' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            onClick={onToggleOnionSkin}
            title={onionSkin ? 'Disable onion skin' : 'Show previous/next event layers on grid'}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="3" />
              <circle cx="8" cy="8" r="5.5" opacity="0.5" />
              <circle cx="8" cy="8" r="7.5" opacity="0.25" />
            </svg>
          </button>
          {selectedIdx !== null && (
            <button
              className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
            >
              Deselect
            </button>
          )}
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-1 text-pf-micro font-mono text-[var(--text-tertiary)] uppercase tracking-wider border-b border-border-subtle/30">
        <span className="w-8 flex-shrink-0">#</span>
        <span className="flex-1">Position</span>
        <span className="flex-shrink-0 w-10 text-right">Cost</span>
        <span className="flex-shrink-0 w-8 text-right">Notes</span>
      </div>

      <div ref={listRef} data-input-scope="events" className="overflow-y-auto space-y-0.5" style={{ maxHeight: 'calc(100vh - 310px)' }}>
        {events.map(event => (
          <EventRow
            key={event.key}
            event={event}
            tempo={state.tempo}
            isSelected={selectedIdx === event.index}
            eventCost={eventCosts.get(event.index) ?? null}
            onClick={() => selectEvent(event)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EventRow({
  event,
  tempo,
  isSelected,
  eventCost,
  onClick,
}: {
  event: TimelineEvent;
  tempo: number;
  isSelected: boolean;
  /** Null when the plan plays no note of this event (none of its Sounds is placed). */
  eventCost: MomentCost | null;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const costBreakdown = eventCost?.breakdown ?? null;
  const unplayable = eventCost?.difficulty === 'Unplayable';

  // Cost severity colour, from the event's own difficulty level.
  const costColor = !eventCost
    ? 'text-[var(--text-tertiary)]'
    : eventCost.difficulty === 'Unplayable' || eventCost.difficulty === 'Hard'
      ? 'text-red-400'
      : eventCost.difficulty === 'Medium' ? 'text-amber-400' : 'text-green-400';

  return (
    <button
      data-moment-index={event.index}
      data-selected={isSelected ? 'true' : undefined}
      title={formatEventLabel(event, tempo)}
      className={`
        w-full text-left px-2 py-1.5 rounded-pf-md text-pf-sm transition-colors
        ${isSelected
          ? 'bg-blue-600/20 border border-blue-500/40 text-[var(--text-primary)]'
          : 'hover:bg-[var(--bg-hover)] border border-transparent text-[var(--text-secondary)]'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Event label */}
        <span className={`text-pf-xs font-mono w-8 flex-shrink-0 ${isSelected ? 'text-blue-300' : 'text-[var(--text-tertiary)]'}`}>
          {String(event.index + 1).padStart(2, '0')}
        </span>

        {/* Beat position */}
        <span className="text-pf-xs font-mono flex-1 text-[var(--text-secondary)]">
          {formatBarBeat(event.startTime, tempo)}
        </span>

        {/* Cost badge */}
        <span
          className={`text-pf-xs font-mono flex-shrink-0 w-10 text-right ${costBreakdown ? `cursor-pointer ${costColor}` : costColor}`}
          onClick={costBreakdown ? (e => { e.stopPropagation(); setExpanded(!expanded); }) : undefined}
          title={unplayable
            ? `${eventCost!.unplayableNoteCount} of ${eventCost!.noteCount} notes can't be played`
            : costBreakdown ? 'Cost of this event (once per event, not per note). Click for the breakdown'
              : eventCost ? 'No cost data' : 'Not analysed: none of its Sounds is placed'}
        >
          {unplayable ? '\u2717' : costBreakdown ? costBreakdown.total.toFixed(1) : '\u2014'}
        </span>

        {/* Note count badge */}
        <span
          className={`text-pf-xs flex-shrink-0 w-8 text-right ${
            event.noteCount > 3 ? 'text-amber-400' : 'text-[var(--text-tertiary)]'
          }`}
          title={`${event.noteCount} ${event.noteCount === 1 ? 'note' : 'notes'} struck together`}
        >
          {event.noteCount}
        </span>
      </div>

      {/* Expanded cost breakdown */}
      {expanded && costBreakdown && (
        <div className="mt-1 ml-10 grid grid-cols-2 gap-x-3 gap-y-0.5 text-pf-micro" onClick={e => e.stopPropagation()}>
          {/* The five factors, named and coloured by FACTOR_META (T20). */}
          {FACTOR_KEYS.map(key => {
            const meta = FACTOR_META[key];
            const value = factorsFromBreakdown(costBreakdown)[key];
            return (
              <span key={key} className="contents">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]" title={meta.description}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="text-[var(--text-secondary)] font-mono text-right">{value.toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}
