/**
 * The look-ahead scheduler (S4.3a, T58).
 *
 * Every tick (about every 25 ms) it schedules the hits and metronome clicks
 * due in the next `horizon` seconds of clock time (100 ms), each at its exact
 * clock time, so what you hear no longer depends on when a frame or a tick
 * happens to run.
 *
 * - Windows are half-open, [from, to), and each starts where the last one
 *   ended, so nothing plays twice and nothing falls between two windows.
 * - The first window after play, a seek or a loop wrap starts exactly at that
 *   position, so a chord on the downbeat always sounds, on every repeat.
 * - A tick so late that notes are already past (a main-thread stall longer
 *   than the horizon) skips them rather than firing them all at once.
 * - A run's count-in (S4.3b) is clicks before its anchor, the first of each
 *   bar accented; they sound whether or not the metronome is on.
 *
 * It knows nothing about audio: it calls its sink with clock times (the
 * engine's sink is RehearsalAudio), and it is driven by explicit tick(now)
 * calls, so tests run it against a fake clock.
 */

import { type RehearsalHit } from './rehearsalAudio';
import { BEATS_PER_BAR, countInStart, firstPass, nextPass, passAt, type Pass, type TransportRun } from './transportMath';

export interface SchedulerSink {
  /** A hit of `soundId` at clock time `when` (MIDI velocity 0–127). */
  hit(soundId: string, when: number, velocity: number): void;
  /** A metronome click at clock time `when`; the first beat of a bar is a downbeat. */
  click(when: number, downbeat: boolean): void;
}

/** What there is to play. */
export interface SchedulerMaterial {
  /** Every audible hit, sorted by time (transport seconds). */
  hits: readonly RehearsalHit[];
  tempo: number;
  hitsOn: boolean;
  clicksOn: boolean;
}

export interface SchedulerOptions {
  /** How far ahead of `now` each tick schedules, in seconds. */
  horizon: number;
  /** A sound due more than this long ago is skipped, not played late. */
  lateTolerance: number;
}

export const SCHEDULER_TICK_MS = 25;
export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = { horizon: 0.1, lateTolerance: 0.03 };

export class LookaheadScheduler {
  private run: TransportRun | null = null;
  private pass: Pass | null = null;
  /** Clock time up to which sounds are scheduled; the next window starts here. */
  private scheduledUntil = 0;
  /** Sounds skipped because their tick came too late (see lateTolerance). */
  skipped = 0;

  constructor(
    private readonly sink: SchedulerSink,
    private material: SchedulerMaterial,
    private readonly options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
  ) {}

  /**
   * Starts scheduling `run`: from its first count-in click, or its anchor
   * when it has none, so the first window after the anchor starts exactly at
   * run.startPos. Never from before `from` (the engine passes the clock time
   * now): a count-in carried over mid-way skips the clicks already past rather
   * than counting them as late.
   */
  start(run: TransportRun, from = -Infinity): void {
    this.run = run;
    this.pass = firstPass(run);
    this.scheduledUntil = Math.min(run.anchorClock, Math.max(countInStart(run), from));
  }

  stop(): void {
    this.run = null;
    this.pass = null;
  }

  get isRunning(): boolean {
    return this.run !== null;
  }

  /** New material; it applies from the next window. The engine rewinds after cancelling what was scheduled. */
  setMaterial(material: SchedulerMaterial): void {
    this.material = material;
  }

  /**
   * Schedules again from clock time `from`: the audio has cancelled every
   * sound due at or after it (a change of material mid-run).
   */
  rewind(from: number): void {
    if (!this.run) return;
    const at = Math.max(from, countInStart(this.run));
    this.pass = passAt(this.run, Math.max(at, this.run.anchorClock));
    this.scheduledUntil = at;
  }

  /** Schedules everything due in [the last window's end, now + horizon). */
  tick(now: number): void {
    const run = this.run;
    if (!run) return;
    const to = now + this.options.horizon;
    let from = this.scheduledUntil;
    // The count-in's clicks come before the anchor, where the run's passes start.
    if (run.countIn && from < run.anchorClock) {
      const end = Math.min(to, run.anchorClock);
      this.emitCountIn(run, from, end, now);
      from = end;
    }
    while (from < to && this.pass) {
      const pass = this.pass;
      if (from >= pass.endClock) {
        // This pass is done: the next repeat, or nothing more when the run doesn't loop.
        this.pass = nextPass(run, pass);
        continue;
      }
      const end = Math.min(to, pass.endClock);
      // Exact positions at the pass's own ends, so a note on the loop's start
      // is always in and a note on its end never is.
      const posFrom = from === pass.startClock ? pass.startPos : pass.startPos + (from - pass.startClock) * run.rate;
      const posTo = end === pass.endClock ? pass.endPos : pass.startPos + (end - pass.startClock) * run.rate;
      this.emit(pass, posFrom, posTo, now);
      from = end;
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, Math.min(to, from));
  }

  /** Whether a sound due at `when` is too late to play at `now`; counts it as skipped if so. */
  private late(when: number, now: number): boolean {
    if (when >= now - this.options.lateTolerance) return false;
    this.skipped++;
    return true;
  }

  /** Emits the count-in clicks due in clock times [from, to): the first of each bar is a downbeat. */
  private emitCountIn(run: TransportRun, from: number, to: number, now: number): void {
    const { beats, beatClock } = run.countIn!;
    const first = countInStart(run);
    // The epsilon keeps a click that falls exactly on `from` in this window.
    for (let k = Math.max(0, Math.ceil((from - first) / beatClock - 1e-9)); k < beats; k++) {
      const when = first + k * beatClock;
      if (when >= to) break;
      if (when < from) continue;
      if (!this.late(when, now)) this.sink.click(when, k % BEATS_PER_BAR === 0);
    }
  }

  /** Emits the hits and clicks with positions in [posFrom, posTo) of `pass`. */
  private emit(pass: Pass, posFrom: number, posTo: number, now: number): void {
    const run = this.run!;
    const clockOf = (position: number) => pass.startClock + (position - pass.startPos) / run.rate;
    const late = (when: number) => this.late(when, now);
    const { hits, tempo, hitsOn, clicksOn } = this.material;
    if (hitsOn) {
      for (let i = firstIndexAtOrAfter(hits, posFrom); i < hits.length && hits[i]!.time < posTo; i++) {
        const hit = hits[i]!;
        const when = clockOf(hit.time);
        if (!late(when)) this.sink.hit(hit.soundId, when, hit.velocity ?? 100);
      }
    }
    if (clicksOn && tempo > 0) {
      const beat = 60 / tempo;
      // The epsilon keeps a beat that falls exactly on posFrom in this window.
      for (let b = Math.ceil(posFrom / beat - 1e-9); b * beat < posTo; b++) {
        if (b * beat < posFrom) continue;
        const when = clockOf(b * beat);
        if (!late(when)) this.sink.click(when, b % BEATS_PER_BAR === 0);
      }
    }
  }
}

/** Index of the first hit at or after `time` (binary search over the sorted hits). */
function firstIndexAtOrAfter(hits: readonly RehearsalHit[], time: number): number {
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid]!.time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
