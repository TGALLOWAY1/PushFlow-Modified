/**
 * S9.1 · what the Performance Route derives (P9-1b, P9-1e, P9-1f).
 *
 * The route lanes, their clips, the detected default route, and the phrases
 * and actions below a section, all derived and never saved. The default mode
 * strip and performed lanes come from the Active Layout, never from names.
 */

import { describe, it, expect } from 'vitest';
import {
  songBarRange,
  routeLanes,
  clipsFor,
  detectedRoute,
  displayedRoute,
  phrasesFor,
  actionsFor,
  modeAt,
  MIN_DETECTED_SECTION_BARS,
} from '../../../src/ui/route/derive';
import { routeProblem, laneIdOfGroup, laneIdOfSound, type ModeSpan } from '../../../src/types/performanceRoute';
import { projectReducer } from '../../../src/ui/state/projectState';
import { songSpan } from '../../../src/ui/audio/transportMath';
import { barSeconds, formatBarBeat } from '../../../src/utils/musicalTime';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';
import { routeProject, placedOnActive } from '../../helpers/routeProject';

describe('the song in bars', () => {
  it('P9-1e: a file whose first note is in bar 3 starts its route at bar 2 (0-based), as the transport and the readout do', () => {
    const tempo = 97;
    const state = routeProject({ tempo, sounds: [{ id: 'kick', bars: [2, 2.5, 3.25, 6.75] }] });
    const range = songBarRange(state);
    expect(range).toEqual({ startBar: 2, endBar: 7 });
    // The transport's song span, in bars.
    const span = songSpan(state.soundStreams, tempo);
    expect(span.start / barSeconds(tempo)).toBeCloseTo(range.startBar, 9);
    expect(span.end / barSeconds(tempo)).toBeCloseTo(range.endBar, 9);
    // The detected route starts there, and every route bar is the readout's bar minus one.
    const route = detectedRoute(state);
    expect(route.sections[0].startBar).toBe(2);
    expect(formatBarBeat(span.start, tempo)).toBe('3.1.1');
    for (let b = range.startBar; b < range.endBar; b++) {
      expect(formatBarBeat(b * barSeconds(tempo), tempo)).toBe(`${b + 1}.1.1`);
    }
  });

  it('an empty project spans the transport\'s four bars from the start', () => {
    const state = routeProject({ sounds: [] });
    expect(songBarRange(state)).toEqual({ startBar: 0, endBar: 4 });
    expect(routeProblem(detectedRoute(state), songBarRange(state))).toBeNull();
  });
});

describe('the detected route', () => {
  it('P9-1b: on TEST MIDI 1 it has at least one section and tiles the song', async () => {
    const state = await importTestMidi1();
    const route = detectedRoute(state);
    expect(route.sections.length).toBeGreaterThanOrEqual(1);
    expect(routeProblem(route, songBarRange(state))).toBeNull();
    expect(route.sections.map(s => s.name)).toEqual(route.sections.map((_, i) => `Section ${i + 1}`));
    expect(route.sections.every(s => s.text === '')).toBe(true);
  });

  it('splits where nothing sounds for 2 s or more, at the bar the next note is in', () => {
    // 120 BPM: a bar is 2 s. Notes in bars 0–5, silence, then bars 9–15.
    const state = routeProject({ sounds: [{ id: 'kick', bars: [0, 1, 2, 3, 4, 5, 9.5, 10, 11, 12, 13, 14, 15] }] });
    expect(detectedRoute(state).sections.map(s => [s.name, s.startBar, s.endBar])).toEqual([
      ['Section 1', 0, 9],
      ['Section 2', 9, 16],
    ]);
    // A hit per bar is 2 s from start to start, but each sounds for a moment, so it is no silence.
    expect(detectedRoute(routeProject({ sounds: [{ id: 'kick', bars: [0, 1, 2, 3, 4, 5, 6, 7] }] })).sections).toHaveLength(1);
    // A long note fills the gap after it.
    const held = routeProject({ sounds: [{ id: 'pad', bars: [0], lengthBars: 7.5 }, { id: 'kick', bars: [0, 8, 9, 10, 11] }] });
    expect(detectedRoute(held).sections).toHaveLength(1);
  });

  it(`never makes a section shorter than ${MIN_DETECTED_SECTION_BARS} bars`, () => {
    // Silences after bar 1 and after bar 10 would give sections of 2 and 1 bars at the edges.
    const state = routeProject({ sounds: [{ id: 'kick', bars: [0, 0.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12] }] });
    const sections = detectedRoute(state).sections;
    expect(sections.every(s => s.endBar - s.startBar >= MIN_DETECTED_SECTION_BARS)).toBe(true);
    expect(routeProblem(detectedRoute(state), songBarRange(state))).toBeNull();
  });

  it('P9-1f: with TEST MIDI 1 placed, every lane is performed and the strip is Drum Rack over the bars with notes', async () => {
    const placed = projectReducer(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
    const lanes = routeLanes(placed);
    expect(lanes).toHaveLength(7);
    expect(lanes.every(l => l.performed)).toBe(true);
    const route = detectedRoute(placed);
    const range = songBarRange(placed);
    expect(route.modeSpans).toEqual([{ ...range, mode: 'drum' }]);
    // Each lane performed over its own clips.
    for (const lane of lanes) {
      expect(route.performedSpans.filter(s => s.laneId === lane.id).map(({ startBar, endBar }) => ({ startBar, endBar })))
        .toEqual(clipsFor(lane, placed));
    }
  });

  it('P9-1f: with nothing placed, no lane is performed and no mode is set, but the sections are still there', async () => {
    const state = await importTestMidi1();
    expect(routeLanes(state).some(l => l.performed)).toBe(false);
    const route = detectedRoute(state);
    expect(route.modeSpans).toEqual([{ ...songBarRange(state), mode: null }]);
    expect(route.performedSpans).toEqual([]);
    expect(route.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('the strip follows the placed lanes only: Drum Rack where they play, no mode where only unplaced ones do', () => {
    const state = placedOnActive(routeProject({
      sounds: [
        { id: 'kick', bars: [0, 1, 2, 3] },
        { id: 'bass', bars: [8, 9, 10, 11] },
      ],
    }), ['kick']);
    expect(detectedRoute(state).modeSpans).toEqual([
      { startBar: 0, endBar: 4, mode: 'drum' },
      { startBar: 4, endBar: 12, mode: null },
    ]);
    expect(detectedRoute(state).performedSpans).toEqual([{ laneId: laneIdOfSound('kick'), startBar: 0, endBar: 4 }]);
  });

  it('displayedRoute is the authored route when there is one', () => {
    const state = routeProject({ sounds: [{ id: 'kick', bars: [0, 7] }] });
    expect(displayedRoute(state)).toEqual(detectedRoute(state));
    const named = projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Verse' } });
    expect(displayedRoute(named).sections[0].name).toBe('Verse');
  });
});

describe('route lanes', () => {
  const grouped = () => routeProject({
    groups: [{ groupId: 'drums', name: 'Drums' }, { groupId: 'empty', name: 'Empty' }],
    sounds: [
      { id: 'kick', bars: [0], groupId: 'drums' },
      { id: 'bass', bars: [1] },
      { id: 'snare', bars: [2], groupId: 'drums' },
      { id: 'lead', bars: [3] },
    ],
  });

  it('a group is one lane and a Sound in no group is its own; empty groups have none', () => {
    const lanes = routeLanes(grouped());
    expect(lanes.map(l => [l.id, l.name, l.soundIds])).toEqual([
      [laneIdOfGroup('drums'), 'Drums', ['kick', 'snare']],
      [laneIdOfSound('bass'), 'bass', ['bass']],
      [laneIdOfSound('lead'), 'lead', ['lead']],
    ]);
    expect(lanes.every(l => l.kind === 'midi')).toBe(true);
  });

  it('a lane is performed when one of its Sounds is on the Active Layout and in the analysis; a draft is not enough', () => {
    const state = grouped();
    const draft = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: state.soundStreams.find(s => s.id === 'snare')! } });
    expect(routeLanes(draft).some(l => l.performed)).toBe(false);

    const placed = placedOnActive(state, ['snare', 'lead']);
    expect(routeLanes(placed).map(l => [l.id, l.performed])).toEqual([
      [laneIdOfGroup('drums'), true],
      [laneIdOfSound('bass'), false],
      [laneIdOfSound('lead'), true],
    ]);
    const excluded = projectReducer(placed, { type: 'SET_SOUND_EXCLUDED', payload: { soundId: 'lead', excluded: true } });
    expect(routeLanes(excluded).find(l => l.id === laneIdOfSound('lead'))!.performed).toBe(false);
  });

  it('clips split where two or more empty bars come between notes, and hold across one', () => {
    const state = routeProject({ sounds: [{ id: 'kick', bars: [0, 1, 3, 6, 7.5], lengthBars: 0.25 }, { id: 'pad', bars: [0], lengthBars: 2.5 }] });
    expect(clipsFor({ soundIds: ['kick'] }, state)).toEqual([{ startBar: 0, endBar: 4 }, { startBar: 6, endBar: 8 }]);
    // A long note covers every bar it sounds in.
    expect(clipsFor({ soundIds: ['pad'] }, state)).toEqual([{ startBar: 0, endBar: 3 }]);
  });
});

describe('phrases and actions', () => {
  it('a section splits into 4-bar phrases from its start, the last cut at its end', () => {
    expect(phrasesFor({ startBar: 2, endBar: 13 })).toEqual([
      { startBar: 2, endBar: 6 },
      { startBar: 6, endBar: 10 },
      { startBar: 10, endBar: 13 },
    ]);
    expect(phrasesFor({ startBar: 0, endBar: 4 }, 2)).toEqual([{ startBar: 0, endBar: 2 }, { startBar: 2, endBar: 4 }]);
  });

  it('a phrase has one action per bar, split where the Push mode changes inside a bar', () => {
    const spans: ModeSpan[] = [
      { startBar: 0, endBar: 1.75, mode: 'drum' },
      { startBar: 1.75, endBar: 2, mode: 'control' },
      { startBar: 2, endBar: 4, mode: 'instrument' },
    ];
    expect(actionsFor({ startBar: 0, endBar: 3 }, spans)).toEqual([
      { startBar: 0, endBar: 1, mode: 'drum' },
      { startBar: 1, endBar: 1.75, mode: 'drum' },
      { startBar: 1.75, endBar: 2, mode: 'control' },
      { startBar: 2, endBar: 3, mode: 'instrument' },
    ]);
    expect(modeAt(spans, 1.8)).toBe('control');
    expect(modeAt(spans, 9)).toBeNull();
  });
});
