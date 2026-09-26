import { type FingerAssignment } from '../../types/executionPlan';
import { planNotesByEvent, resolveEventKey, type EventTimeline } from './eventTimeline';

export interface EventMoment {
  startTime: number;
  assignments: FingerAssignment[];
}

export interface TransitionFingerMove {
  hand: 'left' | 'right';
  finger: NonNullable<FingerAssignment['finger']>;
  fromPad: string | null;
  toPad: string | null;
  isHold: boolean;
  rawDistance?: number;
}

export interface SelectedTransitionModel {
  current: EventMoment;
  next: EventMoment | null;
  previous: EventMoment | null;
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

/**
 * The selected event (S4.1), the next and the previous event the plan plays,
 * and the moves between them. Events are the timeline's (whole moments, by
 * eventKey), so a chord played a few ms apart is one event here as everywhere.
 * Null when nothing is selected or the plan plays no note at the selected event.
 */
export function buildSelectedTransitionModel(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  selectedMomentKey: string | null | undefined,
): SelectedTransitionModel | null {
  const event = resolveEventKey(timeline, selectedMomentKey);
  if (!event || !assignments || assignments.length === 0) return null;
  const byEvent = planNotesByEvent(timeline, assignments);
  const at = (index: number): EventMoment | null => {
    const notes = byEvent.get(index);
    return notes ? { startTime: timeline.events[index]!.startTime, assignments: notes } : null;
  };
  const current = at(event.index);
  if (!current) return null;
  let next: EventMoment | null = null;
  for (let i = event.index + 1; i < timeline.events.length && !next; i++) next = at(i);
  let previous: EventMoment | null = null;
  for (let i = event.index - 1; i >= 0 && !previous; i--) previous = at(i);

  const currentPadKeys = new Set(current.assignments.map(assignmentPadKey).filter((key): key is string => key !== null));
  const nextPadKeys = new Set((next?.assignments ?? []).map(assignmentPadKey).filter((key): key is string => key !== null));
  const previousPadKeys = new Set((previous?.assignments ?? []).map(assignmentPadKey).filter((key): key is string => key !== null));
  const sharedPadKeys = new Set([...currentPadKeys].filter(key => nextPadKeys.has(key)));

  const nextFingerAssignments = (next?.assignments ?? []).filter(
    assignment => assignment.assignedHand !== 'Unplayable' && assignment.finger,
  ) as Array<FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']> }>;

  const currentFingerAssignments = current.assignments.filter(
    assignment => assignment.assignedHand !== 'Unplayable' && assignment.finger,
  ) as Array<FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']> }>;

  const fingerMoves: TransitionFingerMove[] = nextFingerAssignments.map(nextAssignment => {
    const matchingCurrent = currentFingerAssignments.find(currentAssignment =>
      currentAssignment.assignedHand === nextAssignment.assignedHand &&
      currentAssignment.finger === nextAssignment.finger,
    );

    const fromPad = matchingCurrent ? assignmentPadKey(matchingCurrent) : null;
    const toPad = assignmentPadKey(nextAssignment);
    return {
      hand: nextAssignment.assignedHand,
      finger: nextAssignment.finger,
      fromPad,
      toPad,
      isHold: !!fromPad && !!toPad && fromPad === toPad,
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
    current,
    next,
    previous,
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
