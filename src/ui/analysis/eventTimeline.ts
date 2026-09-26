/**
 * One identity for each Performance Event (S4.1, T24).
 *
 * An event is everything struck at one instant: the notes within
 * MOMENT_EPSILON of the first (the shared groupIntoMoments). Events are
 * numbered and keyed over the performance the project analyses, meaning every
 * note of an unmuted Sound, placed or not. So "Event 12" and its momentKey name
 * the same instant on the grid, the Events list, the timeline and the chart,
 * under any solver's plan, whatever is placed, and across re-analysis. The
 * selection is stored as that key (state.selectedMomentKey) and resolved here.
 *
 * A plan's notes join their event by eventKey, which every solver copies from
 * the performance. A note the plan doesn't cover joins by time: a placeholder
 * pill for a muted (excluded) Sound, or a note with no eventKey.
 */

import { groupIntoMoments, summarizeMomentCost, type MomentCost } from '@/engine';
import { MOMENT_EPSILON } from '../../types/performanceEvent';
import { type FingerAssignment } from '../../types/executionPlan';
import { getActivePerformance, type ProjectState } from '../state/projectState';
import { formatBarBeat } from '../../utils/musicalTime';

export interface TimelineEvent {
  /** Position in the performance, 0-based; labels read index + 1. */
  index: number;
  /** Stable identity: the momentKey of its first note's time and its Sounds. */
  key: string;
  /** Its first note's start time, in seconds. */
  startTime: number;
  /** Its last note's start time (within MOMENT_EPSILON of startTime). */
  endTime: number;
  /** The eventKeys of its notes. */
  noteKeys: ReadonlySet<string>;
  noteCount: number;
}

export interface EventTimeline {
  events: readonly TimelineEvent[];
  byKey: ReadonlyMap<string, TimelineEvent>;
  /** Event by a note's eventKey. */
  byNoteKey: ReadonlyMap<string, TimelineEvent>;
}

interface TimelineNote {
  startTime: number;
  voiceId?: string;
  eventKey?: string;
}

export function buildEventTimeline(notes: readonly TimelineNote[]): EventTimeline {
  const byKey = new Map<string, TimelineEvent>();
  const byNoteKey = new Map<string, TimelineEvent>();
  const events = groupIntoMoments(notes).map(moment => {
    const noteKeys = new Set(moment.items.map(n => n.eventKey).filter((k): k is string => k !== undefined));
    const event: TimelineEvent = {
      index: moment.index,
      key: moment.key,
      startTime: moment.startTime,
      endTime: moment.items[moment.items.length - 1]!.startTime,
      noteKeys,
      noteCount: moment.items.length,
    };
    byKey.set(event.key, event);
    for (const k of noteKeys) byNoteKey.set(k, event);
    return event;
  });
  return { events, byKey, byNoteKey };
}

const timelines = new WeakMap<ProjectState['soundStreams'], EventTimeline>();

/** The project's events: the analysed performance (unmuted Sounds), grouped once per Sounds change. */
export function getEventTimeline(state: ProjectState): EventTimeline {
  let timeline = timelines.get(state.soundStreams);
  if (!timeline) {
    timeline = buildEventTimeline(getActivePerformance(state).events);
    timelines.set(state.soundStreams, timeline);
  }
  return timeline;
}

/** How far t is from the event's notes: 0 inside its span. */
function distanceTo(event: TimelineEvent, t: number): number {
  return t < event.startTime ? event.startTime - t : t > event.endTime ? t - event.endTime : 0;
}

/**
 * The event struck at time t (a note's start): the one whose notes lie within
 * MOMENT_EPSILON of t, the nearest if two do; none when no note is that close.
 */
export function eventAtTime(timeline: EventTimeline, t: number): TimelineEvent | null {
  const { events } = timeline;
  // The last event starting no later than t + epsilon. Starts are more than
  // epsilon apart and a span is at most epsilon long, so only it and the two
  // before it can come within epsilon of t.
  let lo = 0;
  let hi = events.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.startTime <= t + MOMENT_EPSILON) { last = mid; lo = mid + 1; } else hi = mid - 1;
  }
  let best: TimelineEvent | null = null;
  for (let i = last; i >= 0 && i >= last - 2; i--) {
    const d = distanceTo(events[i]!, t);
    if (d <= MOMENT_EPSILON && (!best || d < distanceTo(best, t))) best = events[i]!;
  }
  return best;
}

/**
 * The event a stored key names: that key, else the event at the key's time
 * (muting or unmuting a Sound changes which Sounds strike then), else none.
 */
export function resolveEventKey(timeline: EventTimeline, key: string | null | undefined): TimelineEvent | null {
  if (!key) return null;
  const exact = timeline.byKey.get(key);
  if (exact) return exact;
  const ms = Number(key.slice(0, key.indexOf(':')));
  return Number.isFinite(ms) ? eventAtTime(timeline, ms / 1000) : null;
}

/** The event a note belongs to: by its eventKey, else by its time. */
export function eventOfNote(timeline: EventTimeline, note: { eventKey?: string; startTime: number }): TimelineEvent | null {
  return (note.eventKey !== undefined ? timeline.byNoteKey.get(note.eventKey) : undefined)
    ?? eventAtTime(timeline, note.startTime);
}

const planIndexes = new WeakMap<readonly FingerAssignment[], { timeline: EventTimeline; byEvent: Map<number, FingerAssignment[]> }>();

/** A plan's notes by event index, in plan order. */
export function planNotesByEvent(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
): ReadonlyMap<number, FingerAssignment[]> {
  if (!assignments) return new Map();
  const hit = planIndexes.get(assignments);
  if (hit && hit.timeline === timeline) return hit.byEvent;
  const byEvent = new Map<number, FingerAssignment[]>();
  for (const a of assignments) {
    const event = eventOfNote(timeline, a);
    if (!event) continue;
    const list = byEvent.get(event.index);
    if (list) list.push(a); else byEvent.set(event.index, [a]);
  }
  planIndexes.set(assignments, { timeline, byEvent });
  return byEvent;
}

/** "Event 12 · 3.2.3": the one event label (decision Q7). */
export function formatEventLabel(event: Pick<TimelineEvent, 'index' | 'startTime'>, tempo: number): string {
  return `Event ${event.index + 1} · ${formatBarBeat(event.startTime, tempo)}`;
}

/** The selected event: its identity, the plan's notes in it, and their cost, read once for the event. */
export interface SelectedEvent {
  event: TimelineEvent;
  /** The plan's notes at this event; none when no Sound it strikes is analysed. */
  notes: FingerAssignment[];
  /** Null when the plan has no note here. */
  cost: MomentCost | null;
}

export function findSelectedEvent(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  selectedMomentKey: string | null | undefined,
): SelectedEvent | null {
  const event = resolveEventKey(timeline, selectedMomentKey);
  if (!event) return null;
  const notes = planNotesByEvent(timeline, assignments).get(event.index) ?? [];
  return { event, notes, cost: notes.length > 0 ? summarizeMomentCost(notes) : null };
}

/** The selected event of the plan on screen, for state-level readers. */
export function selectedEventOf(state: ProjectState, assignments: readonly FingerAssignment[] | null | undefined): SelectedEvent | null {
  return findSelectedEvent(getEventTimeline(state), assignments, state.selectedMomentKey);
}
