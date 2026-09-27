/**
 * Rehearse (S4.3b, T10): from "this moment is hard" straight to practising it.
 *
 * On an Events row, the docked inspector or a chart bar, Rehearse loops the
 * moment's bar and the next (on bar lines, rehearseRegion), sets the rehearse
 * speed (as written, 75% or 50%), selects the moment so Stop brings it back
 * and, when stopped, plays the loop from its start after a count-in: the one
 * set in the transport, or one bar when that is off. While playing it sets the
 * loop and the speed and carries on, from the loop's start when the playhead
 * is outside it, without counting in: the hands are already on the pads.
 *
 * The loop and speed are the project's rehearsal preferences (saved with it,
 * never analysis inputs or undo steps); the rehearse speed and the count-in
 * are for the session.
 */

import { useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { useTransport } from '../audio/TransportProvider';
import { rehearseRegion } from '../audio/transportMath';
import { type TimelineEvent } from '../analysis/eventTimeline';
import { formatBarRange } from '../../utils/musicalTime';

/** What Rehearse would do for an event. */
export interface RehearsePlan {
  region: { start: number; end: number };
  /** "bars 3–4" (or "bar 1" in a one-bar song). */
  bars: string;
  rate: number;
  /** The count-in a start from stopped gets: at least a bar. */
  countInBars: number;
}

/** "full speed" or "75%". */
export function rehearseSpeedWords(rate: number): string {
  return rate === 1 ? 'full speed' : `${Math.round(rate * 100)}%`;
}

/** The button's tooltip: what a click will do. */
export function rehearseTitle(plan: RehearsePlan, playing: boolean): string {
  const loop = `Loop ${plan.bars} at ${rehearseSpeedWords(plan.rate)}`;
  return playing ? `${loop}; playback carries on into the loop` : `${loop}, after a ${plan.countInBars}-bar count-in`;
}

export function useRehearse() {
  const { state, dispatch } = useProject();
  const transport = useTransport();
  const { tempo, rehearseRate, countInBars, isPlaying } = state;
  const { song } = transport;

  const planFor = useCallback((event: Pick<TimelineEvent, 'startTime'>, rate = rehearseRate): RehearsePlan => {
    const region = rehearseRegion(event.startTime, tempo, song);
    const bars = formatBarRange(region.start, region.end, tempo);
    return { region, bars: bars.charAt(0).toLowerCase() + bars.slice(1), rate, countInBars: Math.max(1, countInBars) };
  }, [tempo, song, rehearseRate, countInBars]);

  const rehearse = useCallback((event: TimelineEvent, rate = rehearseRate) => {
    const plan = planFor(event, rate);
    // The moment is the user's pick: the inspector shows it, and Stop comes back to it.
    dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
    dispatch({ type: 'SET_REHEARSE_RATE', payload: rate });
    transport.rehearse(plan.region, rate, plan.countInBars);
  }, [planFor, rehearseRate, dispatch, transport]);

  return { rehearse, planFor, rate: rehearseRate, playing: isPlaying };
}
