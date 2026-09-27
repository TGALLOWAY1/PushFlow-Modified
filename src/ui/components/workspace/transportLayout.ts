/**
 * Fixed geometry of the transport bar (S4.3a; T05, T58), the workspace's
 * persistent transport above the drawer's Timeline | Composer tabs.
 *
 * Its controls have fixed widths and are always shown, so the centre column
 * is never narrower than the bar (panelSizing.ts); in a window narrower than
 * even the side panels' minimums, the bar scrolls rather than clips.
 */

/** The bar's height: the old timeline toolbar's, so the drawer is no taller. */
export const TRANSPORT_BAR_HEIGHT = 44;
/** Gap between controls, and the bar's own horizontal padding. */
export const TRANSPORT_GAP = 8;
export const TRANSPORT_PADDING = 24;

/**
 * Fixed widths of the transport's controls, left to right. Loop and Metronome
 * are split buttons: the toggle and its menu (the loop presets; the count-in,
 * S4.3b).
 */
export const TRANSPORT_WIDTHS = {
  play: 64,
  return: 30,
  position: 56,
  speed: 160,
  loop: 88,
  metronome: 128,
  hits: 60,
} as const;

/** The loop split button's menu half. */
export const LOOP_MENU_WIDTH = 24;
/** The metronome split button's menu half: room for the count-in's bars beside its chevron. */
export const METRONOME_MENU_WIDTH = 32;

/** Width of the transport's controls, gaps included. */
export const TRANSPORT_CLUSTER_WIDTH = Object.values(TRANSPORT_WIDTHS).reduce((a, b) => a + b, 0)
  + (Object.keys(TRANSPORT_WIDTHS).length - 1) * TRANSPORT_GAP;

/** The narrowest transport bar that shows every control. */
export const TRANSPORT_BAR_MIN_WIDTH = TRANSPORT_PADDING + TRANSPORT_CLUSTER_WIDTH;
