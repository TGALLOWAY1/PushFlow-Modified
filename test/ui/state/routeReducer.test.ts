/**
 * S9.1 · the Performance Route's edits (P9-1c, P9-1d).
 *
 * Each edit is document truth that is never an analysis input: it bumps
 * updatedAt (so autosave writes it) and never marks the analysis stale. The
 * first edit adopts the detected route; the route keeps tiling the song when
 * the notes, the tempo or the lanes change.
 */

import { describe, it, expect } from 'vitest';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { analysisInputsChanged } from '../../../src/ui/state/analysisInputs';
import { serializeProject, deserializeProject } from '../../../src/ui/persistence/projectSerializer';
import { historyLabelFor } from '../../../src/ui/state/historyLabels';
import { NEW_SECTION_NAME } from '../../../src/ui/state/routeReducer';
import { detectedRoute, songBarRange } from '../../../src/ui/route/derive';
import { routeProblem, laneIdOfGroup, laneIdOfSound, type PerformanceRoute } from '../../../src/types/performanceRoute';
import { barSeconds } from '../../../src/utils/musicalTime';
import { routeProject, placedOnActive } from '../../helpers/routeProject';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

/** Kick and snare over bars 0–16 at 120 BPM, placed and promoted, with analysis fresh. */
function project(): ProjectState {
  const state = placedOnActive(routeProject({
    sounds: [
      { id: 'kick', bars: Array.from({ length: 16 }, (_, i) => i) },
      { id: 'snare', bars: Array.from({ length: 16 }, (_, i) => i + 0.5) },
    ],
  }), ['kick', 'snare']);
  return { ...state, analysisStale: false };
}

/** The project with an authored route of three sections: Intro 0–4, Verse 4–12, Outro 12–16. */
function authored(): ProjectState {
  let state = project();
  state = projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 4, newSectionId: 'verse' } });
  state = projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 12, newSectionId: 'outro' } });
  state = projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Intro' } });
  state = projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'verse', name: 'Verse' } });
  return projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'outro', name: 'Outro' } });
}

const route = (state: ProjectState): PerformanceRoute => state.performanceRoute!;
const sections = (state: ProjectState) => route(state).sections.map(s => [s.name, s.startBar, s.endBar]);
const tiles = (state: ProjectState) => routeProblem(route(state), songBarRange(state));

describe('adopting the detected route', () => {
  it('a project starts with no route, and the first edit adopts the detected one and applies the edit in the same step', () => {
    const state = project();
    expect(state.performanceRoute).toBeNull();
    const named = projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Groove' } });
    expect(route(named)).toEqual({ ...detectedRoute(state), sections: [{ ...detectedRoute(state).sections[0], name: 'Groove' }] });
  });

  it('ROUTE_ADOPT_DETECTED takes the detected route as it is; again, it changes nothing', () => {
    const state = project();
    const adopted = projectReducer(state, { type: 'ROUTE_ADOPT_DETECTED' });
    expect(route(adopted)).toEqual(detectedRoute(state));
    expect(projectReducer(adopted, { type: 'ROUTE_ADOPT_DETECTED' })).toBe(adopted);
  });

  it('an edit that changes nothing changes no state, adopted or not', () => {
    const state = project();
    expect(projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Section 1' } })).toBe(state);
    expect(projectReducer(state, { type: 'ROUTE_MERGE_SECTION', payload: { sectionId: 'section-1' } })).toBe(state);
    const intro = authored();
    expect(projectReducer(intro, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Intro' } })).toBe(intro);
    expect(projectReducer(intro, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'nope', name: 'X' } })).toBe(intro);
  });

  it('ROUTE_CLEAR goes back to no route', () => {
    const cleared = projectReducer(authored(), { type: 'ROUTE_CLEAR' });
    expect(cleared.performanceRoute).toBeNull();
    expect(projectReducer(cleared, { type: 'ROUTE_CLEAR' })).toBe(cleared);
  });
});

describe('sections', () => {
  it('split and name: the new section after the bar is "New section"', () => {
    const state = projectReducer(project(), { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 6, newSectionId: 'b' } });
    expect(sections(state)).toEqual([['Section 1', 0, 6], [NEW_SECTION_NAME, 6, 16]]);
    // Not on a boundary or outside the song.
    for (const bar of [0, 6, 16, 40]) {
      expect(projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar } })).toBe(state);
    }
    // A taken id is not reused.
    const again = projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 10, newSectionId: 'b' } });
    expect(new Set(route(again).sections.map(s => s.id)).size).toBe(3);
  });

  it('text is what you do; names are kept as typed', () => {
    const state = projectReducer(authored(), { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'verse', text: 'Kick L2 · Snare R3' } });
    expect(route(state).sections[1]).toMatchObject({ name: 'Verse', text: 'Kick L2 · Snare R3' });
  });

  it('a boundary moves to a bar and never past its neighbours: each side keeps at least a bar', () => {
    const state = authored();
    const move = (bar: number) => sections(projectReducer(state, { type: 'ROUTE_MOVE_BOUNDARY', payload: { sectionId: 'verse', bar } }));
    expect(move(6.4)).toEqual([['Intro', 0, 6], ['Verse', 6, 12], ['Outro', 12, 16]]);
    expect(move(-5)).toEqual([['Intro', 0, 1], ['Verse', 1, 12], ['Outro', 12, 16]]);
    expect(move(30)).toEqual([['Intro', 0, 11], ['Verse', 11, 12], ['Outro', 12, 16]]);
    // The first section's start is the song's start, not a boundary.
    expect(projectReducer(state, { type: 'ROUTE_MOVE_BOUNDARY', payload: { sectionId: 'section-1', bar: 2 } })).toBe(state);
  });

  it('merging removes the boundary before a section; the earlier one keeps its name and fills in its blanks', () => {
    let state = projectReducer(authored(), { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'outro', text: 'Fade the hats' } });
    state = projectReducer(state, { type: 'ROUTE_MERGE_SECTION', payload: { sectionId: 'outro' } });
    expect(sections(state)).toEqual([['Intro', 0, 4], ['Verse', 4, 16]]);
    expect(route(state).sections[1].text).toBe('Fade the hats');
    expect(tiles(state)).toBeNull();
  });
});

describe('Push mode spans and performed lanes', () => {
  it('a mode is painted over a range; neighbours keep the rest', () => {
    const state = projectReducer(authored(), { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 4, endBar: 8, mode: 'instrument' } });
    expect(route(state).modeSpans).toEqual([
      { startBar: 0, endBar: 4, mode: 'drum' },
      { startBar: 4, endBar: 8, mode: 'instrument' },
      { startBar: 8, endBar: 16, mode: 'drum' },
    ]);
    // A quarter-beat of Control presses between two modes.
    const control = projectReducer(state, { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 7.9375, endBar: 8, mode: 'control' } });
    expect(route(control).modeSpans[2]).toEqual({ startBar: 7.9375, endBar: 8, mode: 'control' });
    expect(tiles(control)).toBeNull();
  });

  it('moving a span\'s ends: it paints what it grows into, and its neighbour takes what it gives up', () => {
    let state = projectReducer(authored(), { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 4, endBar: 8, mode: 'instrument' } });
    state = projectReducer(state, { type: 'ROUTE_SET_SPAN_ENDS', payload: { atBar: 5, startBar: 6, endBar: 10 } });
    expect(route(state).modeSpans).toEqual([
      { startBar: 0, endBar: 6, mode: 'drum' },
      { startBar: 6, endBar: 10, mode: 'instrument' },
      { startBar: 10, endBar: 16, mode: 'drum' },
    ]);
    // Shrinking at the song's edge leaves no mode set there.
    const edge = projectReducer(state, { type: 'ROUTE_SET_SPAN_ENDS', payload: { atBar: 0, startBar: 2, endBar: 6 } });
    expect(route(edge).modeSpans[0]).toEqual({ startBar: 0, endBar: 2, mode: null });
    // Reversed ends do nothing.
    expect(projectReducer(state, { type: 'ROUTE_SET_SPAN_ENDS', payload: { atBar: 7, startBar: 9, endBar: 6 } })).toBe(state);
  });

  it('a lane is marked played from its clip over a range, and performed again', () => {
    const kick = laneIdOfSound('kick');
    const state = projectReducer(authored(), { type: 'ROUTE_SET_PERFORMED', payload: { laneId: kick, startBar: 4, endBar: 12, performed: false } });
    expect(route(state).performedSpans.filter(s => s.laneId === kick)).toEqual([
      { laneId: kick, startBar: 0, endBar: 4 },
      { laneId: kick, startBar: 12, endBar: 16 },
    ]);
    const back = projectReducer(state, { type: 'ROUTE_SET_PERFORMED', payload: { laneId: kick, startBar: 4, endBar: 12, performed: true } });
    expect(route(back).performedSpans).toEqual(route(authored()).performedSpans);
  });
});

describe('route edits are never analysis inputs (P9-1c)', () => {
  const EDITS: ProjectAction[] = [
    { type: 'ROUTE_ADOPT_DETECTED' },
    { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Drop' } },
    { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'section-1', text: 'Both hands on the drum pads' } },
    { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 8 } },
    { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 8, endBar: 12, mode: 'session' } },
    { type: 'ROUTE_SET_SPAN_ENDS', payload: { atBar: 0, startBar: 0, endBar: 10 } },
    { type: 'ROUTE_SET_PERFORMED', payload: { laneId: laneIdOfSound('snare'), startBar: 0, endBar: 8, performed: false } },
    { type: 'ROUTE_CLEAR' },
  ];

  it('each edit changes the route and updatedAt, has its own undo name, and leaves the analysis fresh', async () => {
    let state = project();
    for (const action of EDITS) {
      const before = { ...state, updatedAt: '2000-01-01T00:00:00.000Z' };
      const after = projectReducer(before, action);
      expect(after.performanceRoute, action.type).not.toEqual(before.performanceRoute);
      expect(after.updatedAt, action.type).not.toBe(before.updatedAt);
      expect(after.analysisStale, action.type).toBe(false);
      expect(analysisInputsChanged(before, after), action.type).toBe(false);
      expect(after.activeLayout, action.type).toBe(before.activeLayout);
      expect(after.voiceConstraints, action.type).toBe(before.voiceConstraints);
      expect(historyLabelFor(action), action.type).not.toBe('Edit');
      state = after;
    }
    // Two more edits, so the boundary and merge actions are covered too.
    const split = projectReducer(project(), { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 8, newSectionId: 'b' } });
    for (const action of [
      { type: 'ROUTE_MOVE_BOUNDARY', payload: { sectionId: 'b', bar: 6 } },
      { type: 'ROUTE_MERGE_SECTION', payload: { sectionId: 'b' } },
    ] as ProjectAction[]) {
      const after = projectReducer(split, action);
      expect(after.performanceRoute, action.type).not.toEqual(split.performanceRoute);
      expect(after.analysisStale, action.type).toBe(false);
      expect(historyLabelFor(action), action.type).not.toBe('Edit');
    }
  });
});

describe('the route follows the material', () => {
  it('P9-1d: on a seconds store, 120 → 60 BPM halves every bar number and the route still tiles the new song', () => {
    let state = projectReducer(authored(), { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 4, endBar: 8, mode: 'instrument' } });
    state = projectReducer(state, { type: 'SET_TEMPO', payload: 60 });
    expect(songBarRange(state)).toEqual({ startBar: 0, endBar: 8 });
    expect(sections(state)).toEqual([['Intro', 0, 2], ['Verse', 2, 6], ['Outro', 6, 8]]);
    expect(route(state).modeSpans).toEqual([
      { startBar: 0, endBar: 2, mode: 'drum' },
      { startBar: 2, endBar: 4, mode: 'instrument' },
      { startBar: 4, endBar: 8, mode: 'drum' },
    ]);
    expect(tiles(state)).toBeNull();
    // Each boundary is still on the note it was on: Verse starts with the kick that was at bar 4.
    const kick = state.soundStreams.find(s => s.id === 'kick')!.events[4];
    expect(kick.startTime).toBe(route(state).sections[1].startBar * barSeconds(60));
  });

  it('P9-1d: on TEST MIDI 1, 120 → 90 BPM keeps the route tiling the song', async () => {
    let state = projectReducer(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
    state = projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 4 } });
    state = projectReducer(state, { type: 'SET_TEMPO', payload: 90 });
    expect(tiles(state)).toBeNull();
    expect(route(state).sections.map(s => s.startBar)).toEqual([0, 3]);
  });

  it('notes added after the end stretch the last section; notes removed from the end shrink it', () => {
    const state = authored();
    const longer = projectReducer(state, {
      type: 'UPSERT_LANE_SOURCE',
      payload: {
        notesOnly: true,
        sourceFile: state.sourceFiles[0],
        lanes: state.performanceLanes.map(l => (l.id === 'kick'
          ? { ...l, events: [...l.events, { ...l.events[0], eventId: 'late', startTime: 19 * 2 }] }
          : l)),
      },
    });
    expect(sections(longer)).toEqual([['Intro', 0, 4], ['Verse', 4, 12], ['Outro', 12, 20]]);
    expect(tiles(longer)).toBeNull();
    // The new bars have no mode set.
    expect(route(longer).modeSpans.at(-1)).toEqual({ startBar: 16, endBar: 20, mode: null });
  });

  it('a deleted Sound takes its performed spans with it; a regrouped one moves to its group\'s lane', () => {
    const state = authored();
    const deleted = projectReducer(state, { type: 'DELETE_LANE', payload: 'snare' });
    expect(route(deleted).performedSpans.map(s => s.laneId)).toEqual([laneIdOfSound('kick')]);

    let grouped = projectReducer(state, { type: 'CREATE_LANE_GROUP', payload: { groupId: 'drums', name: 'Drums', color: '#888', orderIndex: 0, isCollapsed: false } });
    grouped = projectReducer(grouped, { type: 'SET_LANE_GROUP', payload: { laneId: 'kick', groupId: 'drums' } });
    expect(route(grouped).performedSpans.map(s => s.laneId)).toEqual([laneIdOfSound('snare')]);
    grouped = projectReducer(grouped, { type: 'ROUTE_SET_PERFORMED', payload: { laneId: laneIdOfGroup('drums'), startBar: 0, endBar: 16, performed: true } });
    expect(route(grouped).performedSpans.map(s => s.laneId)).toEqual([laneIdOfGroup('drums'), laneIdOfSound('snare')]);
  });

  it('a stored route that no longer fits the song tiles it again when the project opens', () => {
    const state = authored();
    const stored = serializeProject(state);
    const off = { ...stored, performanceRoute: { ...stored.performanceRoute!, sections: [{ ...stored.performanceRoute!.sections[0], endBar: 40 }] } };
    const opened = deserializeProject(off);
    expect(sections(opened)).toEqual([['Intro', 0, 16]]);
    expect(tiles(opened)).toBeNull();
    expect(sections(deserializeProject(stored))).toEqual(sections(state));
  });

  it('steps that change nothing the route reads leave it the same object', () => {
    const state = authored();
    for (const action of [
      { type: 'SET_CURRENT_TIME', payload: 3 },
      { type: 'RENAME_PROJECT', payload: 'Night Transit' },
      { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '5,5', stream: state.soundStreams[0] } },
    ] as ProjectAction[]) {
      expect(projectReducer(state, action).performanceRoute, action.type).toBe(state.performanceRoute);
    }
  });
});
