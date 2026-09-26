/**
 * The event timeline (S4.1, T24): one numbered, keyed list of Performance
 * Events, resolved the same way from any plan, and a stored key resolved
 * against it. See src/ui/analysis/eventTimeline.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEventTimeline,
  eventAtTime,
  eventOfNote,
  findSelectedEvent,
  formatEventLabel,
  getEventTimeline,
  planNotesByEvent,
  resolveEventKey,
} from '../../../src/ui/analysis/eventTimeline';
import { momentKey } from '../../../src/engine';
import { MOMENT_EPSILON } from '../../../src/types/performanceEvent';
import { type FingerAssignment } from '../../../src/types/executionPlan';
import { projectReducer } from '../../../src/ui/state/projectState';
import { importTestMidi1 } from '../../helpers/testMidi1';

/** A chord played 0, 2 and 4 ms apart, a single hit, and two hits 30 ms apart (two events). */
const NOTES = [
  { startTime: 0.004, voiceId: 'snare', eventKey: 'c' },
  { startTime: 0.000, voiceId: 'hat', eventKey: 'a' },
  { startTime: 0.002, voiceId: 'kick', eventKey: 'b' },
  { startTime: 0.5, voiceId: 'hat', eventKey: 'd' },
  { startTime: 1.0, voiceId: 'kick', eventKey: 'e' },
  { startTime: 1.03, voiceId: 'snare', eventKey: 'f' },
];

function note(eventKey: string | undefined, startTime: number, extra: Partial<FingerAssignment> = {}): FingerAssignment {
  return { eventKey, startTime, noteNumber: 36, assignedHand: 'left', finger: 'index', cost: 1, difficulty: 'Easy', ...extra };
}

describe('buildEventTimeline', () => {
  const timeline = buildEventTimeline(NOTES);

  it('groups notes within MOMENT_EPSILON of the first into one event, numbered in time order', () => {
    expect(timeline.events.map(e => [...e.noteKeys].sort())).toEqual([['a', 'b', 'c'], ['d'], ['e'], ['f']]);
    expect(timeline.events.map(e => e.index)).toEqual([0, 1, 2, 3]);
    expect(timeline.events[0]).toMatchObject({ startTime: 0, endTime: 0.004, noteCount: 3 });
  });

  it('keys each event by its first note\'s time and its sorted Sounds, and finds it by key or by note', () => {
    expect(timeline.events[0]!.key).toBe(momentKey(0, ['hat', 'kick', 'snare']));
    expect(timeline.byKey.get(timeline.events[1]!.key)).toBe(timeline.events[1]);
    expect(timeline.byNoteKey.get('b')).toBe(timeline.events[0]);
  });
});

describe('eventAtTime', () => {
  const timeline = buildEventTimeline(NOTES);
  const [chord, hat, kick, snare] = timeline.events;

  it('finds the event whose notes lie within MOMENT_EPSILON of the time', () => {
    expect(eventAtTime(timeline, 0.003)).toBe(chord);
    expect(eventAtTime(timeline, 0.004 + MOMENT_EPSILON)).toBe(chord);
    expect(eventAtTime(timeline, -MOMENT_EPSILON)).toBe(chord);
    expect(eventAtTime(timeline, 0.49)).toBe(hat);
  });

  it('picks the nearer of two events, and none when no note is that close', () => {
    expect(eventAtTime(timeline, 1.01)).toBe(kick);
    expect(eventAtTime(timeline, 1.02)).toBe(snare);
    expect(eventAtTime(timeline, 0.2)).toBeNull();
    expect(eventAtTime(timeline, 9)).toBeNull();
    expect(eventAtTime(buildEventTimeline([]), 0)).toBeNull();
  });
});

describe('resolveEventKey', () => {
  const timeline = buildEventTimeline(NOTES);

  it('resolves a key to its event, or to the event at its time when its Sounds changed', () => {
    const chord = timeline.events[0]!;
    expect(resolveEventKey(timeline, chord.key)).toBe(chord);
    // A mute took the snare out: the same instant is still selected.
    expect(resolveEventKey(timeline, momentKey(0, ['hat', 'kick']))).toBe(chord);
  });

  it('resolves nothing when no event is at the key\'s time, or there is no key', () => {
    expect(resolveEventKey(timeline, momentKey(0.25, ['hat']))).toBeNull();
    expect(resolveEventKey(timeline, null)).toBeNull();
    expect(resolveEventKey(timeline, undefined)).toBeNull();
    expect(resolveEventKey(timeline, 'nonsense')).toBeNull();
  });
});

describe('a plan\'s notes, by event', () => {
  const timeline = buildEventTimeline(NOTES);

  it('joins each note to its event by eventKey, whatever start time the plan gave it', () => {
    const plan = [note('a', 0), note('b', 0), note('c', 0), note('d', 0.5)];
    const byEvent = planNotesByEvent(timeline, plan);
    expect(byEvent.get(0)).toEqual(plan.slice(0, 3));
    expect(byEvent.get(1)).toEqual([plan[3]]);
    expect(byEvent.has(2)).toBe(false);
    expect(planNotesByEvent(timeline, plan)).toBe(byEvent);
  });

  it('joins a note with an unknown or missing eventKey by its time', () => {
    expect(eventOfNote(timeline, note('muted-note', 0.51))).toBe(timeline.events[1]);
    expect(eventOfNote(timeline, note(undefined, 1.0))).toBe(timeline.events[2]);
    expect(eventOfNote(timeline, note(undefined, 0.25))).toBeNull();
  });
});

describe('findSelectedEvent', () => {
  const timeline = buildEventTimeline(NOTES);
  const plan = [note('a', 0), note('b', 0.002, { cost: 4, difficulty: 'Medium' }), note('d', 0.5)];

  it('gives the selected event, its plan notes and their cost, read once for the event', () => {
    const selected = findSelectedEvent(timeline, plan, timeline.events[0]!.key)!;
    expect(selected.event).toBe(timeline.events[0]);
    expect(selected.notes.map(n => n.eventKey)).toEqual(['a', 'b']);
    expect(selected.cost).toMatchObject({ noteCount: 2, difficulty: 'Medium' });
  });

  it('gives no cost, never "Easy", when the plan has no note at the event', () => {
    const selected = findSelectedEvent(timeline, plan, timeline.events[2]!.key)!;
    expect(selected).toMatchObject({ notes: [], cost: null });
    expect(findSelectedEvent(timeline, plan, null)).toBeNull();
  });
});

describe('formatEventLabel', () => {
  it('reads "Event 12 · bar.beat.sixteenth" (decision Q7)', () => {
    expect(formatEventLabel({ index: 11, startTime: 2.75 }, 120)).toBe('Event 12 · 2.2.3');
    expect(formatEventLabel({ index: 0, startTime: 0 }, 120)).toBe('Event 1 · 1.1.1');
  });
});

describe('getEventTimeline', () => {
  it('numbers every unmuted Sound\'s notes, placed or not, and is built once per Sounds change', async () => {
    const state = await importTestMidi1();
    const timeline = getEventTimeline(state);
    expect(timeline.events).toHaveLength(32);
    expect(timeline.events.reduce((n, e) => n + e.noteCount, 0)).toBe(state.soundStreams.reduce((n, s) => n + s.events.length, 0));
    expect(getEventTimeline({ ...state })).toBe(timeline);
    // A mute changes the Sounds, so the timeline is rebuilt without that Sound.
    const muted = projectReducer(state, { type: 'TOGGLE_MUTE', payload: state.soundStreams[0]!.id });
    const without = getEventTimeline(muted);
    expect(without).not.toBe(timeline);
    expect(without.events.reduce((n, e) => n + e.noteCount, 0))
      .toBe(state.soundStreams.slice(1).reduce((n, s) => n + s.events.length, 0));
  });
});
