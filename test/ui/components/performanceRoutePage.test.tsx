// @vitest-environment happy-dom
/**
 * S9.2 · the Performance Route page, read-only (P9-2c; the Route's keys).
 *
 * Runs the real page under the real ProjectProvider. happy-dom has no layout,
 * so the lanes' area is given a width here; geometry, playback and axe are
 * checked in Playwright (test/e2e/route-song.spec.ts).
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { PerformanceRoutePage } from '../../../src/ui/pages/PerformanceRoutePage';
import { EDIT_ROUTE_REASON } from '../../../src/ui/route/RouteHeader';
import { WHAT_YOU_DO_PLACEHOLDER } from '../../../src/ui/route/RouteBand';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';
import { routeProject } from '../../helpers/routeProject';

let api: ReturnType<typeof useProject>;
function Probe() {
  api = useProject();
  return null;
}

function mount(state: ProjectState) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ProjectProvider initialState={state}>
          <Probe />
          <PerformanceRoutePage />
        </ProjectProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key, ...init });

// The lanes' area is 1200 px wide, so the bar axis is 1024 px after the 176 px gutter.
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
});
afterEach(() => {
  cleanup();
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
});

describe('the Route page', () => {
  it('heads itself with the project, its tempo, bars and length, and the Active Layout', async () => {
    mount(await importTestMidi1());
    expect(screen.getByTestId('route-facts').textContent).toBe('120 BPM · 4/4 · 8 bars · 0:16');
    expect(within(screen.getByTestId('route-layout')).getByTestId('role-chip').getAttribute('data-role')).toBe('active');
    // Editing waits on edit mode, and says so next to the button.
    const edit = screen.getByTestId('route-edit');
    expect((edit as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(edit.getAttribute('aria-describedby')!)!.textContent).toBe(EDIT_ROUTE_REASON);
  });

  it('P9-2c: with no route, the detected sections show with the placeholder and NAME SECTIONS', () => {
    // Silence from bar 4 to bar 8: two detected sections.
    mount(routeProject({ sounds: [{ id: 'kick', bars: [0, 1, 2, 3, 8, 9, 10, 11] }] }));
    const cards = screen.getAllByTestId('route-card');
    expect(cards.map(c => c.getAttribute('data-section-id'))).toEqual(['section-1', 'section-2']);
    expect(cards.map(c => within(c).getByTestId('route-card-text').textContent)).toEqual([WHAT_YOU_DO_PLACEHOLDER, WHAT_YOU_DO_PLACEHOLDER]);
    expect(screen.getByTestId('route-detected').textContent).toBe('Found from silences');
    const cta = screen.getByTestId('route-name-sections') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(document.getElementById(cta.getAttribute('aria-describedby')!)!.textContent).toBe(EDIT_ROUTE_REASON);
  });

  it('P9-2c: with an authored route, the cards read its names and text, and the CTA is gone', async () => {
    let state = await importTestMidi1();
    state = projectReducer(state, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 4, newSectionId: 'b' } });
    state = projectReducer(state, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Intro' } });
    state = projectReducer(state, { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'section-1', text: 'Kick and hats' } });
    state = projectReducer(state, { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'b', text: 'Both hands on the pads' } });
    mount(state);
    const cards = screen.getAllByTestId('route-card');
    expect(cards.map(c => within(c).getByTestId('route-card-text').textContent)).toEqual(['Kick and hats', 'Both hands on the pads']);
    expect(cards[0]!.getAttribute('aria-label')).toMatch(/^Intro · Bars 1–4 · No mode set · Kick and hats · Playing$/);
    expect(screen.queryByTestId('route-name-sections')).toBeNull();
    expect(screen.getByTestId('route-done-count').textContent).toBe('0 / 2 sections done');
  });

  it('Space plays and stops, L loops the song, [ and ] change the practice tempo', async () => {
    mount(await importTestMidi1());
    act(() => press(' '));
    expect(api.state.isPlaying).toBe(true);
    act(() => press(' '));
    expect(api.state.isPlaying).toBe(false);

    // A passage looped in the editor: LOOP (L) loops the song instead, then turns Loop off.
    act(() => api.dispatch({ type: 'SET_LOOP_REGION', payload: { start: 2, end: 4 } }));
    act(() => press('l'));
    expect({ on: api.state.loopEnabled, start: api.state.loopStart }).toEqual({ on: true, start: null });
    act(() => press('l'));
    expect(api.state.loopEnabled).toBe(false);

    act(() => press('['));
    expect(api.state.playbackRate).toBe(0.75);
    expect(screen.getByTestId('route-tempo-value').textContent).toBe('90 BPM · 75%');
    act(() => press(']'));
    act(() => press(']'));
    expect(api.state.playbackRate).toBe(1.25);
  });

  it('edits nothing: Delete leaves the selected pad, and Mod+Z undoes nothing', async () => {
    const state = projectReducer(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
    mount(state);
    const padKey = Object.keys(api.state.activeLayout.padToVoice)[0]!;
    const sound = api.state.activeLayout.padToVoice[padKey]!.id;
    act(() => api.dispatch({ type: 'SELECT_PAD', payload: { padKey, streamId: sound } }));
    act(() => api.dispatch({ type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Groove' } }));
    const before = { active: api.state.activeLayout, working: api.state.workingLayout, route: api.state.performanceRoute, undo: api.undoLabel };
    act(() => press('Delete'));
    act(() => press('Backspace'));
    act(() => press('z', { ctrlKey: true }));
    act(() => press('z', { metaKey: true }));
    expect({ active: api.state.activeLayout, working: api.state.workingLayout, route: api.state.performanceRoute, undo: api.undoLabel }).toEqual(before);
    expect(before.undo).toBe('Rename section');
  });
});
