/**
 * The transport's time (S4.3a, T58): what plays, from where, and where the
 * playhead is at a given clock time. Pure: the transport engine
 * (transportEngine.ts), the look-ahead scheduler (lookaheadScheduler.ts) and
 * the timeline's ruler and loop bar all read it.
 *
 * Positions are transport seconds, the performance's own time (0 is bar 1).
 * Clock times are the audio clock's (AudioContext.currentTime) or, without
 * audio, the wall clock's, also in seconds. Speed scales transport time: one
 * clock second plays `rate` transport seconds.
 *
 * - Loop off plays from the playhead to the end of the song once, then stops.
 * - Loop on with a region plays into the region and repeats it; from at or
 *   past its end, it starts at the region's start.
 * - Loop on with no region repeats the whole song.
 */

import { barSeconds } from '../../utils/musicalTime';

export const BEATS_PER_BAR = 4;

/** Anything shorter than this is no loop region: a click on the loop strip, not a drag. */
export const MIN_LOOP_SECONDS = 0.05;

/**
 * The span the timeline draws and the transport plays: from the bar line at
 * or before the first note to the bar line at or after the last note's end,
 * at least one bar. With no notes, four bars from the start.
 */
export interface SongSpan {
  start: number;
  end: number;
}

interface TimedEvents {
  events: ReadonlyArray<{ startTime: number; duration: number }>;
}

export function songSpan(streams: readonly TimedEvents[], tempo: number): SongSpan {
  const bar = barSeconds(tempo);
  let min = Infinity;
  let max = -Infinity;
  for (const s of streams) {
    for (const e of s.events) {
      if (e.startTime < min) min = e.startTime;
      const end = e.startTime + e.duration;
      if (end > max) max = end;
    }
  }
  if (min === Infinity) { min = 0; max = bar * 4; }
  min = Math.floor(min / bar) * bar;
  max = Math.ceil(max / bar) * bar;
  if (max <= min) max = min + bar;
  return { start: min, end: max };
}

/** The loop settings as the project keeps them (rehearsal preferences, never analysis inputs). */
export interface LoopSettings {
  enabled: boolean;
  start: number | null;
  end: number | null;
}

/** The loop region, ordered, or null when there is none (or it is too short to be one). */
export function loopRegionOf(loop: Pick<LoopSettings, 'start' | 'end'>): { start: number; end: number } | null {
  if (loop.start === null || loop.end === null) return null;
  const start = Math.max(0, Math.min(loop.start, loop.end));
  const end = Math.max(loop.start, loop.end);
  return end - start >= MIN_LOOP_SECONDS ? { start, end } : null;
}

/** What a run plays: [start, end), repeating when `loops`. */
export interface PlayRegion {
  start: number;
  end: number;
  loops: boolean;
}

export function playRegion(song: SongSpan, loop: LoopSettings): PlayRegion {
  if (!loop.enabled) return { start: song.start, end: song.end, loops: false };
  const region = loopRegionOf(loop);
  return region ? { ...region, loops: true } : { start: song.start, end: song.end, loops: true };
}

/**
 * Where a run that starts at `position` begins. Never before the song's
 * start. Loop off: at or past the song's end it starts from the top. Loop on:
 * before the region it plays into it; at or past its end it starts at the
 * region's start.
 */
export function startPosition(position: number, region: PlayRegion, song: SongSpan): number {
  const at = Math.max(song.start, position);
  if (at >= region.end) return region.start;
  return at;
}

/** One play-through, from the clock time it starts. Changing anything mid-run starts a new run. */
export interface TransportRun {
  /** Clock time at which the transport is at `startPos` and starts to move. */
  anchorClock: number;
  startPos: number;
  rate: number;
  region: PlayRegion;
}

/**
 * One pass of a run: the first from startPos to the region's end, then (when
 * it loops) each repeat of the region. Clock times are exact for the pass's
 * ends; positions inside it are startPos + (clock - startClock) * rate.
 */
export interface Pass {
  index: number;
  startClock: number;
  endClock: number;
  startPos: number;
  endPos: number;
}

export function firstPass(run: TransportRun): Pass {
  return {
    index: 0,
    startClock: run.anchorClock,
    endClock: run.anchorClock + Math.max(0, run.region.end - run.startPos) / run.rate,
    startPos: run.startPos,
    endPos: run.region.end,
  };
}

/** The pass after `pass`, or null when the run doesn't loop. */
export function nextPass(run: TransportRun, pass: Pass): Pass | null {
  if (!run.region.loops) return null;
  const length = (run.region.end - run.region.start) / run.rate;
  return {
    index: pass.index + 1,
    startClock: pass.endClock,
    endClock: pass.endClock + length,
    startPos: run.region.start,
    endPos: run.region.end,
  };
}

/** The pass that holds clock time `clock` (the first pass before the run starts). */
export function passAt(run: TransportRun, clock: number): Pass | null {
  const first = firstPass(run);
  if (clock < first.endClock) return first;
  if (!run.region.loops) return null;
  const length = (run.region.end - run.region.start) / run.rate;
  if (!(length > 0)) return null;
  // Computed, not walked, so an hour of one-bar loops costs nothing; then
  // nudged, since a clock time exactly on a pass boundary may round either way.
  let index = Math.max(1, Math.floor((clock - first.endClock) / length) + 1);
  let startClock = first.endClock + (index - 1) * length;
  while (startClock > clock && index > 1) { index--; startClock -= length; }
  while (startClock + length <= clock) { index++; startClock += length; }
  return {
    index,
    startClock,
    endClock: startClock + length,
    startPos: run.region.start,
    endPos: run.region.end,
  };
}

export interface RunPosition {
  /** Transport position, inside the region once the run has reached it. */
  position: number;
  /** Loop off, and the run has played to the end. */
  ended: boolean;
  /** Which pass (0 = the first); counts the loop's repeats. */
  pass: number;
}

/** Where the run is at clock time `clock`. Before its anchor it waits at startPos. */
export function positionAt(run: TransportRun, clock: number): RunPosition {
  const at = Math.max(clock, run.anchorClock);
  const pass = passAt(run, at);
  if (!pass) return { position: run.region.end, ended: true, pass: 0 };
  const position = Math.min(pass.endPos, pass.startPos + (at - pass.startClock) * run.rate);
  return { position, ended: false, pass: pass.index };
}

// ─── Snapping (loop edges) ───────────────────────────────────────────────────

/** Loop edges snap to bars; Shift snaps to beats instead, and Alt leaves them free. */
export type SnapMode = 'bar' | 'beat' | 'free';

export function snapModeOf(modifiers: { shiftKey: boolean; altKey: boolean }): SnapMode {
  if (modifiers.altKey) return 'free';
  return modifiers.shiftKey ? 'beat' : 'bar';
}

/** The nearest bar or beat line to `time` (bar 1 starts at 0), or `time` itself when free; never negative. */
export function snapTime(time: number, tempo: number, mode: SnapMode): number {
  const t = Math.max(0, time);
  if (mode === 'free') return t;
  const step = mode === 'bar' ? barSeconds(tempo) : barSeconds(tempo) / BEATS_PER_BAR;
  return Math.round(t / step) * step;
}

/** `count` bars starting with the bar that holds `time` (a loop preset: "This bar", "Bars 2–3"). */
export function barsAt(time: number, tempo: number, count: number): { start: number; end: number } {
  const bar = barSeconds(tempo);
  const index = Math.floor(Math.max(0, time) / bar + 1e-6);
  return { start: index * bar, end: (index + count) * bar };
}
