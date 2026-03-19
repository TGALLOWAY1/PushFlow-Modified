import { type FingerAssignment, type MomentAssignment } from '../../types/executionPlan';

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

export function buildEventMoments(assignments?: FingerAssignment[] | null): EventMoment[] {
  if (!assignments || assignments.length === 0) return [];

  const byTime = new Map<number, FingerAssignment[]>();
  for (const assignment of assignments) {
    const current = byTime.get(assignment.startTime) ?? [];
    current.push(assignment);
    byTime.set(assignment.startTime, current);
  }

  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startTime, groupedAssignments]) => ({
      startTime,
      assignments: groupedAssignments,
    }));
}

export function getMomentIndexForSelectedEvent(
  assignments: FingerAssignment[] | null | undefined,
  selectedEventIndex: number | null | undefined,
): number {
  if (!assignments || selectedEventIndex === null || selectedEventIndex === undefined) return -1;
  const selected = assignments.find(a => a.eventIndex === selectedEventIndex);
  if (!selected) return -1;
  return buildEventMoments(assignments).findIndex(moment => moment.startTime === selected.startTime);
}

export function buildSelectedTransitionModel(
  assignments: FingerAssignment[] | null | undefined,
  selectedEventIndex: number | null | undefined,
): SelectedTransitionModel | null {
  if (!assignments || assignments.length === 0 || selectedEventIndex === null || selectedEventIndex === undefined) {
    return null;
  }

  const moments = buildEventMoments(assignments);
  const momentIndex = getMomentIndexForSelectedEvent(assignments, selectedEventIndex);
  if (momentIndex < 0) return null;

  const current = moments[momentIndex];
  const next = moments[momentIndex + 1] ?? null;
  const previous = momentIndex > 0 ? moments[momentIndex - 1] : null;
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

// ============================================================================
// Moment-indexed selection (new canonical path)
// ============================================================================

/**
 * Build a transition model directly from MomentAssignment[] and a moment index.
 * This is the preferred path — no re-derivation of grouping needed.
 */
export function buildMomentTransitionModel(
  momentAssignments: MomentAssignment[] | null | undefined,
  selectedMomentIndex: number | null | undefined,
): SelectedTransitionModel | null {
  if (!momentAssignments || momentAssignments.length === 0 ||
      selectedMomentIndex === null || selectedMomentIndex === undefined ||
      selectedMomentIndex < 0 || selectedMomentIndex >= momentAssignments.length) {
    return null;
  }

  // Convert MomentAssignment to EventMoment for compatibility
  const toEventMoment = (ma: MomentAssignment): EventMoment => ({
    startTime: ma.startTime,
    assignments: ma.noteAssignments.map(na => ({
      noteNumber: na.noteNumber,
      voiceId: na.soundId,
      startTime: ma.startTime,
      assignedHand: na.hand,
      finger: na.finger,
      cost: ma.cost,
      costBreakdown: ma.costBreakdown,
      difficulty: ma.difficulty,
      row: na.row,
      col: na.col,
      padId: na.padId,
      eventKey: na.noteKey,
    })),
  });

  const current = toEventMoment(momentAssignments[selectedMomentIndex]);
  const next = selectedMomentIndex + 1 < momentAssignments.length
    ? toEventMoment(momentAssignments[selectedMomentIndex + 1])
    : null;
  const previous = selectedMomentIndex > 0
    ? toEventMoment(momentAssignments[selectedMomentIndex - 1])
    : null;

  const currentPadKeys = new Set(current.assignments.map(assignmentPadKey).filter((key): key is string => key !== null));
  const nextPadKeys = new Set((next?.assignments ?? []).map(assignmentPadKey).filter((key): key is string => key !== null));
  const previousPadKeys = new Set((previous?.assignments ?? []).map(assignmentPadKey).filter((key): key is string => key !== null));
  const sharedPadKeys = new Set([...currentPadKeys].filter(key => nextPadKeys.has(key)));

  const nextFingerAssignments = (next?.assignments ?? []).filter(
    a => a.assignedHand !== 'Unplayable' && a.finger,
  ) as Array<FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']> }>;

  const currentFingerAssignments = current.assignments.filter(
    a => a.assignedHand !== 'Unplayable' && a.finger,
  ) as Array<FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']> }>;

  const fingerMoves: TransitionFingerMove[] = nextFingerAssignments.map(nextAssignment => {
    const matchingCurrent = currentFingerAssignments.find(ca =>
      ca.assignedHand === nextAssignment.assignedHand &&
      ca.finger === nextAssignment.finger,
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

  const currentOnlyAssignments = current.assignments.filter(a => {
    const key = assignmentPadKey(a);
    return !key || !nextPadKeys.has(key);
  });
  const nextOnlyAssignments = (next?.assignments ?? []).filter(a => {
    const key = assignmentPadKey(a);
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
