// @vitest-environment happy-dom
/**
 * S5.1 · a real Sounds panel (T45, T17 rest; P5-3).
 *
 * - P5-3: filter chips with counts (All · To place · On grid · Locked) whose
 *   "To place" and "On grid" counts match the grid; with groups, the other
 *   Sounds sit under "Ungrouped", and no section is ever labelled "On grid"
 *   (or "To place", or "Unassigned"): placement is a row's pill or locator.
 * - Search, the progress line, row pills and locators, hit counts, the lock.
 * - Mod+G ungrouping leaves no empty group behind (the P2 audit follow-up).
 * - The row's menu: colour (the Sound's own from then on), group, short label
 *   (pads show it), GM name, Unplace and Delete with Undo; a Composer Sound
 *   is deleted in the Composer.
 * - The selection bar: Group, Colour and Unplace, one undo step each.
 * - Reordering only by the handle, and the timeline shares the order; its lane
 *   headers select their Sound and carry no S/M.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, createEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';
import { getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { UnifiedTimeline } from '../../../src/ui/components/UnifiedTimeline';
import { SOUND_REORDER_DRAG_TYPE, PAD_DRAG_TYPE } from '../../../src/ui/components/dragTypes';
import { COMPOSER_SOURCE_ID } from '../../../src/ui/state/composerSource';
import { SOUND_PALETTE } from '../../../src/utils/soundPalette';
import { formatPadLocator } from '../../../src/utils/padPosition';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let suggested: ProjectState;
let api: ReturnType<typeof useProject>;

beforeAll(async () => {
  suggested = await suggestedTestMidi1();
}, 60_000);

function Editor({ timeline = false }: { timeline?: boolean }) {
  api = useProject();
  useKeyboardShortcuts({});
  return (
    <>
      <VoicePalette />
      <InteractiveGrid padSize={48} />
      {timeline && <UnifiedTimeline />}
    </>
  );
}

function mount(state: ProjectState, timeline = false) {
  render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor timeline={timeline} />
      </ProjectProvider>
    </ToastProvider>,
  );
}

/** The suggested TEST MIDI 1 layout with two Sounds taken off and one locked. */
function partlyPlaced(): ProjectState {
  const layout = getDisplayedLayout(suggested)!;
  const [a, b, c] = Object.keys(layout.padToVoice);
  let state = projectReducer(suggested, { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: a! } });
  state = projectReducer(state, { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: b! } });
  return projectReducer(state, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: getDisplayedLayout(state)!.padToVoice[c!]!.id, padKey: c! } });
}

const rows = () => screen.getAllByTestId('sound-row');
const rowOf = (id: string) => rows().find(r => r.dataset.soundId === id)!;
const chip = (filter: string) => screen.getByTestId(`sounds-filter-${filter}`);
const count = (filter: string) => Number(chip(filter).dataset.count);
const sectionLabels = () => screen.queryAllByTestId('sounds-section-label').map(el => el.textContent);
const placedIds = () => new Set(Object.values(getDisplayedLayout(api.state)!.padToVoice).map(v => v.id));
const ctrlClick = (el: HTMLElement) => fireEvent.click(el, { ctrlKey: true });

/** happy-dom lays nothing out: the row at y 100–120. */
function upperHalfAtPointer(row: HTMLElement) {
  row.getBoundingClientRect = () => ({ top: 100, bottom: 120, height: 20, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
}

/** A drag event at a pointer height (happy-dom's drag events take no clientY from their init). */
function dragAt(el: HTMLElement, type: 'dragOver' | 'drop', dt: ReturnType<typeof dataTransfer>, clientY: number) {
  const event = createEvent[type](el, { dataTransfer: dt });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(el, event);
}

function dataTransfer(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    get types() { return Object.keys(data); },
    getData: (type: string) => data[type] ?? '',
    setData: (type: string, value: string) => { data[type] = value; },
    dropEffect: 'move',
    effectAllowed: 'move',
  };
}

describe('P5-3 · filters that match the grid, and "Ungrouped" never "On grid"', () => {
  it('counts All, To place, On grid and Locked as the grid has them, and each filter shows exactly those', () => {
    mount(partlyPlaced());
    const placed = placedIds();
    expect(count('all')).toBe(7);
    expect(count('on-grid')).toBe(placed.size);
    expect(count('on-grid')).toBe(5);
    expect(count('to-place')).toBe(7 - placed.size);
    expect(count('locked')).toBe(1);
    expect(screen.getByTestId('sounds-progress').getAttribute('aria-valuetext')).toBe('5 of 7 on the grid');

    for (const [filter, expected] of [
      ['to-place', [...api.state.soundStreams].filter(s => !placed.has(s.id)).map(s => s.id)],
      ['on-grid', [...placed]],
      ['locked', Object.keys(getDisplayedLayout(api.state)!.placementLocks)],
    ] as const) {
      fireEvent.click(chip(filter));
      expect(chip(filter).getAttribute('aria-checked')).toBe('true');
      expect(rows().map(r => r.dataset.soundId).sort()).toEqual([...expected].sort());
      expect(rows()).toHaveLength(count(filter));
    }
    fireEvent.click(chip('all'));
    expect(rows()).toHaveLength(7);
  });

  it('marks placement on each row: a "To place" pill or its pad, never a section; the hit count is its notes', () => {
    mount(partlyPlaced());
    const layout = getDisplayedLayout(api.state)!;
    for (const sound of api.state.soundStreams) {
      const row = rowOf(sound.id);
      const pad = Object.entries(layout.padToVoice).find(([, v]) => v.id === sound.id)?.[0];
      if (pad) {
        expect(within(row).getByTestId('sound-pad-locator').textContent).toBe(formatPadLocator(pad));
        expect(within(row).queryByTestId('sound-to-place')).toBeNull();
      } else {
        expect(within(row).getByTestId('sound-to-place').textContent).toBe('To place');
      }
      expect(within(row).getByTestId('sound-hits').textContent).toBe(String(sound.events.length));
    }
    // No groups: a flat list, with no section labels at all.
    expect(sectionLabels()).toEqual([]);
  });

  it('with a group, every other Sound, placed or not, sits under "Ungrouped"; no section says "On grid"', () => {
    mount(partlyPlaced());
    const [first, second] = api.state.soundStreams.filter(s => placedIds().has(s.id));
    ctrlClick(within(rowOf(first!.id)).getByTestId('sound-name'));
    ctrlClick(within(rowOf(second!.id)).getByTestId('sound-name'));
    fireEvent.keyDown(document.body, { key: 'g', ctrlKey: true });
    expect(sectionLabels()).toEqual(['Group 1', 'Ungrouped']);
    for (const label of sectionLabels()) expect(label).not.toMatch(/^(On grid|To place|Unassigned)/i);
    const [grouped, ungrouped] = screen.getAllByTestId('sounds-section');
    expect(within(grouped!).getAllByTestId('sound-row').map(r => r.dataset.soundId)).toEqual([first!.id, second!.id]);
    const rest = within(ungrouped!).getAllByTestId('sound-row');
    expect(rest).toHaveLength(5);
    // Placed and unplaced alike.
    expect(new Set(rest.map(r => r.dataset.placement))).toEqual(new Set(['on-grid', 'to-place']));
    // The filter counts still match the grid.
    expect(count('on-grid')).toBe(placedIds().size);
  });

  it('Mod+G on Sounds all in one group ungroups them and leaves no empty group behind', () => {
    mount(partlyPlaced());
    const [first, second] = api.state.soundStreams;
    const select = () => {
      ctrlClick(within(rowOf(first!.id)).getByTestId('sound-name'));
      ctrlClick(within(rowOf(second!.id)).getByTestId('sound-name'));
    };
    select();
    fireEvent.keyDown(document.body, { key: 'g', ctrlKey: true });
    expect(api.state.laneGroups).toHaveLength(1);
    select();
    fireEvent.keyDown(document.body, { key: 'g', ctrlKey: true });
    expect(api.state.laneGroups).toEqual([]);
    expect(sectionLabels()).toEqual([]);
    expect(api.undoLabel).toBe('Ungroup');
  });
});

describe('search, lock and the selection bar', () => {
  it('search narrows the list by name, every word, in any case', () => {
    mount(suggested);
    fireEvent.change(screen.getByTestId('sounds-search'), { target: { value: 'midi 1 c' } });
    expect(rows().map(r => within(r).getByTestId('sound-name').textContent)).toEqual(['TEST MIDI 1 C']);
    fireEvent.change(screen.getByTestId('sounds-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('sounds-none-match').textContent).toBe('No Sounds match "zzz".');
  });

  it('the row\'s lock locks the Sound to its pad, and Locked counts it', () => {
    mount(suggested);
    const sound = api.state.soundStreams[3]!;
    fireEvent.click(within(rowOf(sound.id)).getByTestId('sound-lock'));
    const layout = getDisplayedLayout(api.state)!;
    expect(layout.placementLocks[sound.id]).toBe(Object.entries(layout.padToVoice).find(([, v]) => v.id === sound.id)![0]);
    expect(count('locked')).toBe(1);
    expect(within(rowOf(sound.id)).getByTestId('sound-lock').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(rowOf(sound.id)).getByTestId('sound-lock'));
    expect(count('locked')).toBe(0);
  });

  it('the selection bar colours and unplaces the selected Sounds, one undo step each', () => {
    mount(suggested);
    const [a, b] = api.state.soundStreams;
    ctrlClick(within(rowOf(a!.id)).getByTestId('sound-name'));
    ctrlClick(within(rowOf(b!.id)).getByTestId('sound-name'));
    expect(within(screen.getByTestId('sounds-selection-bar')).getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sounds-selection-color'));
    fireEvent.click(screen.getByRole('button', { name: 'Crimson' }));
    const crimson = SOUND_PALETTE[11]!;
    expect(api.state.soundStreams.slice(0, 2).map(s => s.color)).toEqual([crimson, crimson]);
    expect(api.undoLabel).toBe('Sound color');

    // Still selected after colouring.
    fireEvent.click(screen.getByTestId('sounds-selection-unplace'));
    expect(placedIds().has(a!.id)).toBe(false);
    expect(placedIds().has(b!.id)).toBe(false);
    expect(api.undoLabel).toBe('Unplace Sounds');
    expect(screen.getByText('Unplaced 2 Sounds')).toBeTruthy();
    // One Undo puts both back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(placedIds().has(a!.id) && placedIds().has(b!.id)).toBe(true);
    expect(api.undoLabel).toBe('Sound color');
  });
});

describe('the row\'s menu', () => {
  const openMenu = (id: string) => fireEvent.click(within(rowOf(id)).getByTestId('sound-menu-button'));

  it('a colour becomes the Sound\'s own: a group colour no longer repaints it', () => {
    mount(suggested);
    const [a, b] = api.state.soundStreams;
    ctrlClick(within(rowOf(a!.id)).getByTestId('sound-name'));
    ctrlClick(within(rowOf(b!.id)).getByTestId('sound-name'));
    fireEvent.keyDown(document.body, { key: 'g', ctrlKey: true });
    // Imported Sounds already keep their own colour (S2.2a); a Composer-like
    // inherited one is what a pick protects, so make one.
    act(() => api.dispatch({ type: 'SET_LANE_COLOR', payload: { laneId: a!.id, color: '#123456', colorMode: 'inherited' } }));
    openMenu(a!.id);
    fireEvent.click(within(screen.getByTestId('sound-menu-colors')).getByRole('button', { name: 'Teal' }));
    expect(api.state.performanceLanes.find(l => l.id === a!.id)).toMatchObject({ color: SOUND_PALETTE[15], colorMode: 'overridden' });
    act(() => api.dispatch({ type: 'SET_LANE_GROUP_COLOR', payload: { groupId: api.state.laneGroups[0]!.groupId, color: '#abcdef' } }));
    expect(api.state.soundStreams.find(s => s.id === a!.id)!.color).toBe(SOUND_PALETTE[15]);
  });

  it('groups it (a new group, then none, which removes the emptied group)', () => {
    mount(suggested);
    const sound = api.state.soundStreams[2]!;
    openMenu(sound.id);
    fireEvent.click(screen.getByTestId('sound-menu-new-group'));
    expect(sectionLabels()).toEqual(['Group 1', 'Ungrouped']);
    openMenu(sound.id);
    fireEvent.click(screen.getByTestId('sound-menu-group-none'));
    expect(api.state.laneGroups).toEqual([]);
    expect(sectionLabels()).toEqual([]);
  });

  it('a short label shows on its pad instead of the name, and is kept to six characters', () => {
    mount(suggested);
    const sound = api.state.soundStreams[0]!;
    const pad = Object.entries(getDisplayedLayout(api.state)!.padToVoice).find(([, v]) => v.id === sound.id)![0];
    openMenu(sound.id);
    fireEvent.change(screen.getByTestId('sound-short-label-input'), { target: { value: 'Kick' } });
    fireEvent.click(screen.getByTestId('sound-short-label-save'));
    expect(api.state.soundStreams[0]!.shortLabel).toBe('Kick');
    expect(api.state.performanceLanes.find(l => l.id === sound.id)!.shortLabel).toBe('Kick');
    expect(within(screen.getByTestId(`pad-${pad.replace(',', '-')}`)).getByTestId('pad-label').textContent).toBe('Kick');
    expect(api.undoLabel).toBe('Short label');
    act(() => api.dispatch({ type: 'SET_SOUND_SHORT_LABEL', payload: { streamId: sound.id, shortLabel: '  Closed hat ' } }));
    expect(api.state.soundStreams[0]!.shortLabel).toBe('Closed');
    act(() => api.dispatch({ type: 'SET_SOUND_SHORT_LABEL', payload: { streamId: sound.id, shortLabel: null } }));
    expect('shortLabel' in api.state.soundStreams[0]!).toBe(false);
    expect(within(screen.getByTestId(`pad-${pad.replace(',', '-')}`)).getByTestId('pad-label').textContent).toBe('A');
  });

  it('says why GM naming and Unplace can\'t be used, and unplaces with Undo', () => {
    mount(partlyPlaced());
    const unplaced = api.state.soundStreams.find(s => !placedIds().has(s.id))!;
    openMenu(unplaced.id);
    const menu = screen.getByTestId('sound-menu');
    expect((within(menu).getByTestId('sound-menu-gm') as HTMLButtonElement).disabled).toBe(true);
    expect(within(menu).getAllByTestId('disabled-reason').map(el => el.textContent)).toEqual([
      'Its pitch is no GM drum (35–81)',
      'Not on the grid',
    ]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    const placed = [...placedIds()].find(id => !getDisplayedLayout(api.state)!.placementLocks[id])!;
    openMenu(placed);
    fireEvent.click(screen.getByTestId('sound-menu-unplace'));
    expect(placedIds().has(placed)).toBe(false);
    expect(within(rowOf(placed)).getByTestId('sound-to-place')).toBeTruthy();
  });

  it('Delete takes the Sound away with Undo; a Composer Sound is deleted in the Composer', () => {
    mount(suggested);
    const sound = api.state.soundStreams[1]!;
    openMenu(sound.id);
    fireEvent.click(screen.getByTestId('sound-menu-delete'));
    expect(api.state.soundStreams.map(s => s.id)).not.toContain(sound.id);
    expect(placedIds().has(sound.id)).toBe(false);
    expect(api.undoLabel).toBe('Delete Sound');
    expect(screen.getByText(`Deleted ${sound.name}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(api.state.soundStreams.map(s => s.id)).toContain(sound.id);
    expect(placedIds().has(sound.id)).toBe(true);

    cleanup();
    const composed = {
      ...suggested,
      performanceLanes: suggested.performanceLanes.map((l, i) => (i === 0 ? { ...l, sourceFileId: COMPOSER_SOURCE_ID } : l)),
    };
    mount(composed);
    openMenu(api.state.soundStreams[0]!.id);
    expect((screen.getByTestId('sound-menu-delete') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('A Composer lane: delete it in the Composer')).toBeTruthy();
  });

  it('a deleted Sound leaves the selection: the bar counts the others, and Group makes no empty group', () => {
    mount(suggested);
    const [a, b] = api.state.soundStreams;
    ctrlClick(within(rowOf(a!.id)).getByTestId('sound-hits'));
    ctrlClick(within(rowOf(b!.id)).getByTestId('sound-hits'));
    expect(screen.getByTestId('sounds-selection-bar').getAttribute('aria-label')).toBe('2 selected Sounds');

    openMenu(a!.id);
    fireEvent.click(screen.getByTestId('sound-menu-delete'));
    expect(screen.getByTestId('sounds-selection-bar').getAttribute('aria-label')).toBe('1 selected Sounds');
    expect([api.state.armedStreamId, api.state.selectedStreamId]).not.toContain(a!.id);

    fireEvent.click(screen.getByTestId('sounds-selection-group'));
    expect(api.state.laneGroups).toHaveLength(1);
    const members = api.state.performanceLanes.filter(l => l.groupId === api.state.laneGroups[0]!.groupId).map(l => l.id);
    expect(members).toEqual([b!.id]);
  });
});

describe('reordering by the handle only; the timeline shares the order', () => {
  it('a handle drag moves the Sound before or after a row, one undo step, and the timeline follows', () => {
    mount(suggested, true);
    const ids = () => rows().map(r => r.dataset.soundId);
    const lanes = () => screen.getAllByTestId('timeline-lane-header').map(el => el.dataset.soundId);
    const before = ids();
    expect(lanes()).toEqual(before);
    const dt = dataTransfer();
    fireEvent.dragStart(within(rowOf(before[5]!)).getByTestId('sound-reorder-handle'), { dataTransfer: dt });
    expect(dt.types).toEqual([SOUND_REORDER_DRAG_TYPE]);
    // The pointer in the upper half of the first row: before it.
    upperHalfAtPointer(rowOf(before[0]!));
    dragAt(rowOf(before[0]!), 'dragOver', dt, 105);
    expect(within(rowOf(before[0]!)).getByTestId('sound-drop-line').className).toContain('-top-px');
    dragAt(rowOf(before[0]!), 'drop', dt, 105);
    const moved = [before[5]!, ...before.filter(id => id !== before[5])];
    expect(ids()).toEqual(moved);
    expect(lanes()).toEqual(moved);
    expect(api.undoLabel).toBe('Reorder Sounds');
    expect(screen.queryByTestId('sound-drop-line')).toBeNull();
  });

  it('a Sound or pad dragged over the list never reorders it; a pad dropped there is unplaced instead', () => {
    mount(suggested);
    const before = rows().map(r => r.dataset.soundId);
    // A Sound on its way to the grid: the list doesn't take it.
    const sound = dataTransfer({ 'application/pushflow-stream': JSON.stringify({ id: before[2] }) });
    expect(fireEvent.dragOver(rowOf(before[0]!), { dataTransfer: sound })).toBe(true);
    fireEvent.drop(rowOf(before[0]!), { dataTransfer: sound });
    expect(rows().map(r => r.dataset.soundId)).toEqual(before);
    // A pad: the panel is its drop zone (T46), and no row becomes a reorder target.
    const pad = Object.entries(getDisplayedLayout(api.state)!.padToVoice).find(([, v]) => v.id === before[2])![0];
    const padDrag = dataTransfer({ [PAD_DRAG_TYPE]: pad, 'application/pushflow-stream': JSON.stringify({ id: before[2] }) });
    fireEvent.dragOver(rowOf(before[0]!), { dataTransfer: padDrag });
    expect(screen.queryByTestId('sound-drop-line')).toBeNull();
    fireEvent.drop(rowOf(before[0]!), { dataTransfer: padDrag });
    expect(rows().map(r => r.dataset.soundId)).toEqual(before);
    expect(placedIds().has(before[2]!)).toBe(false);
  });

  it('a handle drag onto a group\'s heading moves the Sound into it; with groups, the timeline lists them first', () => {
    mount(suggested, true);
    const [a, b] = api.state.soundStreams;
    ctrlClick(within(rowOf(a!.id)).getByTestId('sound-name'));
    ctrlClick(within(rowOf(b!.id)).getByTestId('sound-name'));
    fireEvent.keyDown(document.body, { key: 'g', ctrlKey: true });
    const last = api.state.soundStreams[6]!;
    const dt = dataTransfer();
    fireEvent.dragStart(within(rowOf(last.id)).getByTestId('sound-reorder-handle'), { dataTransfer: dt });
    const heading = screen.getAllByTestId('sound-group-header').find(h => h.dataset.groupId !== 'ungrouped')!;
    fireEvent.dragOver(heading, { dataTransfer: dt });
    expect(heading.dataset.dropActive).toBe('true');
    fireEvent.drop(heading, { dataTransfer: dt });
    expect(api.state.performanceLanes.find(l => l.id === last.id)!.groupId).toBe(api.state.laneGroups[0]!.groupId);
    const order = [a!.id, b!.id, last.id];
    expect(rows().slice(0, 3).map(r => r.dataset.soundId)).toEqual(order);
    expect(screen.getAllByTestId('timeline-lane-header').slice(0, 3).map(el => el.dataset.soundId)).toEqual(order);
  });

  it('a lane header selects its Sound in every panel, and has no Solo or Mute', () => {
    mount(suggested, true);
    const sound = api.state.soundStreams[4]!;
    const header = screen.getAllByTestId('timeline-lane-header').find(el => el.dataset.soundId === sound.id)!;
    fireEvent.click(header);
    expect(api.state.selectedStreamId).toBe(sound.id);
    expect(header.getAttribute('aria-pressed')).toBe('true');
    expect(rowOf(sound.id).className).toContain('ring-accent-primary/20');
    expect(within(screen.getByTestId('timeline-header').parentElement!).queryAllByTitle(/^(Solo|Mute|Unmute)$/)).toHaveLength(0);
  });
});
