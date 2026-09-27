/**
 * The moment view on the grid (S4.2, T09).
 *
 * Which pads the current event strikes and with which finger, and, as the
 * view asks, the next event's and the previous event's strikes, plus each next
 * strike's move from its finger's last pad. The current event is the selected
 * one while stopped; during playback it is the event at the playhead, so the
 * same overlay runs with the music (T10), and nothing else dims then.
 */

import { type FingerAssignment } from '../../types/executionPlan';
import { noteFinger, type NoteFinger } from '../../utils/fingerNotation';
import { type MomentView } from '../state/viewSettings';
import { planNotesByEvent, type EventTimeline } from './eventTimeline';
import {
  buildSelectedTransitionModel,
  buildTransitionModelAt,
  nextPlayedEventIndex,
  type TransitionFingerMove,
} from './selectionModel';

/** A strike's finger, or null when the note can't be played. */
export type PadStrike = NoteFinger | null;

export interface MomentOverlay {
  /** Pad → finger, for the current event's strikes. */
  now: ReadonlyMap<string, PadStrike>;
  /** The next event's strikes (the Now + Next and Prev · Now · Next views). */
  next: ReadonlyMap<string, PadStrike>;
  /** The previous event's strikes (Prev · Now · Next only). */
  prev: ReadonlyMap<string, PadStrike>;
  /** Each next strike's move from its finger's (or hand's) last pad; holds left out. */
  moves: TransitionFingerMove[];
  /** Whether every other pad dims: a selection while stopped, never during playback. */
  dimOthers: boolean;
}

function strikesOf(notes: readonly FingerAssignment[] | undefined): Map<string, PadStrike> {
  const map = new Map<string, PadStrike>();
  for (const a of notes ?? []) {
    if (a.row === undefined || a.col === undefined) continue;
    const key = `${a.row},${a.col}`;
    if (!map.has(key)) map.set(key, noteFinger(a));
  }
  return map;
}

function layered(
  now: readonly FingerAssignment[] | undefined,
  next: readonly FingerAssignment[] | undefined,
  prev: readonly FingerAssignment[] | undefined,
  moves: TransitionFingerMove[],
  view: MomentView,
  dimOthers: boolean,
): MomentOverlay {
  const showNext = view !== 'now';
  return {
    now: strikesOf(now),
    next: showNext ? strikesOf(next) : new Map(),
    prev: view === 'prev-now-next' ? strikesOf(prev) : new Map(),
    moves: showNext ? moves.filter(m => m.fromPad && m.toPad && !m.isHold) : [],
    dimOthers,
  };
}

/** Stopped: around the selected event; null when nothing is selected or it strikes no pad here. */
export function selectionOverlay(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  selectedMomentKey: string | null | undefined,
  view: MomentView,
): MomentOverlay | null {
  const model = buildSelectedTransitionModel(timeline, assignments, selectedMomentKey);
  if (!model || model.currentPadKeys.size === 0) return null;
  return layered(model.current.assignments, model.next?.assignments, model.previous?.assignments, model.fingerMoves, view, true);
}

/**
 * Playing: around the event at the playhead (`index`, from playheadEventIndex),
 * or before the first event only what comes next. No arrows while playing.
 */
export function playbackOverlayAt(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
  index: number | null,
  view: MomentView,
): MomentOverlay | null {
  if (index === null) {
    const first = nextPlayedEventIndex(timeline, assignments, null);
    if (first === null) return null;
    return layered([], planNotesByEvent(timeline, assignments).get(first), [], [], view, false);
  }
  const model = buildTransitionModelAt(timeline, assignments, index);
  if (!model) return null;
  return layered(model.current.assignments, model.next?.assignments, model.previous?.assignments, [], view, false);
}
