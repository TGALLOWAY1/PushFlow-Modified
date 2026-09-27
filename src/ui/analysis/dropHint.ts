/**
 * What a drop on a pad would do, said while dragging (S5.1, T46): one line
 * beside the pad, and the incoming Sound's ghost on it.
 *
 * - A pad onto another: "Swap with Snare"; onto an empty pad: "Move from
 *   Row 4 · Col 4".
 * - A Sound from a list onto a taken pad: "Replace: Snare goes back to To
 *   place" (the drop evicts it, and says so with Undo); onto an empty pad:
 *   "Move from Row 4 · Col 4" if it is placed, else "Place Kick here".
 * - A drop that would be refused says why: a read-only layout (S3.2), or a
 *   lock on either side (canon section 11). The reducers refuse the same.
 */

import { type Layout } from '../../types/layout';
import { formatPadPosition } from '../../utils/padPosition';
import type { DragSession } from '../components/dragSession';

export type DropKind = 'place' | 'move' | 'swap' | 'replace' | 'same' | 'refused';

export interface DropHint {
  kind: DropKind;
  text: string;
  /** The Sound a drop would send back to To place. */
  evicts?: string;
}

export function dropHint(
  session: DragSession,
  target: string,
  layout: Pick<Layout, 'padToVoice' | 'placementLocks'>,
  nameOf: (soundId: string) => string,
  readOnlyHint: string | null = null,
): DropHint {
  if (readOnlyHint) return { kind: 'refused', text: readOnlyHint };
  const dragged = session.soundId;
  const occupant = layout.padToVoice[target];
  if (occupant?.id === dragged) return { kind: 'same', text: 'Already here' };
  if (occupant && layout.placementLocks?.[occupant.id] === target) {
    return { kind: 'refused', text: `${nameOf(occupant.id)} is locked here · Unlock it first` };
  }

  if (session.kind === 'pad') {
    if (occupant) return { kind: 'swap', text: `Swap with ${nameOf(occupant.id)}` };
    return { kind: 'move', text: `Move from ${formatPadPosition(session.fromPad)}` };
  }

  const lockedTo = layout.placementLocks?.[dragged];
  if (lockedTo && lockedTo !== target) {
    return { kind: 'refused', text: `${nameOf(dragged)} is locked to ${formatPadPosition(lockedTo)} · Unlock it to move it` };
  }
  if (occupant) return { kind: 'replace', text: `Replace: ${nameOf(occupant.id)} goes back to To place`, evicts: occupant.id };
  if (session.fromPad) return { kind: 'move', text: `Move from ${formatPadPosition(session.fromPad)}` };
  return { kind: 'place', text: `Place ${nameOf(dragged)} here` };
}
