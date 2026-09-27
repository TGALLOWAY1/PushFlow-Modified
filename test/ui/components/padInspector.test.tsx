// @vitest-environment happy-dom
/**
 * S4.2 · pad vs moment selection and the pad inspector (T28; P4-11a).
 *
 * A pad click selects the pad and its Sound and opens the pad inspector; it
 * never selects an event, and with an event selected it keeps it while the
 * timeline outlines every hit of the Sound. The inspector shows the Sound and
 * its hits, steps through them (Show its hits, Prev hit, Next hit), writes the
 * soft finger preference to voiceConstraints (invariant 6), and locks and
 * removes (with Undo).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { getActivePerformance, getDisplayedExecutionPlan, getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { UnifiedTimeline } from '../../../src/ui/components/UnifiedTimeline';
import { PadInspector } from '../../../src/ui/components/workspace/PadInspector';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline, resolveEventKey } from '../../../src/ui/analysis/eventTimeline';
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

function Editor() {
  api = useProject();
  return (
    <>
      <InteractiveGrid padSize={48} assignments={getDisplayedExecutionPlan(api.state)?.fingerAssignments} />
      <PadInspector />
      <UnifiedTimeline />
    </>
  );
}

function mount(state: ProjectState) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor />
      </ProjectProvider>
    </ToastProvider>,
  );
}

const pad = (key: string) => screen.getByTestId(`pad-${key.replace(',', '-')}`);
const selectedIndex = () => resolveEventKey(getEventTimeline(api.state), api.state.selectedMomentKey)?.index ?? null;
/** The pad of the Sound struck most often, and that Sound's id. */
function busiestPad(): { key: string; soundId: string } {
  const layout = getDisplayedLayout(api.state)!;
  const [key, voice] = Object.entries(layout.padToVoice)
    .sort(([, a], [, b]) => api.state.soundStreams.find(s => s.id === b.id)!.events.length - api.state.soundStreams.find(s => s.id === a.id)!.events.length)[0]!;
  return { key, soundId: voice.id };
}
const hitsOf = (soundId: string) => getEventTimeline(api.state).events.filter(e => e.soundIds.includes(soundId)).map(e => e.index);

describe('a pad click (T28)', () => {
  it('selects the pad and its Sound and opens the inspector, without selecting an event', () => {
    mount(analysed);
    const { key, soundId } = busiestPad();
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBe(key);
    expect(api.state.selectedStreamId).toBe(soundId);
    expect(api.state.selectedMomentKey).toBeNull();
    expect(document.querySelectorAll('[data-struck="true"]')).toHaveLength(0);
    const inspector = screen.getByTestId('pad-inspector');
    const sound = api.state.soundStreams.find(s => s.id === soundId)!;
    expect(within(inspector).getByTestId('pad-inspector-sound').textContent).toBe(sound.name);
    expect(within(inspector).getByTestId('pad-inspector-hits').textContent).toBe(`${hitsOf(soundId).length} hits`);
    // The plan's finger, as a faint suggestion (never the "(XX)" format).
    const finger = within(inspector).getByTestId('pad-inspector-finger');
    expect(finger.textContent).toMatch(/^[LR][1-5](\/[LR][1-5])?$|^mixed$/);
    expect(finger.getAttribute('aria-label')).toMatch(/^Hand & finger preference \(soft\) for .+: none; the plan uses [LR][1-5]/);
    expect(finger.style.opacity).toBe('0.5');
    expect(inspector.textContent).not.toMatch(/\([LR][1-5]\)/);
  });

  it('with an event selected, keeps it and outlines every hit of the Sound in the timeline (P4-11a)', () => {
    const event = getEventTimeline(analysed).events[4]!;
    mount({ ...analysed, selectedMomentKey: event.key });
    const { key, soundId } = busiestPad();
    fireEvent.click(pad(key));
    expect(api.state.selectedMomentKey).toBe(event.key);
    expect(api.state.selectedPadKey).toBe(key);
    const outlined = [...document.querySelectorAll<HTMLElement>('[data-testid="timeline-pill"][data-sound-selected="true"]')];
    const sound = api.state.soundStreams.find(s => s.id === soundId)!;
    expect(outlined).toHaveLength(sound.events.length);
    expect(outlined.every(p => p.dataset.soundId === soundId)).toBe(true);
    expect(screen.getByTestId('timeline-lane-selected')).toBeTruthy();
  });

  it('Show its hits selects the first; Prev hit and Next hit step through them and stop at the ends', () => {
    mount(analysed);
    const { key, soundId } = busiestPad();
    fireEvent.click(pad(key));
    const hits = hitsOf(soundId);
    fireEvent.click(screen.getByTestId('pad-show-hits'));
    expect(selectedIndex()).toBe(hits[0]);
    // The pad stays selected while stepping.
    expect(api.state.selectedPadKey).toBe(key);
    const next = () => screen.getByTestId('pad-next-hit') as HTMLButtonElement;
    const prev = () => screen.getByTestId('pad-prev-hit') as HTMLButtonElement;
    expect(prev().disabled).toBe(true);
    const seen = [selectedIndex()];
    while (!next().disabled) {
      fireEvent.click(next());
      seen.push(selectedIndex());
    }
    expect(seen).toEqual(hits);
    expect(screen.getByTestId('pad-inspector-hits').textContent).toBe(`hit ${hits.length} of ${hits.length}`);
    fireEvent.click(prev());
    expect(selectedIndex()).toBe(hits[hits.length - 2]);
  });

  it('writes the soft finger preference to the Sound (invariant 6), and can clear it', () => {
    mount(analysed);
    const { key, soundId } = busiestPad();
    fireEvent.click(pad(key));
    const chip = () => screen.getByTestId('pad-inspector-finger');
    // No preference yet: the plan's finger, faint (S5.1).
    expect(chip().getAttribute('data-preference')).toBe('');
    expect(chip().textContent).toMatch(/^[LR][1-5](\/[LR][1-5])?$|^mixed$/);
    fireEvent.click(chip());
    const input = screen.getByTestId('finger-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'R3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.state.voiceConstraints[soundId]).toEqual({ hand: 'right', finger: 'middle' });
    // The layout's pad preference follows (derived from voiceConstraints).
    expect(getDisplayedLayout(api.state)!.fingerConstraints[key]).toBe('R3');
    expect(chip().getAttribute('data-preference')).toBe('R3');
    // Auto (solver) clears it.
    fireEvent.click(chip());
    fireEvent.click(screen.getByTestId('finger-auto'));
    expect(api.state.voiceConstraints[soundId]).toBeUndefined();
    expect(getDisplayedLayout(api.state)!.fingerConstraints[key]).toBeUndefined();
  });

  it('locks, refuses Remove while locked, and removes with Undo', () => {
    mount(analysed);
    const { key, soundId } = busiestPad();
    fireEvent.click(pad(key));
    const lock = screen.getByTestId('pad-inspector-lock');
    fireEvent.click(lock);
    expect(getDisplayedLayout(api.state)!.placementLocks[soundId]).toBe(key);
    expect(lock.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('pad-inspector-remove') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Locked · Unlock to remove')).toBeTruthy();
    fireEvent.click(lock);
    fireEvent.click(screen.getByTestId('pad-inspector-remove'));
    expect(getDisplayedLayout(api.state)!.padToVoice[key]).toBeUndefined();
    expect(api.state.selectedPadKey).toBeNull();
    const name = api.state.soundStreams.find(s => s.id === soundId)!.name;
    const [r, c] = key.split(',').map(Number);
    expect(screen.getByText(`Removed ${name} from Row ${r! + 1} · Col ${c! + 1}`)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(getDisplayedLayout(api.state)!.padToVoice[key]?.id).toBe(soundId);
  });
});
