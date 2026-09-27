/**
 * S4.3a · the transport's time (T58): what plays, from where, and where the
 * playhead is at a clock time (src/ui/audio/transportMath.ts).
 * S4.3b · the count-in's clicks (T59), the loop Rehearse sets (T10) and the
 * speeds [ and ] step through (T61).
 */

import { describe, it, expect } from 'vitest';
import {
  REHEARSAL_SPEEDS,
  barsAt,
  countInBeatAt,
  countInFor,
  countInSeconds,
  countInStart,
  firstPass,
  loopRegionOf,
  nextPass,
  passAt,
  playRegion,
  positionAt,
  rehearseRegion,
  snapModeOf,
  snapTime,
  songSpan,
  startPosition,
  stepSpeed,
  type TransportRun,
} from '../../../src/ui/audio/transportMath';
import { formatBarBeat } from '../../../src/utils/musicalTime';

const song = { start: 0, end: 16 }; // 8 bars at 120 BPM, like TEST MIDI 1
const noLoop = { enabled: false, start: null, end: null };
const wholeSong = { enabled: true, start: null, end: null };
const bars3to4 = { enabled: true, start: 4, end: 8 };

describe('songSpan', () => {
  it('runs from the bar line at or before the first note to the one at or after the last note ends', () => {
    const streams = [{ events: [{ startTime: 2.5, duration: 0.1 }, { startTime: 9.9, duration: 0.2 }] }];
    expect(songSpan(streams, 120)).toEqual({ start: 2, end: 12 });
    // No notes: four bars.
    expect(songSpan([], 120)).toEqual({ start: 0, end: 8 });
    // A note ending on a bar line ends the song there.
    expect(songSpan([{ events: [{ startTime: 0, duration: 16 }] }], 120)).toEqual({ start: 0, end: 16 });
  });
});

describe('what plays', () => {
  it('loop off plays the song once; loop on with no region repeats the song; with a region, the region', () => {
    expect(playRegion(song, noLoop)).toEqual({ start: 0, end: 16, loops: false });
    expect(playRegion(song, wholeSong)).toEqual({ start: 0, end: 16, loops: true });
    expect(playRegion(song, bars3to4)).toEqual({ start: 4, end: 8, loops: true });
    // A region drawn right to left is the same region; one too short is none.
    expect(loopRegionOf({ start: 8, end: 4 })).toEqual({ start: 4, end: 8 });
    expect(playRegion(song, { enabled: true, start: 4, end: 4.01 })).toEqual({ start: 0, end: 16, loops: true });
    // A remembered region with Loop off plays the song.
    expect(playRegion(song, { enabled: false, start: 4, end: 8 })).toEqual({ start: 0, end: 16, loops: false });
  });

  it('starts at the playhead; from the end it starts over; a loop is played into from before it, and from its start when past it', () => {
    const once = playRegion(song, noLoop);
    expect(startPosition(5, once, song)).toBe(5);
    expect(startPosition(16, once, song)).toBe(0);
    expect(startPosition(-1, once, song)).toBe(0);
    const loop = playRegion(song, bars3to4);
    expect(startPosition(1, loop, song)).toBe(1);
    expect(startPosition(6, loop, song)).toBe(6);
    expect(startPosition(8, loop, song)).toBe(4);
    expect(startPosition(12, loop, song)).toBe(4);
    // Never before the song's first bar line.
    expect(startPosition(0, loop, { start: 2, end: 16 })).toBe(2);
  });
});

describe('where the playhead is', () => {
  const run = (over: Partial<TransportRun> = {}): TransportRun => ({
    anchorClock: 100, startPos: 0, rate: 1, region: playRegion(song, noLoop), ...over,
  });

  it('waits at its start until its anchor, then moves at `rate` transport seconds per clock second', () => {
    expect(positionAt(run({ startPos: 3 }), 99)).toEqual({ position: 3, ended: false, pass: 0 });
    expect(positionAt(run({ startPos: 3 }), 101.5).position).toBeCloseTo(4.5, 12);
    expect(positionAt(run({ startPos: 3, rate: 0.5 }), 102).position).toBeCloseTo(4, 12);
  });

  it('loop off: ends at the song end, and stays ended', () => {
    const r = run({ startPos: 14 });
    expect(positionAt(r, 101.999).ended).toBe(false);
    expect(positionAt(r, 102)).toEqual({ position: 16, ended: true, pass: 0 });
    expect(positionAt(r, 500).ended).toBe(true);
  });

  it('loop on: plays into the region, then repeats it, counting passes', () => {
    const r = run({ startPos: 2, region: playRegion(song, bars3to4) });
    // 2 → 8 is the first pass (6 s); then 4 → 8, every 4 s.
    expect(positionAt(r, 105)).toEqual({ position: 7, ended: false, pass: 0 });
    expect(positionAt(r, 106)).toEqual({ position: 4, ended: false, pass: 1 });
    expect(positionAt(r, 107.5).position).toBeCloseTo(5.5, 12);
    expect(positionAt(r, 110)).toEqual({ position: 4, ended: false, pass: 2 });
    expect(positionAt(r, 106 + 4 * 1000 + 1).pass).toBe(1001);
  });

  it('computes the same passes it would walk, just after and between every boundary', () => {
    // Exactly on a boundary, walked and computed clock times differ by ~1e-15,
    // so either side may win there: harmless, the positions agree.
    const r = run({ anchorClock: 0.1, startPos: 1.3, rate: 0.75, region: playRegion(song, { enabled: true, start: 2 / 3, end: 4.1 }) });
    let pass = firstPass(r);
    for (let i = 0; i < 400; i++) {
      for (const clock of [pass.startClock + 1e-9, (pass.startClock + pass.endClock) / 2]) {
        const found = passAt(r, clock)!;
        expect(found.index).toBe(pass.index);
        expect(found.startClock).toBeCloseTo(pass.startClock, 9);
      }
      pass = nextPass(r, pass)!;
    }
  });
});

describe('snapping loop edges', () => {
  it('snaps to the nearest bar; Shift to the nearest beat; Alt leaves it free', () => {
    expect(snapModeOf({ shiftKey: false, altKey: false })).toBe('bar');
    expect(snapModeOf({ shiftKey: true, altKey: false })).toBe('beat');
    expect(snapModeOf({ shiftKey: true, altKey: true })).toBe('free');
    expect(snapTime(2.3, 120, 'bar')).toBe(2);
    expect(snapTime(5.1, 120, 'bar')).toBe(6);
    expect(snapTime(2.3, 120, 'beat')).toBe(2.5);
    expect(snapTime(2.3, 120, 'free')).toBe(2.3);
    expect(snapTime(-0.4, 120, 'bar')).toBe(0);
  });

  it('a snapped bar line reads as that bar\'s downbeat, at any tempo', () => {
    for (const tempo of [60, 97, 120, 133, 174]) {
      const bar = 240 / tempo;
      expect(formatBarBeat(snapTime(bar * 1.04, tempo, 'bar'), tempo)).toBe('2.1.1');
      expect(formatBarBeat(snapTime(bar * 2.97, tempo, 'bar'), tempo)).toBe('4.1.1');
    }
  });

  it('presets take the bar the playhead is in, and the one after it', () => {
    expect(barsAt(2.7, 120, 1)).toEqual({ start: 2, end: 4 });
    expect(barsAt(2.7, 120, 2)).toEqual({ start: 2, end: 6 });
    expect(barsAt(4, 120, 1)).toEqual({ start: 4, end: 6 });
  });
});

describe('the count-in (S4.3b, T59)', () => {
  it('is four clicks a bar, a beat apart at the speed it will play at; none for Off', () => {
    expect(countInFor(0, 120, 1)).toBeUndefined();
    expect(countInFor(1, 120, 1)).toEqual({ beats: 4, beatClock: 0.5 });
    expect(countInFor(2, 120, 1)).toEqual({ beats: 8, beatClock: 0.5 });
    // At 0.75x a 120 BPM beat takes 2/3 s of clock time; at 90 BPM and 0.5x, 4/3 s.
    expect(countInFor(1, 120, 0.75)!.beatClock).toBeCloseTo(2 / 3, 12);
    expect(countInFor(1, 90, 0.5)!.beatClock).toBeCloseTo(4 / 3, 12);
    expect(countInSeconds(countInFor(1, 120, 0.75))).toBeCloseTo(8 / 3, 12);
    expect(countInSeconds(undefined)).toBe(0);
  });

  it('ends at the run\'s anchor, and names the click sounding at a clock time', () => {
    const countIn = countInFor(1, 120, 1)!;
    const run: TransportRun = { anchorClock: 12, startPos: 4, rate: 1, region: { start: 0, end: 16, loops: false }, countIn };
    expect(countInStart(run)).toBe(10);
    expect(countInBeatAt(run, 9.99)).toBeNull();
    expect([10, 10.49, 10.5, 11.2, 11.5, 11.99].map(t => countInBeatAt(run, t))).toEqual([0, 0, 1, 2, 3, 3]);
    expect(countInBeatAt(run, 12)).toBeNull();
    // Meanwhile the playhead waits at the run's start.
    expect(positionAt(run, 11).position).toBe(4);
    // A run with no count-in has none.
    expect(countInBeatAt({ ...run, countIn: undefined }, 11)).toBeNull();
    expect(countInStart({ ...run, countIn: undefined })).toBe(12);
  });
});

describe('Rehearse\'s loop (S4.3b, T10)', () => {
  it('is the moment\'s bar and the next, on bar lines, and holds the moment', () => {
    for (const time of [0, 0.5, 2, 3.25, 9.9, 13.75]) {
      const r = rehearseRegion(time, 120, song);
      expect(r.end - r.start).toBe(4);
      expect(r.start % 2).toBe(0);
      expect(r.start).toBeLessThanOrEqual(time);
      expect(r.end).toBeGreaterThan(time);
    }
    expect(rehearseRegion(3.25, 120, song)).toEqual({ start: 2, end: 6 });
    // At another tempo: 90 BPM bars are 8/3 s.
    const r90 = rehearseRegion(3, 90, { start: 0, end: 32 });
    expect(r90.start).toBeCloseTo(8 / 3, 12);
    expect(r90.end).toBeCloseTo(8, 12);
  });

  it('in the song\'s last bar, loops that bar and the one before; a one-bar song loops its bar', () => {
    expect(rehearseRegion(15.5, 120, song)).toEqual({ start: 12, end: 16 });
    expect(rehearseRegion(14, 120, song)).toEqual({ start: 12, end: 16 });
    expect(rehearseRegion(1.5, 120, { start: 0, end: 2 })).toEqual({ start: 0, end: 2 });
  });
});

describe('speed steps for [ and ] (S4.3b, T61)', () => {
  it('step through the Speed menu\'s speeds and stop at either end', () => {
    expect(REHEARSAL_SPEEDS).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5]);
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
    expect(stepSpeed(1.5, 1)).toBe(1.5);
    expect(stepSpeed(0.25, -1)).toBe(0.25);
    // A speed between two steps goes to the next one either way.
    expect(stepSpeed(0.9, 1)).toBe(1);
    expect(stepSpeed(0.9, -1)).toBe(0.75);
  });
});
