// @vitest-environment happy-dom
/**
 * S4.4 · practice aids (T59): the click's and the hits' levels, the Hands
 * filter and auditions (roadmap P4-7e, and the Hits menu that holds them).
 *
 * - The levels are two buses before the master: clicks (the count-in's too)
 *   go through one, hits and auditions through the other.
 * - "Hands: L" silences and dims the right hand's strikes (the plan's hand per
 *   note; a note with no hand stays) and leaves every analysis value as it was.
 * - Nothing here is saved, undone or an analysis input.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActivePerformance,
  getDisplayedExecutionPlan,
  getDisplayedLayout,
  projectReducer,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { pickDocument } from '../../../src/ui/state/projectDocument';
import { RehearsalAudio, DEFAULT_REHEARSAL_AUDIO, clampLevel } from '../../../src/ui/audio/rehearsalAudio';
import { audibleHits, TransportProvider } from '../../../src/ui/audio/TransportProvider';
import { TransportEngine } from '../../../src/ui/audio/transportEngine';
import { PadInspector } from '../../../src/ui/components/workspace/PadInspector';
import { handsByNote, inHandsFilter, isHandsFilter } from '../../../src/ui/audio/handsFilter';
import { TransportBar } from '../../../src/ui/components/workspace/TransportBar';
import { InteractiveGrid } from '../../../src/ui/components/InteractiveGrid';
import { UnifiedTimeline } from '../../../src/ui/components/UnifiedTimeline';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { analysisCacheKey } from '../../../src/ui/analysis/analysisCache';
import { analysisKeyFor } from '../../../src/ui/analysis/layoutAnalysis';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

// ─── A fake audio graph ──────────────────────────────────────────────────────

class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
}
class FakeNode {
  targets: FakeNode[] = [];
  connect<T extends FakeNode>(node: T): T { this.targets.push(node); return node; }
  disconnect() { this.targets = []; }
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeSource extends FakeNode {
  frequency = new FakeParam();
  Q = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  start() {}
  stop() {}
}
class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  gains: FakeGain[] = [];
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createOscillator() { return new FakeSource(); }
  createBufferSource() { return new FakeSource(); }
  createBiquadFilter() { return new FakeSource(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
}

function audioWithFakeContext() {
  const ctx = new FakeContext();
  const audio = new RehearsalAudio({ context: ctx as unknown as BaseAudioContext });
  const [master, clickBus, hitsBus] = ctx.gains;
  /** The gains made after the buses that feed `bus`: the sounds played through it. */
  const soundsInto = (bus: FakeGain) => ctx.gains.slice(3).filter(g => g.targets.includes(bus)).length;
  return { ctx, audio, master: master!, clickBus: clickBus!, hitsBus: hitsBus!, soundsInto };
}

describe('the click\'s and the hits\' levels', () => {
  it('are two buses before the master; clicks go through one, hits and auditions through the other', () => {
    const { audio, master, clickBus, hitsBus, soundsInto } = audioWithFakeContext();
    expect(clickBus.targets).toEqual([master]);
    expect(hitsBus.targets).toEqual([master]);
    expect([clickBus.gain.value, hitsBus.gain.value]).toEqual([1, 1]);

    audio.setOptions({ ...DEFAULT_REHEARSAL_AUDIO, clickLevel: 0.25, hitsLevel: 0.5 });
    expect([clickBus.gain.value, hitsBus.gain.value, master.gain.value]).toEqual([0.25, 0.5, DEFAULT_REHEARSAL_AUDIO.volume]);

    audio.scheduleClick(1, true);
    expect([soundsInto(clickBus), soundsInto(hitsBus)]).toEqual([1, 0]);
    audio.scheduleHit('kick', 1, 100);
    expect(soundsInto(hitsBus)).toBeGreaterThanOrEqual(1);
    const hits = soundsInto(hitsBus);

    // An audition plays even with Hits off: asking to hear it is the point.
    audio.setOptions({ ...DEFAULT_REHEARSAL_AUDIO, hits: false });
    audio.audition('kick');
    expect(soundsInto(hitsBus)).toBeGreaterThan(hits);
    expect(soundsInto(clickBus)).toBe(1);
  });

  it('keeps a level between 0 and 1', () => {
    expect([clampLevel(-1), clampLevel(0.3), clampLevel(2), clampLevel('loud')]).toEqual([0, 0.3, 1, 1]);
  });
});

// ─── The Hands filter ────────────────────────────────────────────────────────

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

describe('Hands: Both / L / R', () => {
  it('keeps a strike with no hand in both filters', () => {
    expect(isHandsFilter('left')).toBe(true);
    expect(isHandsFilter('thumbs')).toBe(false);
    expect(inHandsFilter('left', 'left')).toBe(true);
    expect(inHandsFilter('right', 'left')).toBe(false);
    expect(inHandsFilter('Unplayable', 'left')).toBe(true);
    expect(inHandsFilter(undefined, 'right')).toBe(true);
    expect(inHandsFilter('right', 'both')).toBe(true);
  });

  it('silences the other hand\'s hits, by the plan\'s hand for each note', () => {
    const plan = getDisplayedExecutionPlan(analysed)!;
    const byNote = handsByNote(plan.fingerAssignments);
    const none = { mutedSoundIds: [], soloedSoundIds: [] };
    const all = audibleHits(analysed.soundStreams, none);
    const left = audibleHits(analysed.soundStreams, none, { filter: 'left', byNote });
    const right = audibleHits(analysed.soundStreams, none, { filter: 'right', byNote });
    const count = (hand: string) => plan.fingerAssignments.filter(a => a.assignedHand === hand).length;
    expect(count('left')).toBeGreaterThan(0);
    expect(count('right')).toBeGreaterThan(0);
    expect(left).toHaveLength(all.length - count('right'));
    expect(right).toHaveLength(all.length - count('left'));
  });

  it('P4-7e: "Hands: L" leaves Playability, the plan and the verdict as they were, with no undo step or save', () => {
    const left = projectReducer(analysed, { type: 'SET_HANDS_FILTER', payload: 'left' });
    expect(left.handsFilter).toBe('left');
    expect(left.analysisStale).toBe(false);
    expect(left.analysisResult).toBe(analysed.analysisResult);
    expect(left.updatedAt).toBe(analysed.updatedAt);
    expect(pickDocument(left)).toEqual(pickDocument(analysed));
    const layout = getDisplayedLayout(analysed)!;
    // The key every Playability score is cached under is unchanged: the same score.
    expect(analysisCacheKey(analysisKeyFor(left, layout))).toBe(analysisCacheKey(analysisKeyFor(analysed, layout)));
    // An unknown filter, or the same one again, changes nothing.
    expect(projectReducer(left, { type: 'SET_HANDS_FILTER', payload: 'left' })).toBe(left);
    expect(projectReducer(left, { type: 'SET_HANDS_FILTER', payload: 'thumbs' as never })).toBe(left);
  });
});

// ─── On screen ───────────────────────────────────────────────────────────────

function Workspace() {
  api = useProject();
  return (
    <>
      <TransportBar />
      <InteractiveGrid padSize={48} assignments={getDisplayedExecutionPlan(api.state)?.fingerAssignments} />
      <UnifiedTimeline />
    </>
  );
}

function mount(state: ProjectState = analysed) {
  return render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Workspace />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('Hits\' menu in the transport', () => {
  it('sets the levels and the hand, shows the hand on its half, and changes nothing that is saved', () => {
    mount();
    const before = api.state;
    fireEvent.click(screen.getByTestId('transport-mix'));
    const menu = screen.getByTestId('transport-mix-menu');
    fireEvent.change(within(menu).getByTestId('level-click'), { target: { value: '40' } });
    fireEvent.change(within(menu).getByTestId('level-hits'), { target: { value: '75' } });
    expect(api.state.rehearsalAudio).toMatchObject({ clickLevel: 0.4, hitsLevel: 0.75 });
    expect(within(menu).getByText('40%')).toBeTruthy();

    fireEvent.click(within(menu).getByTestId('hands-left'));
    expect(api.state.handsFilter).toBe('left');
    expect(screen.getByTestId('transport-mix').textContent).toBe('L');
    expect(screen.getByTestId('transport-mix').getAttribute('aria-label')).toBe('Levels and hands: Left hand only');

    expect(api.canUndo).toBe(false);
    expect(api.state.updatedAt).toBe(before.updatedAt);
    expect(pickDocument(api.state)).toEqual(pickDocument(before));
  });

  it('with "Hands: R", every pad only the left hand strikes is dimmed, and so are its notes; "Both" undims them', () => {
    mount();
    const plan = getDisplayedExecutionPlan(api.state)!;
    const handsOf = new Map<string, Set<string>>();
    for (const a of plan.fingerAssignments) {
      const key = `${a.row},${a.col}`;
      handsOf.set(key, (handsOf.get(key) ?? new Set()).add(a.assignedHand));
    }
    const leftOnly = [...handsOf].filter(([, hands]) => [...hands].every(h => h === 'left')).map(([key]) => key).sort();
    expect(leftOnly.length).toBeGreaterThan(0);

    act(() => api.dispatch({ type: 'SET_HANDS_FILTER', payload: 'right' }));
    const dimmed = [...document.querySelectorAll('[data-hand-filtered="true"][data-testid^="pad-"]')]
      .map(el => el.getAttribute('data-testid')!.replace(/^pad-(\d)-(\d)$/, '$1,$2')).sort();
    expect(dimmed).toEqual(leftOnly);
    const dimmedPills = document.querySelectorAll('[data-testid="timeline-pill"][data-hand-filtered="true"]');
    expect(dimmedPills).toHaveLength(plan.fingerAssignments.filter(a => a.assignedHand === 'left').length);

    act(() => api.dispatch({ type: 'SET_HANDS_FILTER', payload: 'both' }));
    expect(document.querySelectorAll('[data-hand-filtered="true"]')).toHaveLength(0);
  });

  it('an excluded Sound\'s notes are never dimmed by its finger preference: the plan gives them no hand, so the transport plays them (P4 audit)', async () => {
    const g = analysed.soundStreams[analysed.soundStreams.length - 1]!;
    let state = projectReducer(analysed, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: g.id, hand: 'right', finger: 'index' } });
    state = projectReducer(state, { type: 'SET_SOUND_EXCLUDED', payload: { soundId: g.id, excluded: true } });
    const analysis = await analyzeLayout({
      performance: getActivePerformance(state), layout: getDisplayedLayout(state)!,
      instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
    });
    mount({ ...state, analysisResult: analysis, analysisStale: false });
    act(() => api.dispatch({ type: 'SET_HANDS_FILTER', payload: 'left' }));

    // Its placeholder pills show the preference ("R2"), but stay undimmed, like its pad.
    const pills = [...document.querySelectorAll(`[data-testid="timeline-pill"][data-sound-id="${g.id}"]`)];
    expect(pills).toHaveLength(g.events.length);
    expect(pills.every(p => p.getAttribute('data-excluded') === 'true')).toBe(true);
    expect(pills.filter(p => p.getAttribute('data-hand-filtered') === 'true')).toHaveLength(0);
    // The plan's own right-hand notes dim, and only they.
    const plan = getDisplayedExecutionPlan(api.state)!;
    expect(document.querySelectorAll('[data-testid="timeline-pill"][data-hand-filtered="true"]'))
      .toHaveLength(plan.fingerAssignments.filter(a => a.assignedHand === 'right').length);
    // The transport keeps every one of its hits.
    const left = audibleHits(api.state.soundStreams, { mutedSoundIds: [], soloedSoundIds: [] }, { filter: 'left', byNote: handsByNote(plan.fingerAssignments) });
    expect(left.filter(h => h.soundId === g.id)).toHaveLength(g.events.length);
  }, 30_000);
});

describe('auditions', () => {
  it('the pad inspector\'s play button plays its Sound through the transport, and changes nothing', () => {
    const audition = vi.spyOn(TransportEngine.prototype, 'audition').mockImplementation(() => {});
    try {
      render(
        <ToastProvider>
          <ProjectProvider initialState={analysed}>
            <TransportProvider>
              <Workspace />
              <PadInspector />
            </TransportProvider>
          </ProjectProvider>
        </ToastProvider>,
      );
      const [key, voice] = Object.entries(getDisplayedLayout(api.state)!.padToVoice)[0]!;
      act(() => api.dispatch({ type: 'SELECT_PAD', payload: { padKey: key, streamId: voice.id } }));
      const before = api.state;
      fireEvent.click(screen.getByTestId('pad-inspector-audition'));
      expect(audition.mock.calls).toEqual([[voice.id]]);
      expect(api.state).toBe(before);
    } finally {
      audition.mockRestore();
    }
  });
});
