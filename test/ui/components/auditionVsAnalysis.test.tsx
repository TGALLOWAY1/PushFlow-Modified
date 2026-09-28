// @vitest-environment happy-dom
/**
 * S4.4 · audition vs analysis (T15, T16; roadmap P4-7a–d).
 *
 * Mute and Solo are rehearsal-only session state: independent flags that
 * change what sounds and nothing else (no undo step, no save, no stale
 * analysis, no layout change), and a muted pad stays fully editable. "Exclude
 * from analysis" is the analysis's own switch: a saved Sound flag, one undo
 * step, badged in the Sounds panel and counted by the scope line, while the
 * Sound stays on its pad and in the timeline.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActivePerformance,
  getDisplayedExecutionPlan,
  getDisplayedLayout,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { pickDocument } from '../../../src/ui/state/projectDocument';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { UnifiedTimeline } from '../../../src/ui/components/UnifiedTimeline';
import { VoicePalette } from '../../../src/ui/components/VoicePalette';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { analysisScopeLine } from '../../../src/ui/analysis/analysisScope';
import { PAD_DRAG_TYPE } from '../../../src/ui/components/dragTypes';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let analysed: ProjectState;
let api: ReturnType<typeof useProject>;

beforeAll(async () => {
  const state = await suggestedTestMidi1();
  const layout = getDisplayedLayout(state)!;
  const analysis = await analyzeLayout({
    performance: getActivePerformance(state), layout,
    instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
  });
  analysed = { ...state, analysisResult: analysis, analysisStale: false };
}, 60_000);

function Editor() {
  api = useProject();
  return (
    <>
      <VoicePalette />
      <InteractiveGrid padSize={48} assignments={getDisplayedExecutionPlan(api.state)?.fingerAssignments} />
      <UnifiedTimeline />
    </>
  );
}

function mount(state: ProjectState = analysed) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Editor />
      </ProjectProvider>
    </ToastProvider>,
  );
}

const rowOf = (id: string) => screen.getAllByTestId('sound-row').find(r => r.getAttribute('data-sound-id') === id)!;
const padOf = (id: string) => {
  const [key] = Object.entries(getDisplayedLayout(api.state)!.padToVoice).find(([, v]) => v.id === id)!;
  return { key, el: screen.getByTestId(`pad-${key.replace(',', '-')}`) };
};
const emptyPad = () => {
  const taken = getDisplayedLayout(api.state)!.padToVoice;
  for (let row = 7; row >= 0; row--) for (let col = 0; col < 8; col++) if (!taken[`${row},${col}`]) return `${row},${col}`;
  throw new Error('no empty pad');
};
function dataTransfer() {
  const data: Record<string, string> = {};
  return {
    get types() { return Object.keys(data); },
    getData: (type: string) => data[type] ?? '',
    setData: (type: string, value: string) => { data[type] = value; },
    dropEffect: 'move',
    effectAllowed: 'move',
  };
}

describe('Mute and Solo are rehearsal-only (P4-7b, P4-7c)', () => {
  it('a mute lights M and changes nothing else: no undo step, no save, the same analysis, layout and fingering', () => {
    mount();
    const kick = analysed.soundStreams[0]!.id;
    const before = api.state;
    fireEvent.click(within(rowOf(kick)).getByTestId('sound-mute'));

    expect(api.state.mutedSoundIds).toEqual([kick]);
    expect(within(rowOf(kick)).getByTestId('sound-mute').getAttribute('aria-pressed')).toBe('true');
    expect(within(rowOf(kick)).getByTestId('sound-silent').getAttribute('data-reason')).toBe('muted');
    expect(pickDocument(api.state)).toEqual(pickDocument(before));
    expect(api.state.updatedAt).toBe(before.updatedAt);
    expect(api.state.analysisStale).toBe(false);
    expect(api.state.analysisResult).toBe(before.analysisResult);
    expect(api.canUndo).toBe(false);
    expect(getActivePerformance(api.state)).toEqual(getActivePerformance(before));
  });

  it('Solo lights S; Unmute works while another Sound is soloed; un-soloing leaves the earlier mute', () => {
    mount();
    const [kick, snare, hat] = analysed.soundStreams.map(s => s.id);
    fireEvent.click(within(rowOf(hat!)).getByTestId('sound-mute'));
    fireEvent.click(within(rowOf(kick!)).getByTestId('sound-solo'));
    expect(within(rowOf(kick!)).getByTestId('sound-solo').getAttribute('aria-pressed')).toBe('true');
    // Every other Sound is silent while Kick is soloed.
    expect(within(rowOf(snare!)).getByTestId('sound-silent').getAttribute('data-reason')).toBe('not-soloed');

    // Unmute Hat while Kick is soloed: its mute goes, and it stays silent only because of the solo.
    fireEvent.click(within(rowOf(hat!)).getByTestId('sound-mute'));
    expect(api.state.mutedSoundIds).toEqual([]);
    expect(within(rowOf(hat!)).getByTestId('sound-mute').getAttribute('aria-pressed')).toBe('false');
    expect(within(rowOf(hat!)).getByTestId('sound-silent').getAttribute('data-reason')).toBe('not-soloed');

    // Mute Snare again, then un-solo Kick: Snare keeps its mute, Hat sounds.
    fireEvent.click(within(rowOf(snare!)).getByTestId('sound-mute'));
    fireEvent.click(within(rowOf(kick!)).getByTestId('sound-solo'));
    expect(api.state.soloedSoundIds).toEqual([]);
    expect(api.state.mutedSoundIds).toEqual([snare]);
    expect(within(rowOf(snare!)).getByTestId('sound-silent').getAttribute('data-reason')).toBe('muted');
    expect(within(rowOf(hat!)).queryByTestId('sound-silent')).toBeNull();
    expect(api.canUndo).toBe(false);
  });

  it('solos add up; Alt-click solos only that Sound, and Alt-click again clears the solo', () => {
    mount();
    const [kick, snare, hat] = analysed.soundStreams.map(s => s.id);
    fireEvent.click(within(rowOf(kick!)).getByTestId('sound-solo'));
    fireEvent.click(within(rowOf(snare!)).getByTestId('sound-solo'));
    expect(api.state.soloedSoundIds).toEqual([kick, snare]);
    fireEvent.click(within(rowOf(hat!)).getByTestId('sound-solo'), { altKey: true });
    expect(api.state.soloedSoundIds).toEqual([hat]);
    fireEvent.click(within(rowOf(hat!)).getByTestId('sound-solo'), { altKey: true });
    expect(api.state.soloedSoundIds).toEqual([]);
  });
});

describe('a muted pad stays editable (P4-7a)', () => {
  it('shows its speaker-off glyph and can be dragged and dropped onto an empty pad, as one undo step', () => {
    mount();
    const kick = analysed.soundStreams[0]!.id;
    act(() => api.dispatch({ type: 'TOGGLE_MUTE', payload: kick }));
    const { key: from, el } = padOf(kick);
    expect(el.getAttribute('data-silent')).toBe('muted');
    expect(within(el).getByTestId('pad-silent')).toBeTruthy();
    expect(el.getAttribute('draggable')).toBe('true');
    expect(el.className).not.toContain('pointer-events-none');

    const to = emptyPad();
    const dt = dataTransfer();
    fireEvent.dragStart(el, { dataTransfer: dt });
    expect(dt.getData(PAD_DRAG_TYPE)).toBe(from);
    const target = screen.getByTestId(`pad-${to.replace(',', '-')}`);
    fireEvent.dragOver(target, { dataTransfer: dt });
    fireEvent.drop(target, { dataTransfer: dt });

    const layout = getDisplayedLayout(api.state)!;
    expect(layout.padToVoice[to]?.id).toBe(kick);
    expect(layout.padToVoice[from]).toBeUndefined();
    // Still muted, and the move is the one step Undo reverts.
    expect(api.state.mutedSoundIds).toEqual([kick]);
    expect(api.undoLabel).toBeTruthy();
  });

  it('a click selects it, and its pad menu opens, as for any pad', () => {
    mount();
    const kick = analysed.soundStreams[0]!.id;
    act(() => api.dispatch({ type: 'TOGGLE_MUTE', payload: kick }));
    const { key, el } = padOf(kick);
    fireEvent.click(el);
    expect(api.state.selectedPadKey).toBe(key);
    fireEvent.contextMenu(el);
    expect(screen.getByTestId('pad-menu')).toBeTruthy();
  });
});

describe('Exclude from analysis (P4-7c, P4-7d)', () => {
  it('is one undo step from the row menu: badged, counted by the scope line, stale analysis, out of the performance', () => {
    mount();
    const kick = analysed.soundStreams[0]!;
    fireEvent.click(within(rowOf(kick.id)).getByTestId('sound-menu-button'));
    fireEvent.click(screen.getByTestId('sound-menu-exclude'));

    expect(api.state.soundStreams.find(s => s.id === kick.id)!.excluded).toBe(true);
    expect(api.state.performanceLanes.find(l => l.id === kick.id)!.excluded).toBe(true);
    expect(within(rowOf(kick.id)).getByTestId('sound-excluded').textContent).toBe('Excluded');
    expect(api.state.analysisStale).toBe(true);
    expect(api.state.updatedAt).not.toBe(analysed.updatedAt);
    expect(api.undoLabel).toBe('Exclude from analysis');
    expect(getActivePerformance(api.state).events.some(e => e.voiceId === kick.id)).toBe(false);
    expect(analysisScopeLine(api.state.soundStreams, getDisplayedLayout(api.state))).toBe('Analysing 6 of 7 Sounds · 1 excluded');
    // Still on its pad, marked, and Generate will keep it there.
    expect(padOf(kick.id).el.getAttribute('data-excluded')).toBe('true');
    expect(within(padOf(kick.id).el).getByTestId('pad-excluded')).toBeTruthy();

    act(() => api.undo());
    expect(api.state.soundStreams.find(s => s.id === kick.id)!.excluded).toBeUndefined();
    expect(within(rowOf(kick.id)).queryByTestId('sound-excluded')).toBeNull();
  });

  it('Include in analysis takes it back, clearing the flag on the Sound and its lane', () => {
    mount();
    const kick = analysed.soundStreams[0]!.id;
    act(() => api.dispatch({ type: 'SET_SOUND_EXCLUDED', payload: { soundId: kick, excluded: true } }));
    fireEvent.click(within(rowOf(kick)).getByTestId('sound-menu-button'));
    expect(screen.getByTestId('sound-menu-exclude').textContent).toBe('Include in analysis');
    fireEvent.click(screen.getByTestId('sound-menu-exclude'));
    expect('excluded' in api.state.soundStreams.find(s => s.id === kick)!).toBe(false);
    expect('excluded' in api.state.performanceLanes.find(l => l.id === kick)!).toBe(false);
    expect(api.undoLabel).toBe('Include in analysis');
  });

  it('muted and excluded Sounds stay in the timeline, the excluded one\'s notes marked not analysed (invariant 4)', () => {
    mount();
    const [kick, snare] = analysed.soundStreams.map(s => s.id);
    act(() => {
      api.dispatch({ type: 'TOGGLE_MUTE', payload: kick! });
      api.dispatch({ type: 'SET_SOUND_EXCLUDED', payload: { soundId: snare!, excluded: true } });
    });
    const lanes = screen.getAllByTestId('timeline-lane-header');
    expect(lanes).toHaveLength(analysed.soundStreams.length);
    const lane = (id: string) => lanes.find(l => l.getAttribute('data-sound-id') === id)!;
    expect(lane(kick!).getAttribute('data-silent')).toBe('muted');
    expect(lane(snare!).getAttribute('data-excluded')).toBe('true');
    const pills = (id: string) => screen.getAllByTestId('timeline-pill').filter(p => p.getAttribute('data-sound-id') === id);
    const events = (id: string) => analysed.soundStreams.find(s => s.id === id)!.events.length;
    expect(pills(kick!)).toHaveLength(events(kick!));
    expect(pills(snare!)).toHaveLength(events(snare!));
    expect(pills(snare!).every(p => p.getAttribute('data-excluded') === 'true' && p.title.includes('not analysed'))).toBe(true);
    // The muted Sound keeps its analysed pills (hand and finger).
    expect(pills(kick!).every(p => /^[LR][1-5]$/.test(p.getAttribute('data-finger') ?? ''))).toBe(true);
  });
});
