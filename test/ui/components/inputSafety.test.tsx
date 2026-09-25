// @vitest-environment happy-dom
/**
 * P1b-6 (S1b.4): finger input safety (T19) and Delete scoping (T28).
 * - Opening the finger field on a solver suggestion and blurring it (or
 *   pressing Escape) without typing leaves voiceConstraints unchanged.
 * - Invalid input is flagged inline and sets nothing.
 * - Delete/Backspace with an event selected and no pad selected removes nothing.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react';
import { FingerAssignmentInput } from '../../../src/ui/components/shared/FingerAssignmentInput';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';
import { getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getActivePerformance } from '../../../src/ui/state/projectState';

afterEach(cleanup);

describe('FingerAssignmentInput (T19)', () => {
  const suggestion = { hand: 'left' as const, finger: 'index' as const };

  it('opens empty on a suggestion, with the suggestion as the placeholder', () => {
    render(<FingerAssignmentInput value={suggestion} isSuggestion onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByTestId('finger-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('L2');
  });

  it('blur without typing changes nothing', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={suggestion} isSuggestion onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.blur(screen.getByTestId('finger-input'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('finger-input')).toBeNull();
  });

  it('Escape without typing changes nothing, also on a user preference', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={suggestion} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.blur(screen.getByTestId('finger-input'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('flags invalid input inline and sets nothing; blur then discards it', () => {
    const onChange = vi.fn();
    render(<FingerAssignmentInput value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByTestId('finger-input');
    fireEvent.change(input, { target: { value: 'X9' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('L1–L5 or R1–R5');
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a typed value is set, and emptying a preference clears it', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FingerAssignmentInput value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByTestId('finger-input'), { target: { value: 'r3' } });
    fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ hand: 'right', finger: 'middle' });
    rerender(<FingerAssignmentInput value={{ hand: 'right', finger: 'middle' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByTestId('finger-input'), { target: { value: '' } });
    fireEvent.keyDown(screen.getByTestId('finger-input'), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('Delete scoping (T28)', () => {
  it('Delete or Backspace with an event selected and no pad selected removes nothing', async () => {
    let state: ProjectState = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const analysis = await analyzeLayout({
      performance: getActivePerformance(state), layout,
      instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
    });
    state = { ...state, analysisResult: analysis, analysisStale: false };
    let api: ReturnType<typeof useProject> | null = null;
    function Probe() {
      api = useProject();
      useKeyboardShortcuts();
      return null;
    }
    render(<ProjectProvider initialState={state}><Probe /></ProjectProvider>);
    const firstPlayed = analysis.executionPlan.fingerAssignments.find(a => a.row !== undefined)!;
    act(() => api!.dispatch({ type: 'SELECT_EVENT', payload: firstPlayed.eventIndex! }));
    const padsBefore = JSON.stringify(getDisplayedLayout(api!.state)!.padToVoice);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(JSON.stringify(getDisplayedLayout(api!.state)!.padToVoice)).toBe(padsBefore);
    expect(api!.state.selectedEventIndex).toBe(firstPlayed.eventIndex);
  });
});

describe('Remove from pad says so, with Undo (T28)', () => {
  it('toasts "Removed … from Row r · Col c" and its Undo puts the Sound back', async () => {
    const { ToastProvider } = await import('../../../src/ui/components/shared/Toast');
    const { useRemovePadWithUndo } = await import('../../../src/ui/hooks/useRemovePadWithUndo');
    const state = await suggestedTestMidi1();
    const [padKey, voice] = Object.entries(getDisplayedLayout(state)!.padToVoice)[0]!;
    let api: ReturnType<typeof useProject> | null = null;
    let remove: ((k: string) => void) | null = null;
    function Probe() {
      api = useProject();
      remove = useRemovePadWithUndo();
      return null;
    }
    render(<ToastProvider><ProjectProvider initialState={state}><Probe /></ProjectProvider></ToastProvider>);
    act(() => remove!(padKey));
    expect(getDisplayedLayout(api!.state)!.padToVoice[padKey]).toBeUndefined();
    const [r, c] = padKey.split(',').map(Number);
    expect(screen.getByText(`Removed ${voice.name} from Row ${r! + 1} · Col ${c! + 1}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(getDisplayedLayout(api!.state)!.padToVoice[padKey]?.id).toBe(voice.id);
  });
});

describe('Arrow keys under an open overlay (Codex review)', () => {
  it('ArrowRight with a menu open changes neither the selection nor the playhead', async () => {
    const { Popover } = await import('../../../src/ui/components/shared/Overlay');
    let state: ProjectState = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const analysis = await analyzeLayout({
      performance: getActivePerformance(state), layout,
      instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
    });
    state = { ...state, analysisResult: analysis, analysisStale: false };
    let api: ReturnType<typeof useProject> | null = null;
    function Probe() {
      api = useProject();
      useKeyboardShortcuts();
      return <Popover x={0} y={0} onClose={() => {}} ariaLabel="menu"><button role="menuitem">item</button></Popover>;
    }
    render(<ProjectProvider initialState={state}><Probe /></ProjectProvider>);
    fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'ArrowRight' });
    expect(api!.state.selectedEventIndex).toBeNull();
    expect(api!.state.currentTime).toBe(0);
  });
});
