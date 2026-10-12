/**
 * The Performance Route's fixed sizes, in px (S9.2). Desktop-only: no
 * breakpoints; the bar axis takes whatever width is left, so the whole song
 * fits at the Song level without a horizontal scroll.
 */

export const ROUTE_HEADER_HEIGHT = 56;
export const ROUTE_TRANSPORT_HEIGHT = 48;
/** The zoom rail on the left. */
export const ROUTE_RAIL_WIDTH = 120;
/** The column left of the bar axis: row labels above, lane names below. */
export const ROUTE_GUTTER_WIDTH = 176;
export const ROUTE_LINE_HEIGHT = 24;
export const ROUTE_CARD_HEIGHT = 92;
export const ROUTE_STRIP_HEIGHT = 20;
export const ROUTE_RULER_HEIGHT = 24;
export const ROUTE_LANE_HEIGHT = 36;

/** A Push mode's colour, from its token. */
export const modeColour = (mode: string) => `var(--mode-${mode})`;

/** "4:05" for seconds. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
