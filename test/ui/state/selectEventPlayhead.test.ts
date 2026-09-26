/**
 * Moment-view stop-gaps in the reducer (S1b.4, T10 slice): selecting an event
 * while stopped moves the playhead there; while playing it does not; clearing
 * an empty selection returns the same state (T06).
 */

import { describe, it, expect } from 'vitest';
import { projectReducer, getDisplayedLayout, getActivePerformance } from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
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
