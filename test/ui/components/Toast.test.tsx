// @vitest-environment happy-dom
/**
 * Toast region primitive (S1a.1, T31 slice), and its first use: Undo and Redo
 * say what they did.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ToastProvider, useToast, type ToastOptions } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return <button onClick={() => toast.show(options)}>trigger</button>;
}

describe('ToastProvider', () => {
  it('renders an always-present polite live region', () => {
    render(<ToastProvider><div /></ToastProvider>);
    const region = screen.getByTestId('toast-region');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.children).toHaveLength(0);
  });

  it('shows a message with its action, runs it once and dismisses', () => {
    const onUndo = vi.fn();
    render(<ToastProvider><Trigger options={{ message: 'Draft discarded', action: { label: 'Undo', onClick: onUndo } }} /></ToastProvider>);
    fireEvent.click(screen.getByText('trigger'));
    expect(screen.getByTestId('toast').textContent).toContain('Draft discarded');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('dismisses itself after its duration, but not while hovered', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Trigger options={{ message: 'Saved', durationMs: 1000 }} /></ToastProvider>);
    fireEvent.click(screen.getByText('trigger'));
    const toast = screen.getByTestId('toast');
    fireEvent.mouseEnter(toast);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByTestId('toast')).not.toBeNull();
    fireEvent.mouseLeave(toast);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('has a labelled dismiss button and keeps at most three toasts', () => {
    render(<ToastProvider><Trigger options={{ message: 'Hello' }} /></ToastProvider>);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('trigger'));
    expect(screen.getAllByTestId('toast')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
    expect(screen.getAllByTestId('toast')).toHaveLength(2);
  });

  it('is a no-op outside a provider', () => {
    render(<Trigger options={{ message: 'nowhere' }} />);
    expect(() => fireEvent.click(screen.getByText('trigger'))).not.toThrow();
  });
});

describe('Undo and Redo report through the toast', () => {
  function UndoProbe() {
    const { state, dispatch, undo } = useProject();
    return (
      <>
        <button onClick={() => dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: state.soundStreams[0] } })}>place</button>
        <button onClick={undo}>undo</button>
        <span data-testid="pads">{Object.keys((state.workingLayout ?? state.activeLayout).padToVoice).join(' ')}</span>
      </>
    );
  }

  it('Undo names the step and offers Redo', async () => {
    const initial = await importTestMidi1();
    render(<ToastProvider><ProjectProvider initialState={initial}><UndoProbe /></ProjectProvider></ToastProvider>);
    fireEvent.click(screen.getByText('place'));
    expect(screen.getByTestId('pads').textContent).toBe('3,3');
    fireEvent.click(screen.getByText('undo'));
    expect(screen.getByTestId('pads').textContent).toBe('');
    expect(screen.getByTestId('toast').textContent).toContain('Undone: Place Sound');

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByTestId('pads').textContent).toBe('3,3');
    expect(screen.getByTestId('toast').textContent).toContain('Redone: Place Sound');
  });
});
