/**
 * Measured grid (T04).
 *
 * The pad grid is sized by measurement, never by CSS transform: a
 * ResizeObserver on the grid region picks an integer pad size between 32 and
 * 72 px that fits the 8x8 matrix, its axes, its hand-zone labels, the hardware
 * frame, the state-bar slot above it and the moment dock (S4.2). Label sizes
 * stay fixed; only the pads grow or shrink. Desktop-only: no breakpoints, just
 * the measured box.
 *
 * The dock (the moment and pad inspectors, and the moment view's control)
 * sits beside the frame whenever the region is wide enough for it next to
 * 32 px pads, which it is in every window about 1140 px wide or more: there it
 * uses width the height-bound pads leave empty, so it costs neither pad size
 * nor timeline lanes. In a narrower region it sits under the frame, and the
 * region's minimum height (and so the drawer's maximum) makes room for it.
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
/**
 * The fixed, unscaled slot above the frame that the layout-state bar fills
 * (S3.2: a role chip, a two-line name and status, and the role's actions; the
 * two lines take 30 px). Kept at 36: 40 would shrink the pads at 1366x768 from
 * 34 to 33 px, where an occupied pad's × would cover its centre.
 */
export const STATE_BAR_HEIGHT = 36;
export const STATE_BAR_GAP = 6;
/** Below this pad size, secondary labels (note, position, empty-pad coordinates) hide. */
export const SECONDARY_LABEL_MIN_PAD = 40;
/**
 * The moment dock beside the frame (S4.2): at least DOCK_WIDTH, growing into
 * the width the height-bound pads leave, up to DOCK_MAX_WIDTH; and the gap
 * between them. Pads are sized for the minimum, so the dock never costs one.
 */
export const DOCK_WIDTH = 248;
export const DOCK_MAX_WIDTH = 360;
export const DOCK_GAP = 12;
/** The dock under the frame instead, in a region too narrow for it beside. */
export const DOCK_BELOW_HEIGHT = 136;

export type DockPlacement = 'side' | 'below';

/** Width of the frame (matrix, axis and frame inset) for a pad size. */
export function gridFrameWidth(pad: number): number {
  return AXIS_WIDTH + 8 * pad + 7 * PAD_GAP + 2 * FRAME_INSET;
}

/** Height of the frame (matrix, column numbers, hand-zone labels and inset) for a pad size. */
export function gridFrameHeight(pad: number): number {
  return 2 * FRAME_INSET + 8 * pad + 8 * PAD_GAP + COLUMN_LABELS_HEIGHT + ZONE_LABELS_HEIGHT;
}

/** Beside the frame when the region fits it next to 32 px pads; under the frame otherwise. */
export function dockPlacementFor(width: number): DockPlacement {
  return width >= gridFrameWidth(PAD_MIN) + DOCK_GAP + DOCK_WIDTH ? 'side' : 'below';
}

/** Width of the frame and, beside it, the dock. */
export function gridRegionWidth(pad: number, placement: DockPlacement): number {
  return gridFrameWidth(pad) + (placement === 'side' ? DOCK_GAP + DOCK_WIDTH : 0);
}

/** Height of everything in the grid region for a pad size: state-bar slot, frame, labels, and a dock under the frame. */
export function gridRegionHeight(pad: number, placement: DockPlacement = 'side'): number {
  return STATE_BAR_HEIGHT + STATE_BAR_GAP + gridFrameHeight(pad)
    + (placement === 'below' ? DOCK_GAP + DOCK_BELOW_HEIGHT : 0);
}

/** The grid region's height at the smallest pad size: the drawer never takes more than this leaves. */
export function gridRegionMinHeight(placement: DockPlacement = 'side'): number {
  return gridRegionHeight(PAD_MIN, placement);
}

export const GRID_REGION_MIN_HEIGHT = gridRegionMinHeight('side');

/** The largest integer pad size, from 32 to 72 px, whose grid (and dock) fits a region of this size. */
export function padSizeFor(width: number, height: number, placement: DockPlacement = dockPlacementFor(width)): number {
  const byWidth = (width - gridRegionWidth(0, placement)) / 8;
  const byHeight = (height - gridRegionHeight(0, placement)) / 8;
  const fit = Math.floor(Math.min(byWidth, byHeight));
  return Math.max(PAD_MIN, Math.min(PAD_MAX, fit));
}

/**
 * Measures an element and returns the pad size for its content box, and where
 * the dock goes (by the region's width alone, so the drawer's height, which
 * follows it, can't feed back into it). Returns a callback ref, so the
 * observer attaches whenever the element mounts. The size is an integer and
 * only changes state when it changes, so the grid can never feed back into its
 * own measurement.
 */
export function useMeasuredPadSize(initial = 56): [(el: HTMLElement | null) => void, number, DockPlacement] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<{ pad: number; dock: DockPlacement }>({ pad: initial, dock: 'side' });
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);
  // Layout effect: the first paint already has the measured size.
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const { clientWidth, clientHeight } = el;
      // A hidden or not-yet-laid-out region reports 0; keep the last size.
      if (clientWidth <= 0 || clientHeight <= 0) return;
      const dock = dockPlacementFor(clientWidth);
      const pad = padSizeFor(clientWidth, clientHeight, dock);
      setLayout(prev => (prev.pad === pad && prev.dock === dock ? prev : { pad, dock }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [ref, layout.pad, layout.dock];
}
