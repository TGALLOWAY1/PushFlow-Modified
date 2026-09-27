/**
 * The drag in progress (S5.1, T46).
 *
 * During a drag the browser tells drop targets only the drag's types, never
 * its data, so the grid couldn't say what a drop would do. A Sound dragged
 * from the Sounds panel (or the unplaced list) or a pad dragged from the grid
 * records here what it is and where it comes from, and the grid's hint and
 * ghost, and the Sounds panel's drop zone, read it. Any dragend (dropped,
 * cancelled, or let go outside the page) ends it.
 */

import { useSyncExternalStore } from 'react';

export type DragSession =
  /** A Sound from a list; `fromPad` is where it is now, or null when unplaced. */
  | { kind: 'sound'; soundId: string; fromPad: string | null }
  /** A pad from the grid, carrying its Sound. */
  | { kind: 'pad'; soundId: string; fromPad: string };

let current: DragSession | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onDragEnd() {
  endDrag();
}

export function startDrag(session: DragSession): void {
  current = session;
  if (typeof window !== 'undefined') window.addEventListener('dragend', onDragEnd, true);
  emit();
}

export function endDrag(): void {
  if (current === null) return;
  current = null;
  if (typeof window !== 'undefined') window.removeEventListener('dragend', onDragEnd, true);
  emit();
}

export function getDragSession(): DragSession | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The drag in progress, or null. */
export function useDragSession(): DragSession | null {
  return useSyncExternalStore(subscribe, getDragSession, getDragSession);
}
