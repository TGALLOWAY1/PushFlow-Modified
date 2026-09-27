// @vitest-environment happy-dom
/**
 * S5.1 · one "Hand & finger preference (soft)" control (T19 full; P5-1, P5-2).
 *
 * - The control: Left or Right and Thumb to Pinky, where half a choice sets
 *   nothing; Accept makes the plan's most-used finger the preference; Auto
 *   (solver) clears it. With no preference the chip shows the plan's fingers
 *   faintly ("L2", "L2/L3", "mixed"), never "(L2)".
 * - P5-1: a preference set in any panel (the Sounds row, the pad inspector,
 *   the selected event, the layout summary's selected note, the pad menu, the
 *   Composer) appears in all the others within one render.
 * - P5-2: with no preference, each Sounds row shows the plan's finger at
 *   reduced opacity, and "(L2)" appears nowhere.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  createEmptyProjectState,
  getActivePerformance,
  getDisplayedExecutionPlan,
  getDisplayedLayout,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { FingerAssignmentInput } from '../../../src/ui/components/shared/FingerAssignmentInput';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { PadInspector } from '../../../src/ui/components/workspace/PadInspector';
import { MomentInspector } from '../../../src/ui/components/workspace/MomentInspector';
import { ActiveLayoutSummary } from '../../../src/ui/components/panels/ActiveLayoutSummary';
import { WorkspacePatternStudio } from '../../../src/ui/components/workspace/WorkspacePatternStudio';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { eventOfNote, getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import { planFingersBySound } from '../../../src/ui/analysis/planFingers';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

describe('the control', () => {
  const plan = (...labels: string[]) => {
    const fingers = labels.map((label, i) => ({
      hand: label[0] === 'L' ? 'left' as const : 'right' as const,
      finger: (['thumb', 'index', 'middle', 'ring', 'pinky'] as const)[Number(label[1]) - 1]!,
      label,
      count: 10 - i,
    }));
    return { fingers, label: labels.length > 2 ? 'mixed' : labels.join('/') };
  };
  const chip = () => screen.getByTestId('finger-preference');

  it('shows the plan faintly with no preference, "L2/L3" or "mixed" when it uses more than one, never "(L2)"', () => {
    const { rerender } = render(<FingerAssignmentInput value={null} plan={plan('L2')} onChange={() => {}} soundName="Kick" />);
    expect(chip().textContent).toBe('L2');
    expect(chip().style.opacity).toBe('0.5');
    expect(chip().getAttribute('data-preference')).toBe('');
    expect(chip().getAttribute('aria-label')).toBe('Hand & finger preference (soft) for Kick: none; the plan uses L2 (10 hits)');
    rerender(<FingerAssignmentInput value={null} plan={plan('L2', 'L3')} onChange={() => {}} />);
    expect(chip().textContent).toBe('L2/L3');
    rerender(<FingerAssignmentInput value={null} plan={plan('L2', 'R2', 'R1')} onChange={() => {}} />);
    expect(chip().textContent).toBe('mixed');
    rerender(<FingerAssignmentInput value={{ hand: 'right', finger: 'thumb' }} plan={plan('L2')} onChange={() => {}} />);
    expect(chip().textContent).toBe('R1');
    expect(chip().style.opacity).toBe('1');
    expect(chip().getAttribute('aria-label')).toBe('Hand & finger preference (soft): R1 · Right thumb');
    // Nor in the open control, with a preference and a plan.
    fireEvent.click(chip());
    expect(screen.getByTestId('finger-preference-status').textContent).toBe('Yours: R1 · Right thumb; the plan uses L2 (10 hits).');
    expect(document.body.textContent).not.toMatch(/\([LR][1-5]\)/);
  });

  it('with no preference, a hand alone sets nothing; the finger then sets both', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={null} plan={plan('L2')} onChange={onChange} />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByTestId('finger-hand-right'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('finger-pending').textContent).toBe('Pick a finger for the right hand');
    fireEvent.click(screen.getByTestId('finger-finger-3'));
    expect(onChange).toHaveBeenCalledWith({ hand: 'right', finger: 'middle' });
  });

  it('a finger alone sets nothing either; closing then changes nothing', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={null} onChange={onChange} />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByTestId('finger-finger-1'));
    expect(screen.getByTestId('finger-pending').textContent).toBe('Pick a hand for the thumb');
    escape();
    expect(screen.queryByTestId('finger-preference-popover')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('with a preference, another hand keeps its finger, and another finger keeps its hand', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FingerAssignmentInput value={{ hand: 'left', finger: 'index' }} onChange={onChange} />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByTestId('finger-hand-right'));
    expect(onChange).toHaveBeenLastCalledWith({ hand: 'right', finger: 'index' });
    rerender(<FingerAssignmentInput value={{ hand: 'right', finger: 'index' }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('finger-finger-5'));
    expect(onChange).toHaveBeenLastCalledWith({ hand: 'right', finger: 'pinky' });
    // Choosing what is already set changes nothing.
    rerender(<FingerAssignmentInput value={{ hand: 'right', finger: 'pinky' }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('finger-finger-5'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('Accept makes the plan\'s most-used finger the preference; Auto (solver) clears one', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FingerAssignmentInput value={null} plan={plan('R3', 'R2')} onChange={onChange} />);
    fireEvent.click(chip());
    expect(screen.getByTestId('finger-accept').textContent).toBe('Accept R3');
    // With no preference, Auto is what is set: pressing it changes nothing.
    expect(screen.getByTestId('finger-auto').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('finger-accept'));
    expect(onChange).toHaveBeenLastCalledWith({ hand: 'right', finger: 'middle' });
    expect(screen.queryByTestId('finger-preference-popover')).toBeNull();

    rerender(<FingerAssignmentInput value={{ hand: 'right', finger: 'middle' }} plan={plan('R3', 'R2')} onChange={onChange} />);
    fireEvent.click(chip());
    // Accepting what is already set is not offered.
    expect(screen.queryByTestId('finger-accept')).toBeNull();
    fireEvent.click(screen.getByTestId('finger-auto'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('the chip opens and closes it; a press outside closes it with no change', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={null} plan={plan('L2')} onChange={onChange} />);
    fireEvent.mouseDown(chip());
    fireEvent.click(chip());
    expect(screen.getByTestId('finger-preference-popover')).toBeTruthy();
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    // A press on the chip itself is not outside: its click closes it.
    fireEvent.mouseDown(chip());
    fireEvent.click(chip());
    expect(screen.queryByTestId('finger-preference-popover')).toBeNull();
    fireEvent.click(chip());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('finger-preference-popover')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// P5-1 and P5-2 in the editor's panels
// ---------------------------------------------------------------------------

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
      <VoicePalette />
      <InteractiveGrid padSize={48} assignments={getDisplayedExecutionPlan(api.state)?.fingerAssignments} />
      <PadInspector />
      <MomentInspector />
      <ActiveLayoutSummary />
    </>
  );
}

function mountEditor(state: ProjectState) {
  render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor />
      </ProjectProvider>
    </ToastProvider>,
  );
}

/** The busiest placed Sound, its pad, and one of its notes; the pad, the note's event and the note selected. */
function selectEverywhere() {
  const layout = getDisplayedLayout(api.state)!;
  const plan = getDisplayedExecutionPlan(api.state)!;
  const [padKey, voice] = Object.entries(layout.padToVoice)
    .sort(([, a], [, b]) => api.state.soundStreams.find(s => s.id === b.id)!.events.length - api.state.soundStreams.find(s => s.id === a.id)!.events.length)[0]!;
  const note = plan.fingerAssignments.find(a => a.voiceId === voice.id && a.assignedHand !== 'Unplayable')!;
  const event = eventOfNote(getEventTimeline(api.state), note)!;
  act(() => api.dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime, noteKey: note.eventKey } }));
  act(() => api.dispatch({ type: 'SELECT_PAD', payload: { padKey, streamId: voice.id } }));
  return { padKey, soundId: voice.id };
}

const soundRowChip = (soundId: string) => within(screen.getAllByTestId('sound-row').find(r => r.dataset.soundId === soundId)!).getByTestId('sound-finger');
const strikeChip = (soundId: string) => within(
  screen.getAllByTestId('moment-strike').find(li => li.querySelector(`[data-sound-id="${soundId}"]`))!,
).getByTestId('moment-strike-finger');

function panels(soundId: string): Record<string, () => HTMLElement> {
  return {
    'Sounds row': () => soundRowChip(soundId),
    'pad inspector': () => screen.getByTestId('pad-inspector-finger'),
    'selected event': () => strikeChip(soundId),
    'selected note': () => screen.getByTestId('selected-note-finger'),
  };
}

/** Every panel shows `label` as the Sound's preference, and the pad's derived preference follows. */
function expectEverywhere(soundId: string, padKey: string, label: string) {
  for (const [name, chip] of Object.entries(panels(soundId))) {
    expect({ name, preference: chip().getAttribute('data-preference') }).toEqual({ name, preference: label });
  }
  expect(getDisplayedLayout(api.state)!.fingerConstraints[padKey]).toBe(label || undefined);
}

describe('P5-1 · a preference set in any panel appears in the others within one render', () => {
  it('the Sounds row, the pad inspector, the selected event, the selected note and the pad menu', () => {
    mountEditor(analysed);
    const { padKey, soundId } = selectEverywhere();
    const chips = panels(soundId);
    expectEverywhere(soundId, padKey, '');

    // The Sounds row: typed.
    fireEvent.click(chips['Sounds row']!());
    fireEvent.change(screen.getByTestId('finger-input'), { target: { value: 'L1' } });
    fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Enter' });
    expect(api.state.voiceConstraints[soundId]).toEqual({ hand: 'left', finger: 'thumb' });
    expectEverywhere(soundId, padKey, 'L1');

    // The pad inspector: another hand keeps the finger.
    fireEvent.click(chips['pad inspector']!());
    fireEvent.click(screen.getByTestId('finger-hand-right'));
    expectEverywhere(soundId, padKey, 'R1');
    escape();

    // The selected event's strike: another finger keeps the hand.
    fireEvent.click(chips['selected event']!());
    fireEvent.click(screen.getByTestId('finger-finger-3'));
    expectEverywhere(soundId, padKey, 'R3');
    escape();

    // The layout summary's selected note.
    fireEvent.click(chips['selected note']!());
    fireEvent.change(screen.getByTestId('finger-input'), { target: { value: 'L5' } });
    fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Enter' });
    expectEverywhere(soundId, padKey, 'L5');

    // The pad menu opens the same panel.
    fireEvent.contextMenu(screen.getByTestId(`pad-${padKey.replace(',', '-')}`), { clientX: 50, clientY: 50 });
    expect(within(screen.getByTestId('pad-menu-finger')).getByText('L5')).toBeTruthy();
    fireEvent.click(screen.getByTestId('pad-menu-finger'));
    fireEvent.click(screen.getByTestId('finger-finger-2'));
    expectEverywhere(soundId, padKey, 'L2');
    escape();

    // Auto (solver) anywhere clears it everywhere; each shows the plan again.
    fireEvent.click(chips['pad inspector']!());
    fireEvent.click(screen.getByTestId('finger-auto'));
    expect(api.state.voiceConstraints[soundId]).toBeUndefined();
    expectEverywhere(soundId, padKey, '');
    const planLabel = planFingersBySound(getDisplayedExecutionPlan(api.state)!.fingerAssignments).get(soundId)!.label;
    for (const chip of Object.values(chips)) expect(chip().textContent).toBe(planLabel);
  });

  describe('the Composer and the Sounds panel', () => {
    beforeEach(() => localStorage.clear());

    it('a Composer Sound\'s preference, set in either, shows in the other', async () => {
      let ctx: ReturnType<typeof useProject> | null = null;
      function Probe() { ctx = useProject(); return null; }
      render(
        <ToastProvider>
          <ProjectProvider initialState={{ ...createEmptyProjectState(), id: 'composer-fingers' }}>
            <Probe />
            <VoicePalette />
            <WorkspacePatternStudio isActive />
          </ProjectProvider>
        </ToastProvider>,
      );
      fireEvent.click(screen.getByTitle('Add lane'));
      fireEvent.click(screen.getByTestId('composer-cell-0-0'));
      await waitFor(() => expect(ctx!.state.soundStreams).toHaveLength(1));
      const soundId = ctx!.state.soundStreams[0]!.id;
      const composerChip = () => screen.getByTestId('composer-lane-finger');

      fireEvent.click(composerChip());
      fireEvent.change(screen.getByTestId('finger-input'), { target: { value: 'L4' } });
      fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Enter' });
      expect(soundRowChip(soundId).getAttribute('data-preference')).toBe('L4');

      fireEvent.click(soundRowChip(soundId));
      fireEvent.click(screen.getByTestId('finger-hand-right'));
      expect(composerChip().getAttribute('data-preference')).toBe('R4');
      expect(ctx!.state.voiceConstraints[soundId]).toEqual({ hand: 'right', finger: 'ring' });
    });
  });
});

describe('P5-2 · with no preference, the plan\'s finger at reduced opacity, never "(L2)"', () => {
  it('every Sounds row, and the pad menu and the control\'s panel', () => {
    mountEditor(analysed);
    const plans = planFingersBySound(getDisplayedExecutionPlan(api.state)!.fingerAssignments);
    const rows = screen.getAllByTestId('sound-row');
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const chip = within(row).getByTestId('sound-finger');
      expect(chip.getAttribute('data-preference')).toBe('');
      expect(chip.textContent).toBe(plans.get(row.dataset.soundId!)!.label);
      expect(chip.style.opacity).toBe('0.5');
    }
    expect(document.body.textContent).not.toMatch(/\([LR][1-5]\)/);

    const { padKey } = selectEverywhere();
    fireEvent.contextMenu(screen.getByTestId(`pad-${padKey.replace(',', '-')}`), { clientX: 50, clientY: 50 });
    expect(document.body.textContent).not.toMatch(/\([LR][1-5]\)/);
    fireEvent.click(screen.getByTestId('pad-menu-finger'));
    expect(screen.getByTestId('finger-preference-status').textContent).toMatch(/^No preference: the solver chooses, and the plan uses [LR][1-5] \(\d+ hits?\)/);
    expect(document.body.textContent).not.toMatch(/\([LR][1-5]\)/);
  });
});
