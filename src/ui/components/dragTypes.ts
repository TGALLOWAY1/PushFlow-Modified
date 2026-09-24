/**
 * Custom drag data types shared by the grid and the Sounds panel.
 *
 * `dragover` can only read a drag's types, not its data, so anything a drop
 * target must know before the drop is carried as a type of its own.
 */

/** Present when the dragged Sound is locked to a pad; the grid refuses to drop it anywhere. */
export const LOCKED_SOUND_DRAG_TYPE = 'application/pushflow-locked';
