/**
 * The open Performance Route's view, for the e2e hook (window.__pf), which
 * lives outside the page. PerformanceRoutePage registers it while mounted;
 * nothing else reads this.
 */

export interface RouteView {
  /** The zoom level: 0 song, 1 section, 2 phrase, 3 action, 4 pad (S9.3). */
  level: number;
  /** The first bar on screen and how many bars are (0-based, as the route counts). */
  viewStart: number;
  viewSpan: number;
  /** Edit mode (S9.4). */
  editing: boolean;
}

let current: RouteView | null = null;

export function setLiveRouteView(view: RouteView | null): void {
  current = view;
}

export function liveRouteView(): RouteView | null {
  return current;
}
