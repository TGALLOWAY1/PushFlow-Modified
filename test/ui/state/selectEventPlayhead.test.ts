/**
 * Moment-view stop-gaps in the reducer (S1b.4, T10 slice): selecting an event
 * while stopped moves the playhead there; while playing it does not; clearing
 * an empty selection returns the same state (T06).
 *
 * S4.3b (T10): the one current moment. A stop mid-song with no event picked
 * selects the playhead's event (P4-3c's state half), and a later stop moves
 * it; a picked event stays (P4-3b); the song's end clears a stop's selection.
 */

import { describe, it, expect } from 'vitest';
import { projectReducer, getDisplayedLayout, getActivePerformance, type ProjectState } from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import { playheadEvent } from '../../../src/ui/audio/TransportProvider';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

async function analysed() {
  const state = await suggestedTestMidi1();
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout: getDisplayedLayout(state)!,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  return { state: { ...state, analysisResult: analysis, analysisStale: false }, analysis };
}

/** An event after 1 s, as SELECT_EVENT takes it (S4.1: its momentKey and start). */
function laterEvent(state: Awaited<ReturnType<typeof analysed>>['state']) {
  const event = getEventTimeline(state).events.find(e => e.startTime > 1)!;
  return { key: event.key, startTime: event.startTime };
}

describe('SELECT_EVENT and the playhead', () => {
  it('while stopped, moves the playhead to the event', async () => {
    const { state } = await analysed();
    const later = laterEvent(state);
    const next = projectReducer(state, { type: 'SELECT_EVENT', payload: later });
    expect(next.currentTime).toBe(later.startTime);
    expect(next.selectedMomentKey).toBe(later.key);
  });

  it('selecting the selected event again, stopped elsewhere, seeks back to it (Codex review)', async () => {
    const { state } = await analysed();
    const later = laterEvent(state);
    const selected = projectReducer(state, { type: 'SELECT_EVENT', payload: later });
    const movedOn = { ...selected, currentTime: later.startTime + 2 };
    expect(projectReducer(movedOn, { type: 'SELECT_EVENT', payload: later }).currentTime).toBe(later.startTime);
    expect(projectReducer(selected, { type: 'SELECT_EVENT', payload: later })).toBe(selected);
  });

  it('while playing, leaves the playhead alone', async () => {
    const { state } = await analysed();
    const playing = { ...state, isPlaying: true, currentTime: 3.5 };
    const next = projectReducer(playing, { type: 'SELECT_EVENT', payload: laterEvent(state) });
    expect(next.currentTime).toBe(3.5);
    expect(next.selectedMomentKey).toBe(laterEvent(state).key);
  });

  it('clearing an empty selection returns the same state', async () => {
    const { state } = await analysed();
    expect(projectReducer({ ...state, selectedMomentKey: null }, { type: 'SELECT_EVENT', payload: null }).selectedMomentKey).toBeNull();
    const s = { ...state, selectedMomentKey: null, selectedNoteKey: null };
    expect(projectReducer(s, { type: 'SELECT_EVENT', payload: null })).toBe(s);
  });
});

describe('PLAYBACK_STOPPED: one current moment (S4.3b, T10)', () => {
  /** Stopped at `time`: what TransportProvider dispatches, with the playhead's event. */
  const stopAt = (state: ProjectState, time: number) =>
    projectReducer({ ...state, isPlaying: false }, { type: 'PLAYBACK_STOPPED', payload: { time, momentKey: playheadEvent(state, time)?.key ?? null } });

  it('the playhead\'s event is the last one the plan plays at or before it', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    expect(playheadEvent(state, events[5]!.startTime)).toEqual({ key: events[5]!.key, index: 5 });
    expect(playheadEvent(state, events[5]!.startTime + 0.2)).toEqual({ key: events[5]!.key, index: 5 });
    expect(playheadEvent(state, events[0]!.startTime - 0.01)).toBeNull();
    // No plan, no event to show.
    expect(playheadEvent({ ...state, analysisResult: null }, 3)).toBeNull();
  });

  it('with nothing picked, a stop mid-song selects the playhead\'s event and leaves the playhead where it stopped', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    const at = events[9]!.startTime + 0.2;
    const stopped = stopAt(state, at);
    expect(stopped.selectedMomentKey).toBe(events[9]!.key);
    expect(stopped.selectionFromPause).toBe(true);
    expect(stopped.currentTime).toBe(at);
    // The next stop moves it to where that one stops.
    const later = events[20]!.startTime + 0.1;
    const again = stopAt(stopped, later);
    expect(again.selectedMomentKey).toBe(events[20]!.key);
    expect(again.currentTime).toBe(later);
    // Stopping on the same event again changes nothing but the time.
    expect(stopAt(again, events[20]!.startTime + 0.15).selectedMomentKey).toBe(events[20]!.key);
  });

  it('a picked event is never moved by a stop: Stop brings it back', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    const picked = projectReducer(state, { type: 'SELECT_EVENT', payload: { key: events[4]!.key, startTime: events[4]!.startTime } });
    expect(picked.selectionFromPause).toBe(false);
    const stopped = stopAt(picked, events[12]!.startTime + 0.1);
    expect(stopped.selectedMomentKey).toBe(events[4]!.key);
    expect(stopped.selectionFromPause).toBe(false);
    expect(stopped.currentTime).toBe(events[12]!.startTime + 0.1);
  });

  it('picking the event a stop selected makes it the user\'s own', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    const stopped = stopAt(state, events[9]!.startTime + 0.2);
    const picked = projectReducer(stopped, { type: 'SELECT_EVENT', payload: { key: events[9]!.key, startTime: events[9]!.startTime } });
    expect(picked.selectionFromPause).toBe(false);
    expect(picked.currentTime).toBe(events[9]!.startTime);
    expect(stopAt(picked, events[15]!.startTime).selectedMomentKey).toBe(events[9]!.key);
  });

  it('the song\'s end clears a stop\'s selection but keeps a picked one', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    const stopped = stopAt(state, events[9]!.startTime + 0.2);
    const ended = projectReducer(stopped, { type: 'PLAYBACK_STOPPED', payload: { time: 16, momentKey: null } });
    expect(ended.selectedMomentKey).toBeNull();
    expect(ended.selectionFromPause).toBe(false);
    expect(ended.currentTime).toBe(16);
    const picked = projectReducer(state, { type: 'SELECT_EVENT', payload: { key: events[4]!.key, startTime: events[4]!.startTime } });
    expect(projectReducer(picked, { type: 'PLAYBACK_STOPPED', payload: { time: 16, momentKey: null } }).selectedMomentKey).toBe(events[4]!.key);
  });

  it('Escape\'s clear ends a stop\'s selection; the next stop selects again', async () => {
    const { state } = await analysed();
    const events = getEventTimeline(state).events;
    const cleared = projectReducer(stopAt(state, events[9]!.startTime + 0.2), { type: 'SELECT_EVENT', payload: null });
    expect(cleared.selectedMomentKey).toBeNull();
    expect(cleared.selectionFromPause).toBe(false);
    expect(stopAt(cleared, events[11]!.startTime).selectedMomentKey).toBe(events[11]!.key);
  });

  it('a stop that changes nothing returns the same state', async () => {
    const { state } = await analysed();
    const s = { ...state, currentTime: 0.2, selectedMomentKey: null, selectedNoteKey: null };
    expect(projectReducer(s, { type: 'PLAYBACK_STOPPED', payload: { time: 0.2, momentKey: null } })).toBe(s);
  });
});
