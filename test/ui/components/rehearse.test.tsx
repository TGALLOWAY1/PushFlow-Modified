// @vitest-environment happy-dom
/**
 * S4.3b · Rehearse (T10) and the count-in (T59), through the real components.
 *
 * Rehearse on the selected Events row, in the docked inspector (with its speed
 * menu) and under the chart: it selects the event, loops its bar and the next
 * on bar lines at the rehearse speed, and plays from the loop's start; while
 * playing it moves into the loop without restarting. Through the workspace's
 * TransportProvider, a Rehearse from stopped reaches the engine with a count-in
 * of at least a bar, while plain Play counts in only as set.
 *
 * TEST MIDI 1 with its Sounds spread over the grid: 8 bars at 120 BPM (2 s a
 * bar), an event every 0.5 s.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { getActivePerformance, getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { EventsPanel } from '../../../src/ui/components/EventsPanel';
import { MomentInspector } from '../../../src/ui/components/workspace/MomentInspector';
import { EventCostChart } from '../../../src/ui/components/panels/EventCostChart';
import { TransportProvider } from '../../../src/ui/audio/TransportProvider';
import { liveTransport } from '../../../src/ui/audio/liveTransport';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline, type TimelineEvent } from '../../../src/ui/analysis/eventTimeline';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let spread: ProjectState;
let api: ReturnType<typeof useProject>;

function Grab() {
  api = useProject();
  return null;
}

beforeAll(async () => {
  let state = await importTestMidi1();
  ['0,0', '7,0', '4,3', '3,7', '7,7', '0,7', '5,5'].forEach((padKey, i) => {
    state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });
  });
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout: getDisplayedLayout(state)!,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  spread = { ...state, analysisResult: analysis, analysisStale: false };
}, 60_000);

const loop = () => ({ enabled: api.state.loopEnabled, start: api.state.loopStart, end: api.state.loopEnd, rate: api.state.playbackRate });
const event = (i: number): TimelineEvent => getEventTimeline(spread).events[i]!;

describe('Rehearse (S4.3b, T10)', () => {
  it('is on the selected Events row only; it loops the event\'s bar and the next at 75% and plays from the loop\'s start', () => {
    render(<ProjectProvider initialState={spread}><Grab /><EventsPanel /></ProjectProvider>);
    expect(screen.queryAllByTestId('event-rehearse')).toHaveLength(0);
    // Event 14 is at 6.5 s, in bar 4 (6 s to 8 s).
    fireEvent.click(document.querySelector('button[data-moment-index="13"]')!);
    const rehearse = screen.getByTestId('event-rehearse');
    expect(rehearse.textContent).toBe('Rehearse bars 4–5 · 75%');
    expect(rehearse.getAttribute('title')).toBe('Loop bars 4–5 at 75%, after a 1-bar count-in');
    expect(screen.getAllByTestId('event-rehearse')).toHaveLength(1);
    act(() => { fireEvent.click(rehearse); });
    expect(loop()).toEqual({ enabled: true, start: 6, end: 10, rate: 0.75 });
    expect(api.state.isPlaying).toBe(true);
    expect(api.state.currentTime).toBe(6);
    expect(api.state.selectedMomentKey).toBe(event(13).key);
    expect(api.state.selectionFromPause).toBe(false);
    // Nothing a Rehearse does is a document edit.
    expect(api.state.analysisStale).toBe(false);
  });

  it('in the inspector, the menu rehearses at 50% and remembers it; while playing it moves into the new loop without restarting', () => {
    render(
      <ProjectProvider initialState={{ ...spread, selectedMomentKey: event(25).key, currentTime: event(25).startTime }}>
        <Grab />
        <MomentInspector />
      </ProjectProvider>,
    );
    fireEvent.click(screen.getByTestId('dock-rehearse-menu'));
    const speeds = screen.getByTestId('dock-rehearse-speeds');
    expect([...speeds.querySelectorAll('button')].map(b => b.textContent)).toEqual([
      'Rehearse at full speed', 'Rehearse at 75%', 'Rehearse at 50%',
    ]);
    act(() => { fireEvent.click(within(speeds).getByTestId('dock-rehearse-at-50')); });
    // Event 26 is at 12.5 s, in bar 7: bars 7 and 8, the song's last two.
    expect(loop()).toEqual({ enabled: true, start: 12, end: 16, rate: 0.5 });
    expect(api.state.rehearseRate).toBe(0.5);
    expect(api.state.isPlaying).toBe(true);
    expect(screen.getByTestId('dock-rehearse').textContent).toMatch(/· 50%$/);

    // Playing at 13 s (the inspector follows the playhead: event 27), its
    // Rehearse loops bars 7 and 8, which hold the playhead: it carries on.
    act(() => api.dispatch({ type: 'SET_CURRENT_TIME', payload: 13 }));
    expect(screen.getByTestId('selected-event-label').textContent).toMatch(/^Event 27 · /);
    act(() => { fireEvent.click(screen.getByTestId('dock-rehearse')); });
    expect(api.state.currentTime).toBe(13);
    expect(api.state.isPlaying).toBe(true);
  });

  it('while playing, Rehearse on an event elsewhere moves playback to its loop\'s start, with no count-in or restart', () => {
    render(
      <ProjectProvider initialState={{ ...spread, isPlaying: true, currentTime: 13 }}>
        <Grab />
        <EventsPanel />
      </ProjectProvider>,
    );
    // Event 6 is at 2.5 s: bars 2 and 3.
    fireEvent.click(document.querySelector('button[data-moment-index="5"]')!);
    expect(api.state.currentTime).toBe(13); // selecting while playing leaves the playhead alone
    const rehearse = screen.getByTestId('event-rehearse');
    expect(rehearse.getAttribute('title')).toBe('Loop bars 2–3 at 75%; playback carries on into the loop');
    act(() => { fireEvent.click(rehearse); });
    expect(loop()).toEqual({ enabled: true, start: 2, end: 6, rate: 0.75 });
    expect(api.state.currentTime).toBe(2);
    expect(api.state.isPlaying).toBe(true);
    expect(api.state.selectedMomentKey).toBe(event(5).key);
  });

  it('under the chart, for the selected bar', () => {
    function Chart() {
      const { state, dispatch } = useProject();
      return (
        <EventCostChart
          fingerAssignments={state.analysisResult!.executionPlan.fingerAssignments}
          timeline={getEventTimeline(state)}
          tempo={state.tempo}
          selectedMomentKey={state.selectedMomentKey}
          onSelectEvent={selection => dispatch({ type: 'SELECT_EVENT', payload: selection })}
          showRehearse
        />
      );
    }
    render(<ProjectProvider initialState={spread}><Grab /><Chart /></ProjectProvider>);
    expect(screen.queryByTestId('chart-rehearse')).toBeNull();
    fireEvent.click(document.querySelector('[data-testid="event-bar"][data-event-index="5"]')!);
    expect(screen.getByTestId('chart-selected-event').textContent).toMatch(/^Event 6 · 2\.2\.1/);
    act(() => { fireEvent.click(screen.getByTestId('chart-rehearse')); });
    expect(loop()).toEqual({ enabled: true, start: 2, end: 6, rate: 0.75 });
    expect(api.state.currentTime).toBe(2);
  });

  it('through the workspace\'s transport, Rehearse counts in at least a bar while plain Play counts in only as set', () => {
    render(
      <ProjectProvider initialState={{ ...spread, selectedMomentKey: event(13).key, currentTime: event(13).startTime }}>
        <TransportProvider>
          <Grab />
          <MomentInspector />
        </TransportProvider>
      </ProjectProvider>,
    );
    // Plain Play with the count-in Off: no count-in.
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: true }));
    expect(liveTransport()!.debug().running).toBe(true);
    expect(liveTransport()!.debug().countIn).toBeNull();
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: false }));
    expect(liveTransport()!.debug().running).toBe(false);

    // Rehearse: a bar of count-in (four clicks), waiting at the loop's start.
    act(() => { fireEvent.click(screen.getByTestId('play-from-here')); });
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: false }));
    act(() => { fireEvent.click(screen.getByTestId('dock-rehearse')); });
    const debug = liveTransport()!.debug();
    expect(debug.running).toBe(true);
    expect(debug.countIn).toEqual({ beat: 0, beats: 4 });
    expect(debug.position).toBe(6);
    expect(debug.region).toEqual({ start: 6, end: 10, loops: true });
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: false }));

    // With 2 bars set, Play counts in eight clicks, and so does Rehearse.
    act(() => api.dispatch({ type: 'SET_COUNT_IN_BARS', payload: 2 }));
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: true }));
    expect(liveTransport()!.debug().countIn).toEqual({ beat: 0, beats: 8 });
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: false }));
    act(() => { fireEvent.click(screen.getByTestId('dock-rehearse')); });
    expect(liveTransport()!.debug().countIn).toEqual({ beat: 0, beats: 8 });
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: false }));
  });
});
