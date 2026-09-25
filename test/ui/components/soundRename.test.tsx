// @vitest-environment happy-dom
/**
 * S2.2a · renaming Sounds from the keyboard (T17): F2 or Enter on a name (or
 * the hover pencil) starts it; Enter or Tab keeps the name and moves on to the
 * next Sound, Shift+Tab to the previous; Escape changes nothing. The Sounds
 * header offers "Name from GM drum map" only when it would rename something.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

async function mount(state?: ProjectState) {
  const initial = state ?? await importTestMidi1();
  let api: ReturnType<typeof useProject> | null = null;
  function Probe() {
    api = useProject();
    return null;
  }
  render(<ProjectProvider initialState={initial}><Probe /><VoicePalette /></ProjectProvider>);
  return { api: () => api!, initial };
}

const names = () => screen.getAllByTestId('sound-name').map(el => el.textContent);
const input = () => screen.getByTestId('sound-rename-input') as HTMLInputElement;

describe('renaming Sounds (T17)', () => {
  it('F2 starts a rename; Enter keeps it and moves on to the next Sound', async () => {
    const { api } = await mount();
    fireEvent.keyDown(screen.getAllByTestId('sound-name')[0]!, { key: 'F2' });
    expect(input().value).toBe('TEST MIDI 1 A');
    fireEvent.change(input(), { target: { value: 'Kick' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(api().state.soundStreams[0]!.name).toBe('Kick');
    // The next Sound is now being renamed.
    expect(input().value).toBe('TEST MIDI 1 B');
    fireEvent.change(input(), { target: { value: 'Snare' } });
    fireEvent.keyDown(input(), { key: 'Tab' });
    expect(api().state.soundStreams[1]!.name).toBe('Snare');
    expect(input().value).toBe('TEST MIDI 1 C');
    // Shift+Tab goes back without renaming this one.
    fireEvent.keyDown(input(), { key: 'Tab', shiftKey: true });
    expect(input().value).toBe('Snare');
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByTestId('sound-rename-input')).toBeNull();
    expect(names().slice(0, 3)).toEqual(['Kick', 'Snare', 'TEST MIDI 1 C']);
  });

  it('Enter on a name and the pencil also start it; Escape and an unchanged name change nothing', async () => {
    const { api, initial } = await mount();
    fireEvent.keyDown(screen.getAllByTestId('sound-name')[2]!, { key: 'Enter' });
    fireEvent.change(input(), { target: { value: 'Hat' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(api().state.soundStreams[2]!.name).toBe('TEST MIDI 1 C');

    fireEvent.click(screen.getAllByTestId('sound-rename')[3]!);
    fireEvent.blur(input());
    expect(api().state.soundStreams).toEqual(initial.soundStreams);
    expect(api().canUndo).toBe(false);
  });

  it('the last Sound ends the run: Enter keeps the name and closes the field', async () => {
    const { api } = await mount();
    fireEvent.keyDown(screen.getAllByTestId('sound-name')[6]!, { key: 'F2' });
    fireEvent.change(input(), { target: { value: 'Ride' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(api().state.soundStreams[6]!.name).toBe('Ride');
    expect(screen.queryByTestId('sound-rename-input')).toBeNull();
  });
});

describe('Name from GM drum map in the Sounds header', () => {
  it('is disabled when no Sound has a GM drum pitch (TEST MIDI 1 uses pitches 0–14)', async () => {
    await mount();
    expect((screen.getByTestId('name-from-gm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renames every GM Sound as one undo step', async () => {
    const tm1 = await importTestMidi1();
    const gm = [36, 38, 42];
    const lanes = tm1.performanceLanes.map((l, i) => i < 3 ? { ...l, events: l.events.map(e => ({ ...e, rawPitch: gm[i]! })) } : l);
    const state = projectReducer({ ...tm1, performanceLanes: lanes }, { type: 'SYNC_STREAMS_FROM_LANES' });
    const { api } = await mount(state);
    const button = screen.getByTestId('name-from-gm') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    act(() => { fireEvent.click(button); });
    expect(names().slice(0, 3)).toEqual(['Kick', 'Snare', 'Closed Hat']);
    expect(api().undoLabel).toBe('Name from GM drum map');
    act(() => api().undo());
    expect(names().slice(0, 3)).toEqual(['TEST MIDI 1 A', 'TEST MIDI 1 B', 'TEST MIDI 1 C']);
  });
});
