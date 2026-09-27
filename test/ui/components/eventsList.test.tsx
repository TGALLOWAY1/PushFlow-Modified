// @vitest-environment happy-dom
/**
 * S4.2 · the Events list for finding problems (T27; P4-8).
 *
 * TEST MIDI 1 with its seven Sounds spread over the grid (the C1 layout), so
 * its 32 events are a mix of Easy, Medium and Hard. Each filter chip shows
 * exactly the events it names, rows sit under their bar, a row reads its
 * position, each Sound struck with its finger and a difficulty badge, Prev
 * and Next hard visit every Hard event in time order and stop at the ends,
 * one row at a time opens its factors, and the Analysis panel's counts open
 * the list with their filter applied.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { getActivePerformance, getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { EventsPanel } from '../../../src/ui/components/EventsPanel';
import { PerformanceCostsPanel } from '../../../src/ui/components/panels/PerformanceCostsPanel';
import { EventsNavigationProvider, type EventsNavigation } from '../../../src/ui/components/workspace/eventsNavigation';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline, planNotesByEvent, resolveEventKey } from '../../../src/ui/analysis/eventTimeline';
import { EVENTS_FILTERS, eventCostsOf, filterEvents, type EventsFilter } from '../../../src/ui/analysis/eventDifficulty';
import { barNumber } from '../../../src/utils/musicalTime';
import { fingerLabel } from '../../../src/utils/fingerNotation';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
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
  const layout = getDisplayedLayout(state)!;
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  spread = { ...state, analysisResult: analysis, analysisStale: false };
}, 60_000);

function mount(state: ProjectState) {
  return render(
    <ProjectProvider initialState={state}>
      <Grab />
      <EventsPanel />
    </ProjectProvider>,
  );
}

const plan = () => api.state.analysisResult!.executionPlan.fingerAssignments;
const rows = () => [...document.querySelectorAll<HTMLElement>('button[data-moment-index]')].map(el => Number(el.dataset.momentIndex));
const chip = (id: EventsFilter) => screen.getByTestId(`events-filter-${id}`);
const selectedIndex = () => resolveEventKey(getEventTimeline(api.state), api.state.selectedMomentKey)?.index ?? null;

describe('the Events list (T27)', () => {
  it('each filter chip shows exactly the matching events, with its count (P4-8)', () => {
    mount(spread);
    const timeline = getEventTimeline(api.state);
    const costs = eventCostsOf(timeline, plan());
    for (const { id, label } of EVENTS_FILTERS) {
      const want = filterEvents(timeline, costs, id).map(e => e.index);
      expect(chip(id).textContent).toBe(`${label} ${want.length}`);
      fireEvent.click(chip(id));
      expect(chip(id).getAttribute('aria-pressed')).toBe('true');
      expect(rows()).toEqual(want);
      // Every row shown has the level the chip names.
      for (const badge of screen.queryAllByTestId('event-difficulty')) {
        const level = badge.getAttribute('data-level');
        if (id === 'hard') expect(level).toBe('Hard');
        if (id === 'medium-up') expect(['Medium', 'Hard', 'Unplayable']).toContain(level);
      }
    }
    expect(filterEvents(timeline, costs, 'hard').length).toBeGreaterThan(3);
  });

  it('groups rows under their bar, and reads position, Sounds with fingers, and difficulty', () => {
    mount(spread);
    const timeline = getEventTimeline(api.state);
    for (const section of screen.getAllByTestId('events-bar')) {
      const bar = Number(/Bar (\d+)/.exec(section.getAttribute('aria-label') ?? '')![1]);
      for (const row of within(section).getAllByTestId('event-row')) {
        expect(barNumber(timeline.events[Number(row.dataset.eventIndex)]!.startTime, api.state.tempo)).toBe(bar);
      }
    }
    const byEvent = planNotesByEvent(timeline, plan());
    const event = timeline.events.find(e => (byEvent.get(e.index)?.length ?? 0) >= 2)!;
    const row = document.querySelector<HTMLElement>(`[data-testid="event-row"][data-event-index="${event.index}"]`)!;
    expect(within(row).getByRole('button', { name: /^\d+\.\d\.\d/ }).textContent).toMatch(/^\d+\.\d\.\d/);
    // Each Sound struck, by id, with the finger the plan plays it with.
    const fingers = [...row.querySelectorAll<HTMLElement>('[data-finger]')].map(el => el.dataset.finger);
    expect(fingers).toEqual(event.soundIds.map(id => fingerLabel(byEvent.get(event.index)!.find(n => n.voiceId === id)!.assignedHand, byEvent.get(event.index)!.find(n => n.voiceId === id)!.finger)));
    expect([...row.querySelectorAll<HTMLElement>('[data-sound-id]')].map(el => el.dataset.soundId)).toEqual([...event.soundIds]);
    // The cost is in the tooltip, never printed as a number in the row.
    const badge = within(row).getByTestId('event-difficulty');
    expect(badge.getAttribute('data-level')).toBe(eventCostsOf(timeline, plan()).get(event.index)!.difficulty);
    expect(badge.getAttribute('title')).toMatch(/cost \d+\.\d, counted once for the event|can’t be played/);
    expect(row.textContent).not.toMatch(/Infinity/);
  });

  it('Prev and Next hard visit every Hard event in time order and stop at the ends (P4-8)', () => {
    mount(spread);
    const timeline = getEventTimeline(api.state);
    const hard = filterEvents(timeline, eventCostsOf(timeline, plan()), 'hard').map(e => e.index);
    const next = screen.getByTestId('events-next-hard') as HTMLButtonElement;
    const prev = screen.getByTestId('events-prev-hard') as HTMLButtonElement;
    const forward: number[] = [];
    while (!next.disabled && forward.length < 64) {
      fireEvent.click(next);
      forward.push(selectedIndex()!);
    }
    expect(forward).toEqual(hard);
    expect(screen.getByTestId('events-hard-status').textContent).toBe(`Hard ${hard.length} of ${hard.length}`);
    const back: number[] = [];
    while (!prev.disabled && back.length < 64) {
      fireEvent.click(prev);
      back.push(selectedIndex()!);
    }
    expect(back).toEqual(hard.slice(0, -1).reverse());
    expect(prev.disabled).toBe(true);
  });

  it('a click anywhere on a row selects it, and one row at a time shows its factors', () => {
    mount(spread);
    const [a, b] = [...document.querySelectorAll<HTMLElement>('[data-testid="event-row"]')];
    const toggleA = within(a!).getByRole('button', { name: /Show the factors/ });
    fireEvent.click(toggleA);
    expect(selectedIndex()).toBe(Number(a!.dataset.eventIndex));
    expect(toggleA.getAttribute('aria-expanded')).toBe('true');
    expect(within(a!).getByTestId('event-factors')).toBeTruthy();
    fireEvent.click(within(b!).getByRole('button', { name: /Show the factors/ }));
    expect(within(a!).queryByTestId('event-factors')).toBeNull();
    expect(within(b!).getByTestId('event-factors')).toBeTruthy();
    expect(selectedIndex()).toBe(Number(b!.dataset.eventIndex));
    fireEvent.click(within(a!).getByRole('button', { name: /^\d+\.\d\.\d/ }));
    expect(selectedIndex()).toBe(Number(a!.dataset.eventIndex));
  });

  it('an unplayable event reads "Unplayable" under its own chip, never Infinity', () => {
    // One of the plan's events made unplayable by hand.
    const assignments = spread.analysisResult!.executionPlan.fingerAssignments;
    const target = assignments[0]!;
    const broken = assignments.map(a => a.eventKey === target.eventKey
      ? { ...a, assignedHand: 'Unplayable' as const, finger: null, difficulty: 'Unplayable' as const, cost: Infinity }
      : a);
    const analysis = { ...spread.analysisResult!, executionPlan: { ...spread.analysisResult!.executionPlan, fingerAssignments: broken } } as CandidateSolution;
    mount({ ...spread, analysisResult: analysis });
    expect(chip('unplayable').textContent).toBe('Unplayable 1');
    fireEvent.click(chip('unplayable'));
    expect(rows()).toHaveLength(1);
    const badge = screen.getByTestId('event-difficulty');
    expect(badge.getAttribute('data-level')).toBe('Unplayable');
    expect(badge.textContent).toBe('✗ Unplayable');
    expect(document.body.textContent).not.toMatch(/Infinity/);
  });
});

describe('the Analysis panel opens the list with a filter (T27)', () => {
  function Workspace({ state }: { state: ProjectState }) {
    const [filter, setFilter] = useState<EventsFilter>('all');
    const [shownTab, setShownTab] = useState('costs');
    const nav = useMemo<EventsNavigation>(() => ({
      filter, setFilter, showEvents: f => { setFilter(f); setShownTab('events'); },
    }), [filter]);
    return (
      <ProjectProvider initialState={state}>
        <Grab />
        <EventsNavigationProvider value={nav}>
          <div data-testid="shown-tab">{shownTab}</div>
          <PerformanceCostsPanel />
          <EventsPanel />
        </EventsNavigationProvider>
      </ProjectProvider>
    );
  }

  it('"N hard events" shows the Hard events', () => {
    render(<Workspace state={spread} />);
    const button = screen.getByTestId('show-events-hard');
    expect(button.textContent).toMatch(/^\d+ hard events?$/);
    act(() => { fireEvent.click(button); });
    expect(screen.getByTestId('shown-tab').textContent).toBe('events');
    expect(chip('hard').getAttribute('aria-pressed')).toBe('true');
    const timeline = getEventTimeline(api.state);
    expect(rows()).toEqual(filterEvents(timeline, eventCostsOf(timeline, plan()), 'hard').map(e => e.index));
  });
});
