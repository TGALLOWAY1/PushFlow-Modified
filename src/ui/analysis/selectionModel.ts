import { type FingerAssignment } from '../../types/executionPlan';
import { fingerLabel } from '../../utils/fingerNotation';
import { planNotesByEvent, resolveEventKey, type EventTimeline } from './eventTimeline';

export interface EventMoment {
  startTime: number;
  assignments: FingerAssignment[];
}

export interface TransitionFingerMove {
  hand: 'left' | 'right';
  finger: NonNullable<FingerAssignment['finger']>;
  /** "L2". */
  label: string;
  /**
   * The pad this finger last struck at or before the current event (S4.2,
   * T09), else the last pad its hand struck; null when neither has struck yet.
   */
  fromPad: string | null;
  toPad: string | null;
  /** The finger strikes the same pad again. */
  isHold: boolean;
  /** Whether fromPad is struck in the current event itself (the move happens right now). */
  fromCurrent: boolean;
  rawDistance?: number;
}

export interface SelectedTransitionModel {
  /** The current event's index in the timeline. */
  index: number;
  current: EventMoment;
  next: EventMoment | null;
  /** The next event the plan plays, by timeline index; null at the end. */
  nextIndex: number | null;
  previous: EventMoment | null;
  previousIndex: number | null;
  currentPadKeys: Set<string>;
  nextPadKeys: Set<string>;
  previousPadKeys: Set<string>;
  sharedPadKeys: Set<string>;
  fingerMoves: TransitionFingerMove[];
  currentOnlyAssignments: FingerAssignment[];
  nextOnlyAssignments: FingerAssignment[];
  timeDelta: number | null;
}

function distanceBetweenPads(a: string, b: string): number | undefined {
  const [aRow, aCol] = a.split(',').map(Number);
  const [bRow, bCol] = b.split(',').map(Number);
  if ([aRow, aCol, bRow, bCol].some(Number.isNaN)) return undefined;
  return Math.hypot(aRow - bRow, aCol - bCol);
}

function assignmentPadKey(assignment: FingerAssignment): string | null {
  if (assignment.row === undefined || assignment.col === undefined) return null;
  return `${assignment.row},${assignment.col}`;
}

type PlayedNote = FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']> };

function isPlayed(a: FingerAssignment): a is PlayedNote {
  return a.assignedHand !== 'Unplayable' && !!a.finger;
}

/**
 * The event the playhead is at: the last event the plan plays that starts at
 * or before `time`, or null before the first one (S4.2: during playback the
 * playhead drives the moment view).
 */
export function playheadEventIndex(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  time: number,
): number | null {
  const byEvent = planNotesByEvent(timeline, assignments);
  const { events } = timeline;
  let lo = 0;
  let hi = events.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.startTime <= time + 1e-6) { last = mid; lo = mid + 1; } else hi = mid - 1;
  }
  for (let i = last; i >= 0; i--) if (byEvent.has(i)) return i;
  return null;
}

/** The first event the plan plays after event `index` (or from the start when index is null). */
export function nextPlayedEventIndex(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  index: number | null,
): number | null {
  const byEvent = planNotesByEvent(timeline, assignments);
  for (let i = index === null ? 0 : index + 1; i < timeline.events.length; i++) if (byEvent.has(i)) return i;
  return null;
}

/**
 * Event `index` of the timeline, the next and the previous event the plan
 * plays, and the moves between them. Events are the timeline's (whole
 * moments, by eventKey), so a chord played a few ms apart is one event here as
 * everywhere. Each next strike's finger moves from the pad it last struck,
 * searching back from this event, else from its hand's last pad (T09), so a
 * finger that rests between strikes still shows where it comes from.
 * Null when the plan plays no note at that event.
 */
export function buildTransitionModelAt(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  index: number,
): SelectedTransitionModel | null {
  if (!assignments || assignments.length === 0) return null;
  const byEvent = planNotesByEvent(timeline, assignments);
  const at = (i: number): EventMoment | null => {
    const notes = byEvent.get(i);
    return notes ? { startTime: timeline.events[i]!.startTime, assignments: notes } : null;
  };
  const current = at(index);
  if (!current) return null;
  let nextIndex: number | null = null;
  for (let i = index + 1; i < timeline.events.length && nextIndex === null; i++) if (byEvent.has(i)) nextIndex = i;
  let previousIndex: number | null = null;
  for (let i = index - 1; i >= 0 && previousIndex === null; i--) if (byEvent.has(i)) previousIndex = i;
  const next = nextIndex === null ? null : at(nextIndex);
  const previous = previousIndex === null ? null : at(previousIndex);

  const padsOf = (moment: EventMoment | null) =>
    new Set((moment?.assignments ?? []).map(assignmentPadKey).filter((key): key is string => key !== null));
  const currentPadKeys = padsOf(current);
  const nextPadKeys = padsOf(next);
  const previousPadKeys = padsOf(previous);
  const sharedPadKeys = new Set([...currentPadKeys].filter(key => nextPadKeys.has(key)));

  // The last pad a finger (else its hand) struck, at or before this event.
  const lastPad = (hand: 'left' | 'right', finger: string): { pad: string; inCurrent: boolean } | null => {
    let handPad: { pad: string; inCurrent: boolean } | null = null;
    for (let i = index; i >= 0; i--) {
      const notes = byEvent.get(i);
      if (!notes) continue;
      for (const a of notes) {
        const pad = assignmentPadKey(a);
        if (!pad || !isPlayed(a) || a.assignedHand !== hand) continue;
        if (a.finger === finger) return { pad, inCurrent: i === index };
        if (!handPad) handPad = { pad, inCurrent: i === index };
      }
      // The hand's latest pad is known; keep looking back only for the finger's own.
    }
    return handPad;
  };

  const fingerMoves: TransitionFingerMove[] = (next?.assignments ?? []).filter(isPlayed).map(nextNote => {
    const toPad = assignmentPadKey(nextNote);
    const from = lastPad(nextNote.assignedHand, nextNote.finger);
    const fromPad = from?.pad ?? null;
    return {
      hand: nextNote.assignedHand,
      finger: nextNote.finger,
      label: fingerLabel(nextNote.assignedHand, nextNote.finger),
      fromPad,
      toPad,
      isHold: !!fromPad && !!toPad && fromPad === toPad,
      fromCurrent: !!from?.inCurrent,
      rawDistance: fromPad && toPad ? distanceBetweenPads(fromPad, toPad) : undefined,
    };
  });

  const currentOnlyAssignments = current.assignments.filter(assignment => {
    const key = assignmentPadKey(assignment);
    return !key || !nextPadKeys.has(key);
  });
  const nextOnlyAssignments = (next?.assignments ?? []).filter(assignment => {
    const key = assignmentPadKey(assignment);
    return !key || !currentPadKeys.has(key);
  });

  return {
    index,
    current,
    next,
    nextIndex,
    previous,
    previousIndex,
    currentPadKeys,
    nextPadKeys,
    previousPadKeys,
    sharedPadKeys,
    fingerMoves,
    currentOnlyAssignments,
    nextOnlyAssignments,
    timeDelta: next ? next.startTime - current.startTime : null,
  };
}

/**
 * The selected event (S4.1), the next and the previous event the plan plays,
 * and the moves between them (buildTransitionModelAt). Null when nothing is
 * selected or the plan plays no note at the selected event.
 */
export function buildSelectedTransitionModel(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  selectedMomentKey: string | null | undefined,
): SelectedTransitionModel | null {
  const event = resolveEventKey(timeline, selectedMomentKey);
  return event ? buildTransitionModelAt(timeline, assignments, event.index) : null;
}
