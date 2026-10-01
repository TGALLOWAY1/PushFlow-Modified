/**
 * S9.2 · where things go on the Performance Route: the bar axis every row
 * shares, card states and detail, the ruler, and the lanes' scene, which is
 * what the canvas paints (so it is what these tests read).
 */

import { describe, it, expect } from 'vitest';
import {
  type RouteAxis,
  xOfBar,
  spanX,
  sectionState,
  sectionModes,
  cardDetail,
  barRangeLabel,
  sectionAt,
  barLabelStep,
  rulerTicks,
  laneDetail,
  laneScene,
  lanesLiveAt,
} from '../../../src/ui/route/routeGeometry';
import { clipsFor, detectedRoute, routeLanes } from '../../../src/ui/route/derive';
import { type ModeSpan, type PerformanceRoute, laneIdOfSound } from '../../../src/types/performanceRoute';
import { transportStateWord } from '../../../src/ui/route/RouteTransportBar';
import { spanLabel } from '../../../src/ui/route/ModeStrip';
import { doneCount } from '../../../src/ui/route/RouteBand';
import { routeProject, placedOnActive } from '../../helpers/routeProject';

const AXIS: RouteAxis = { startBar: 0, spanBars: 8, width: 800 };

describe('the bar axis', () => {
  it('maps bars to x across the width, and clips spans to it', () => {
    expect(xOfBar(AXIS, 0)).toBe(0);
    expect(xOfBar(AXIS, 2.5)).toBe(250);
    expect(spanX(AXIS, { startBar: 7, endBar: 12 })).toEqual({ x: 700, w: 100 });
    expect(spanX({ ...AXIS, startBar: 2 }, { startBar: 0, endBar: 3 })).toEqual({ x: 0, w: 100 });
  });
});

describe('section cards', () => {
  const section = { id: 's', name: 'Verse', text: '', startBar: 2, endBar: 6 };

  it('is upcoming before its first bar, active inside, done from its end', () => {
    expect([1.9, 2, 5.9, 6, 7].map(bar => sectionState(section, bar))).toEqual(['upcoming', 'active', 'active', 'done', 'done']);
  });

  it('lists its Push modes in order, once each, without "no mode set"', () => {
    const spans: ModeSpan[] = [
      { startBar: 0, endBar: 3, mode: 'drum' },
      { startBar: 3, endBar: 3.25, mode: 'control' },
      { startBar: 3.25, endBar: 4, mode: null },
      { startBar: 4, endBar: 5, mode: 'drum' },
      { startBar: 5, endBar: 8, mode: 'instrument' },
    ];
    expect(sectionModes(section, spans)).toEqual(['drum', 'control', 'instrument']);
  });

  it('shows less as it narrows: 220 / 150 / 92 / 58 / 30 px', () => {
    expect([400, 220, 219, 150, 92, 58, 30, 29].map(cardDetail))
      .toEqual(['full', 'full', 'abbr', 'abbr', 'glyphs', 'glyph', 'state', 'none']);
  });

  it('names its bars as the readout counts them', () => {
    expect(barRangeLabel({ startBar: 2, endBar: 6 })).toBe('Bars 3–6');
    expect(barRangeLabel({ startBar: 0, endBar: 1 })).toBe('Bar 1');
  });

  it('finds the section at the playhead, and the first or last outside the song', () => {
    const sections = [{ ...section, id: 'a', startBar: 0, endBar: 2 }, { ...section, id: 'b', startBar: 2, endBar: 8 }];
    expect([-1, 0, 2, 7.9, 9].map(bar => sectionAt(sections, bar)?.id)).toEqual(['a', 'a', 'b', 'b', 'b']);
    expect(doneCount(sections, 2)).toBe('1 / 2 sections done');
    expect(doneCount([sections[0]!], 0)).toBe('0 / 1 section done');
  });
});

describe('the ruler', () => {
  it('numbers bars as densely as 40 px allows, from bar 1', () => {
    expect(barLabelStep(AXIS)).toBe(1);
    expect(barLabelStep({ startBar: 0, spanBars: 160, width: 1000 })).toBe(8);
    const ticks = rulerTicks({ startBar: 0, spanBars: 16, width: 320 }, { startBar: 0, endBar: 16 });
    expect(ticks).toHaveLength(17);
    expect(ticks.filter(t => t.label).map(t => t.label)).toEqual(['1', '3', '5', '7', '9', '11', '13', '15']);
  });
});

describe('the lanes', () => {
  // 120 BPM: a bar is 2 s. Kick on every beat of bars 0–3, snare on bar 2's backbeats.
  const project = () => placedOnActive(routeProject({
    sounds: [
      { id: 'kick', bars: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3] },
      { id: 'snare', bars: [2.25, 2.75] },
      { id: 'pad', bars: [6], lengthBars: 1 },
    ],
  }), ['kick', 'snare']);

  const sceneOf = (axis: RouteAxis, unplayable: ReadonlySet<string> = new Set(), route?: PerformanceRoute) => {
    const state = project();
    const lanes = routeLanes(state);
    return laneScene({
      axis,
      lanes,
      streams: state.soundStreams,
      tempo: state.tempo,
      route: route ?? detectedRoute(state),
      clips: new Map(lanes.map(l => [l.id, clipsFor(l, state)])),
      unplayable,
      laneHeight: 36,
    });
  };

  it('draws single notes from 50 px a bar, and a density bar per bar below it', () => {
    expect(laneDetail({ startBar: 0, spanBars: 8, width: 400 })).toBe('notes');
    expect(laneDetail({ startBar: 0, spanBars: 8, width: 399 })).toBe('density');
    const notes = sceneOf(AXIS);
    expect(notes.primitives.filter(p => p.kind === 'note')).toHaveLength(13);
    const density = sceneOf({ startBar: 0, spanBars: 8, width: 200 });
    const kickBars = density.primitives.filter(p => p.kind === 'density' && p.laneId === laneIdOfSound('kick'));
    expect(kickBars).toHaveLength(4);
    // The busiest bar (4 kicks) fills the lane; a bar with one kick is a quarter as tall.
    const heights = kickBars.map(p => Math.round(p.h));
    expect(Math.max(...heights)).toBe(26);
    expect(Math.min(...heights)).toBe(Math.round(26 / 4));
  });

  it('keeps an unplayable note in place and marks it, as a note or as its bar', () => {
    const state = project();
    const snareKeys = state.soundStreams.find(s => s.id === 'snare')!.events.map(e => e.eventKey);
    const unplayable = new Set([snareKeys[0]!]);
    const notes = sceneOf(AXIS, unplayable);
    const marked = notes.primitives.filter(p => p.kind === 'note' && p.unplayable);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({ soundId: 'snare', eventKey: snareKeys[0], x: 225 });
    expect(notes.unplayableMarks).toBe(1);
    // Every note is still drawn: 13 with or without the mark.
    expect(notes.primitives.filter(p => p.kind === 'note')).toHaveLength(13);
    const density = sceneOf({ startBar: 0, spanBars: 8, width: 200 }, unplayable);
    expect(density.primitives.filter(p => p.kind === 'density' && p.unplayable)).toHaveLength(1);
    expect(density.unplayableMarks).toBe(1);
  });

  it('draws clips, and the performed overlay cut where the Push mode changes', () => {
    const state = project();
    const base = detectedRoute(state);
    const route: PerformanceRoute = {
      ...base,
      modeSpans: [{ startBar: 0, endBar: 2, mode: 'drum' }, { startBar: 2, endBar: 8, mode: 'instrument' }],
    };
    const scene = sceneOf(AXIS, new Set(), route);
    const kick = laneIdOfSound('kick');
    expect(scene.primitives.filter(p => p.kind === 'clip' && p.laneId === kick).map(p => [p.x, p.w])).toEqual([[0, 400]]);
    expect(scene.primitives.filter(p => p.kind === 'performed' && p.laneId === kick).map(p => p.kind === 'performed' && [p.mode, p.x, p.w]))
      .toEqual([['drum', 0, 200], ['instrument', 200, 200]]);
    // The pad isn't placed: it plays from its clip, with no overlay, dimmed.
    const pad = laneIdOfSound('pad');
    expect(scene.primitives.some(p => p.kind === 'performed' && p.laneId === pad)).toBe(false);
    expect(scene.rows.find(r => r.laneId === pad)!.dim).toBe(true);
    expect(scene.rows.find(r => r.laneId === kick)!.dim).toBe(false);
  });

  it('a lane is live where it is performed', () => {
    const route = detectedRoute(project());
    expect([...lanesLiveAt(route, 0.5)].sort()).toEqual([laneIdOfSound('kick')]);
    expect([...lanesLiveAt(route, 2.5)].sort()).toEqual([laneIdOfSound('kick'), laneIdOfSound('snare')]);
    expect(lanesLiveAt(route, 6.5).size).toBe(0);
  });
});

describe('words on the strip and the transport', () => {
  it('a span shows its name, then its abbreviation, then its glyph, then nothing', () => {
    expect([200, 110, 109, 44, 43, 14, 13].map(spanLabel)).toEqual(['full', 'full', 'abbr', 'abbr', 'glyph', 'glyph', 'none']);
  });

  it('the transport says PLAYING, STOPPED or END OF SONG', () => {
    expect(transportStateWord(true, 3, 16)).toBe('PLAYING');
    expect(transportStateWord(false, 3, 16)).toBe('STOPPED');
    expect(transportStateWord(false, 16, 16)).toBe('END OF SONG');
  });
});
