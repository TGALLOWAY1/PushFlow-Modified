// @vitest-environment happy-dom
/**
 * S3.2 · looking never writes (T01; roadmap P3-1): while a candidate is
 * inspected, every edit path through the real grid, Sounds panel and key
 * handlers is refused with "Use as my draft to edit", one test per path for
 * drag, the pad menu, click-to-place and Delete; the other paths (a preset
 * drop, the pad's ×, the selected note's finger controls) share one.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActivePerformance,
  getDisplayedExecutionPlan,
  projectReducer,
  resolveInspectedLayout,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { pickDocument, documentChanged } from '../../../src/ui/state/projectDocument';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { ActiveLayoutSummary } from '../../../src/ui/components/panels/ActiveLayoutSummary';
import { COMPOSER_PRESET_DRAG_TYPE } from '../../../src/ui/components/composer/PresetCard';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

const HINT = 'Use as my draft to edit';
let api: ReturnType<typeof useProject>;
let presetDrops = 0;

/** The editor's input surfaces as the workspace wires them: a read-only layout shows through layoutOverride. */
function Editor() {
  api = useProject();
  useKeyboardShortcuts({});
  const shown = resolveInspectedLayout(api.state);
  const plan = getDisplayedExecutionPlan(api.state);
  return (
    <>
      <VoicePalette />
      <InteractiveGrid
        padSize={48}
        assignments={plan?.fingerAssignments}
        selectedEventIndex={api.state.selectedEventIndex}
        layoutOverride={shown.readOnly ? shown.layout : undefined}
        onPresetDrop={() => { presetDrops++; }}
      />
      <ActiveLayoutSummary />
    </>
  );
}

/**
 * TEST MIDI 1 suggested (the draft), a candidate that moves its first Sound to
 * [4,4], shown read-only as after Generate, with the candidate's own plan
 * mirrored as the workspace does, so its pads, fingers and events are on screen.
 */
async function inspectingCandidate(): Promise<ProjectState> {
  let state = await suggestedTestMidi1();
  const draft = state.workingLayout!;
  const [firstPad, firstVoice] = Object.entries(draft.padToVoice)[0]!;
  const { [firstPad]: _moved, ...rest } = draft.padToVoice;
  const layout: Layout = { ...draft, id: 'cand-a-layout', padToVoice: { ...rest, '4,4': firstVoice } };
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  const candidate = { ...analysis, id: 'cand-a', layout, metadata: { strategy: 'pose0-offset-0', seed: 0 } } as CandidateSolution;
  state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [candidate] });
  state = projectReducer(state, { type: 'SET_INSPECTED_ANALYSIS', payload: candidate });
  expect(resolveInspectedLayout(state)).toMatchObject({ role: 'candidate', readOnly: true });
  return state;
}

function mount(state: ProjectState) {
  presetDrops = 0;
  render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor />
      </ProjectProvider>
    </ToastProvider>,
  );
  return { before: pickDocument(api.state), draftHash: hashLayout(api.state.workingLayout!) };
}

const pad = (key: string) => screen.getByTestId(`pad-${key.replace(',', '-')}`);
/** The pads the grid shows (the candidate's), by key. */
const shownPads = () => resolveInspectedLayout(api.state).layout.padToVoice;
const occupiedPad = () => Object.keys(shownPads())[0]!;
const emptyPad = () => ['7,7', '7,6', '6,7', '6,6'].find(k => !shownPads()[k])!;
/** A pad that looks empty but holds a Sound in the draft: the candidate moved that Sound off it. */
const hiddenDraftPad = () => {
  const key = Object.keys(api.state.workingLayout!.padToVoice).find(k => !shownPads()[k]);
  expect(key).toBeDefined();
  return key!;
};
const soundRow = (i: number) => screen.getAllByTestId('sound-row')[i]!;

function dataTransfer(data: Record<string, string>) {
  return { types: Object.keys(data), getData: (type: string) => data[type] ?? '', setData: () => {}, dropEffect: 'move', effectAllowed: 'move' };
}

/** Nothing written: the document, and so the draft, as it was; no undo step; the hint on screen. */
function expectRefused(before: ReturnType<typeof pickDocument>, draftHash: string) {
  expect(documentChanged(before, pickDocument(api.state))).toBe(false);
  expect(hashLayout(api.state.workingLayout!)).toBe(draftHash);
  expect(api.canUndo).toBe(false);
  expect(screen.getByText(HINT)).toBeTruthy();
}

describe('while a candidate is inspected, each edit path is refused with the hint', () => {
  it('drag: a Sound from the Sounds panel, and a pad onto another', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    const stream = api.state.soundStreams[1]!;
    // The drop target refuses it at dragover: not default-prevented, so the browser won't drop…
    const over = dataTransfer({ 'application/pushflow-stream': JSON.stringify({ id: stream.id }) });
    expect(fireEvent.dragOver(pad(emptyPad()), { dataTransfer: over })).toBe(true);
    // …and a drop that arrives anyway changes nothing.
    fireEvent.drop(pad(emptyPad()), { dataTransfer: over });
    const [a, b] = Object.keys(shownPads());
    fireEvent.drop(pad(b!), { dataTransfer: dataTransfer({ 'application/pushflow-pad': a!, 'application/pushflow-stream': JSON.stringify({ id: shownPads()[a!]!.id }) }) });
    // A pad drag doesn't start.
    expect(fireEvent.dragStart(pad(a!), { dataTransfer: dataTransfer({}) })).toBe(false);
    expectRefused(before, draftHash);
  });

  it('the pad menu (lock, finger, remove) does not open', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    fireEvent.contextMenu(pad(occupiedPad()), { clientX: 100, clientY: 100 });
    expect(screen.queryByRole('menu')).toBeNull();
    expectRefused(before, draftHash);
  });

  it('click-to-place: an armed Sound is not placed, on an empty pad or a taken one', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    fireEvent.click(soundRow(1));
    expect(api.state.armedStreamId).toBe(api.state.soundStreams[1]!.id);
    fireEvent.click(pad(emptyPad()));
    fireEvent.click(pad(occupiedPad()));
    expect(screen.queryByText('Pad taken · drag to swap')).toBeNull();
    expectRefused(before, draftHash);
  });

  it('click-to-place on a pad that looks empty but holds the armed Sound in the draft: the hint, not a silent disarm', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    const key = hiddenDraftPad();
    const i = api.state.soundStreams.findIndex(s => s.id === api.state.workingLayout!.padToVoice[key]!.id);
    fireEvent.click(soundRow(i));
    const armed = api.state.soundStreams[i]!.id;
    expect(api.state.armedStreamId).toBe(armed);
    fireEvent.click(pad(key));
    // Still armed, as after any refused click-to-place.
    expect(api.state.armedStreamId).toBe(armed);
    expectRefused(before, draftHash);
  });

  it('with nothing armed, a click on that pad clears the selection, as on any empty pad', async () => {
    mount(await inspectingCandidate());
    const key = hiddenDraftPad();
    fireEvent.click(pad(occupiedPad()));
    expect(api.state.selectedPadKey).toBe(occupiedPad());
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBeNull();
    expect(api.state.selectedStreamId).toBeNull();
  });

  it('Delete on a selected pad removes nothing, and says so instead of "Removed"', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    const key = occupiedPad();
    fireEvent.click(pad(key));
    expect(api.state.selectedPadKey).toBe(key);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(shownPads()[key]).toBeDefined();
    expect(screen.queryByText(/^Removed /)).toBeNull();
    expectRefused(before, draftHash);
  });

  it('the rest: a preset drop, the pad\'s ×, and the selected note\'s finger controls', async () => {
    const { before, draftHash } = mount(await inspectingCandidate());
    // A preset dropped on the grid never reaches its handler.
    fireEvent.drop(pad(emptyPad()), { dataTransfer: dataTransfer({ [COMPOSER_PRESET_DRAG_TYPE]: JSON.stringify({ presetId: 'p', isMirrored: false }) }) });
    expect(presetDrops).toBe(0);
    // No remove button on a read-only layout's pads.
    expect(within(pad(occupiedPad())).queryByTitle('Remove from pad')).toBeNull();
    // The selected note's finger controls are disabled and say how to edit.
    const note = getDisplayedExecutionPlan(api.state)!.fingerAssignments.find(a => a.row !== undefined)!;
    act(() => api.dispatch({ type: 'SELECT_EVENT', payload: note.eventIndex! }));
    const controls = screen.getByTestId('selected-note-fingers');
    const buttons = within(controls).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(within(controls).getByTestId('disabled-reason').textContent).toBe(HINT);
    fireEvent.click(buttons[0]!);
    expect(documentChanged(before, pickDocument(api.state))).toBe(false);
    expect(hashLayout(api.state.workingLayout!)).toBe(draftHash);
    expect(api.canUndo).toBe(false);
  });

  it('and all of it works again after "Back to my draft"', async () => {
    mount(await inspectingCandidate());
    act(() => api.dispatch({ type: 'INSPECT_LAYOUT', payload: null }));
    const key = occupiedPad();
    fireEvent.click(pad(key));
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(api.state.workingLayout!.padToVoice[key]).toBeUndefined();
    expect(api.undoLabel).toBe('Remove from pad');
  });
});
