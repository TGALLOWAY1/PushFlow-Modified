/**
 * Measured grid (T04).
 *
 * The pad grid is sized by measurement, never by CSS transform: a
 * ResizeObserver on the grid region picks an integer pad size between 32 and
 * 72 px that fits the 8x8 matrix, its axes, its hand-zone labels, the hardware
 * frame and the state-bar slot above it. Label sizes stay fixed; only the pads
 * grow or shrink. Desktop-only: no breakpoints, just the measured box.
 */

import { useCallback, useLayoutEffect, useState } from 'react';

export const PAD_MIN = 32;
export const PAD_MAX = 72;
/** Gap between pads, and between the last row and the column labels. */
export const PAD_GAP = 4;
/** Row-number column left of the pads (16 px labels + 4 px margin). */
export const AXIS_WIDTH = 20;
/** Column-number row under the pads. */
export const COLUMN_LABELS_HEIGHT = 16;
/** Hand-zone labels under the column numbers (4 px margin + 16 px row). */
export const ZONE_LABELS_HEIGHT = 20;
/** The hardware frame around the matrix: 12 px padding + 1 px border, per side. */
export const FRAME_INSET = 13;
/** The fixed, unscaled slot above the frame that P3's layout-state bar fills. */
export const STATE_BAR_HEIGHT = 36;
export const STATE_BAR_GAP = 6;
/** Below this pad size, secondary labels (note, position, empty-pad coordinates) hide. */
export const SECONDARY_LABEL_MIN_PAD = 40;

/** Width of the frame (matrix, axis and frame inset) for a pad size. */
export function gridFrameWidth(pad: number): number {
  return AXIS_WIDTH + 8 * pad + 7 * PAD_GAP + 2 * FRAME_INSET;
}

/** Height of everything in the grid region for a pad size: state-bar slot, frame, labels. */
export function gridRegionHeight(pad: number): number {
  return STATE_BAR_HEIGHT + STATE_BAR_GAP + 2 * FRAME_INSET
    + 8 * pad + 8 * PAD_GAP + COLUMN_LABELS_HEIGHT + ZONE_LABELS_HEIGHT;
}

/** The grid region's height at the smallest pad size: the drawer never takes more than this leaves. */
export const GRID_REGION_MIN_HEIGHT = gridRegionHeight(PAD_MIN);

/** The largest integer pad size, from 32 to 72 px, whose grid fits a region of this size. */
export function padSizeFor(width: number, height: number): number {
  const byWidth = (width - gridFrameWidth(0)) / 8;
  const byHeight = (height - gridRegionHeight(0)) / 8;
  const fit = Math.floor(Math.min(byWidth, byHeight));
  return Math.max(PAD_MIN, Math.min(PAD_MAX, fit));
}

/**
 * Measures an element and returns the pad size for its content box. Returns a
 * callback ref, so the observer attaches whenever the element mounts. The size
 * is an integer and only changes state when it changes, so the grid can never
 * feed back into its own measurement.
 */
export function useMeasuredPadSize(initial = 56): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [padSize, setPadSize] = useState(initial);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);
  // Layout effect: the first paint already has the measured size.
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const { clientWidth, clientHeight } = el;
      // A hidden or not-yet-laid-out region reports 0; keep the last size.
      if (clientWidth <= 0 || clientHeight <= 0) return;
      const next = padSizeFor(clientWidth, clientHeight);
      setPadSize(prev => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [ref, padSize];
}
