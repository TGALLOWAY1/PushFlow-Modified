/**
 * S4.3a · the transport's time (T58): what plays, from where, and where the
 * playhead is at a clock time (src/ui/audio/transportMath.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  barsAt,
  firstPass,
  loopRegionOf,
  nextPass,
  passAt,
  playRegion,
  positionAt,
  snapModeOf,
  snapTime,
  songSpan,
  startPosition,
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
