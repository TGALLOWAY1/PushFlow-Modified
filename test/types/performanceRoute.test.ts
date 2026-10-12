/**
 * S9.1 · the Performance Route's stored shape and its normalization (P9-1b).
 *
 * normalizeRoute is the one place that makes a route valid: sections on whole
 * bars and mode spans on sixteenths, both tiling the song's bars with no gap,
 * overlap or reversed bounds; performed spans merged per live lane.
 */

import { describe, it, expect } from 'vitest';
import {
  type PerformanceRoute,
  type RouteSection,
  normalizeRoute,
  routeProblem,
  paintModeSpan,
  paintPerformed,
  rescaleRoute,
  performanceRouteOf,
  mergeRanges,
  PUSH_MODES,
  PUSH_MODE_LABELS,
  PUSH_MODE_ABBREVIATIONS,
} from '../../src/types/performanceRoute';

const SONG = { startBar: 0, endBar: 16 };
const section = (id: string, startBar: number, endBar: number, name = id): RouteSection => ({ id, name, text: '', startBar, endBar });
const route = (over: Partial<PerformanceRoute> = {}): PerformanceRoute => ({
  version: 1,
  sections: [section('a', 0, 8), section('b', 8, 16)],
  modeSpans: [{ startBar: 0, endBar: 16, mode: 'drum' }],
  performedSpans: [],
  lanes: [],
  ...over,
});
const bounds = (r: PerformanceRoute) => r.sections.map(s => [s.id, s.startBar, s.endBar]);

describe('normalizeRoute', () => {
  it('a valid route comes back equal, and routeProblem finds nothing', () => {
    const valid = route();
    expect(normalizeRoute(valid, SONG)).toEqual(valid);
    expect(routeProblem(valid, SONG)).toBeNull();
  });

  it('P9-1b: overlap, gaps and reversed bounds are each reported, and made valid', () => {
    const overlap = route({ sections: [section('a', 0, 10), section('b', 8, 16)] });
    const gap = route({ sections: [section('a', 0, 6), section('b', 8, 16)] });
    const reversed = route({ sections: [section('a', 0, 8), section('b', 16, 8)] });
    expect(routeProblem(overlap, SONG)).toMatch(/overlap at bar 8/);
    expect(routeProblem(gap, SONG)).toMatch(/gap at bar 6/);
    expect(routeProblem(reversed, SONG)).toMatch(/reversed or empty bounds/);

    // The earlier section keeps shared bars; a gap goes to the section before it.
    expect(bounds(normalizeRoute(overlap, SONG))).toEqual([['a', 0, 10], ['b', 10, 16]]);
    expect(bounds(normalizeRoute(gap, SONG))).toEqual([['a', 0, 8], ['b', 8, 16]]);
    // A reversed section is dropped; the one before stretches to the end.
    expect(bounds(normalizeRoute(reversed, SONG))).toEqual([['a', 0, 16]]);
    for (const r of [overlap, gap, reversed]) expect(routeProblem(normalizeRoute(r, SONG), SONG)).toBeNull();
  });

  it('sections snap to whole bars and stretch or shrink with the song', () => {
    const r = route({ sections: [section('a', 0.4, 4.6), section('b', 4.6, 16)] });
    expect(bounds(normalizeRoute(r, SONG))).toEqual([['a', 0, 5], ['b', 5, 16]]);
    // The material grows at both ends: the first and last sections stretch.
    expect(bounds(normalizeRoute(route(), { startBar: -2, endBar: 20 }))).toEqual([['a', -2, 8], ['b', 8, 20]]);
    // It shrinks past a boundary: the section it no longer reaches goes.
    expect(bounds(normalizeRoute(route(), { startBar: 0, endBar: 6 }))).toEqual([['a', 0, 6]]);
    // It moves past every section: the first one is kept, over the whole song.
    expect(bounds(normalizeRoute(route(), { startBar: 30, endBar: 34 }))).toEqual([['a', 30, 34]]);
  });

  it('mode spans tile the song: gaps are "no mode set", neighbours with one mode merge, bounds snap to sixteenths', () => {
    const r = route({
      modeSpans: [
        { startBar: 2, endBar: 4, mode: 'drum' },
        { startBar: 4, endBar: 6.05, mode: 'drum' },
        { startBar: 6.05, endBar: 6.25, mode: 'control' },
        { startBar: 10, endBar: 30, mode: 'instrument' },
      ],
    });
    const spans = normalizeRoute(r, SONG).modeSpans;
    expect(spans).toEqual([
      { startBar: 0, endBar: 2, mode: null },
      { startBar: 2, endBar: 6.0625, mode: 'drum' },
      { startBar: 6.0625, endBar: 6.25, mode: 'control' },
      { startBar: 6.25, endBar: 10, mode: null },
      { startBar: 10, endBar: 16, mode: 'instrument' },
    ]);
    // With no spans at all, the song is one unset span.
    expect(normalizeRoute(route({ modeSpans: [] }), SONG).modeSpans).toEqual([{ startBar: 0, endBar: 16, mode: null }]);
  });

  it('performed spans merge per lane, stay inside the song, and go with their lane', () => {
    const r = route({
      performedSpans: [
        { laneId: 'sound:kick', startBar: 0, endBar: 4 },
        { laneId: 'sound:kick', startBar: 4, endBar: 6 },
        { laneId: 'sound:kick', startBar: 12, endBar: 40 },
        { laneId: 'sound:gone', startBar: 0, endBar: 4 },
      ],
      lanes: [{ laneId: 'sound:kick', kind: 'midi' }, { laneId: 'sound:kick', kind: 'audio' }, { laneId: 'sound:gone', kind: 'midi' }],
    });
    const out = normalizeRoute(r, SONG, new Set(['sound:kick']));
    expect(out.performedSpans).toEqual([
      { laneId: 'sound:kick', startBar: 0, endBar: 6 },
      { laneId: 'sound:kick', startBar: 12, endBar: 16 },
    ]);
    expect(out.lanes).toEqual([{ laneId: 'sound:kick', kind: 'midi' }]);
    // Without a live-lane set, no lane is dropped.
    expect(normalizeRoute(r, SONG).performedSpans.some(s => s.laneId === 'sound:gone')).toBe(true);
  });

  it('mergeRanges merges touching ranges, and ranges within maxGap when given', () => {
    const ranges = [{ startBar: 0, endBar: 2 }, { startBar: 2, endBar: 3 }, { startBar: 4, endBar: 5 }, { startBar: 7, endBar: 8 }];
    expect(mergeRanges(ranges)).toEqual([{ startBar: 0, endBar: 3 }, { startBar: 4, endBar: 5 }, { startBar: 7, endBar: 8 }]);
    expect(mergeRanges(ranges, 1)).toEqual([{ startBar: 0, endBar: 5 }, { startBar: 7, endBar: 8 }]);
  });
});

describe('route edits', () => {
  it('paintModeSpan paints over what was there', () => {
    const spans = paintModeSpan([{ startBar: 0, endBar: 16, mode: 'drum' }], { startBar: 4, endBar: 8 }, 'instrument');
    expect(normalizeRoute(route({ modeSpans: spans }), SONG).modeSpans).toEqual([
      { startBar: 0, endBar: 4, mode: 'drum' },
      { startBar: 4, endBar: 8, mode: 'instrument' },
      { startBar: 8, endBar: 16, mode: 'drum' },
    ]);
  });

  it('paintPerformed adds and removes a lane over a range, leaving other lanes alone', () => {
    const spans = [{ laneId: 'x', startBar: 0, endBar: 16 }, { laneId: 'y', startBar: 0, endBar: 16 }];
    const cut = paintPerformed(spans, 'x', { startBar: 4, endBar: 8 }, false);
    expect(normalizeRoute(route({ performedSpans: cut }), SONG).performedSpans).toEqual([
      { laneId: 'x', startBar: 0, endBar: 4 },
      { laneId: 'x', startBar: 8, endBar: 16 },
      { laneId: 'y', startBar: 0, endBar: 16 },
    ]);
    const back = paintPerformed(cut, 'x', { startBar: 4, endBar: 8 }, true);
    expect(normalizeRoute(route({ performedSpans: back }), SONG).performedSpans).toEqual(spans);
  });

  it('rescaleRoute moves every bound by the factor, snapped to its grid', () => {
    const r = route({
      sections: [section('a', 0, 6), section('b', 6, 16)],
      modeSpans: [{ startBar: 0, endBar: 3, mode: 'drum' }, { startBar: 3, endBar: 16, mode: null }],
      performedSpans: [{ laneId: 'x', startBar: 1, endBar: 3 }],
    });
    const half = rescaleRoute(r, 0.5);
    expect(bounds(half)).toEqual([['a', 0, 3], ['b', 3, 8]]);
    expect(half.modeSpans).toEqual([{ startBar: 0, endBar: 1.5, mode: 'drum' }, { startBar: 1.5, endBar: 8, mode: null }]);
    expect(half.performedSpans).toEqual([{ laneId: 'x', startBar: 0.5, endBar: 1.5 }]);
  });
});

describe('stored shape', () => {
  it('performanceRouteOf keeps a stored route and is idempotent', () => {
    const stored = route({ performedSpans: [{ laneId: 'sound:k', startBar: 0, endBar: 2 }], lanes: [{ laneId: 'sound:k', kind: 'midi' }] });
    expect(performanceRouteOf(stored)).toEqual(stored);
    expect(performanceRouteOf(performanceRouteOf(stored))).toEqual(stored);
  });

  it('anything that is not a route reads as none, and malformed items are dropped', () => {
    for (const raw of [undefined, null, 3, 'route', [], {}, { sections: [] }, { sections: [{ name: 'no id' }] }]) {
      expect(performanceRouteOf(raw)).toBeNull();
    }
    const odd = performanceRouteOf({
      sections: [{ id: 's', startBar: 0, endBar: 4, name: 7 }],
      modeSpans: [{ startBar: 0, endBar: 4, mode: 'theremin' }, { startBar: 0, endBar: 4, mode: null }, 'x'],
      performedSpans: [{ laneId: 3, startBar: 0, endBar: 1 }],
      lanes: [{ laneId: 'l', kind: 'video' }],
    });
    expect(odd).toEqual({
      version: 1,
      sections: [{ id: 's', name: '', text: '', startBar: 0, endBar: 4 }],
      modeSpans: [{ startBar: 0, endBar: 4, mode: null }],
      performedSpans: [],
      lanes: [],
    });
  });

  it('a section id stored twice is kept once', () => {
    const twice = performanceRouteOf({ ...route(), sections: [section('a', 0, 8), section('a', 8, 16)] })!;
    expect(twice.sections.map(s => [s.id, s.startBar])).toEqual([['a', 0]]);
  });

  it('five Push modes, each with a label and an abbreviation', () => {
    expect(PUSH_MODES).toEqual(['session', 'instrument', 'drum', 'fx', 'control']);
    expect(PUSH_MODES.map(m => PUSH_MODE_LABELS[m])).toEqual(['Session View', 'Instrument', 'Drum Rack', 'FX / Device', 'Control']);
    expect(new Set(PUSH_MODES.map(m => PUSH_MODE_ABBREVIATIONS[m])).size).toBe(5);
  });
});
