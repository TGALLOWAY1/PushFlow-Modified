// @vitest-environment happy-dom
/**
 * Composer data can't be lost (S1a.5; T60, T66, T67; roadmap P1a-11a, P1a-12a–c).
 *
 * - A pending Composer save and sync are written when the tab is switched away
 *   and when the Composer unmounts, never dropped.
 * - Composer sync writes notes only: a Sound renamed, recoloured or muted in
 *   the project keeps that after a Composer edit.
 * - Composer finger edits go through voiceConstraints under the lane's project
 *   Sound id (what the Sounds panel reads) and can be cleared.
 * - Clear shows a toast whose Undo restores the notes, the Sounds and their pads.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { WorkspacePatternStudio } from '../../../src/ui/components/workspace/WorkspacePatternStudio';
import { createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';
import { loadLoopState } from '../../../src/ui/persistence/loopStorage';

const PROJECT_ID = 'composer-test';
const PATTERN_SOURCE = 'workspace_pattern_source';

type Ctx = ReturnType<typeof useProject>;

function Probe({ into }: { into: { current: Ctx | null } }) {
  into.current = useProject();
  return null;
}

function setup(isActive = true) {
  const state: ProjectState = { ...createEmptyProjectState(), id: PROJECT_ID };
  const ctx: { current: Ctx | null } = { current: null };
  const tree = (active: boolean) => (
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Probe into={ctx} />
        <WorkspacePatternStudio isActive={active} />
      </ProjectProvider>
    </ToastProvider>
  );
  const utils = render(tree(isActive));
  return {
    ...utils,
    project: () => ctx.current!,
    setActive: (active: boolean) => utils.rerender(tree(active)),
  };
}

const cell = (lane: number, step: number) => screen.getByTestId(`composer-cell-${lane}-${step}`);
const onCells = () => document.querySelectorAll('[data-testid^="composer-cell-"][data-on="true"]').length;
const composerSounds = (s: ProjectState) => s.performanceLanes.filter(l => l.sourceFileId === PATTERN_SOURCE);
const eventCount = (s: ProjectState) => s.soundStreams.reduce((n, st) => n + st.events.length, 0);

/** Adds a lane, toggles a note on it and waits for the Composer to sync it into the project. */
async function addLaneWithNote(project: () => Ctx, laneIndex: number, step: number) {
  fireEvent.click(screen.getByTitle('Add lane'));
  fireEvent.click(cell(laneIndex, step));
  await waitFor(() => expect(composerSounds(project().state)).toHaveLength(laneIndex + 1));
  return composerSounds(project().state)[laneIndex]!.id;
}

beforeEach(() => {
  localStorage.clear();
});

describe('P1a-11a · a pending Composer edit is written, never dropped', () => {
  it('flushes the save and the sync as soon as the tab is switched away', () => {
    const { project, setActive } = setup();
    fireEvent.click(screen.getByTitle('Add lane'));
    fireEvent.click(cell(0, 0));
    // Nothing yet: the save waits 500 ms and the sync 200 ms.
    expect(loadLoopState(PROJECT_ID)).toBeNull();
    expect(composerSounds(project().state)).toHaveLength(0);

    setActive(false);

    expect(loadLoopState(PROJECT_ID)?.events.size).toBe(1);
    expect(composerSounds(project().state)).toHaveLength(1);
    expect(eventCount(project().state)).toBe(1);
  });

  it('flushes them when the Composer unmounts', () => {
    const { unmount } = setup();
    fireEvent.click(screen.getByTitle('Add lane'));
    fireEvent.click(cell(0, 3));
    unmount();
    expect(loadLoopState(PROJECT_ID)?.events.size).toBe(1);
  });

  it('flushes them on Stop', () => {
    const { project } = setup();
    fireEvent.click(screen.getByTitle('Add lane'));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(cell(0, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(loadLoopState(PROJECT_ID)?.events.size).toBe(1);
    expect(eventCount(project().state)).toBe(1);
  });

  it('opening the Composer with a stored pattern writes nothing to the project', async () => {
    const first = setup();
    await addLaneWithNote(first.project, 0, 0);
    first.setActive(false);
    first.unmount();

    const { project } = setup(false);
    await new Promise(r => setTimeout(r, 300));
    expect(project().canUndo).toBe(false);
    expect(onCells()).toBe(1);
  });
});

describe('P1a-12a · Composer sync writes notes only', () => {
  it('a Sound renamed, recoloured and muted in the project keeps all three after a Composer edit', async () => {
    const { project } = setup();
    const id = await addLaneWithNote(project, 0, 0);
    act(() => {
      project().dispatch({ type: 'RENAME_SOUND', payload: { streamId: id, name: 'Kick' } });
      project().dispatch({ type: 'SET_SOUND_COLOR', payload: { streamId: id, color: '#123456' } });
      project().dispatch({ type: 'TOGGLE_MUTE', payload: id });
    });

    fireEvent.click(cell(0, 4));
    await waitFor(() => expect(eventCount(project().state)).toBe(2));

    const sound = project().state.soundStreams.find(s => s.id === id)!;
    expect({ name: sound.name, color: sound.color, muted: sound.muted }).toEqual({ name: 'Kick', color: '#123456', muted: true });
    // The Composer shows the project's name.
    expect(screen.getByTitle('Kick')).toBeTruthy();
  });

  it('a Composer edit that changes no notes records no undo step', async () => {
    const { project } = setup();
    await addLaneWithNote(project, 0, 0);
    const before = project().state;
    // Toggle a note on and off again before the sync fires.
    fireEvent.click(cell(0, 5));
    fireEvent.click(cell(0, 5));
    await new Promise(r => setTimeout(r, 300));
    expect(project().state.performanceLanes).toBe(before.performanceLanes);
    expect(project().undoLabel).toBe('Composer edit');
  });

  it('renaming a lane in the Composer renames its Sound', async () => {
    const { project } = setup();
    const id = await addLaneWithNote(project, 0, 0);
    fireEvent.doubleClick(screen.getByTitle('Lane 1'));
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Snare' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(project().state.soundStreams.find(s => s.id === id)?.name).toBe('Snare');
  });
});

describe('P1a-12b · Composer finger edits are the Sound\'s finger preference', () => {
  it('sets voiceConstraints under the project Sound id and clears it', async () => {
    const { project } = setup();
    const id = await addLaneWithNote(project, 0, 0);

    fireEvent.click(screen.getByTitle('Click to assign finger (e.g. L1, R5)'));
    let input = document.querySelector('input[maxlength="2"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'L2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(project().state.voiceConstraints).toEqual({ [id]: { hand: 'left', finger: 'index' } });

    fireEvent.click(screen.getByText('L2'));
    input = document.querySelector('input[maxlength="2"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(project().state.voiceConstraints).toEqual({});
  });

  it('shows a preference set in the Sounds panel', async () => {
    const { project } = setup();
    const id = await addLaneWithNote(project, 0, 0);
    act(() => project().dispatch({ type: 'SET_VOICE_CONSTRAINT', payload: { streamId: id, hand: 'right', finger: 'middle' } }));
    expect(screen.getByText('R3')).toBeTruthy();
  });
});

describe('P1a-12c · Undo after Clear restores the notes, Sounds and pads', () => {
  it('restores everything from the Clear toast', async () => {
    const { project } = setup();
    const kick = await addLaneWithNote(project, 0, 0);
    const snare = await addLaneWithNote(project, 1, 4);
    const streams = project().state.soundStreams;
    act(() => {
      project().dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: streams.find(s => s.id === kick)! } });
      project().dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,1', stream: streams.find(s => s.id === snare)! } });
      project().dispatch({ type: 'SET_VOICE_CONSTRAINT', payload: { streamId: snare, hand: 'left', finger: 'middle' } });
    });
    const before = project().state;
    const pads = (s: ProjectState) => (s.workingLayout ?? s.activeLayout).padToVoice;

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onCells()).toBe(0);
    expect(project().state.soundStreams).toHaveLength(0);
    expect(pads(project().state)).toEqual({});
    expect(screen.getByText(/Composer cleared · 2 notes and 2 Sounds removed/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onCells()).toBe(2);
    expect(project().state.soundStreams.map(s => s.id)).toEqual(before.soundStreams.map(s => s.id));
    expect(pads(project().state)).toEqual(pads(before));
    expect(project().state.voiceConstraints).toEqual(before.voiceConstraints);

    // And the restored pattern is stored again.
    await waitFor(() => expect(loadLoopState(PROJECT_ID)?.events.size).toBe(2));
  });

  it('restores the notes after the project Undo too (Ctrl+Z / toolbar)', async () => {
    const { project } = setup();
    await addLaneWithNote(project, 0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(project().undoLabel).toBe('Clear Composer');
    act(() => { project().undo(); });
    expect(onCells()).toBe(1);
    expect(composerSounds(project().state)).toHaveLength(1);
  });

  it('drops the toast\'s Undo once another step is recorded', async () => {
    const { project } = setup();
    const id = await addLaneWithNote(project, 0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    act(() => project().dispatch({ type: 'RENAME_PROJECT', payload: `Renamed ${id}` }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull());
  });
});

describe('P1a-13b · Save Preset marks made-up fingering unverified', () => {
  it('records a finger preference as such, and the column/index fallback as unverified', async () => {
    const { project } = setup();
    const kick = await addLaneWithNote(project, 0, 0);
    const snare = await addLaneWithNote(project, 1, 4);
    const streams = project().state.soundStreams;
    act(() => {
      project().dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: streams.find(s => s.id === kick)! } });
      project().dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,1', stream: streams.find(s => s.id === snare)! } });
      project().dispatch({ type: 'SET_VOICE_CONSTRAINT', payload: { streamId: snare, hand: 'left', finger: 'middle' } });
    });
    const prompt = window.prompt;
    window.prompt = () => 'P';
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Save Preset' }));
    } finally {
      window.prompt = prompt;
    }
    const [preset] = JSON.parse(localStorage.getItem('pushflow_composer_presets') ?? '[]');
    const byLane = Object.fromEntries(preset.pads.map((p: { laneId: string; fingerSource: string; finger: string }) => [p.laneId, [p.finger, p.fingerSource]]));
    expect(Object.values(byLane).sort()).toEqual([['index', 'unverified'], ['middle', 'preference']]);
  });
});
