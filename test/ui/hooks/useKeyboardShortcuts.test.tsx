// @vitest-environment happy-dom
/**
 * Cmd/Ctrl+S saves now (S1a.4, T57 slice), even while typing in an input,
 * and the browser's own save dialog is suppressed.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider } from '../../../src/ui/state/ProjectContext';
import { createEmptyProjectState } from '../../../src/ui/state/projectState';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';

afterEach(cleanup);

function renderShortcuts(onSave: () => void) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={{ ...createEmptyProjectState(), id: 'keys' }}>{children}</ProjectProvider>
  );
  return renderHook(() => useKeyboardShortcuts({ onSave }), { wrapper });
}

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts · save', () => {
  it('Ctrl+S and Cmd+S save now and are not left to the browser', () => {
    const onSave = vi.fn();
    renderShortcuts(onSave);
    expect(press(document.body, { key: 's', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(press(document.body, { key: 's', metaKey: true }).defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(2);
    // A plain "s" is nothing.
    expect(press(document.body, { key: 's' }).defaultPrevented).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('works from inside an input, where the other shortcuts stay out of the way', () => {
    const onSave = vi.fn();
    renderShortcuts(onSave);
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(press(input, { key: 's', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(press(input, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false);
    input.remove();
  });
});
