/**
 * Custom drag data types shared by the grid and the Sounds panel.
 *
 * `dragover` can only read a drag's types, not its data, so anything a drop
 * target must know before the drop is carried as a type of its own.
 */

import { startDrag } from './dragSession';

/** Present when the dragged Sound is locked to a pad; the grid refuses to drop it anywhere. */
export const LOCKED_SOUND_DRAG_TYPE = 'application/pushflow-locked';

/** A Sound dragged onto the grid (the grid places it on the pad it is dropped on). */
export const SOUND_DRAG_TYPE = 'application/pushflow-stream';

/** A pad dragged from the grid: onto another pad it swaps or moves; onto the Sounds panel it unplaces (S5.1). */
export const PAD_DRAG_TYPE = 'application/pushflow-pad';

/**
 * A Sounds row dragged by its handle, to reorder the Sounds or move one into a
 * group (S5.1, T46). Only this type reorders: a Sound or pad dragged over the
 * list never does.
 */
export const SOUND_REORDER_DRAG_TYPE = 'application/pushflow-sound-order';

/**
 * Starts dragging a Sound onto the grid: the Sounds panel's rows and the
 * Analysis panels' list of unplaced Sounds (S3.3) carry the same data, so the
 * grid places them the same way. It also records the drag (dragSession.ts),
 * so the grid can say what a drop would do while it is under way (T46).
 */
export function setSoundDragData(
  dataTransfer: DataTransfer,
  sound: { id: string; name: string; color: string; originalMidiNote: number | null },
  lockedPad?: string | null,
  /** The pad it is on now, if any. */
  fromPad?: string | null,
): void {
  startDrag({ kind: 'sound', soundId: sound.id, fromPad: fromPad ?? null });
  dataTransfer.setData(SOUND_DRAG_TYPE, JSON.stringify({
    id: sound.id,
    name: sound.name,
    color: sound.color,
    originalMidiNote: sound.originalMidiNote,
    source: 'palette',
  }));
  // A locked Sound stays on its pad: the grid refuses to drop it elsewhere.
  if (lockedPad) dataTransfer.setData(LOCKED_SOUND_DRAG_TYPE, lockedPad);
  dataTransfer.effectAllowed = 'copyMove';
}
