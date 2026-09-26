/**
 * EventsPanel: the Performance Events, for finding the hard ones (S4.2, T27).
 *
 * The project's events (everything struck at one instant), numbered and keyed
 * by the shared event timeline (S4.1), so a row is the same event on the grid,
 * the timeline and the chart. Every event is listed and selectable, including
 * one whose Sounds aren't placed yet ("—").
 *
 * - A row reads bar.beat.sub · each Sound struck (its colour and short name)
 *   with its finger ("L2") · a difficulty badge in the timeline's colours. The
 *   cost is in the tooltip.
 * - Rows sit under bar headers.
 * - Filter chips (All, Medium+, Hard, Unplayable) with their counts, and Prev
 *   and Next hard (Shift+←/→ from anywhere).
 * - A click anywhere on a row selects its event (SELECT_EVENT with its
 *   momentKey). One row at a time opens its five factors (aria-expanded).
 * - ↑/↓ and j/k step through the rows shown while focus is in the list.
 *
 * Costs come from the plan of the layout on screen (S3.2), which the
 * SubjectChip at the top names.
 */

import { useMemo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { type MomentCost } from '@/engine';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan } from '../state/projectState';
import { useInputHandler } from '../input/inputRegistry';
import { barNumber, formatBarBeat } from '../../utils/musicalTime';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown } from '../analysis/factorMeta';
import { formatEventLabel, getEventTimeline, planNotesByEvent, resolveEventKey, type TimelineEvent } from '../analysis/eventTimeline';
import { EVENTS_FILTERS, eventCostsOf, filterCounts, filterEvents, type EventsFilter } from '../analysis/eventDifficulty';
import { sharedNamePrefix, withoutSharedPrefix } from '../analysis/padLabels';
import { type FingerAssignment } from '../../types/executionPlan';
import { inspectedSubject } from '../state/layoutSubject';
import { useEventsNavigation } from './workspace/eventsNavigation';
import { SubjectChip } from './shared/SubjectChip';
import { ToggleButton } from './shared/ToggleButton';
import { DifficultyBadge, difficultyTitle } from './shared/DifficultyBadge';
import { HardEventStepper } from './shared/HardEventStepper';
import { StrikeChip, type StrikeSound } from './shared/StrikeChip';

// ─── Component ───────────────────────────────────────────────────────────────

export function EventsPanel() {
  const { state, dispatch } = useProject();
  const listRef = useRef<HTMLDivElement>(null);
  // The filter is the workspace's when there is one ("N need attention" sets it).
  const nav = useEventsNavigation();
  const [ownFilter, setOwnFilter] = useState<EventsFilter>('all');
  const filter = nav?.filter ?? ownFilter;
  const setFilter = nav?.setFilter ?? setOwnFilter;
  const [expanded, setExpanded] = useState<number | null>(null);

  const timeline = getEventTimeline(state);
  const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
  const costs = eventCostsOf(timeline, assignments);
  const notesByEvent = planNotesByEvent(timeline, assignments);
  const selectedIdx = resolveEventKey(timeline, state.selectedMomentKey)?.index ?? null;
  const shown = useMemo(() => filterEvents(timeline, costs, filter), [timeline, costs, filter]);
  const counts = useMemo(() => filterCounts(timeline, costs), [timeline, costs]);

  // Rows under their bar's header.
  const bars = useMemo(() => {
    const out: Array<{ bar: number; events: TimelineEvent[] }> = [];
    for (const event of shown) {
      const bar = barNumber(event.startTime, state.tempo);
      const last = out[out.length - 1];
      if (last && last.bar === bar) last.events.push(event);
      else out.push({ bar, events: [event] });
    }
    return out;
  }, [shown, state.tempo]);

  // Sounds by id, and the words every Sound's name starts with (T17).
  const soundById = useMemo(() => new Map(state.soundStreams.map(s => [s.id, s])), [state.soundStreams]);
  const namePrefix = useMemo(() => sharedNamePrefix(state.soundStreams.map(s => s.name)), [state.soundStreams]);

  const selectEvent = useCallback((event: TimelineEvent) => {
    dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
  }, [dispatch]);

  // ↑/↓ and j/k step through the rows shown while focus is in the list (the
  // input table's events-list-keys row; the listener skips selects, text
  // fields and menus). From an event the filter hides, they go to the nearest
  // row shown in that direction.
  useInputHandler('events-list-keys', e => {
    // Nothing while playing (T61 slice).
    if (state.isPlaying || shown.length === 0) return false;
    const down = e.key === 'ArrowDown' || e.key === 'j';
    const at = shown.findIndex(ev => ev.index === selectedIdx);
    let target: TimelineEvent | undefined;
    if (at >= 0) target = shown[Math.min(shown.length - 1, Math.max(0, at + (down ? 1 : -1)))];
    else if (selectedIdx === null) target = down ? shown[0] : shown[shown.length - 1];
    else target = down ? shown.find(ev => ev.index > selectedIdx) : [...shown].reverse().find(ev => ev.index < selectedIdx);
    if (target) selectEvent(target);
  });

  // Auto-scroll selected event row into view (V1 pattern)
  useEffect(() => {
    if (selectedIdx === null || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-moment-index="${selectedIdx}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx, filter]);

  if (timeline.events.length === 0) {
    return (
      <div className="py-6 text-center text-pf-sm text-[var(--text-tertiary)]">
        No events. Import MIDI or compose a pattern.
      </div>
    );
  }

  const strikesOf = (event: TimelineEvent) => {
    const notes = notesByEvent.get(event.index) ?? [];
    return event.soundIds.map(id => ({
      sound: soundById.get(id) as StrikeSound | undefined,
      note: notes.find(n => n.voiceId === id) ?? null,
    }));
  };

  return (
    <div className="space-y-1.5">
      {/* Whose costs these are (S3.2). */}
      <div className="flex items-center justify-between gap-2 px-1">
        <SubjectChip subject={inspectedSubject(state)} testId="events-subject" />
        {selectedIdx !== null && (
          <button
            type="button"
            className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0"
            onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
          >
            Deselect
          </button>
        )}
      </div>

      {/* Filter chips, with how many events each shows. */}
      <div role="group" aria-label="Show events" data-testid="events-filters" className="flex flex-wrap gap-1 px-1">
        {EVENTS_FILTERS.map(f => (
          <ToggleButton
            key={f.id}
            size="sm"
            pressed={filter === f.id}
            onPressedChange={() => setFilter(f.id)}
            label={`${f.label} ${counts[f.id]}`}
            title={f.description}
            testId={`events-filter-${f.id}`}
          />
        ))}
      </div>

      <div className="px-1">
        <HardEventStepper testIdPrefix="events" />
      </div>

      <div ref={listRef} data-input-scope="events" data-testid="events-list" className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 330px)' }}>
        {shown.length === 0 && (
          <p data-testid="events-none" className="py-4 text-center text-pf-xs text-[var(--text-tertiary)]">
            No {EVENTS_FILTERS.find(f => f.id === filter)!.label} events{assignments ? '' : ' yet: nothing is analysed'}.
          </p>
        )}
        {bars.map(({ bar, events }) => (
          <section key={bar} aria-label={`Bar ${bar}`} data-testid="events-bar">
            <h4 className="sticky top-0 z-10 bg-[var(--bg-panel)] px-2 pt-1.5 pb-0.5 text-pf-micro font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Bar {bar}
            </h4>
            <div className="space-y-0.5">
              {events.map(event => (
                <EventRow
                  key={event.key}
                  event={event}
                  tempo={state.tempo}
                  isSelected={selectedIdx === event.index}
                  cost={costs.get(event.index) ?? null}
                  strikes={strikesOf(event)}
                  namePrefix={namePrefix}
                  expanded={expanded === event.index}
                  onSelect={() => selectEvent(event)}
                  onToggleExpanded={() => setExpanded(prev => (prev === event.index ? null : event.index))}
                />
              ))}
            </div>
          </section>
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
  cost,
  strikes,
  namePrefix,
  expanded,
  onSelect,
  onToggleExpanded,
}: {
  event: TimelineEvent;
  tempo: number;
  isSelected: boolean;
  /** Null when the plan plays no note of this event (none of its Sounds is placed). */
  cost: MomentCost | null;
  strikes: Array<{ sound: StrikeSound | undefined; note: FingerAssignment | null }>;
  namePrefix: string;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
}) {
  const factorsId = useId();
  const breakdown = cost?.breakdown ?? null;
  const factors = breakdown ? factorsFromBreakdown(breakdown) : null;
  return (
    <div
      data-testid="event-row"
      data-event-index={event.index}
      className={`rounded-pf-md border transition-colors ${
        isSelected ? 'bg-blue-600/20 border-blue-500/40' : 'border-transparent hover:bg-[var(--bg-hover)]'
      }`}
    >
      <div className="flex items-center">
        <button
          type="button"
          data-moment-index={event.index}
          data-selected={isSelected ? 'true' : undefined}
          aria-current={isSelected ? 'true' : undefined}
          title={`${formatEventLabel(event, tempo)} · ${difficultyTitle(cost)}`}
          className="focus-ring flex-1 min-w-0 flex items-center gap-2 pl-2 pr-1 py-1.5 text-left rounded-pf-md"
          onClick={onSelect}
        >
          <span className={`text-pf-xs font-mono tabular-nums w-10 flex-shrink-0 ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {formatBarBeat(event.startTime, tempo)}
          </span>
          <span className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            {strikes.map(({ sound, note }, i) => (
              <StrikeChip
                key={sound?.id ?? i}
                sound={sound}
                shortName={sound ? withoutSharedPrefix(sound.name, namePrefix) : '?'}
                note={note}
              />
            ))}
          </span>
          <DifficultyBadge cost={cost} short testId="event-difficulty" />
        </button>
        {factors ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={factorsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} the factors of Event ${event.index + 1}`}
            title={expanded ? 'Hide the factors' : 'Show the five factors'}
            className="focus-ring w-6 h-6 mr-0.5 flex items-center justify-center flex-shrink-0 rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            onClick={() => { onSelect(); onToggleExpanded(); }}
          >
            <ChevronRight size={14} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-6 mr-0.5 flex-shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* The five factors, named and coloured by FACTOR_META (T20). */}
      {expanded && factors && (
        <div id={factorsId} data-testid="event-factors" className="ml-12 mr-2 mb-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-pf-micro">
          {FACTOR_KEYS.map(key => {
            const meta = FACTOR_META[key];
            return (
              <span key={key} className="contents">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]" title={meta.description}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="text-[var(--text-secondary)] font-mono text-right">{factors[key].toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
