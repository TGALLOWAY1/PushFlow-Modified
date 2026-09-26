// @vitest-environment happy-dom
/**
 * One selection on every surface (S4.1, T24; P4-1): for each of the 32 TEST
 * MIDI 1 events, under a beam plan and a greedy plan, selecting it on any
 * surface (an Events row, a chart bar, a timeline note, →) highlights the same
 * pads on the grid, the same row in the Events list, every note of that event
 * in the timeline, and the same bar in the chart. The selection survives
 * re-analysis, a click on any timeline note highlights its whole event, and a
 * chord played a few ms apart lights every pad (it lit one).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActivePerformance,
  getDisplayedExecutionPlan,
  getDisplayedLayout,
  projectReducer,
  rebindAnalysisToLayout,
  resolveInspectedLayout,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { EventsPanel } from '../../../src/ui/components/EventsPanel';
import { UnifiedTimeline } from '../../../src/ui/components/UnifiedTimeline';
import { PerformanceCostsPanel } from '../../../src/ui/components/panels/PerformanceCostsPanel';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { formatEventLabel, getEventTimeline, type TimelineEvent } from '../../../src/ui/analysis/eventTimeline';
import { getOptimizer } from '../../../src/engine/optimization/optimizerRegistry';
import '../../../src/engine/optimization/greedyOptimizer';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';
import { scoringRequestFor } from '../../../src/ui/analysis/layoutAnalysis';
import { analyseAndScoreLayout } from '../../../src/ui/analysis/scoreLayout';

afterEach(cleanup);

let api: ReturnType<typeof useProject>;

/** The four surfaces, wired as the workspace wires them. */
function Surfaces() {
  api = useProject();
  useKeyboardShortcuts({});
  const shown = resolveInspectedLayout(api.state);
  return (
    <>
      <InteractiveGrid padSize={48} assignments={getDisplayedExecutionPlan(api.state)?.fingerAssignments} layoutOverride={shown.readOnly ? shown.layout : undefined} />
      <EventsPanel onionSkin={false} onToggleOnionSkin={() => {}} />
      <UnifiedTimeline />
      <PerformanceCostsPanel />
    </>
  );
}

function mount(state: ProjectState) {
  render(<ToastProvider><ProjectProvider initialState={state}><Surfaces /></ProjectProvider></ToastProvider>);
  fireEvent.click(screen.getByText('Event difficulty chart'));
}

function analysis(id: string, layout: Layout, executionPlan: ExecutionPlanResult): CandidateSolution {
  return rebindAnalysisToLayout({ id, layout, executionPlan, metadata: { strategy: id, seed: 0 } } as unknown as CandidateSolution, layout);
}

async function beamAnalysis(state: ProjectState, layout: Layout): Promise<CandidateSolution> {
  return analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
}

/** TEST MIDI 1, suggested, its draft analysed by beam (the app's analysis path). */
async function underBeam(): Promise<ProjectState> {
  const state = await suggestedTestMidi1();
  return { ...state, analysisResult: await beamAnalysis(state, getDisplayedLayout(state)!), analysisStale: false };
}

/** TEST MIDI 1 with a greedy candidate shown read-only, carrying the greedy optimizer's own plan. */
async function underGreedy(): Promise<{ state: ProjectState; candidate: CandidateSolution }> {
  let state = await suggestedTestMidi1();
  const layout = getDisplayedLayout(state)!;
  const result = await getOptimizer('greedy').optimize({
    performance: getActivePerformance(state), layout, costToggles: ALL_COSTS_ENABLED, constraints: {},
    config: { engineConfig: state.engineConfig, seed: 0 },
    evaluationConfig: {
      restingPose: state.engineConfig.restingPose, stiffness: state.engineConfig.stiffness,
      instrumentConfig: state.instrumentConfig, neutralHandCenters: getNeutralHandCenters(layout, state.instrumentConfig),
    },
    instrumentConfig: state.instrumentConfig,
  });
  const candidateLayout: Layout = { ...result.layout, id: 'greedy-a-layout' };
  const candidate = analysis('greedy-a', candidateLayout, result.executionPlan);
  state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [candidate] });
  state = projectReducer(state, { type: 'SET_INSPECTED_ANALYSIS', payload: candidate });
  expect(resolveInspectedLayout(state)).toMatchObject({ role: 'candidate', readOnly: true });
  return { state, candidate };
}

const selected = (testId: string, attr: string) =>
  screen.queryAllByTestId(testId).filter(el => el.dataset.selected === 'true').map(el => el.getAttribute(attr));
const struckPads = () => [...document.querySelectorAll<HTMLElement>('[data-struck="true"]')].map(el => el.dataset.testid!.slice(4).replace('-', ',')).sort();
const selectedRows = () => [...document.querySelectorAll<HTMLElement>('[data-moment-index][data-selected="true"]')].map(el => Number(el.dataset.momentIndex));

/** Every surface shows `event`: its pads, its row, all its notes, its bar and its label. */
function expectEverywhere(event: TimelineEvent) {
  const plan = getDisplayedExecutionPlan(api.state)!;
  const pads = [...new Set(plan.fingerAssignments
    .filter(a => event.noteKeys.has(a.eventKey!) && a.row !== undefined)
    .map(a => `${a.row},${a.col}`))].sort();
  expect(api.state.selectedMomentKey).toBe(event.key);
  expect({ event: event.index, pads: struckPads() }).toEqual({ event: event.index, pads });
  expect(selectedRows()).toEqual([event.index]);
  expect(selected('timeline-pill', 'data-event-key').sort()).toEqual([...event.noteKeys].sort());
  expect(selected('event-bar', 'data-event-index')).toEqual([String(event.index)]);
  expect(screen.getByTestId('selected-event-label').textContent).toBe(formatEventLabel(event, api.state.tempo));
}

/** Selects each event on a different surface in turn, and checks every surface each time. */
function selectEveryEventOnEverySurface() {
  const { events } = getEventTimeline(api.state);
  expect(events).toHaveLength(32);
  for (const event of events) {
    switch (event.index % 4) {
      case 0: fireEvent.click(document.querySelector(`[data-moment-index="${event.index}"]`)!); break;
      case 1: fireEvent.click(document.querySelector(`[data-testid="event-bar"][data-event-index="${event.index}"]`)!); break;
      case 2: fireEvent.click(document.querySelector(`[data-testid="timeline-pill"][data-event-key="${[...event.noteKeys][0]}"]`)!); break;
      case 3: fireEvent.keyDown(document.body, { key: 'ArrowRight' }); break;
    }
    expectEverywhere(event);
  }
}

describe('one selection on the grid, the Events list, the timeline and the chart (P4-1)', () => {
  let beamState: ProjectState;
  let greedy: { state: ProjectState; candidate: CandidateSolution };
  beforeAll(async () => {
    beamState = await underBeam();
    greedy = await underGreedy();
  }, 120_000);

  it('under a beam plan, for all 32 events, whichever surface selects them', () => {
    mount(beamState);
    selectEveryEventOnEverySurface();
  });

  it('under a greedy plan, for all 32 events, whichever surface selects them', () => {
    mount(greedy.state);
    expect(getDisplayedExecutionPlan(api.state)).toBe(greedy.candidate.executionPlan);
    selectEveryEventOnEverySurface();
  });

  it('keeps the selected event when the greedy plan is re-analysed by beam', async () => {
    mount(greedy.state);
    const event = getEventTimeline(api.state).events[12]!;
    fireEvent.click(document.querySelector(`[data-moment-index="12"]`)!);
    expectEverywhere(event);
    const pads = struckPads();
    const reanalysed = await beamAnalysis(api.state, greedy.candidate.layout);
    act(() => api.dispatch({ type: 'SET_INSPECTED_ANALYSIS', payload: { ...greedy.candidate, executionPlan: reanalysed.executionPlan } }));
    expect(getDisplayedExecutionPlan(api.state)).toBe(reanalysed.executionPlan);
    expectEverywhere(event);
    // The same layout strikes the same pads, whichever plan fingers them.
    expect(struckPads()).toEqual(pads);
  });

  it('a click on any timeline note highlights its whole event', () => {
    mount(beamState);
    const { events } = getEventTimeline(api.state);
    for (const pill of screen.getAllByTestId('timeline-pill')) {
      fireEvent.click(pill);
      const event = events.find(e => e.noteKeys.has(pill.dataset.eventKey!))!;
      expect(selected('timeline-pill', 'data-event-key').sort()).toEqual([...event.noteKeys].sort());
    }
  });
});

describe('a partly placed layout', () => {
  it('numbers the chart\'s bars and axis by event, as the list does, though some events have no bar', async () => {
    let state = await importTestMidi1();
    // One Sound placed, one whose first note is not in the first event.
    const events = getEventTimeline(state).events;
    const stream = state.soundStreams.find(s => !events[0]!.noteKeys.has(s.events[0]!.eventKey))!;
    state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream } });
    const layout = getDisplayedLayout(state)!;
    const { analysis } = await analyseAndScoreLayout(scoringRequestFor(state, layout).request);
    mount(projectReducer(state, { type: 'SET_ANALYSIS_RESULT', payload: rebindAnalysisToLayout(analysis, layout) }));
    const played = new Set(stream.events.map(e => e.eventKey));
    const expected = events.filter(e => [...e.noteKeys].some(k => played.has(k))).map(e => e.index);
    expect(expected[0]).toBeGreaterThan(0);
    expect(screen.getAllByTestId('event-bar').map(b => Number(b.dataset.eventIndex))).toEqual(expected);
    const axis = screen.getByTestId('event-axis').textContent;
    expect(axis).toBe(`Event ${expected[0]! + 1}${expected[Math.floor(expected.length / 2)]! + 1}${expected[expected.length - 1]! + 1}`);
  }, 60_000);
});

describe('a chord played a few ms apart', () => {
  it('is one event: selecting it lights every pad and every note (it lit one)', async () => {
    let state = await suggestedTestMidi1();
    // Play the first three-Sound chord in: its notes 0, 2 and 4 ms apart.
    const chord = getEventTimeline(state).events.find(e => e.noteCount >= 3)!;
    const [, second, third] = [...chord.noteKeys];
    const nudge: Record<string, number> = { [second!]: 0.002, [third!]: 0.004 };
    state = {
      ...state,
      soundStreams: state.soundStreams.map(s => ({
        ...s,
        events: s.events.map(e => (nudge[e.eventKey] ? { ...e, startTime: e.startTime + nudge[e.eventKey]! } : e)),
      })),
    };
    const played = { ...state, analysisResult: await beamAnalysis(state, getDisplayedLayout(state)!), analysisStale: false };
    mount(played);
    const event = getEventTimeline(api.state).events[chord.index]!;
    expect(event.noteCount).toBe(chord.noteCount);
    fireEvent.click(document.querySelector(`[data-moment-index="${chord.index}"]`)!);
    expectEverywhere(event);
    expect(struckPads().length).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
