/**
 * The workspace's transport (S4.3a; T58, T60 part): play, stop, seek, loop
 * and speed, timed by the audio clock.
 *
 * One engine per open project, owned by the workspace (TransportProvider),
 * not by the timeline, so it keeps playing whichever drawer tab is shown.
 *
 * - Time is AudioContext.currentTime while audio runs. The playhead is derived
 *   from it, less the output latency, so pads flash when a hit is heard.
 *   Without audio (none in this browser, or a context that won't resume within
 *   PENDING_MAX_MS of Play) the wall clock stands in, silently, and hands over
 *   to the audio clock if audio starts later.
 * - Sounds are scheduled ahead by the look-ahead scheduler, from a ticker that
 *   runs every 25 ms (in a worker where possible, so a background tab keeps
 *   its timing), at exact clock times.
 * - Anything that changes mid-run (speed, the loop, the material, Hits or
 *   Metronome) starts a new run from where the transport is, and a seek from
 *   where it is sent; scheduled sounds that haven't started are cancelled.
 * - Loop off plays once and stops at the end (onEnded).
 * - The old frame-driven audio path stays selectable for one release through
 *   a dev-only localStorage switch (transportModeFromStorage).
 *
 * The position is published once per animation frame (subscribe/snapshot) for
 * the few components that draw it; the project state holds only where the
 * transport rests (currentTime) and whether it plays (isPlaying).
 */

import {
  type AudioClock,
  type AudioReadiness,
  type RehearsalAudioOptions,
  type RehearsalHit,
  DEFAULT_REHEARSAL_AUDIO,
} from './rehearsalAudio';
import { DEFAULT_SCHEDULER_OPTIONS, LookaheadScheduler, SCHEDULER_TICK_MS, type SchedulerMaterial } from './lookaheadScheduler';
import {
  playRegion,
  positionAt,
  startPosition,
  type LoopSettings,
  type PlayRegion,
  type RunPosition,
  type SongSpan,
  type TransportRun,
} from './transportMath';

/** How long Play waits for a suspended AudioContext before starting silently on the wall clock. */
export const PENDING_MAX_MS = 250;
/** Play and seeks start this far ahead of the audio clock, so their first notes are never late. */
export const START_LEAD = 0.04;

/** 'lookahead' is the transport; 'frame' is the pre-S4.3a frame-driven audio, behind the dev switch. */
export type TransportAudioMode = 'lookahead' | 'frame';

/** The parts of RehearsalAudio the engine uses. */
export interface TransportAudio {
  ensure(): AudioReadiness;
  resume(): Promise<void>;
  clock(): AudioClock | null;
  scheduleHit(soundId: string, when: number, velocity: number): void;
  scheduleClick(when: number, downbeat: boolean): void;
  cancelFrom(when: number): void;
  setOptions(options: RehearsalAudioOptions): void;
  reset(): void;
  playWindow(hits: readonly RehearsalHit[], fromTime: number, toTime: number): void;
  playMetronomeWindow(fromTime: number, toTime: number, tempo: number): void;
  dispose(): void;
}

/** Calls onTick every intervalMs until stopped. */
export interface Ticker {
  start(onTick: () => void): void;
  stop(): void;
  dispose(): void;
}

/** requestAnimationFrame, injectable for tests. */
export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(id: number): void;
}

export interface Timers {
  set(callback: () => void, ms: number): number;
  clear(id: number): void;
}

/** What there is to play. */
export interface TransportMaterial {
  /** Every audible hit, sorted by time. */
  hits: readonly RehearsalHit[];
  tempo: number;
  song: SongSpan;
}

export interface TransportEngineDeps {
  audio: TransportAudio;
  mode?: TransportAudioMode;
  wallClock?: AudioClock;
  ticker?: Ticker;
  frames?: FrameScheduler;
  timers?: Timers;
  /** Loop off reached the end: the transport stopped there. */
  onEnded?: (at: number) => void;
}

/** Which clock the transport runs on right now, for tests and the e2e hook. */
export type TransportClockKind = 'audio' | 'wall' | 'none';

export interface TransportDebug {
  running: boolean;
  pending: boolean;
  clock: TransportClockKind;
  mode: TransportAudioMode;
  position: number;
  region: PlayRegion;
  /** Sounds skipped because the scheduler ran too late for them. */
  skipped: number;
}

const WALL_CLOCK: AudioClock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000,
  latency: () => 0,
};

const EMPTY_MATERIAL: TransportMaterial = { hits: [], tempo: 120, song: { start: 0, end: 8 } };

export class TransportEngine {
  private readonly audio: TransportAudio;
  readonly mode: TransportAudioMode;
  private readonly wallClock: AudioClock;
  private readonly ticker: Ticker;
  private readonly frames: FrameScheduler;
  private readonly timers: Timers;
  onEnded: ((at: number) => void) | undefined;

  private material: TransportMaterial = EMPTY_MATERIAL;
  private loop: LoopSettings = { enabled: false, start: null, end: null };
  private rate = 1;
  private options: RehearsalAudioOptions = { ...DEFAULT_REHEARSAL_AUDIO };
  private readonly scheduler: LookaheadScheduler;

  private running = false;
  /** Waiting for the audio clock: the playhead holds at pendingStart. */
  private pending = false;
  private pendingStart = 0;
  private pendingTimer: number | null = null;
  /** Bumped by every Play, so a late resume() from an earlier one is ignored. */
  private playToken = 0;
  private clock: AudioClock | null = null;
  private onAudioClock = false;
  private run: TransportRun | null = null;
  /** Where the transport rests while stopped. */
  private resting = 0;
  private frameId: number | null = null;
  /** The frame-driven path's last frame. */
  private lastFrame: RunPosition = { position: 0, ended: false, pass: 0 };

  private published = 0;
  private readonly listeners = new Set<() => void>();

  constructor(deps: TransportEngineDeps) {
    this.audio = deps.audio;
    this.mode = deps.mode ?? 'lookahead';
    this.wallClock = deps.wallClock ?? WALL_CLOCK;
    this.ticker = deps.ticker ?? createTicker();
    this.frames = deps.frames ?? animationFrames();
    this.timers = deps.timers ?? browserTimers();
    this.onEnded = deps.onEnded;
    this.scheduler = new LookaheadScheduler(
      {
        hit: (soundId, when, velocity) => this.audio.scheduleHit(soundId, when, velocity),
        click: (when, downbeat) => this.audio.scheduleClick(when, downbeat),
      },
      this.schedulerMaterial(),
      DEFAULT_SCHEDULER_OPTIONS,
    );
  }

  // ─── Reading ───────────────────────────────────────────────────────────────

  isRunning(): boolean {
    return this.running;
  }

  /** The playhead now: computed from the clock, not the last frame. */
  position(): number {
    return this.live().position;
  }

  /** The position published for drawing, once per frame while playing. */
  get snapshot(): number {
    return this.published;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** What plays: the loop region, or the song. */
  region(): PlayRegion {
    return playRegion(this.material.song, this.loop);
  }

  debug(): TransportDebug {
    return {
      running: this.running,
      pending: this.pending,
      clock: !this.running || this.pending || !this.clock ? 'none' : this.onAudioClock ? 'audio' : 'wall',
      mode: this.mode,
      position: this.position(),
      region: this.region(),
      skipped: this.scheduler.skipped,
    };
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  setMaterial(material: TransportMaterial): void {
    if (material.hits === this.material.hits && material.tempo === this.material.tempo
      && material.song.start === this.material.song.start && material.song.end === this.material.song.end) return;
    this.material = material;
    this.scheduler.setMaterial(this.schedulerMaterial());
    this.continueRun();
  }

  setLoop(loop: LoopSettings): void {
    if (loop.enabled === this.loop.enabled && loop.start === this.loop.start && loop.end === this.loop.end) return;
    this.loop = { ...loop };
    this.continueRun();
  }

  setRate(rate: number): void {
    const next = Math.min(2, Math.max(0.1, rate || 1));
    if (next === this.rate) return;
    this.rate = next;
    this.continueRun();
  }

  setAudioOptions(options: RehearsalAudioOptions): void {
    const audible = options.hits !== this.options.hits || options.metronome !== this.options.metronome;
    this.options = options;
    this.audio.setOptions(options);
    if (!audible) return;
    this.scheduler.setMaterial(this.schedulerMaterial());
    this.continueRun();
  }

  // ─── Transport ─────────────────────────────────────────────────────────────

  /** Plays from `from` (see startPosition for where a run actually starts). */
  play(from: number): void {
    if (this.running) return;
    this.running = true;
    const token = ++this.playToken;
    const start = startPosition(from, this.region(), this.material.song);
    this.pendingStart = start;
    this.publish(start);
    this.startFrames();

    const readiness = this.audio.ensure();
    if (this.mode === 'frame') {
      // The old path: the wall clock, and audio triggered frame by frame.
      this.audio.reset();
      this.begin(this.wallClock, false, start, 0);
      return;
    }
    const audioClock = readiness === 'running' ? this.audio.clock() : null;
    if (audioClock) {
      this.begin(audioClock, true, start, START_LEAD);
      return;
    }
    if (readiness === 'unavailable') {
      this.begin(this.wallClock, false, start, 0);
      return;
    }
    // A context waiting to resume: hold the playhead a moment, so the first
    // notes sound when audio starts; start silently if it doesn't.
    this.pending = true;
    void this.audio.resume().then(() => this.audioResumed(token));
    this.pendingTimer = this.timers.set(() => {
      this.pendingTimer = null;
      if (token === this.playToken && this.pending) this.begin(this.wallClock, false, this.pendingStart, 0);
    }, PENDING_MAX_MS);
  }

  /** Stops where the playhead is, and returns that position. Sounds not yet started are cancelled. */
  stop(): number {
    if (!this.running) return this.resting;
    const at = this.live().position;
    if (this.onAudioClock && this.clock) this.audio.cancelFrom(this.clock.now());
    this.halt();
    this.rest(at);
    return at;
  }

  /** Moves the playhead. While playing, playback carries on from there at once. */
  seek(to: number): void {
    const target = Math.max(0, to);
    if (!this.running) {
      this.rest(target);
      return;
    }
    const start = startPosition(target, this.region(), this.material.song);
    if (!this.run || !this.clock) {
      this.pendingStart = start;
      this.publish(start);
      return;
    }
    this.restart(start, START_LEAD);
  }

  /**
   * Stops and releases the audio and the ticker. Both come back on the next
   * Play, so a component remounted by React's StrictMode can carry on.
   */
  dispose(): void {
    this.halt();
    this.ticker.dispose();
    this.audio.dispose();
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private schedulerMaterial(): SchedulerMaterial {
    return {
      hits: this.material.hits,
      tempo: this.material.tempo,
      hitsOn: this.options.hits,
      clicksOn: this.options.metronome,
    };
  }

  /** Where the playhead is: the rest position, the held start, or the run at the heard clock time. */
  private live(): RunPosition {
    if (!this.running) return { position: this.resting, ended: false, pass: 0 };
    if (!this.run || !this.clock) return { position: this.pendingStart, ended: false, pass: 0 };
    return positionAt(this.run, this.clock.now() - this.clock.latency());
  }

  private begin(clock: AudioClock, onAudio: boolean, start: number, lead: number): void {
    this.pending = false;
    if (this.pendingTimer !== null) {
      this.timers.clear(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.clock = clock;
    this.onAudioClock = onAudio;
    this.restart(start, lead);
    if (onAudio && this.mode === 'lookahead') this.ticker.start(this.tick);
  }

  /** A new run from `start`, `lead` seconds from now on the current clock. */
  private restart(start: number, lead: number): void {
    const clock = this.clock!;
    const now = clock.now();
    if (this.onAudioClock) this.audio.cancelFrom(now);
    this.run = { anchorClock: now + lead, startPos: start, rate: this.rate, region: this.region() };
    if (this.mode === 'frame') {
      this.audio.reset();
      this.lastFrame = { position: start, ended: false, pass: 0 };
    } else if (this.onAudioClock) {
      this.scheduler.start(this.run);
      this.scheduler.tick(now);
    }
    this.publish(start);
  }

  /** Something changed mid-run: carry on from where the transport is, under the new settings. */
  private continueRun(): void {
    if (!this.running) return;
    if (!this.run || !this.clock) {
      this.pendingStart = startPosition(this.pendingStart, this.region(), this.material.song);
      return;
    }
    const now = positionAt(this.run, this.clock.now());
    if (now.ended) return; // the frame loop is about to stop it
    const start = startPosition(now.position, this.region(), this.material.song);
    this.restart(start, start === now.position ? 0 : START_LEAD);
  }

  private audioResumed(token: number): void {
    if (token !== this.playToken || !this.running || this.mode === 'frame') return;
    const clock = this.audio.clock();
    if (!clock) return;
    if (this.pending) {
      this.begin(clock, true, this.pendingStart, START_LEAD);
    } else if (!this.onAudioClock && this.run) {
      // Started silently on the wall clock; audio is here now, so hand over.
      const at = this.live().position;
      this.begin(clock, true, at, 0);
    }
  }

  private tick = (): void => {
    if (!this.running || !this.run || !this.clock || !this.onAudioClock) return;
    this.scheduler.tick(this.clock.now());
  };

  private startFrames(): void {
    if (this.frameId !== null) return;
    const frame = () => {
      this.frameId = null;
      if (!this.running) return;
      const at = this.live();
      if (this.mode === 'frame' && this.run) this.playFrame(at);
      if (at.ended) {
        this.finish();
        return;
      }
      this.publish(at.position);
      this.frameId = this.frames.request(frame);
    };
    this.frameId = this.frames.request(frame);
  }

  /** The old path: sound the slice of time since the last frame, now. */
  private playFrame(at: RunPosition): void {
    const { hits, tempo } = this.material;
    const region = this.run!.region;
    const prev = this.lastFrame;
    const to = at.ended ? region.end : at.position;
    if (at.pass !== prev.pass) {
      this.audio.playWindow(hits, prev.position, region.end);
      this.audio.playMetronomeWindow(prev.position, region.end, tempo);
      this.audio.reset();
      // As before S4.3a: the window after a wrap excludes its start.
      this.audio.playWindow(hits, region.start, to);
      this.audio.playMetronomeWindow(region.start, to, tempo);
    } else {
      this.audio.playWindow(hits, prev.position, to);
      this.audio.playMetronomeWindow(prev.position, to, tempo);
    }
    this.lastFrame = at;
  }

  /** Loop off reached the end: stop there. */
  private finish(): void {
    const at = this.run ? this.run.region.end : this.resting;
    this.halt();
    this.rest(at);
    this.onEnded?.(at);
  }

  private halt(): void {
    this.running = false;
    this.pending = false;
    this.playToken++;
    if (this.pendingTimer !== null) {
      this.timers.clear(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.frameId !== null) {
      this.frames.cancel(this.frameId);
      this.frameId = null;
    }
    this.ticker.stop();
    this.scheduler.stop();
    this.run = null;
    this.clock = null;
    this.onAudioClock = false;
  }

  private rest(at: number): void {
    this.resting = at;
    this.publish(at);
  }

  private publish(position: number): void {
    if (position === this.published) return;
    this.published = position;
    for (const listener of [...this.listeners]) listener();
  }
}

// ─── Browser defaults ────────────────────────────────────────────────────────

const TICKER_WORKER = 'let id=null;onmessage=e=>{clearInterval(id);id=null;if(e.data>0)id=setInterval(()=>postMessage(0),e.data)};';

/**
 * A ticker for the scheduler. A dedicated worker's interval keeps its pace in
 * a background tab, where the page's own timers slow to once a second; where
 * a worker can't be made, the page's setInterval does. Nothing is created
 * until the first start, and a disposed ticker can start again.
 */
export function createTicker(intervalMs = SCHEDULER_TICK_MS): Ticker {
  let onTick: (() => void) | null = null;
  let worker: { worker: Worker; url: string } | null = null;
  let workerFailed = false;
  let id: ReturnType<typeof setInterval> | null = null;

  const makeWorker = (): Worker | null => {
    if (worker) return worker.worker;
    if (workerFailed) return null;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
        workerFailed = true;
        return null;
      }
      const url = URL.createObjectURL(new Blob([TICKER_WORKER], { type: 'text/javascript' }));
      const made = new Worker(url);
      made.onmessage = () => onTick?.();
      worker = { worker: made, url };
      return made;
    } catch {
      // No worker here: the page's own interval.
      workerFailed = true;
      return null;
    }
  };
  const stop = () => {
    onTick = null;
    worker?.worker.postMessage(0);
    if (id !== null) clearInterval(id);
    id = null;
  };
  return {
    start: tick => {
      stop();
      onTick = tick;
      const w = makeWorker();
      if (w) w.postMessage(intervalMs);
      else id = setInterval(() => onTick?.(), intervalMs);
    },
    stop,
    dispose: () => {
      stop();
      if (!worker) return;
      worker.worker.terminate();
      URL.revokeObjectURL(worker.url);
      worker = null;
    },
  };
}

function animationFrames(): FrameScheduler {
  if (typeof requestAnimationFrame === 'function') {
    return { request: cb => requestAnimationFrame(() => cb()), cancel: id => cancelAnimationFrame(id) };
  }
  return {
    request: cb => setTimeout(cb, 16) as unknown as number,
    cancel: id => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  };
}

function browserTimers(): Timers {
  return {
    set: (cb, ms) => setTimeout(cb, ms) as unknown as number,
    clear: id => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  };
}

/** The dev-only switch back to the old frame-driven audio (S4.3a, one release): localStorage 'pushflow:dev:transport' = 'frame'. */
export const TRANSPORT_MODE_KEY = 'pushflow:dev:transport';

export function transportModeFromStorage(): TransportAudioMode {
  if (!import.meta.env.DEV) return 'lookahead';
  try {
    return localStorage.getItem(TRANSPORT_MODE_KEY) === 'frame' ? 'frame' : 'lookahead';
  } catch {
    return 'lookahead';
  }
}
