// @vitest-environment happy-dom
/**
 * S2.1 · the measured grid, the drawer's height and the toolbar's fitting are
 * pure functions of measured sizes (T04, T05).
 */

import { describe, expect, it } from 'vitest';
import {
  GRID_REGION_MIN_HEIGHT,
  PAD_MAX,
  PAD_MIN,
  gridFrameWidth,
  gridRegionHeight,
  padSizeFor,
} from '../../../src/ui/components/workspace/gridSizing';
import {
  DRAWER_CAP_RATIO,
  DRAWER_MIN_HEIGHT,
  DRAWER_TAB_BAR_HEIGHT,
  DEFAULT_DRAWER_PREFS,
  SPLITTER_HEIGHT,
  drawerHeightFor,
  loadDrawerPrefs,
  maxDrawerHeight,
  minDrawerHeight,
  saveDrawerPrefs,
} from '../../../src/ui/components/workspace/drawerSizing';
import { CENTER_MIN_WIDTH, fitSidePanels, maxPanelWidth } from '../../../src/ui/components/workspace/panelSizing';
import {
  TOOLBAR_GAP,
  TOOLBAR_MORE_WIDTH,
  TOOLBAR_PADDING,
  TRANSPORT_CLUSTER_WIDTH,
  TRANSPORT_WIDTHS,
  fitSecondaryControls,
  timelineContentHeight,
  type SecondaryControl,
} from '../../../src/ui/components/timelineLayout';

describe('padSizeFor', () => {
  it('returns the largest integer pad whose grid fits both dimensions', () => {
    for (const [w, h] of [[670, 412], [900, 548], [700, 700], [1200, 900], [500, 460]]) {
      const pad = padSizeFor(w, h);
      expect(Number.isInteger(pad)).toBe(true);
      if (pad > PAD_MIN && pad < PAD_MAX) {
        expect(gridFrameWidth(pad)).toBeLessThanOrEqual(w);
        expect(gridRegionHeight(pad)).toBeLessThanOrEqual(h);
        // One pixel more would not fit one of them.
        expect(gridFrameWidth(pad + 1) > w || gridRegionHeight(pad + 1) > h).toBe(true);
      }
    }
  });

  it('clamps to 32–72 px', () => {
    expect(padSizeFor(200, 200)).toBe(PAD_MIN);
    expect(padSizeFor(4000, 4000)).toBe(PAD_MAX);
  });

  it('at the 1366x768 default layout the pads are at least 32 px', () => {
    // Centre column ~670 px wide and ~700 px tall; the drawer takes at most 40%.
    const center = 700;
    const drawer = drawerHeightFor(center, timelineContentHeight(7), DEFAULT_DRAWER_PREFS);
    const region = center - SPLITTER_HEIGHT - drawer;
    expect(region).toBeGreaterThanOrEqual(GRID_REGION_MIN_HEIGHT);
    expect(padSizeFor(666, region)).toBeGreaterThanOrEqual(32);
  });
});

describe('drawerHeightFor', () => {
  it('fits the timeline content when it is small', () => {
    const content = timelineContentHeight(2);
    expect(drawerHeightFor(1000, content, DEFAULT_DRAWER_PREFS)).toBe(DRAWER_TAB_BAR_HEIGHT + content);
  });

  it('is capped at about 40% of the centre column', () => {
    expect(drawerHeightFor(900, timelineContentHeight(20), DEFAULT_DRAWER_PREFS)).toBe(Math.round(900 * DRAWER_CAP_RATIO));
  });

  it("uses the viewer's height, but never takes the grid's minimum room", () => {
    expect(drawerHeightFor(900, 100, { height: 300, collapsed: false })).toBe(300);
    expect(drawerHeightFor(900, 100, { height: 2000, collapsed: false })).toBe(maxDrawerHeight(900));
    expect(900 - SPLITTER_HEIGHT - maxDrawerHeight(900)).toBe(GRID_REGION_MIN_HEIGHT);
    expect(drawerHeightFor(900, 100, { height: 10, collapsed: false })).toBe(DRAWER_MIN_HEIGHT);
  });

  it('in a short centre column, gives up its open minimum so the grid keeps its own (review on #107)', () => {
    // 500 px leaves 98 px under the grid's minimum: less than an open drawer's 120.
    const center = 500;
    const drawer = drawerHeightFor(center, timelineContentHeight(7), DEFAULT_DRAWER_PREFS);
    expect(drawer).toBeLessThan(DRAWER_MIN_HEIGHT);
    expect(center - SPLITTER_HEIGHT - drawer).toBe(GRID_REGION_MIN_HEIGHT);
    // A remembered height can't take the room either, and the splitter's range follows.
    expect(drawerHeightFor(center, 100, { height: 300, collapsed: false })).toBe(drawer);
    expect(minDrawerHeight(center)).toBe(drawer);
    expect(minDrawerHeight(900)).toBe(DRAWER_MIN_HEIGHT);
    // Shorter still, the drawer is down to its tab bar.
    expect(drawerHeightFor(400, 100, DEFAULT_DRAWER_PREFS)).toBe(DRAWER_TAB_BAR_HEIGHT);
  });

  it('collapsed, it is just the tab bar', () => {
    expect(drawerHeightFor(900, 400, { height: 300, collapsed: true })).toBe(DRAWER_TAB_BAR_HEIGHT);
  });

  it('remembers prefs, and survives blocked or odd storage', () => {
    localStorage.clear();
    expect(loadDrawerPrefs()).toEqual(DEFAULT_DRAWER_PREFS);
    saveDrawerPrefs({ height: 250, collapsed: true });
    expect(loadDrawerPrefs()).toEqual({ height: 250, collapsed: true });
    localStorage.setItem('pushflow:drawer', '{"height":"tall","collapsed":1}');
    expect(loadDrawerPrefs()).toEqual(DEFAULT_DRAWER_PREFS);
    localStorage.setItem('pushflow:drawer', 'not json');
    expect(loadDrawerPrefs()).toEqual(DEFAULT_DRAWER_PREFS);
  });
});

describe('fitSecondaryControls', () => {
  const all = new Set<SecondaryControl>(['import', 'count', 'zoom', 'clearLoop']);

  it('the transport cluster width is the sum of its controls and gaps', () => {
    const widths = Object.values(TRANSPORT_WIDTHS);
    expect(TRANSPORT_CLUSTER_WIDTH).toBe(widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * TOOLBAR_GAP);
  });

  it('shows everything inline, with no menu, when it all fits', () => {
    expect(fitSecondaryControls(2000, all)).toEqual({ inline: ['import', 'count', 'zoom', 'clearLoop'], overflow: [] });
  });

  it('keeps priority order and moves the rest into the menu', () => {
    const r = fitSecondaryControls(TOOLBAR_PADDING + TRANSPORT_CLUSTER_WIDTH + TOOLBAR_GAP + TOOLBAR_MORE_WIDTH + 2 * (TOOLBAR_GAP + 72), all);
    expect(r).toEqual({ inline: ['import', 'count'], overflow: ['zoom', 'clearLoop'] });
  });

  it('puts everything in the menu when only the transport fits (1366x768)', () => {
    expect(fitSecondaryControls(664, all)).toEqual({ inline: [], overflow: ['import', 'count', 'zoom', 'clearLoop'] });
  });

  it('leaves out controls with nothing to show', () => {
    expect(fitSecondaryControls(2000, new Set(['import', 'count', 'zoom']))).toEqual({ inline: ['import', 'count', 'zoom'], overflow: [] });
  });
});

describe('fitSidePanels (review on #107)', () => {
  const MIN = { left: 200, right: 280 };

  it('keeps the viewer\'s widths when the centre has room', () => {
    expect(fitSidePanels(1000, { left: 320, right: 340 }, MIN)).toEqual({ left: 320, right: 340 });
  });

  it('gives back only what the centre needs, from each panel in proportion to its spare width', () => {
    // 1280 px wide: the body keeps 1260, the handles 16, the centre CENTER_MIN_WIDTH.
    const room = 1260 - 16 - CENTER_MIN_WIDTH;
    const fitted = fitSidePanels(room, { left: 320, right: 340 }, MIN);
    expect(fitted.left + fitted.right).toBe(room);
    expect(320 - fitted.left).toBeGreaterThan(340 - fitted.right); // 120 spare vs 60
  });

  it('never goes below a panel\'s minimum, even when the window is too narrow', () => {
    expect(fitSidePanels(100, { left: 320, right: 340 }, MIN)).toEqual(MIN);
  });

  it('leaves a collapsed panel alone', () => {
    expect(fitSidePanels(300, { left: 0, right: 500 }, { left: 0, right: 280 })).toEqual({ left: 0, right: 300 });
  });

  it('stops a drag where the centre would get too narrow', () => {
    expect(maxPanelWidth(700, 340, 200, 500)).toBe(360);
    expect(maxPanelWidth(2000, 340, 200, 500)).toBe(500);
    expect(maxPanelWidth(300, 340, 200, 500)).toBe(200);
  });
});
