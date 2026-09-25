/**
 * The bottom drawer (Timeline | Composer tabs) under the grid (T04).
 *
 * By default it is as tall as the timeline's content, capped at about 40% of
 * the centre column, so the grid gets the rest. A splitter lets the viewer set
 * their own height or collapse the drawer to its tab bar (the Composer tab stays
 * reachable, invariant 3); both are remembered per viewer in localStorage.
 * Whatever the height, the grid region keeps room for 32 px pads.
 */

import { GRID_REGION_MIN_HEIGHT } from './gridSizing';

/** The drawer's tab bar (Timeline, Composer and the collapse control). */
export const DRAWER_TAB_BAR_HEIGHT = 36;
/** The smallest open drawer: the tab bar plus a few lanes. */
export const DRAWER_MIN_HEIGHT = 120;
/** "Capped at about 40% of the body." */
export const DRAWER_CAP_RATIO = 0.4;
/** The draggable bar between the grid and the drawer. */
export const SPLITTER_HEIGHT = 10;

export interface DrawerPrefs {
  /** A height the viewer dragged to, or null to fit the timeline's content. */
  height: number | null;
  collapsed: boolean;
}

export const DEFAULT_DRAWER_PREFS: DrawerPrefs = { height: null, collapsed: false };

/**
 * The largest drawer that still leaves the grid room for its smallest pads.
 * In a short centre column that is less than an open drawer's minimum, down
 * to the tab bar alone: the grid's minimum wins.
 */
export function maxDrawerHeight(centerHeight: number): number {
  return Math.max(DRAWER_TAB_BAR_HEIGHT, centerHeight - SPLITTER_HEIGHT - GRID_REGION_MIN_HEIGHT);
}

/** The smallest the viewer can drag the drawer to: its open minimum, or less when the grid needs the room. */
export function minDrawerHeight(centerHeight: number): number {
  return Math.min(DRAWER_MIN_HEIGHT, maxDrawerHeight(centerHeight));
}

/**
 * The drawer's height in px: the tab bar alone when collapsed; otherwise the
 * viewer's height, or the content's (at most 40% of the centre column), kept
 * between DRAWER_MIN_HEIGHT and what leaves the grid its minimum. When both
 * can't hold, the grid's minimum wins. Content with no natural height (the
 * Composer, POSITIVE_INFINITY) gets the 40%.
 */
export function drawerHeightFor(centerHeight: number, contentHeight: number, prefs: DrawerPrefs): number {
  if (prefs.collapsed) return DRAWER_TAB_BAR_HEIGHT;
  const fit = DRAWER_TAB_BAR_HEIGHT + contentHeight;
  const wanted = prefs.height ?? Math.min(fit, Math.round(centerHeight * DRAWER_CAP_RATIO));
  return Math.round(Math.min(maxDrawerHeight(centerHeight), Math.max(DRAWER_MIN_HEIGHT, wanted)));
}

const STORAGE_KEY = 'pushflow:drawer';

/** The remembered drawer size; defaults when storage is empty, blocked or holds something odd. */
export function loadDrawerPrefs(): DrawerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DRAWER_PREFS;
    const parsed = JSON.parse(raw) as Partial<DrawerPrefs>;
    return {
      height: typeof parsed.height === 'number' && Number.isFinite(parsed.height) ? parsed.height : null,
      collapsed: parsed.collapsed === true,
    };
  } catch {
    return DEFAULT_DRAWER_PREFS;
  }
}

export function saveDrawerPrefs(prefs: DrawerPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: the drawer still works, it just isn't remembered.
  }
}
