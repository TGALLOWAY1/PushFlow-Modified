// @vitest-environment happy-dom
/**
 * S4.2 · the moment inspector docked beside the grid (T27).
 *
 * It lists every strike of the selected event by Sound id (its finger and its
 * pad, or "not placed"), says why the event is as hard as it is and what the
 * move to the next event asks, and plays from just before the event. While
 * playing, the grid follows the playhead and the inspector says so.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { getActivePerformance, getDisplayedExecutionPlan, getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { MomentInspector } from '../../../src/ui/components/workspace/MomentInspector';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { findSelectedEvent, formatEventLabel, getEventTimeline, type TimelineEvent } from '../../../src/ui/analysis/eventTimeline';
import { buildSelectedTransitionModel } from '../../../src/ui/analysis/selectionModel';
import { explainMomentCost, explainMomentTransition } from '../../../src/ui/analysis/momentExplanation';
import { fingerLabel } from '../../../src/utils/fingerNotation';
import { formatPadPosition } from '../../../src/utils/padPosition';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let api: ReturnType<typeof useProject>;

async function analysed(state: ProjectState): Promise<ProjectState> {
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout: getDisplayedLayout(state)!,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  return { ...state, analysisResult: analysis, analysisStale: false };
}

let suggested: ProjectState;
let partly: ProjectState;

beforeAll(async () => {
  suggested = await analysed(await suggestedTestMidi1());
  // Four of seven Sounds placed: some events strike Sounds with no pad.
  let state = await importTestMidi1();
  ['3,3', '3,4', '4,2', '4,5'].forEach((padKey, i) => {
    state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });
  });
  partly = await analysed(state);
}, 60_000);

function Inspector() {
  api = useProject();
  return <MomentInspector />;
}

function mount(state: ProjectState, event: TimelineEvent) {
  render(
    <ProjectProvider initialState={{ ...state, selectedMomentKey: event.key, currentTime: event.startTime }}>
      <Inspector />
    </ProjectProvider>,
  );
  return screen.getByTestId('selected-event-card');
}

describe('the moment inspector (T27)', () => {
  it('shows nothing with no event selected', () => {
    render(<ProjectProvider initialState={suggested}><Inspector /></ProjectProvider>);
    expect(screen.queryByTestId('selected-event-card')).toBeNull();
  });

  it('lists every strike by Sound id, with its finger and its pad, and says why and what comes next', () => {
    const timeline = getEventTimeline(suggested);
    const event = timeline.events.find(e => e.soundIds.length >= 2)!;
    const card = mount(suggested, event);
    expect(within(card).getByTestId('selected-event-label').textContent).toBe(formatEventLabel(event, suggested.tempo));

    const assignments = getDisplayedExecutionPlan(suggested)!.fingerAssignments;
    const selected = findSelectedEvent(timeline, assignments, event.key)!;
    const strikes = within(card).getAllByTestId('moment-strike');
    expect(strikes).toHaveLength(event.soundIds.length);
    event.soundIds.forEach((id, i) => {
      const note = selected.notes.find(n => n.voiceId === id)!;
      expect(strikes[i]!.querySelector('[data-sound-id]')?.getAttribute('data-sound-id')).toBe(id);
      expect(strikes[i]!.textContent).toContain(fingerLabel(note.assignedHand, note.finger));
      expect(strikes[i]!.textContent).toContain(formatPadPosition(`${note.row},${note.col}`));
    });

    expect(within(card).getByTestId('moment-why').textContent).toBe(explainMomentCost(selected.cost).text);
    const model = buildSelectedTransitionModel(timeline, assignments, event.key)!;
    const next = timeline.events[model.nextIndex!]!;
    expect(within(card).getByTestId('transition-preview').textContent).toBe(explainMomentTransition(model, `Event ${next.index + 1}`));
    // Never a MIDI note number or raw seconds.
    expect(card.textContent).not.toMatch(/\bMIDI\b|\d\.\d+\s?s\b/);
  });

  it('names a struck Sound that this layout doesn’t place as "not placed"', () => {
    const timeline = getEventTimeline(partly);
    const placed = new Set(Object.values(getDisplayedLayout(partly)!.padToVoice).map(v => v.id));
    const event = timeline.events.find(e => e.soundIds.some(id => placed.has(id)) && e.soundIds.some(id => !placed.has(id)))!;
    const card = mount(partly, event);
    const strikes = within(card).getAllByTestId('moment-strike');
    event.soundIds.forEach((id, i) => {
      if (placed.has(id)) expect(strikes[i]!.textContent).not.toContain('not placed');
      else expect(strikes[i]!.textContent).toContain('not placed');
    });
  });

  it('Play from here starts at the event itself (the transport plays its start, S4.3a), and while playing says the grid follows the playhead', () => {
    const event = getEventTimeline(suggested).events[6]!;
    mount(suggested, event);
    act(() => { fireEvent.click(screen.getByTestId('play-from-here')); });
    expect(api.state.isPlaying).toBe(true);
    expect(api.state.currentTime).toBe(event.startTime);
    // The selection stays; the button gives way to the note.
    expect(api.state.selectedMomentKey).toBe(event.key);
    expect(screen.queryByTestId('play-from-here')).toBeNull();
    expect(screen.getByTestId('moment-playing-note').textContent).toMatch(/grid follows the playhead/);
  });
});
