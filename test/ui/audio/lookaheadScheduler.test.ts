/**
 * S4.3a · the look-ahead scheduler (T58), against a fake clock.
 *
 * P4-5c: every hit and click is scheduled within 2 ms of its exact clock time
 * (here: exactly), however the ticks jitter; nothing is scheduled twice and
 * nothing is dropped, across loop wraps and at every speed. Also: the first
 * window after play, a seek or a wrap includes its start (the opening chord
 * sounds on every repeat, P4-5b's scheduling half; the audio half renders
 * through an OfflineAudioContext in test/e2e/transport-audio.spec.ts), loop
 * off schedules nothing past the end, and a stall skips notes instead of
 * bursting them.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LookaheadScheduler, type SchedulerMaterial } from '../../../src/ui/audio/lookaheadScheduler';
import { playRegion, songSpan, type LoopSettings, type TransportRun } from '../../../src/ui/audio/transportMath';
import { type RehearsalHit } from '../../../src/ui/audio/rehearsalAudio';
import { createSeededRng } from '../../../src/utils/seededRng';
import { importTestMidi1 } from '../../helpers/testMidi1';

interface Scheduled { kind: 'hit' | 'click'; id: string; when: number; tickAt: number; downbeat?: boolean }

let hits: RehearsalHit[] = [];
let song = { start: 0, end: 16 };
const TEMPO = 120;

beforeAll(async () => {
  // TEST MIDI 1 through the app's import path: 7 Sounds, 48 notes, 8 bars at 120 BPM.
  const state = await importTestMidi1();
  hits = state.soundStreams
    .flatMap(s => s.events.map(e => ({ soundId: s.id, time: e.startTime, velocity: e.velocity })))
    .sort((a, b) => a.time - b.time);
  song = songSpan(state.soundStreams, state.tempo);
  expect(state.tempo).toBe(TEMPO);
});

function recorder() {
  const out: Scheduled[] = [];
  let tickAt = 0;
  return {
    out,
    setTick: (t: number) => { tickAt = t; },
    sink: {
      hit: (id: string, when: number) => { out.push({ kind: 'hit', id, when, tickAt }); },
      click: (when: number, downbeat: boolean) => { out.push({ kind: 'click', id: 'click', when, tickAt, downbeat }); },
    },
  };
}

const material = (over: Partial<SchedulerMaterial> = {}): SchedulerMaterial => ({
  hits, tempo: TEMPO, hitsOn: true, clicksOn: false, ...over,
});

/** Drives `scheduler` with ticks from `from` to `until` whose gaps come from `gap()`. */
function drive(scheduler: LookaheadScheduler, rec: ReturnType<typeof recorder>, from: number, until: number, gap: () => number) {
  for (let now = from; now < until; now += gap()) {
    rec.setTick(now);
    scheduler.tick(now);
  }
}

/**
 * Every hit the run should play before clock time `until`, with its exact
 * clock time, computed in closed form (not by walking the passes).
 */
function expectedHits(run: TransportRun, until: number): Array<{ id: string; when: number; pass: number }> {
  const { region, rate, startPos, anchorClock } = run;
  const firstEnd = anchorClock + (region.end - startPos) / rate;
  const length = (region.end - region.start) / rate;
  const out: Array<{ id: string; when: number; pass: number }> = [];
  for (let pass = 0; ; pass++) {
    const passStart = pass === 0 ? anchorClock : firstEnd + (pass - 1) * length;
    const passStartPos = pass === 0 ? startPos : region.start;
    if (passStart >= until || (pass > 0 && !region.loops)) break;
    for (const h of hits) {
      if (h.time < passStartPos || h.time >= region.end) continue;
      const when = passStart + (h.time - passStartPos) / rate;
      if (when < until) out.push({ id: h.soundId, when, pass });
    }
  }
  return out;
}

const runOf = (loop: LoopSettings, over: Partial<TransportRun> = {}): TransportRun => ({
  anchorClock: 10.04, startPos: 0, rate: 1, region: playRegion(song, loop), ...over,
});

describe('the look-ahead scheduler (P4-5c: timing against a fake clock)', () => {
  const cases: Array<[string, LoopSettings, Partial<TransportRun>]> = [
    ['the whole song, looped, at 1x', { enabled: true, start: null, end: null }, {}],
    ['bars 2–3 from bar 1, at 0.75x', { enabled: true, start: 2, end: 6 }, { rate: 0.75 }],
    ['a loop that starts off a beat, from inside it, at 1.5x', { enabled: true, start: 3.1, end: 7.35 }, { startPos: 5, rate: 1.5 }],
    ['loop off, from bar 7', { enabled: false, start: null, end: null }, { startPos: 12 }],
  ];

  for (const [name, loop, over] of cases) {
    it(`${name}: every hit once, within 2 ms of its exact time, however the ticks jitter`, () => {
      const rng = createSeededRng(7);
      const rec = recorder();
      const scheduler = new LookaheadScheduler(rec.sink, material());
      const run = runOf(loop, over);
      scheduler.start(run);
      // Ticks every 25 ms plus up to 70 ms of lateness (a busy main thread).
      const until = 10 + 60;
      drive(scheduler, rec, 10, until, () => 0.025 + rng() * 0.07);

      const want = expectedHits(run, until - 0.2);
      const got = rec.out.filter(s => s.when < until - 0.2);
      expect(got.length).toBe(want.length);
      let maxError = 0;
      want.forEach((w, i) => {
        expect(got[i]!.id).toBe(w.id);
        maxError = Math.max(maxError, Math.abs(got[i]!.when - w.when));
      });
      expect(maxError).toBeLessThan(0.002);
      // Scheduled ahead, never late.
      expect(rec.out.every(s => s.when >= s.tickAt)).toBe(true);
      expect(scheduler.skipped).toBe(0);
      if (run.region.loops) expect(new Set(want.map(w => w.pass)).size).toBeGreaterThan(3);
    });
  }

  it('the opening chord is scheduled at the start of every repeat, and nothing on the loop end', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material());
    const run = runOf({ enabled: true, start: 0, end: 4 });
    scheduler.start(run);
    drive(scheduler, rec, 10, 10 + 4 * 5 + 0.05, () => 0.025);
    const chord = hits.filter(h => h.time === 0).map(h => h.soundId).sort();
    expect(chord.length).toBe(3);
    for (let pass = 0; pass < 5; pass++) {
      const at = run.anchorClock + pass * 4;
      const sounded = rec.out.filter(s => Math.abs(s.when - at) < 1e-9).map(s => s.id).sort();
      expect(sounded, `repeat ${pass + 1}`).toEqual(chord);
    }
    // Bar 3's downbeat (4 s) is the loop's end, outside bars 1–2: only the
    // opening chord ever sounds on a repeat's boundary.
    expect(hits.filter(h => h.time === 4).length).toBeGreaterThan(0);
    const inFivePasses = rec.out.filter(s => s.when < run.anchorClock + 4 * 5 - 1e-6);
    expect(inFivePasses.filter(s => Math.abs(((s.when - run.anchorClock) % 4)) < 1e-9).length).toBe(3 * 5);
  });

  it('the first window after play and after a seek starts exactly at the new position', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material());
    // Play from the chord at 2 s (bar 2's downbeat).
    scheduler.start(runOf({ enabled: false, start: null, end: null }, { startPos: 2, anchorClock: 5.04 }));
    rec.setTick(5);
    scheduler.tick(5);
    const atTwo = hits.filter(h => h.time === 2).map(h => h.soundId).sort();
    expect(rec.out.filter(s => s.when === 5.04).map(s => s.id).sort()).toEqual(atTwo);
    // Seek to 6 s: a new run whose first window includes 6 s.
    rec.out.length = 0;
    scheduler.start(runOf({ enabled: false, start: null, end: null }, { startPos: 6, anchorClock: 5.54 }));
    rec.setTick(5.5);
    scheduler.tick(5.5);
    const atSix = hits.filter(h => h.time === 6).map(h => h.soundId).sort();
    expect(atSix.length).toBeGreaterThan(0);
    expect(rec.out.filter(s => s.when === 5.54).map(s => s.id).sort()).toEqual(atSix);
  });

  it('metronome clicks land on every beat, the downbeats marked, the first one included', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material({ hitsOn: false, clicksOn: true }));
    const run = runOf({ enabled: true, start: 2, end: 4 }, { startPos: 2, anchorClock: 1 });
    scheduler.start(run);
    drive(scheduler, rec, 0.96, 1 + 6, () => 0.025);
    const clicks = rec.out.filter(s => s.kind === 'click' && s.when < 7 - 1e-9);
    // Three passes of one bar: 12 beats, a downbeat every 4.
    expect(clicks.map(c => +(c.when - 1).toFixed(9))).toEqual(Array.from({ length: 12 }, (_, i) => i * 0.5));
    expect(clicks.map(c => c.downbeat)).toEqual(Array.from({ length: 12 }, (_, i) => i % 4 === 0));
  });

  it('loop off schedules nothing past the end of the song', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material({ clicksOn: true }));
    const run = runOf({ enabled: false, start: null, end: null }, { startPos: 14 });
    scheduler.start(run);
    drive(scheduler, rec, 10, 20, () => 0.025);
    const end = run.anchorClock + 2;
    expect(rec.out.length).toBeGreaterThan(0);
    expect(rec.out.every(s => s.when < end)).toBe(true);
  });

  it('after a stall longer than the horizon, notes already past are skipped, not fired in a burst', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material({ clicksOn: true }));
    scheduler.start(runOf({ enabled: true, start: null, end: null }));
    drive(scheduler, rec, 10, 11, () => 0.025);
    // A 600 ms stall: the next tick comes at 11.6.
    rec.setTick(11.6);
    scheduler.tick(11.6);
    expect(scheduler.skipped).toBeGreaterThan(0);
    expect(rec.out.every(s => s.when >= s.tickAt - 0.03)).toBe(true);
    // And it carries on in time afterwards.
    drive(scheduler, rec, 11.625, 13, () => 0.025);
    expect(rec.out.filter(s => s.tickAt > 11.6).every(s => s.when >= s.tickAt)).toBe(true);
  });

  it('after a rewind (the audio cancelled what was ahead), schedules from there again, once', () => {
    const rec = recorder();
    const scheduler = new LookaheadScheduler(rec.sink, material());
    const run = runOf({ enabled: true, start: null, end: null });
    scheduler.start(run);
    drive(scheduler, rec, 10, 12, () => 0.025);
    // The engine cancels everything due at or after 12 and rewinds there.
    const kept = rec.out.filter(s => s.when < 12);
    rec.out.length = 0;
    rec.out.push(...kept);
    scheduler.rewind(12);
    drive(scheduler, rec, 12, 14, () => 0.025);
    const want = expectedHits(run, 13.8);
    const got = rec.out.filter(s => s.when < 13.8);
    expect(got.map(s => [s.id, +s.when.toFixed(9)])).toEqual(want.map(w => [w.id, +w.when.toFixed(9)]));
  });
});
