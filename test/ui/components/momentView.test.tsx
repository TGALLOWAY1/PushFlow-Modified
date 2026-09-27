// @vitest-environment happy-dom
/**
 * S4.2 · the rebuilt moment view on the grid (T09; P4-2, P4-3a).
 *
 * TEST MIDI 1 with the suggested layout, analysed. With an event selected,
 * its strikes keep their Sound's colour and name and gain a hand ring and a
 * finger badge; Now + Next adds the next strikes (dashed outline, "+1", their
 * finger) and Prev · Now · Next the previous ones (faint outline, "−1"), also
 * in their Sound's colour and name; every other pad dims. While playing, the
 * playhead drives the same layers with 16 px fingers and nothing dims.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import chroma from 'chroma-js';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { getActivePerformance, getDisplayedExecutionPlan, getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline, planNotesByEvent } from '../../../src/ui/analysis/eventTimeline';
import { padLabel, sharedNamePrefix } from '../../../src/ui/analysis/padLabels';
import { fingerLabel } from '../../../src/utils/fingerNotation';
import { type MomentView } from '../../../src/ui/state/viewSettings';
import { type FingerAssignment } from '../../../src/types/executionPlan';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let analysed: ProjectState;
let api: ReturnType<typeof useProject>;

beforeAll(async () => {
  const state = await suggestedTestMidi1();
  const layout = getDisplayedLayout(state)!;
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  analysed = { ...state, analysisResult: analysis, analysisStale: false };
}, 60_000);

function Grid({ view, assignments }: { view: MomentView; assignments?: FingerAssignment[] }) {
  api = useProject();
  return <InteractiveGrid padSize={48} assignments={assignments ?? getDisplayedExecutionPlan(api.state)?.fingerAssignments} momentView={view} />;
}

/** Mounts the grid on `state`'s plan, or on `assignments` in its place. */
function mount(view: MomentView, state: ProjectState, assignments?: FingerAssignment[]) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Grid view={view} assignments={assignments} />
      </ProjectProvider>
    </ToastProvider>,
  );
}

/** Event 5 (index 4): a chord, with a previous and a next event on other pads (the review screenshots' event). */
const EVENT = 4;
const pads = (attr: string) => [...document.querySelectorAll<HTMLElement>(`[data-${attr}="true"]`)];
const padKeyOf = (el: HTMLElement) => el.dataset.testid!.replace('pad-', '').replace('-', ',');
const tag = (pad: HTMLElement, layer: 'next' | 'prev') => pad.querySelector<HTMLElement>(`[data-testid="moment-tag"][data-layer="${layer}"]`);
const padOf = (note: FingerAssignment) => `${note.row},${note.col}`;

function expectKeepsItsSound(pad: HTMLElement) {
  const layout = getDisplayedLayout(api.state)!;
  const voice = layout.padToVoice[padKeyOf(pad)]!;
  const sound = api.state.soundStreams.find(s => s.id === voice.id)!;
  const prefix = sharedNamePrefix(api.state.soundStreams.map(s => s.name));
  expect(within(pad).getByTestId('pad-label').textContent).toBe(padLabel(sound.name, prefix, 48, 1));
  // Its own colour, never the hand's (T09: struck pads used to turn solid blue or orange).
  const bg = pad.style.backgroundColor;
  expect(bg).not.toMatch(/hand/);
  expect(chroma(bg).alpha(1).hex()).toBe(chroma(sound.color).hex());
}

describe('the moment view (T09)', () => {
  it('Now: the event’s strikes keep their Sound and gain a hand ring and finger badge; the rest dims', () => {
    const event = getEventTimeline(analysed).events[EVENT]!;
    mount('now', { ...analysed, selectedMomentKey: event.key });
    const notes = planNotesByEvent(getEventTimeline(api.state), getDisplayedExecutionPlan(api.state)!.fingerAssignments).get(EVENT)!;
    const struck = pads('struck');
    expect(struck.map(padKeyOf).sort()).toEqual(notes.map(n => `${n.row},${n.col}`).sort());
    for (const pad of struck) {
      expectKeepsItsSound(pad);
      const note = notes.find(n => `${n.row},${n.col}` === padKeyOf(pad))!;
      const badge = within(pad).getByTestId('moment-finger');
      expect(badge.dataset.layer).toBe('now');
      expect(badge.textContent).toBe(fingerLabel(note.assignedHand, note.finger));
      expect(pad.style.boxShadow).toMatch(/^0 0 0 2px var\(--hand-(left|right)\)/);
    }
    expect(pads('next')).toHaveLength(0);
    expect(pads('prev')).toHaveLength(0);
    // Every other placed pad dims to 45%, and no pad is desaturated.
    const others = Object.keys(getDisplayedLayout(api.state)!.padToVoice).filter(k => !struck.map(padKeyOf).includes(k));
    for (const key of others) expect(screen.getByTestId(`pad-${key.replace(',', '-')}`).className).toContain('opacity-[0.45]');
    expect(document.querySelectorAll('[style*="saturate(0)"]')).toHaveLength(0);
  });

  it('Now + Next adds the next strikes: dashed hand outline, "+1" and finger, in their Sound’s colour and name', () => {
    const event = getEventTimeline(analysed).events[EVENT]!;
    mount('now-next', { ...analysed, selectedMomentKey: event.key });
    const next = pads('next');
    expect(next.length).toBeGreaterThan(0);
    for (const pad of next) {
      expectKeepsItsSound(pad);
      expect(within(pad).getByTestId('moment-next-outline')).toBeTruthy();
      expect(tag(pad, 'next')!.textContent).toBe('+1');
      if (pad.dataset.struck !== 'true') {
        expect(within(pad).getByTestId('moment-finger').dataset.layer).toBe('next');
        expect(pad.className).not.toContain('opacity-[0.45]');
      }
    }
    expect(pads('prev')).toHaveLength(0);
  });

  it('Prev · Now · Next adds the previous strikes: a faint outline and "−1", in their Sound’s colour and name', () => {
    const event = getEventTimeline(analysed).events[EVENT]!;
    mount('prev-now-next', { ...analysed, selectedMomentKey: event.key });
    const prev = pads('prev');
    expect(prev.length).toBeGreaterThan(0);
    for (const pad of prev) {
      expectKeepsItsSound(pad);
      expect(within(pad).getByTestId('moment-prev-outline')).toBeTruthy();
      expect(tag(pad, 'prev')!.textContent).toBe('−1');
      expect(pad.className).not.toContain('opacity-[0.45]');
    }
    expect(pads('next').length).toBeGreaterThan(0);
  });

  it('marks a pad struck before even when it is struck now too (Codex review on #113)', () => {
    const timeline = getEventTimeline(analysed);
    const byEvent = planNotesByEvent(timeline, getDisplayedExecutionPlan(analysed)!.fingerAssignments);
    // An event that strikes again a pad the event before it struck (Event 17 on this layout).
    const event = timeline.events.find(e => e.index > 0
      && byEvent.get(e.index)?.some(n => byEvent.get(e.index - 1)?.some(p => padOf(p) === padOf(n))))!;
    const shared = byEvent.get(event.index)!.map(padOf).filter(k => byEvent.get(event.index - 1)!.some(p => padOf(p) === k));
    mount('prev-now-next', { ...analysed, selectedMomentKey: event.key });
    for (const key of shared) {
      const pad = screen.getByTestId(`pad-${key.replace(',', '-')}`);
      expect(pad.dataset.struck).toBe('true');
      expect(pad.dataset.prev).toBe('true');
      expect(tag(pad, 'prev')!.textContent).toBe('−1');
    }
    // Prev · Now · Next draws something Now + Next doesn't, even here.
    cleanup();
    mount('now-next', { ...analysed, selectedMomentKey: event.key });
    for (const key of shared) expect(screen.getByTestId(`pad-${key.replace(',', '-')}`).dataset.prev).toBeUndefined();
  });

  it('shows both tags, in opposite corners, on a pad struck before and after (Codex review on #113)', () => {
    const timeline = getEventTimeline(analysed);
    const plan = getDisplayedExecutionPlan(analysed)!.fingerAssignments;
    const byEvent = planNotesByEvent(timeline, plan);
    // Move one note of the next event onto a pad the previous event struck: A–B–A.
    const index = EVENT + 2;
    const nowPads = byEvent.get(index)!.map(padOf);
    const prevPad = byEvent.get(index - 1)!.map(padOf).find(k => !nowPads.includes(k))!;
    const moved = byEvent.get(index + 1)![0]!;
    const [row, col] = prevPad.split(',').map(Number);
    const assignments = plan.map(a => (a.eventKey === moved.eventKey ? { ...a, row, col } : a));
    mount('prev-now-next', { ...analysed, selectedMomentKey: timeline.events[index]!.key }, assignments);

    const pad = screen.getByTestId(`pad-${prevPad.replace(',', '-')}`);
    expect(pad.dataset.next).toBe('true');
    expect(pad.dataset.prev).toBe('true');
    const [next, prev] = [tag(pad, 'next')!, tag(pad, 'prev')!];
    expect(next.textContent).toBe('+1');
    expect(prev.textContent).toBe('−1');
    // Never on top of each other: "+1" top right, "−1" bottom left.
    expect(next.className).toMatch(/-top-2/);
    expect(next.className).toMatch(/-right-2/);
    expect(prev.className).toMatch(/-bottom-2/);
    expect(prev.className).toMatch(/-left-2/);
    // The look-ahead outline is the one drawn.
    expect(within(pad).getByTestId('moment-next-outline')).toBeTruthy();
    expect(within(pad).queryByTestId('moment-prev-outline')).toBeNull();
  });

  it('while playing, the playhead drives it: 16 px fingers now and next, and nothing dims (P4-3a)', () => {
    const timeline = getEventTimeline(analysed);
    const selected = timeline.events[EVENT]!;
    mount('now-next', { ...analysed, selectedMomentKey: selected.key });
    const playhead = timeline.events[EVENT + 2]!;
    act(() => {
      api.dispatch({ type: 'SET_IS_PLAYING', payload: true });
      api.dispatch({ type: 'SET_CURRENT_TIME', payload: playhead.startTime + 0.01 });
    });
    // The playhead's event, not the selection, is struck now.
    const notes = planNotesByEvent(timeline, getDisplayedExecutionPlan(api.state)!.fingerAssignments).get(EVENT + 2)!;
    expect(pads('struck').map(padKeyOf).sort()).toEqual(notes.map(n => `${n.row},${n.col}`).sort());
    expect(pads('next').length).toBeGreaterThan(0);
    for (const badge of screen.getAllByTestId('moment-finger')) expect(badge.style.fontSize).toBe('16px');
    expect(screen.getAllByTestId('moment-finger').some(b => b.dataset.layer === 'next')).toBe(true);
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="pad-"]')) {
      expect(el.className).not.toContain('opacity-[0.45]');
    }
    // No arrows while playing.
    expect(document.querySelector('svg path[stroke^="var(--hand"]')).toBeNull();
  });
});
