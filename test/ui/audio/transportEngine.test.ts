/**
 * S4.3a · the transport engine (T58, T60 part) with a fake audio clock.
 *
 * P4-5a: loop off plays once and stops at the end; Play from there starts
 * over. Also: loop on with no region repeats the song; a seek while playing
 * cancels what was scheduled and starts exactly at the target; speed and loop
 * changes carry on from where the transport is; a suspended AudioContext
 * holds the playhead and then starts on the audio clock, or starts silently on
 * the wall clock; Stop returns where it stopped; the dev switch's frame path
 * triggers audio frame by frame and schedules nothing ahead.
 *
 * S4.3b (T59): Play counts in (a bar or two of clicks at the speed it plays
 * at) while the playhead waits at the start; Stop, a seek, a change of speed
 * and the hand-over from the wall clock each do the right thing to it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransportEngine,
  PENDING_MAX_MS,
  START_LEAD,
  type TransportAudio,
  type TransportAudioMode,
} from '../../../src/ui/audio/transportEngine';
import { type AudioReadiness, type RehearsalHit } from '../../../src/ui/audio/rehearsalAudio';

// ─── Fakes ───────────────────────────────────────────────────────────────────

class FakeAudio implements TransportAudio {
  time = 50;
  readiness: AudioReadiness = 'running';
  resumeResolves = true;
  latencySeconds = 0;
  hits: Array<{ id: string; when: number }> = [];
  clicks: number[] = [];
  /** Every click scheduled, with its accent (cancelled ones included). */
  clickLog: Array<{ when: number; downbeat: boolean }> = [];
  cancels: number[] = [];
  frameWindows: Array<[number, number]> = [];
  private resolveResume: (() => void) | null = null;

  ensure(): AudioReadiness { return this.readiness; }
  resume(): Promise<void> {
    return new Promise(resolve => {
      this.resolveResume = () => { this.readiness = 'running'; resolve(); };
      if (this.resumeResolves) this.resolveResume();
    });
  }
  finishResume() { this.resolveResume?.(); }
  clock() {
    return this.readiness === 'running' ? { now: () => this.time, latency: () => this.latencySeconds } : null;
  }
  scheduleHit(id: string, when: number) { this.hits.push({ id, when }); }
  scheduleClick(when: number, downbeat: boolean) { this.clicks.push(when); this.clickLog.push({ when, downbeat }); }
  cancelFrom(when: number) {
    this.cancels.push(when);
    this.hits = this.hits.filter(h => h.when < when);
    this.clicks = this.clicks.filter(c => c < when);
  }
  setOptions() {}
  reset() {}
  playWindow(_hits: readonly RehearsalHit[], from: number, to: number) { this.frameWindows.push([from, to]); }
  playMetronomeWindow() {}
  dispose() {}
}

class Pump {
  private next = 1;
  private callbacks = new Map<number, () => void>();
  request = (cb: () => void) => { const id = this.next++; this.callbacks.set(id, cb); return id; };
  cancel = (id: number) => { this.callbacks.delete(id); };
  /** Runs the callbacks waiting now (a frame, a tick). */
  flush() {
    const waiting = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const cb of waiting) cb();
  }
}

let audio: FakeAudio;
let frames: Pump;
let timers: { set: (cb: () => void, ms: number) => number; clear: (id: number) => void; fire: () => void };
let tickFn: (() => void) | null;
let wall: number;
let ended: number[];

// TEST MIDI 1's shape: 8 bars at 120 BPM, a chord on the first downbeat.
const HITS: RehearsalHit[] = [
  { soundId: 'a', time: 0 }, { soundId: 'e', time: 0 }, { soundId: 'g', time: 0 },
  { soundId: 'c', time: 0.5 }, { soundId: 'b', time: 1 }, { soundId: 'a', time: 2 },
  { soundId: 'a', time: 4 }, { soundId: 'd', time: 6 }, { soundId: 'a', time: 14 }, { soundId: 'f', time: 15.5 },
];
const MATERIAL = { hits: HITS, tempo: 120, song: { start: 0, end: 16 } };

function engine(mode: TransportAudioMode = 'lookahead') {
  const e = new TransportEngine({
    audio,
    mode,
    wallClock: { now: () => wall, latency: () => 0 },
    ticker: { start: fn => { tickFn = fn; }, stop: () => { tickFn = null; }, dispose: () => { tickFn = null; } },
    frames: { request: frames.request, cancel: frames.cancel },
    timers,
    onEnded: at => ended.push(at),
  });
  e.setMaterial(MATERIAL);
  e.setAudioOptions({ metronome: false, hits: true, volume: 0.6 });
  return e;
}

/** Advances the audio and wall clocks, ticking the scheduler every 25 ms and drawing a frame every ~16 ms. */
function advance(seconds: number) {
  const steps = Math.round(seconds / 0.005);
  for (let i = 1; i <= steps; i++) {
    audio.time += 0.005;
    wall += 0.005;
    if (i % 5 === 0) tickFn?.();
    if (i % 3 === 0) frames.flush();
  }
}

beforeEach(() => {
  audio = new FakeAudio();
  frames = new Pump();
  tickFn = null;
  wall = 1000;
  ended = [];
  const pending = new Map<number, () => void>();
  let id = 1;
  timers = {
    set: (cb) => { const n = id++; pending.set(n, cb); return n; },
    clear: (n) => { pending.delete(n); },
    fire: () => { const all = [...pending.values()]; pending.clear(); all.forEach(cb => cb()); },
  };
});

describe('the transport engine', () => {
  it('P4-5a: loop off plays once and stops at the end; Play from there starts over', () => {
    const e = engine();
    e.play(14);
    advance(1);
    expect(e.isRunning()).toBe(true);
    expect(e.position()).toBeCloseTo(15 - START_LEAD, 6);
    advance(1.2);
    expect(e.isRunning()).toBe(false);
    expect(ended).toEqual([16]);
    expect(e.position()).toBe(16);
    expect(e.snapshot).toBe(16);
    // Nothing was scheduled past the end.
    expect(audio.hits.every(h => h.when < audio.time)).toBe(true);
    // Play at the end starts from the top, with the opening chord.
    audio.hits = [];
    e.play(16);
    expect(e.position()).toBe(0);
    expect(audio.hits.filter(h => h.when === audio.time + START_LEAD).map(h => h.id).sort()).toEqual(['a', 'e', 'g']);
  });

  it('loop on with no region repeats the whole song, with the opening chord each time', () => {
    const e = engine();
    e.setLoop({ enabled: true, start: null, end: null });
    const t0 = audio.time;
    e.play(0);
    advance(16 * 2 + 1);
    expect(e.isRunning()).toBe(true);
    expect(ended).toEqual([]);
    expect(e.position()).toBeCloseTo(1 - START_LEAD, 6);
    for (const repeat of [0, 1, 2]) {
      const at = t0 + START_LEAD + repeat * 16;
      expect(audio.hits.filter(h => Math.abs(h.when - at) < 1e-9).map(h => h.id).sort(), `repeat ${repeat + 1}`).toEqual(['a', 'e', 'g']);
    }
  });

  it('a loop region is played into from before it, then repeated', () => {
    const e = engine();
    e.setLoop({ enabled: true, start: 4, end: 8 });
    e.play(1);
    advance(2.5);
    expect(e.position()).toBeCloseTo(3.5 - START_LEAD, 6);
    advance(5);
    // 1 → 8 took 7 s; 0.5 s into the second pass of 4–8.
    expect(e.position()).toBeCloseTo(4.5 - START_LEAD, 6);
  });

  it('a seek while playing cancels what was ahead and plays the target exactly', () => {
    const e = engine();
    e.play(0);
    advance(0.5);
    const at = audio.time;
    e.seek(6);
    expect(audio.cancels).toContain(at);
    expect(audio.hits.filter(h => h.when >= at).map(h => [h.id, +(h.when - at).toFixed(9)])).toEqual([['d', START_LEAD]]);
    expect(e.snapshot).toBe(6);
    advance(1);
    expect(e.position()).toBeCloseTo(7 - START_LEAD, 6);
  });

  it('a speed change carries on from the same position, and the playhead moves at the new speed', () => {
    const e = engine();
    e.play(0);
    advance(1);
    const before = e.position();
    const changedAt = audio.time;
    e.setRate(0.5);
    expect(e.position()).toBeCloseTo(before, 6);
    advance(1);
    expect(e.position()).toBeCloseTo(before + 0.5, 6);
    // The notes still ahead (1 s and 2 s) were cancelled at 1x and sound once
    // each, at their half-speed clock times.
    advance(1.5);
    const next = audio.hits.filter(h => h.when > changedAt);
    expect(next.map(h => h.id)).toEqual(['b', 'a']);
    expect(next[0]!.when).toBeCloseTo(changedAt + (1 - before) / 0.5, 9);
    expect(next[1]!.when).toBeCloseTo(changedAt + (2 - before) / 0.5, 9);
  });

  it('Stop returns where the playhead is and cancels what was scheduled ahead', () => {
    const e = engine();
    e.play(0);
    advance(0.9);
    const at = e.stop();
    expect(at).toBeCloseTo(0.9 - START_LEAD, 6);
    expect(e.isRunning()).toBe(false);
    expect(audio.cancels.at(-1)).toBeCloseTo(audio.time, 9);
    expect(audio.hits.every(h => h.when < audio.time)).toBe(true);
    expect(tickFn).toBeNull();
    // Stopped, a seek only moves the resting playhead.
    e.seek(3);
    expect(e.position()).toBe(3);
    expect(e.snapshot).toBe(3);
  });

  it('the playhead shows what is heard: the audio clock less the output latency', () => {
    audio.latencySeconds = 0.03;
    const e = engine();
    e.play(0);
    advance(1);
    expect(e.position()).toBeCloseTo(1 - START_LEAD - 0.03, 6);
  });

  it('a suspended AudioContext holds the playhead, then starts on the audio clock with the first notes', async () => {
    audio.readiness = 'pending';
    audio.resumeResolves = false;
    const e = engine();
    e.play(0);
    advance(0.1);
    expect(e.position()).toBe(0);
    expect(e.debug().clock).toBe('none');
    audio.finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(e.debug().clock).toBe('audio');
    expect(audio.hits.filter(h => h.when === audio.time + START_LEAD).map(h => h.id).sort()).toEqual(['a', 'e', 'g']);
  });

  it('with no audio by then, Play starts silently on the wall clock, and hands over when audio arrives', async () => {
    audio.readiness = 'pending';
    audio.resumeResolves = false;
    const e = engine();
    e.play(0);
    timers.fire(); // PENDING_MAX_MS passed
    expect(PENDING_MAX_MS).toBeGreaterThan(0);
    expect(e.debug().clock).toBe('wall');
    advance(1);
    expect(e.position()).toBeCloseTo(1, 6);
    expect(audio.hits).toEqual([]);
    audio.finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(e.debug().clock).toBe('audio');
    const at = e.position();
    advance(1);
    expect(e.position()).toBeCloseTo(at + 1, 6);
    expect(audio.hits.map(h => h.id)).toContain('a'); // the note at 2 s
  });

  it('Hits off mid-run cancels the hits ahead; back on, they are scheduled again from now', () => {
    const e = engine();
    e.play(0);
    advance(0.3);
    e.setAudioOptions({ metronome: false, hits: false, volume: 0.6 });
    expect(audio.hits.every(h => h.when < audio.time)).toBe(true);
    advance(1);
    expect(audio.hits.every(h => h.when < audio.time - 1)).toBe(true);
    e.setAudioOptions({ metronome: false, hits: true, volume: 0.6 });
    advance(1);
    expect(audio.hits.some(h => h.id === 'a' && h.when > audio.time - 1)).toBe(true);
  });

  it('a new loop region mid-run: past its end, playback goes to its start', () => {
    const e = engine();
    e.play(0);
    advance(5);
    e.setLoop({ enabled: true, start: 0, end: 4 });
    expect(e.snapshot).toBe(0);
    advance(1);
    expect(e.position()).toBeCloseTo(1 - START_LEAD, 6);
  });

  it('the dev switch\'s frame path sounds each frame\'s slice and schedules nothing ahead', () => {
    const e = engine('frame');
    e.play(0);
    advance(1);
    expect(audio.hits).toEqual([]);
    expect(audio.frameWindows.length).toBeGreaterThan(20);
    // Frame by frame: each window starts where the last ended.
    for (let i = 1; i < audio.frameWindows.length; i++) {
      expect(audio.frameWindows[i]![0]).toBeCloseTo(audio.frameWindows[i - 1]![1], 9);
    }
    expect(e.stop()).toBeCloseTo(1, 6);
  });
});

describe('the count-in (S4.3b, T59)', () => {
  const round = (xs: number[]) => xs.map(x => +x.toFixed(9));

  it('Play with a one-bar count-in clicks four beats at the speed it plays at while the playhead waits, then plays from there', () => {
    const e = engine();
    e.setRate(0.75);
    const t0 = audio.time;
    e.play(4, { countInBars: 1 });
    // The clicks start after the usual lead, 2/3 s apart (0.5 s beats at 0.75x): 8/3 s in all.
    const anchor = t0 + START_LEAD + 8 / 3;
    advance(0.2);
    expect(e.countIn).toEqual({ beat: 0, beats: 4 });
    expect(e.debug().countIn).toEqual({ beat: 0, beats: 4 });
    advance(2.45);
    expect(e.countIn).toEqual({ beat: 3, beats: 4 });
    expect(e.position()).toBe(4);
    expect(round(audio.clicks)).toEqual(round([0, 1, 2, 3].map(k => t0 + START_LEAD + (k * 2) / 3)));
    expect(audio.clickLog.map(c => c.downbeat)).toEqual([true, false, false, false]);
    expect(audio.hits.every(h => h.when >= anchor - 1e-9)).toBe(true);
    advance(1);
    expect(e.countIn).toBeNull();
    expect(e.position()).toBeCloseTo(4 + (audio.time - anchor) * 0.75, 6);
    // The note at 4 s sounds exactly where the count-in ends; the metronome (off) adds no clicks.
    expect(audio.hits.some(h => h.id === 'a' && Math.abs(h.when - anchor) < 1e-9)).toBe(true);
    expect(audio.clicks.length).toBe(4);
  });

  it('two bars count in eight clicks, a downbeat on each bar', () => {
    const e = engine();
    e.play(0, { countInBars: 2 });
    advance(4.2);
    expect(audio.clickLog.map(c => c.downbeat)).toEqual([true, false, false, false, true, false, false, false]);
    expect(e.position()).toBeCloseTo(4.2 - START_LEAD - 4, 6);
  });

  it('Stop during the count-in rests at the start and cancels the clicks still to come', () => {
    const e = engine();
    e.play(6, { countInBars: 1 });
    advance(0.8);
    expect(e.stop()).toBe(6);
    expect(e.isRunning()).toBe(false);
    expect(e.countIn).toBeNull();
    expect(audio.clicks.every(c => c < audio.time)).toBe(true);
    expect(audio.hits).toEqual([]);
  });

  it('a seek during the count-in ends it: the target plays at once', () => {
    const e = engine();
    e.play(0, { countInBars: 2 });
    advance(1);
    const seekAt = audio.time;
    e.seek(2);
    advance(0.5);
    expect(e.countIn).toBeNull();
    expect(e.position()).toBeCloseTo(2 + 0.5 - START_LEAD, 6);
    expect(audio.clicks.filter(c => c >= seekAt)).toEqual([]);
    expect(audio.hits.some(h => h.id === 'a' && Math.abs(h.when - (seekAt + START_LEAD)) < 1e-9)).toBe(true);
  });

  it('a speed change during the count-in keeps its clicks and where it ends', () => {
    const e = engine();
    const t0 = audio.time;
    e.play(4, { countInBars: 1 });
    const anchor = t0 + START_LEAD + 2;
    advance(0.7);
    e.setRate(0.5);
    advance(1.2);
    expect(e.position()).toBe(4);
    // The same four clicks, none twice.
    expect(round([...audio.clicks].sort((a, b) => a - b))).toEqual(round([0, 0.5, 1, 1.5].map(x => t0 + START_LEAD + x)));
    advance(1.5);
    expect(e.position()).toBeCloseTo(4 + (audio.time - anchor) * 0.5, 6);
  });

  it('started silently on the wall clock, the hand-over to audio keeps what is left of the count-in', async () => {
    audio.readiness = 'pending';
    audio.resumeResolves = false;
    const e = engine();
    e.play(4, { countInBars: 1 });
    timers.fire(); // no audio yet: the wall clock counts in, silently
    advance(0.6);
    expect(e.countIn).toEqual({ beat: 1, beats: 4 });
    expect(audio.clicks).toEqual([]);
    audio.finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(e.debug().clock).toBe('audio');
    // 1.4 s were left: the last two clicks sound on the audio clock, then the music.
    const handedOver = audio.time;
    advance(1.5);
    expect(round(audio.clicks)).toEqual(round([handedOver + 0.4, handedOver + 0.9]));
    expect(e.debug().skipped).toBe(0);
    expect(e.position()).toBeCloseTo(4 + (audio.time - (handedOver + 1.4)), 6);
  });

  it('publishes the count-in once per click, not every frame', () => {
    const e = engine();
    let notified = 0;
    const off = e.subscribe(() => { notified++; });
    e.play(4, { countInBars: 1 });
    notified = 0;
    advance(2);
    off();
    // Four clicks (the playhead holds, so it adds nothing).
    expect(notified).toBe(4);
  });

  it('no count-in: Play plays at once, as before', () => {
    const e = engine();
    e.play(4, { countInBars: 0 });
    advance(0.5);
    expect(e.countIn).toBeNull();
    expect(e.position()).toBeCloseTo(4.5 - START_LEAD, 6);
    expect(audio.clicks).toEqual([]);
  });
});
