// @vitest-environment happy-dom
/**
 * Truthful save (S1a.4, T57 slice; roadmap P1a-10).
 *
 * "Saved" is reported only after a write has committed, and only for the
 * state that was written. A failed write shows the error state and never
 * "Saved"; an edit made during a write stays unsaved until the next write; an
 * explicit save waits for a write in flight; and beforeunload warns while a
 * save is pending.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';

const saveProjectAsync = vi.fn<(state: ProjectState) => Promise<void>>();
vi.mock('../../../src/ui/persistence/projectStorage', () => ({
  saveProjectAsync: (state: ProjectState) => saveProjectAsync(state),
}));

import { useAutoSave, type SaveStatus } from '../../../src/ui/hooks/useAutoSave';

function deferred() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const stateAt = (updatedAt: string): ProjectState => ({ ...createEmptyProjectState(), id: 'proj-save', updatedAt });

/** Renders the hook and records every status it reports, in order. */
function renderSave(initial: ProjectState) {
  const seen: SaveStatus[] = [];
  const hook = renderHook((state: ProjectState) => {
    const result = useAutoSave(state);
    if (seen[seen.length - 1] !== result.saveStatus) seen.push(result.saveStatus);
    return result;
  }, { initialProps: initial });
  return { ...hook, seen };
}

beforeEach(() => {
  vi.useFakeTimers();
  saveProjectAsync.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flushMicrotasks = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useAutoSave', () => {
  it('P1a-10: a failed write shows the error state and never "Saved"', async () => {
    saveProjectAsync.mockRejectedValue(new Error('QuotaExceededError'));
    const { result, rerender, seen } = renderSave(stateAt('t0'));
    expect(result.current.saveStatus).toBe('saved');

    rerender(stateAt('t1'));
    expect(result.current.saveStatus).toBe('unsaved');
    await act(async () => { vi.advanceTimersByTime(2000); });
    await flushMicrotasks();
    expect(saveProjectAsync).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('error');

    // An explicit save (the chip's Retry) fails again: still the error, still never "Saved".
    await act(async () => { await result.current.saveNow(); });
    expect(saveProjectAsync).toHaveBeenCalledTimes(2);
    expect(result.current.saveStatus).toBe('error');
    // Another edit on top of a failure stays an error, not a hopeful "unsaved".
    rerender(stateAt('t2'));
    expect(result.current.saveStatus).toBe('error');
    expect(seen.slice(1)).not.toContain('saved');

    // Retry once the store is back: now, and only now, "Saved".
    saveProjectAsync.mockResolvedValue(undefined);
    await act(async () => { await result.current.saveNow(); });
    expect(saveProjectAsync).toHaveBeenLastCalledWith(expect.objectContaining({ updatedAt: 't2' }));
    expect(result.current.saveStatus).toBe('saved');
  });

  it('reports "saved" only once the write has committed', async () => {
    const write = deferred();
    saveProjectAsync.mockReturnValue(write.promise);
    const { result, rerender } = renderSave(stateAt('t0'));

    rerender(stateAt('t1'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.saveStatus).toBe('saving');
    // Explicit saves while a write is in flight do not turn the label green either.
    let explicit: Promise<void> | undefined;
    act(() => { explicit = result.current.saveNow(); });
    expect(result.current.saveStatus).toBe('saving');

    await act(async () => { write.resolve(); await explicit; });
    expect(result.current.saveStatus).toBe('saved');
    expect(saveProjectAsync).toHaveBeenCalledTimes(1);
  });

  it('an edit made during a write stays unsaved, and the next write saves it', async () => {
    const first = deferred();
    saveProjectAsync.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const { result, rerender } = renderSave(stateAt('t0'));

    rerender(stateAt('t1'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.saveStatus).toBe('saving');

    rerender(stateAt('t2'));
    await act(async () => { first.resolve(); });
    await flushMicrotasks();
    // t1 landed, but t2 has not been written.
    expect(result.current.saveStatus).toBe('unsaved');

    await act(async () => { vi.advanceTimersByTime(2000); });
    await flushMicrotasks();
    expect(saveProjectAsync).toHaveBeenCalledTimes(2);
    expect(saveProjectAsync).toHaveBeenLastCalledWith(expect.objectContaining({ updatedAt: 't2' }));
    expect(result.current.saveStatus).toBe('saved');
  });

  it('an explicit save waits for the write in flight, then writes the newer state', async () => {
    const first = deferred();
    saveProjectAsync.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const { result, rerender } = renderSave(stateAt('t0'));

    rerender(stateAt('t1'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    rerender(stateAt('t2'));
    let explicit: Promise<void> | undefined;
    act(() => { explicit = result.current.saveNow(); });
    expect(saveProjectAsync).toHaveBeenCalledTimes(1);

    await act(async () => { first.resolve(); await explicit; });
    expect(saveProjectAsync).toHaveBeenCalledTimes(2);
    expect(saveProjectAsync.mock.calls.map(([s]) => s.updatedAt)).toEqual(['t1', 't2']);
    expect(result.current.saveStatus).toBe('saved');
  });

  it('does nothing when there is nothing to save', async () => {
    saveProjectAsync.mockResolvedValue(undefined);
    const { result } = renderSave(stateAt('t0'));
    await act(async () => { await result.current.saveNow(); });
    expect(saveProjectAsync).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('saved');
  });

  it('warns on beforeunload while a save is pending or has failed, not once saved', async () => {
    saveProjectAsync.mockResolvedValue(undefined);
    const { result, rerender } = renderSave(stateAt('t0'));
    const fire = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);

    rerender(stateAt('t1'));
    expect(fire()).toBe(true);

    await act(async () => { await result.current.saveNow(); });
    expect(result.current.saveStatus).toBe('saved');
    expect(fire()).toBe(false);

    saveProjectAsync.mockRejectedValueOnce(new Error('down'));
    rerender(stateAt('t2'));
    await act(async () => { await result.current.saveNow(); });
    expect(result.current.saveStatus).toBe('error');
    expect(fire()).toBe(true);
  });

  // S2.3: "← Library" saves and then unmounts the editor; the state already
  // being written is not written (and re-stamped) a second time.
  it('leaving while that very state is being saved writes it once', async () => {
    const write = deferred();
    saveProjectAsync.mockReturnValue(write.promise);
    const { result, rerender, unmount } = renderSave(stateAt('t0'));
    rerender(stateAt('t1'));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveNow(); });
    await flushMicrotasks();
    expect(saveProjectAsync).toHaveBeenCalledTimes(1);
    unmount();
    expect(saveProjectAsync).toHaveBeenCalledTimes(1);
    write.resolve();
    await act(async () => { await saving; });
  });

  it('leaving with an edit newer than the write in flight still saves it', async () => {
    const write = deferred();
    saveProjectAsync.mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const { result, rerender, unmount } = renderSave(stateAt('t0'));
    rerender(stateAt('t1'));
    act(() => { void result.current.saveNow(); });
    await flushMicrotasks();
    rerender(stateAt('t2'));
    unmount();
    expect(saveProjectAsync).toHaveBeenCalledTimes(2);
    expect(saveProjectAsync).toHaveBeenLastCalledWith(expect.objectContaining({ updatedAt: 't2' }));
    write.resolve();
  });

  it('flushes a pending save on pagehide', async () => {
    saveProjectAsync.mockResolvedValue(undefined);
    const { rerender } = renderSave(stateAt('t0'));
    rerender(stateAt('t1'));
    window.dispatchEvent(new Event('pagehide'));
    expect(saveProjectAsync).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 't1' }));
  });
});
