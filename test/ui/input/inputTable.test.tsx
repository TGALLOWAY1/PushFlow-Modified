// @vitest-environment happy-dom
/**
 * S2.4 · the one input table (T61, T62; P2-10).
 *
 * One test per row of INPUT_TABLE. ROW_TESTS is a Record over InputRowId, so a
 * row added to the table without a test doesn't compile, and the last check
 * compares the two lists at run time too. Keys go through the real listener
 * (inputRegistry) and the editor's handlers (useKeyboardShortcuts, VoicePalette,
 * EventsPanel); pad clicks go through the real grid.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { Checkbox } from '../../../src/ui/components/shared/Checkbox';
import { Tabs } from '../../../src/ui/components/shared/Tabs';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActivePerformance,
  getDisplayedExecutionPlan,
  getDisplayedLayout,
  projectReducer,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { getEventTimeline, resolveEventKey, type TimelineEvent } from '../../../src/ui/analysis/eventTimeline';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { EventsPanel } from '../../../src/ui/components/EventsPanel';
import { ShortcutSheet } from '../../../src/ui/components/shared/ShortcutSheet';
import { Popover } from '../../../src/ui/components/shared/Overlay';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import {
  INPUT_TABLE,
  PAD_TAKEN_MESSAGE,
  boundRows,
  displayInput,
  padClickMeaning,
  type InputRowId,
} from '../../../src/ui/input/inputTable';
import { InputRegistry, inputRegistry, keysBelongToTarget, widgetOwnsKey } from '../../../src/ui/input/inputRegistry';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let api: ReturnType<typeof useProject>;
const onSave = vi.fn();
const onOpenShortcuts = vi.fn();
const buttonClick = vi.fn();

beforeEach(() => {
  onSave.mockReset();
  onOpenShortcuts.mockReset();
  buttonClick.mockReset();
});

/** The editor's input surfaces: the Sounds list, the grid and the key handlers, plus a few plain controls. */
function Editor({ children }: { children?: ReactNode }) {
  api = useProject();
  useKeyboardShortcuts({ onSave, onOpenShortcuts });
  const plan = getDisplayedExecutionPlan(api.state);
  return (
    <>
      <VoicePalette />
      <InteractiveGrid padSize={48} assignments={plan?.fingerAssignments} />
      <button type="button" data-testid="plain-button" onClick={buttonClick}>Loop</button>
      <select data-testid="plain-select" defaultValue="1"><option value="1">1</option><option value="2">2</option></select>
      <input data-testid="plain-input" />
      {children}
    </>
  );
}

function mount(state: ProjectState, children?: ReactNode) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor>{children}</Editor>
      </ProjectProvider>
    </ToastProvider>,
  );
}

/** TEST MIDI 1 with the suggested layout, analysed, so events exist. */
async function analysedProject(): Promise<ProjectState> {
  const state = await suggestedTestMidi1();
  const layout = getDisplayedLayout(state)!;
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  return { ...state, analysisResult: analysis, analysisStale: false };
}

const pad = (key: string) => screen.getByTestId(`pad-${key.replace(',', '-')}`);
const soundRow = (i: number) => screen.getAllByTestId('sound-row')[i]!;
const shownPads = () => getDisplayedLayout(api.state)!.padToVoice;
/** Presses a key on `target` (the page by default); returns false when its default was prevented. */
const press = (key: string, init: Partial<KeyboardEventInit> = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init });
/** A pad that holds a Sound, and one that doesn't, in the shown layout. */
const occupiedPad = () => Object.keys(shownPads())[0]!;
const emptyPad = () => ['7,7', '7,6', '6,7', '6,6'].find(k => !shownPads()[k])!;
/** The project's events' start times (S4.1), and the selected event's. */
const eventTimes = () => getEventTimeline(api.state).events.map(e => e.startTime);
const selectedTime = () => resolveEventKey(getEventTimeline(api.state), api.state.selectedMomentKey)?.startTime ?? null;
/** Selects an event as the surfaces do: by its momentKey. */
const selectEvent = (event: TimelineEvent) =>
  act(() => api.dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } }));

/** Widgets with keys of their own (T63): a checkbox and a row of tabs, from the shared primitives. */
function WidgetControls() {
  const [ticked, setTicked] = useState(false);
  const [tab, setTab] = useState<'sounds' | 'events'>('sounds');
  return (
    <>
      <Checkbox label="Show finger assignment" checked={ticked} onChange={setTicked} />
      <Tabs
        label="Sidebar"
        tabs={[{ id: 'sounds', label: 'Sounds' }, { id: 'events', label: 'Events' }]}
        selected={tab}
        onSelect={setTab}
        renderPanel={() => null}
      />
    </>
  );
}

/** A drag payload as the palette or a pad sets it. */
function dataTransfer(data: Record<string, string>) {
  return { types: Object.keys(data), getData: (type: string) => data[type] ?? '', setData: () => {}, dropEffect: 'move', effectAllowed: 'move' };
}

/** A candidate with the draft's first Sound moved to [4,4], for the read-only row. */
function readOnlyCandidate(state: ProjectState): CandidateSolution {
  const draft = getDisplayedLayout(state)!;
  const [firstPad, firstVoice] = Object.entries(draft.padToVoice)[0]!;
  const { [firstPad]: _moved, ...rest } = draft.padToVoice;
  const layout: Layout = { ...draft, id: 'cand-a-layout', padToVoice: { ...rest, '4,4': firstVoice }, role: 'working' };
  return {
    id: 'cand-a',
    layout,
    executionPlan: {
      layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' },
      score: 50, unplayableCount: 0, hardCount: 0, fingerAssignments: [],
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0 },
    },
    difficultyAnalysis: { overallScore: 0.1 },
    metadata: { strategy: 'test', seed: 0 },
  } as unknown as CandidateSolution;
}

const ROW_TESTS: Record<InputRowId, () => Promise<void>> = {
  'arm-sound': async () => {
    mount(await importTestMidi1());
    const id = api.state.soundStreams[0]!.id;
    fireEvent.click(soundRow(0));
    expect(api.state.armedStreamId).toBe(id);
    expect(api.state.selectedStreamId).toBe(id);
    expect(soundRow(0).dataset.armed).toBe('true');
    // Clicking it again keeps it armed (it never undoes the auto-advance).
    fireEvent.click(soundRow(0));
    expect(api.state.armedStreamId).toBe(id);
    expect(screen.getByTestId('pad-7-7').title).toContain(`click to place ${api.state.soundStreams[0]!.name}`);
  },

  'pad-click-armed': async () => {
    mount(await importTestMidi1());
    const [first, second] = api.state.soundStreams;
    fireEvent.click(soundRow(0));
    fireEvent.click(pad('3,3'));
    // Placed as one undo step, and the next unplaced Sound is armed.
    expect(shownPads()['3,3']?.id).toBe(first!.id);
    expect(api.undoLabel).toBe('Place Sound');
    expect(api.state.armedStreamId).toBe(second!.id);
    // An occupied pad says so and changes nothing.
    const before = JSON.stringify(shownPads());
    fireEvent.click(pad('3,3'));
    expect(JSON.stringify(shownPads())).toBe(before);
    expect(screen.getByText(PAD_TAKEN_MESSAGE)).toBeTruthy();
    expect(api.state.armedStreamId).toBe(second!.id);
    // One Undo takes the placement back.
    act(() => api.undo());
    expect(shownPads()['3,3']).toBeUndefined();
  },

  'drag-sound': async () => {
    mount(await importTestMidi1());
    const stream = api.state.soundStreams[2]!;
    fireEvent.drop(pad('2,5'), { dataTransfer: dataTransfer({ 'application/pushflow-stream': JSON.stringify({ id: stream.id }) }) });
    expect(shownPads()['2,5']?.id).toBe(stream.id);
  },

  'pad-click-moment': async () => {
    mount(await analysedProject());
    const first = getEventTimeline(api.state).events[0]!;
    selectEvent(first);
    const key = Object.keys(shownPads()).find(k => pad(k).dataset.struck !== 'true')!;
    fireEvent.click(pad(key));
    // The event stays; the pad and its Sound are selected.
    expect(api.state.selectedMomentKey).toBe(first.key);
    expect(api.state.selectedPadKey).toBe(key);
    expect(api.state.selectedStreamId).toBe(shownPads()[key]!.id);
    expect(pad(key).dataset.selected).toBe('true');
  },

  'pad-click-idle': async () => {
    mount(await analysedProject());
    const key = occupiedPad();
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBe(key);
    expect(api.state.selectedStreamId).toBe(shownPads()[key]!.id);
    // Selecting a pad no longer selects that Sound's first hit (T28).
    expect(api.state.selectedMomentKey).toBeNull();
    // An empty pad clears the selection.
    fireEvent.click(pad(emptyPad()));
    expect(api.state.selectedPadKey).toBeNull();
    expect(api.state.selectedStreamId).toBeNull();
  },

  'pad-alt-click': async () => {
    // Reserved for audition (P4): nothing happens yet, armed or not.
    mount(await importTestMidi1());
    fireEvent.click(soundRow(0));
    fireEvent.click(pad('0,0'), { altKey: true });
    expect(shownPads()['0,0']).toBeUndefined();
    expect(api.state.armedStreamId).toBe(api.state.soundStreams[0]!.id);
    expect(boundRows().map(r => r.id)).not.toContain('pad-alt-click');
  },

  'drag-pad': async () => {
    mount(await suggestedTestMidi1());
    const [a, b] = Object.keys(shownPads());
    const [va, vb] = [shownPads()[a!]!.id, shownPads()[b!]!.id];
    fireEvent.drop(pad(b!), { dataTransfer: dataTransfer({ 'application/pushflow-pad': a!, 'application/pushflow-stream': JSON.stringify({ id: va }) }) });
    expect(shownPads()[a!]!.id).toBe(vb);
    expect(shownPads()[b!]!.id).toBe(va);
  },

  'pad-menu': async () => {
    mount(await suggestedTestMidi1());
    fireEvent.contextMenu(pad(occupiedPad()), { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menu')).toBeTruthy();
  },

  'pad-enter': async () => {
    // Reserved for the keyboard grid (P8): Enter on a focused pad does nothing yet.
    mount(await suggestedTestMidi1());
    const key = occupiedPad();
    const before = JSON.stringify(shownPads());
    pad(key).focus();
    press('Enter', {}, pad(key));
    expect(JSON.stringify(shownPads())).toBe(before);
    expect(api.state.selectedPadKey).toBeNull();
    expect(boundRows().map(r => r.id)).not.toContain('pad-enter');
  },

  'read-only-edit': async () => {
    // A candidate shown read-only (S3.2): each edit gesture changes nothing and says how to edit it.
    let state = await suggestedTestMidi1();
    state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [readOnlyCandidate(state)] });
    mount(state);
    expect(api.state.inspectedLayout?.kind).toBe('candidate');
    const before = JSON.stringify(api.state.workingLayout);
    const stream = api.state.soundStreams[0]!;
    fireEvent.drop(pad(emptyPad()), { dataTransfer: dataTransfer({ 'application/pushflow-stream': JSON.stringify({ id: stream.id }) }) });
    fireEvent.contextMenu(pad(occupiedPad()), { clientX: 100, clientY: 100 });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(soundRow(0));
    fireEvent.click(pad(emptyPad()));
    fireEvent.click(pad(occupiedPad()));
    press('Delete');
    expect(JSON.stringify(api.state.workingLayout)).toBe(before);
    expect(screen.getByText('Use as my draft to edit')).toBeTruthy();
  },

  'delete': async () => {
    mount(await analysedProject());
    // With only an event selected, Delete removes nothing (T28).
    const first = getDisplayedExecutionPlan(api.state)!.fingerAssignments.find(a => a.row !== undefined)!;
    act(() => api.dispatch({ type: 'SELECT_EVENT', payload: first.eventIndex! }));
    const before = JSON.stringify(shownPads());
    expect(press('Delete')).toBe(true);
    press('Backspace');
    expect(JSON.stringify(shownPads())).toBe(before);
    // With a pad selected, it takes that pad's Sound off, with Undo in the toast.
    const key = occupiedPad();
    const name = shownPads()[key]!.name;
    fireEvent.click(pad(key));
    press('Delete');
    expect(shownPads()[key]).toBeUndefined();
    expect(api.state.selectedPadKey).toBeNull();
    const [r, c] = key.split(',').map(Number);
    expect(screen.getByText(`Removed ${name} from Row ${r! + 1} · Col ${c! + 1}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shownPads()[key]?.name).toBe(name);
  },

  'space': async () => {
    mount(await suggestedTestMidi1(), <WidgetControls />);
    const button = screen.getByTestId('plain-button');
    button.focus();
    // On a focused button Space plays, and neither its keydown nor its keyup
    // is left to click the button.
    expect(press(' ', {}, button)).toBe(false);
    expect(fireEvent.keyUp(button, { key: ' ' })).toBe(false);
    expect(api.state.isPlaying).toBe(true);
    expect(buttonClick).not.toHaveBeenCalled();
    press(' ');
    expect(api.state.isPlaying).toBe(false);
    // Not in a text field or a select.
    expect(press(' ', {}, screen.getByTestId('plain-input'))).toBe(true);
    expect(press(' ', {}, screen.getByTestId('plain-select'))).toBe(true);
    expect(api.state.isPlaying).toBe(false);
    // A focused checkbox takes Space to tick itself (T63): both keys are left to
    // it, so the browser's click on keyup goes ahead. (The page's last Space
    // had no keyup; a keyup belongs to the latest keydown, so it isn't
    // swallowed for that one.)
    const box = screen.getByRole('checkbox', { name: 'Show finger assignment' }) as HTMLInputElement;
    box.focus();
    expect(press(' ', {}, box)).toBe(true);
    expect(fireEvent.keyUp(box, { key: ' ' })).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(api.state.isPlaying).toBe(false);
    // A tab is a button: Space plays there too (its tab is already selected).
    const tab = screen.getByRole('tab', { name: 'Sounds' });
    tab.focus();
    expect(press(' ', {}, tab)).toBe(false);
    expect(api.state.isPlaying).toBe(true);
  },

  'step-events': async () => {
    mount(await analysedProject(), <WidgetControls />);
    const times = eventTimes();
    press('ArrowRight');
    expect(selectedTime()).toBe(times[0]);
    // At the first event, ← stays there: no wrapping to the last.
    press('ArrowLeft');
    expect(selectedTime()).toBe(times[0]);
    for (let i = 0; i < times.length + 2; i++) press('ArrowRight');
    expect(selectedTime()).toBe(times[times.length - 1]);
    // A focused select keeps its arrows, and so does a text field.
    const select = screen.getByTestId('plain-select');
    expect(press('ArrowLeft', {}, select)).toBe(true);
    expect(press('ArrowLeft', {}, screen.getByTestId('plain-input'))).toBe(true);
    expect(selectedTime()).toBe(times[times.length - 1]);
    // In a row of tabs, ←/→, Home and End move between the tabs, not events (T63).
    const sounds = screen.getByRole('tab', { name: 'Sounds' });
    const events = screen.getByRole('tab', { name: 'Events' });
    sounds.focus();
    press('ArrowRight', {}, sounds);
    expect(events.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(events);
    press('Home', {}, events);
    expect(sounds.getAttribute('aria-selected')).toBe('true');
    press('ArrowLeft', {}, sounds);
    expect(document.activeElement).toBe(events);
    expect(selectedTime()).toBe(times[times.length - 1]);
    // A checkbox uses only Space: ← on a focused one still steps events.
    const box = screen.getByRole('checkbox', { name: 'Show finger assignment' });
    box.focus();
    expect(press('ArrowLeft', {}, box)).toBe(false);
    expect(selectedTime()).toBe(times[times.length - 2]);
    press('ArrowRight', {}, box);
    expect(selectedTime()).toBe(times[times.length - 1]);
    // While playing, nothing.
    act(() => api.dispatch({ type: 'SET_IS_PLAYING', payload: true }));
    press('ArrowLeft');
    expect(selectedTime()).toBe(times[times.length - 1]);
  },

  'events-list-keys': async () => {
    mount(await analysedProject(), <EventsPanel onionSkin={false} onToggleOnionSkin={() => {}} />);
    const rows = document.querySelectorAll<HTMLElement>('[data-input-scope="events"] [data-moment-index]');
    expect(rows.length).toBeGreaterThan(2);
    // Outside the list, ↓ means nothing to the list.
    press('ArrowDown');
    expect(api.state.selectedMomentKey).toBeNull();
    // Inside it, ↓ and j move down, ↑ and k move up.
    fireEvent.click(rows[0]!);
    rows[0]!.focus();
    const t0 = selectedTime();
    press('ArrowDown', {}, rows[0]!);
    const t1 = selectedTime();
    expect(t1).toBeGreaterThan(t0!);
    press('j', {}, rows[0]!);
    expect(selectedTime()).toBeGreaterThan(t1!);
    press('k', {}, rows[0]!);
    expect(selectedTime()).toBe(t1);
    // ArrowDown on a focused select changes the select, not the event (P2-10).
    expect(press('ArrowDown', {}, screen.getByTestId('plain-select'))).toBe(true);
    expect(selectedTime()).toBe(t1);
  },

  'exit-replay': async () => {
    // A step of candidate A's trace replayed on the grid (S3.4, T33): Esc leaves
    // the replay before anything else, and the edits it refused work again.
    let state = await suggestedTestMidi1();
    const replay = readOnlyCandidate(state);
    const steps = [0, 1, 2].map(i => ({ iterationIndex: i, phase: 'hill-climb', stateBefore: { layout: replay.layout, assignment: {} } }));
    state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [{ ...replay, iterationTrace: steps } as CandidateSolution] });
    state = projectReducer(state, { type: 'INSPECT_LAYOUT', payload: null });
    mount({ ...state, moveHistoryIndex: 2 });
    expect(api.state.iterationTrace).toHaveLength(3);
    const key = Object.keys(shownPads())[0]!;
    fireEvent.click(pad(key));
    press('Delete');
    expect(shownPads()[key]).toBeDefined();
    expect(api.state.moveHistoryIndex).toBe(2);
    press('Escape');
    expect(api.state.moveHistoryIndex).toBeNull();
    // Not replaying: Esc goes on to the next layer (the selected pad).
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBe(key);
    press('Escape');
    expect(api.state.selectedPadKey).toBeNull();
  },

  'escape': async () => {
    const state = await analysedProject();
    const first = getEventTimeline(state).events[0]!;
    mount({ ...state, selectedMomentKey: first.key });
    const key = Object.keys(shownPads())[1]!;
    fireEvent.click(pad(key));
    fireEvent.click(soundRow(0));
    // Layers: an open menu, the armed Sound, the pad, the event.
    fireEvent.contextMenu(pad(key), { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menu')).toBeTruthy();
    press('Escape', {}, screen.getAllByRole('menuitem')[0]!);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(api.state.armedStreamId).not.toBeNull();
    press('Escape');
    expect(api.state.armedStreamId).toBeNull();
    // Arming ended the pad selection, so select the pad again for the next layer.
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBe(key);
    press('Escape');
    expect(api.state.selectedPadKey).toBeNull();
    expect(api.state.selectedMomentKey).toBe(first.key);
    press('Escape');
    expect(api.state.selectedMomentKey).toBeNull();
    // Nothing left: the key is left alone.
    expect(press('Escape')).toBe(true);
  },

  'rename-sound': async () => {
    mount(await importTestMidi1());
    fireEvent.keyDown(screen.getAllByTestId('sound-name')[0]!, { key: 'F2' });
    const input = screen.getByTestId('sound-rename-input') as HTMLInputElement;
    // Keys typed while renaming are the field's: Space doesn't play.
    expect(press(' ', {}, input)).toBe(true);
    expect(api.state.isPlaying).toBe(false);
    fireEvent.change(input, { target: { value: 'Kick' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.state.soundStreams[0]!.name).toBe('Kick');
  },

  'group-sounds': async () => {
    mount(await importTestMidi1());
    const [a, b] = api.state.soundStreams;
    fireEvent.click(soundRow(0), { ctrlKey: true });
    fireEvent.click(soundRow(1), { ctrlKey: true });
    // Selecting several Sounds is not placing.
    expect(api.state.armedStreamId).toBeNull();
    press('g', { ctrlKey: true });
    const groupOf = (id: string) => api.state.performanceLanes.find(l => l.id === id)?.groupId ?? null;
    expect(groupOf(a!.id)).not.toBeNull();
    expect(groupOf(a!.id)).toBe(groupOf(b!.id));
    // The same two, again: ungrouped.
    const rowFor = (id: string) => screen.getAllByTestId('sound-row').find(el => el.dataset.soundId === id)!;
    fireEvent.click(rowFor(a!.id), { ctrlKey: true });
    fireEvent.click(rowFor(b!.id), { ctrlKey: true });
    press('g', { ctrlKey: true });
    expect(groupOf(a!.id)).toBeNull();
    expect(groupOf(b!.id)).toBeNull();
  },

  'undo': async () => {
    mount(await importTestMidi1());
    fireEvent.click(soundRow(0));
    fireEvent.click(pad('1,1'));
    expect(shownPads()['1,1']).toBeDefined();
    // Not from a text field (its own undo).
    press('z', { ctrlKey: true }, screen.getByTestId('plain-input'));
    expect(shownPads()['1,1']).toBeDefined();
    press('z', { ctrlKey: true });
    expect(shownPads()['1,1']).toBeUndefined();
  },

  'redo': async () => {
    mount(await importTestMidi1());
    fireEvent.click(soundRow(0));
    fireEvent.click(pad('1,1'));
    press('z', { metaKey: true });
    press('z', { metaKey: true, shiftKey: true });
    expect(shownPads()['1,1']).toBeDefined();
    press('z', { ctrlKey: true });
    press('y', { ctrlKey: true });
    expect(shownPads()['1,1']).toBeDefined();
  },

  'save': async () => {
    mount(await importTestMidi1());
    expect(press('s', { ctrlKey: true })).toBe(false);
    // From a text field too, where the browser would offer to save the page.
    expect(press('s', { metaKey: true }, screen.getByTestId('plain-input'))).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(2);
  },

  'shortcut-sheet': async () => {
    mount(await importTestMidi1());
    press('?', { shiftKey: true });
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
    // Not while typing a question mark.
    press('?', { shiftKey: true }, screen.getByTestId('plain-input'));
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
    // The sheet lists every bound row, and none reserved for later.
    cleanup();
    render(<ShortcutSheet onClose={() => {}} />);
    const sheet = screen.getByTestId('shortcut-sheet');
    const listed = [...sheet.querySelectorAll<HTMLElement>('[data-row-id]')].map(el => el.dataset.rowId);
    expect(listed.sort()).toEqual(boundRows().map(r => r.id).sort());
    expect(within(sheet).getByRole('heading', { name: 'Keyboard and mouse' })).toBeTruthy();
  },
};

describe('the input table (P2-10): one test per row', () => {
  for (const row of INPUT_TABLE) {
    it(`${row.id}: ${row.input.join(' / ')} — ${row.when}`, async () => {
      await ROW_TESTS[row.id]();
    });
  }

  it('every row has a test, and every test a row', () => {
    expect(Object.keys(ROW_TESTS).sort()).toEqual(INPUT_TABLE.map(r => r.id).sort());
  });
});

describe('the registry', () => {
  it('leaves keys in text fields, selects, contenteditable and menus to them', () => {
    const el = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.appendChild(host);
      return host.querySelector<HTMLElement>('[data-t]')!;
    };
    expect(keysBelongToTarget(el('<input data-t />'))).toBe(true);
    // A checkbox takes no typing: it owns only Space (widgetOwnsKey, next test).
    expect(keysBelongToTarget(el('<input type="checkbox" data-t />'))).toBe(false);
    expect(keysBelongToTarget(el('<textarea data-t></textarea>'))).toBe(true);
    expect(keysBelongToTarget(el('<select data-t><option>1</option></select>'))).toBe(true);
    expect(keysBelongToTarget(el('<div role="menu"><button data-t>x</button></div>'))).toBe(true);
    expect(keysBelongToTarget(el('<div role="listbox"><div data-t tabindex="0">x</div></div>'))).toBe(true);
    expect(keysBelongToTarget(el('<button data-t>x</button>'))).toBe(false);
    expect(keysBelongToTarget(el('<input type="button" data-t />'))).toBe(false);
    const editable = el('<div data-t contenteditable="true">x</div>');
    // happy-dom may not compute isContentEditable; the check reads it.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(keysBelongToTarget(editable)).toBe(true);
    document.body.innerHTML = '';
  });

  it('leaves a focused widget its own keys by role, and only those (T63)', () => {
    const el = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.appendChild(host);
      return host.querySelector<HTMLElement>('[data-t]')!;
    };
    // A checkbox (native or by role) and a switch own Space, and nothing else.
    for (const html of ['<input type="checkbox" data-t />', '<div role="checkbox" tabindex="0" data-t></div>', '<button role="switch" data-t>x</button>']) {
      const widget = el(html);
      expect(widgetOwnsKey(widget, ' ')).toBe(true);
      expect(['ArrowLeft', 'ArrowRight', 'Delete', 'Escape'].some(k => widgetOwnsKey(widget, k))).toBe(false);
    }
    // A tab list owns ←/→/Home/End; Space on a tab still plays (it is a button).
    const tab = el('<div role="tablist"><button role="tab" data-t>x</button></div>');
    expect(['ArrowLeft', 'ArrowRight', 'Home', 'End'].every(k => widgetOwnsKey(tab, k))).toBe(true);
    expect(widgetOwnsKey(tab, ' ')).toBe(false);
    expect(widgetOwnsKey(tab, 'ArrowDown')).toBe(false);
    // A plain button owns nothing.
    expect(widgetOwnsKey(el('<button data-t>x</button>'), ' ')).toBe(false);

    // Through the listener, with raw events no widget handler has seen.
    const registry = new InputRegistry();
    const space = vi.fn();
    const step = vi.fn();
    const offs = [registry.register('space', space), registry.register('step-events', step)];
    const key = (target: Element, k: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const box = el('<input type="checkbox" data-t />');
    expect(key(box, ' ')).toBe(true);
    expect(space).not.toHaveBeenCalled();
    expect(key(box, 'ArrowLeft')).toBe(false);
    expect(step).toHaveBeenCalledTimes(1);
    expect(key(tab, 'ArrowRight')).toBe(true);
    expect(step).toHaveBeenCalledTimes(1);
    expect(key(tab, ' ')).toBe(false);
    expect(space).toHaveBeenCalledTimes(1);
    offs.forEach(off => off());
    document.body.innerHTML = '';
  });

  it('calls the highest priority first, then the latest bound; false passes the key on', () => {
    const registry = new InputRegistry();
    const calls: string[] = [];
    const offA = registry.register('space', () => { calls.push('workspace'); });
    const offB = registry.register('space', () => { calls.push('composer'); }, 1);
    const offC = registry.register('space', () => { calls.push('late'); return false; }, 1);
    registry.handleKeyDown(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(calls).toEqual(['late', 'composer']);
    offB(); offC();
    registry.handleKeyDown(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(calls).toEqual(['late', 'composer', 'workspace']);
    offA();
    expect(registry.boundIds()).toEqual([]);
  });

  it('skips keys a widget already handled, and everything but Save under an open overlay', () => {
    const registry = new InputRegistry();
    const space = vi.fn();
    const save = vi.fn();
    registry.register('space', space);
    registry.register('save', save);
    const handled = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    handled.preventDefault();
    registry.handleKeyDown(handled);
    expect(space).not.toHaveBeenCalled();

    render(<Popover x={0} y={0} onClose={() => {}} ariaLabel="menu"><button role="menuitem">item</button></Popover>);
    registry.handleKeyDown(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    registry.handleKeyDown(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }));
    expect(space).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('the editor binds every bound key row, and nothing reserved', async () => {
    mount(await importTestMidi1(), <EventsPanel onionSkin={false} onToggleOnionSkin={() => {}} />);
    const keyRows = INPUT_TABLE.filter(r => r.keys && !r.from).map(r => r.id);
    // group-sounds binds only while Sounds are selected.
    fireEvent.click(soundRow(0), { ctrlKey: true });
    expect(inputRegistry.boundIds().sort()).toEqual([...keyRows].sort());
  });
});

describe('what a pad click means', () => {
  const ctx = { armed: false, occupied: false, holdsArmed: false, eventSelected: false, altKey: false };
  it('follows the table, first match wins', () => {
    expect(padClickMeaning({ ...ctx, armed: true })).toEqual({ row: 'pad-click-armed', action: 'place' });
    expect(padClickMeaning({ ...ctx, armed: true, occupied: true })).toEqual({ row: 'pad-click-armed', action: 'taken' });
    expect(padClickMeaning({ ...ctx, armed: true, occupied: true, holdsArmed: true })).toEqual({ row: 'pad-click-armed', action: 'disarm' });
    expect(padClickMeaning({ ...ctx, armed: true, altKey: true })).toEqual({ row: 'pad-alt-click', action: 'none' });
    expect(padClickMeaning({ ...ctx, eventSelected: true, occupied: true })).toEqual({ row: 'pad-click-moment', action: 'select-pad' });
    expect(padClickMeaning({ ...ctx, occupied: true })).toEqual({ row: 'pad-click-idle', action: 'select-pad' });
    expect(padClickMeaning({ ...ctx })).toEqual({ row: 'pad-click-idle', action: 'clear-pad' });
  });

  it('moving an armed Sound that is already placed ends placing', async () => {
    mount(await suggestedTestMidi1());
    const id = api.state.soundStreams[0]!.id;
    fireEvent.click(soundRow(0));
    fireEvent.click(pad('7,7'));
    expect(shownPads()['7,7']?.id).toBe(id);
    expect(Object.values(shownPads()).filter(v => v.id === id)).toHaveLength(1);
    expect(api.state.armedStreamId).toBeNull();
  });

  it('a locked Sound is not moved by a click, and says why', async () => {
    let state = await suggestedTestMidi1();
    const [key, voice] = Object.entries(getDisplayedLayout(state)!.padToVoice)[0]!;
    state = projectReducer(state, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: voice.id, padKey: key } });
    mount(state);
    const row = screen.getAllByTestId('sound-row').find(el => el.dataset.soundId === voice.id)!;
    fireEvent.click(row);
    fireEvent.click(pad('7,7'));
    expect(shownPads()[key]?.id).toBe(voice.id);
    expect(shownPads()['7,7']).toBeUndefined();
    expect(screen.getByText(/is locked to Row .* · Unlock it to move it/)).toBeTruthy();
  });

  it('shows keys for this platform', () => {
    expect(displayInput('Mod+Shift+Z', true)).toBe('⌘⇧Z');
    expect(displayInput('Mod+Shift+Z', false)).toBe('Ctrl+Shift+Z');
    expect(displayInput('Alt-click a pad', true)).toBe('Option-click a pad');
    expect(displayInput('Click a pad', false)).toBe('Click a pad');
  });
});
