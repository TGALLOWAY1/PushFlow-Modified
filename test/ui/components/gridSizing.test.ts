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
  saveDrawerPrefs,
} from '../../../src/ui/components/workspace/drawerSizing';
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
