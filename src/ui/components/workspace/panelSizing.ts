/**
 * Side panel widths (Sounds | Events on the left, Costs | Layouts on the right)
 * that leave the centre column room for the timeline's transport.
 *
 * The transport cluster and its "⋯" button are always shown (T05), so the
 * centre must be at least as wide as they are. The widths the viewer dragged
 * to are kept; each panel gives back only what the centre needs, in
 * proportion to what it has above its own minimum, and never goes below that
 * minimum. A window too narrow even then scrolls the timeline's toolbar
 * instead of clipping it.
 */

import { TIMELINE_TOOLBAR_MIN_WIDTH } from '../timelineLayout';

/** The centre column's narrowest: the timeline toolbar plus the drawer's frame and the column's padding. */
export const CENTER_MIN_WIDTH = TIMELINE_TOOLBAR_MIN_WIDTH + 8;

export interface PanelWidths {
  left: number;
  right: number;
}

/**
 * The panels' widths when together they may take `room` px. `wanted` are the
 * viewer's widths and `min` the smallest each may be (a collapsed panel passes
 * 0 for both). When the room is too small even for the minimums, both panels
 * stop at their minimums. Callers skip this until the body has been measured.
 */
export function fitSidePanels(room: number, wanted: PanelWidths, min: PanelWidths): PanelWidths {
  const over = wanted.left + wanted.right - room;
  if (over <= 0) return wanted;
  const spareLeft = Math.max(0, wanted.left - min.left);
  const spareRight = Math.max(0, wanted.right - min.right);
  const spare = spareLeft + spareRight;
  if (spare === 0) return wanted;
  const take = Math.min(over, spare);
  const fromLeft = Math.round((take * spareLeft) / spare);
  return { left: wanted.left - fromLeft, right: wanted.right - (take - fromLeft) };
}

/** How wide a panel may be dragged, given the other panel's width. */
export function maxPanelWidth(room: number, otherWidth: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, room - otherWidth));
}
