/**
 * Moment-view stop-gaps in the reducer (S1b.4, T10 slice): selecting an event
 * while stopped moves the playhead there; while playing it does not; clearing
 * an empty selection returns the same state (T06).
 */

import { describe, it, expect } from 'vitest';
import { projectReducer, getDisplayedLayout, getActivePerformance } from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

async function analysed() {
  const state = await suggestedTestMidi1();
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout: getDisplayedLayout(state)!,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  return { state: { ...state, analysisResult: analysis, analysisStale: false }, analysis };
}

describe('SELECT_EVENT and the playhead', () => {
  it('while stopped, moves the playhead to the event', async () => {
    const { state, analysis } = await analysed();
    const later = analysis.executionPlan.fingerAssignments.find(a => a.startTime > 1)!;
    const next = projectReducer(state, { type: 'SELECT_EVENT', payload: later.eventIndex! });
    expect(next.currentTime).toBe(later.startTime);
  });

  it('while playing, leaves the playhead alone', async () => {
    const { state, analysis } = await analysed();
    const playing = { ...state, isPlaying: true, currentTime: 3.5 };
    const later = analysis.executionPlan.fingerAssignments.find(a => a.startTime > 1)!;
    expect(projectReducer(playing, { type: 'SELECT_EVENT', payload: later.eventIndex! }).currentTime).toBe(3.5);
  });

  it('clearing an empty selection returns the same state', async () => {
    const { state } = await analysed();
    expect(projectReducer({ ...state, selectedEventIndex: null }, { type: 'SELECT_EVENT', payload: null }).selectedEventIndex).toBeNull();
    const s = { ...state, selectedEventIndex: null };
    expect(projectReducer(s, { type: 'SELECT_EVENT', payload: null })).toBe(s);
  });
});
