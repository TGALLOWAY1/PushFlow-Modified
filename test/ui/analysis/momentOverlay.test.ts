// @vitest-environment happy-dom
/**
 * S4.2 · the moment view's model (T09; P4-2, P4-3a).
 *
 * The current event's strikes and, as the view asks, the next and the
 * previous event's, each with its finger; next-move arrows from each finger's
 * last pad (else its hand's), searching back; while playing, the event at the
 * playhead drives the same layers and nothing dims.
 */

import { describe, expect, it } from 'vitest';
import { type FingerAssignment } from '../../../src/types/executionPlan';
import { buildEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import { playbackOverlayAt, selectionOverlay } from '../../../src/ui/analysis/momentOverlay';
import { buildTransitionModelAt, nextPlayedEventIndex, playheadEventIndex } from '../../../src/ui/analysis/selectionModel';
import { nextMomentView, loadViewSettings, DEFAULT_VIEW_SETTINGS } from '../../../src/ui/state/viewSettings';

type Strike = [time: number, sound: string, hand: 'left' | 'right' | 'Unplayable', finger: FingerAssignment['finger'], pad: string];

/**
 * Four events, 0.5 s apart:
 *   0: L2 on 0,0            (Kick)
 *   1: R1 on 0,5 + L3 on 1,1 (Hat + Snare)
 *   2: L2 on 0,2            (Clap: L2 moves from 0,0, struck two events back)
 *   3: L4 on 2,3            (Tom: L4's first strike, so it comes from its hand's last pad, 0,2)
 */
const STRIKES: Strike[] = [
  [0, 'kick', 'left', 'index', '0,0'],
  [0.5, 'hat', 'right', 'thumb', '0,5'],
  [0.5, 'snare', 'left', 'middle', '1,1'],
  [1, 'clap', 'left', 'index', '0,2'],
  [1.5, 'tom', 'left', 'ring', '2,3'],
];

function fixture() {
  const plan: FingerAssignment[] = STRIKES.map(([startTime, voiceId, assignedHand, finger, pad], i) => {
    const [row, col] = pad.split(',').map(Number);
    return {
      eventKey: `n${i}`, voiceId, startTime, noteNumber: 36, row, col, assignedHand, finger,
      cost: 1, difficulty: 'Easy',
    } as FingerAssignment;
  });
  const timeline = buildEventTimeline(plan);
  return { timeline, plan };
}

const keys = (map: ReadonlyMap<string, unknown>) => [...map.keys()].sort();

describe('the selection overlay (stopped)', () => {
  it('Now shows the event’s own strikes with their fingers, and dims the rest', () => {
    const { timeline, plan } = fixture();
    const o = selectionOverlay(timeline, plan, timeline.events[1]!.key, 'now')!;
    expect(keys(o.now)).toEqual(['0,5', '1,1']);
    expect(o.now.get('0,5')?.label).toBe('R1');
    expect(o.now.get('1,1')?.label).toBe('L3');
    expect(o.next.size).toBe(0);
    expect(o.prev.size).toBe(0);
    expect(o.moves).toEqual([]);
    expect(o.dimOthers).toBe(true);
  });

  it('Now + Next adds the next strikes and each finger’s move from its last pad', () => {
    const { timeline, plan } = fixture();
    const o = selectionOverlay(timeline, plan, timeline.events[1]!.key, 'now-next')!;
    expect(keys(o.next)).toEqual(['0,2']);
    expect(o.next.get('0,2')?.label).toBe('L2');
    // L2 last struck 0,0, two events back (not in the current event).
    expect(o.moves.map(m => [m.label, m.fromPad, m.toPad, m.fromCurrent])).toEqual([['L2', '0,0', '0,2', false]]);
    expect(o.prev.size).toBe(0);
  });

  it('a finger that hasn’t struck yet comes from its hand’s last pad', () => {
    const { timeline, plan } = fixture();
    const o = selectionOverlay(timeline, plan, timeline.events[2]!.key, 'now-next')!;
    expect(o.moves.map(m => [m.label, m.fromPad, m.toPad, m.fromCurrent])).toEqual([['L4', '0,2', '2,3', true]]);
  });

  it('Prev · Now · Next adds the previous strikes', () => {
    const { timeline, plan } = fixture();
    const o = selectionOverlay(timeline, plan, timeline.events[2]!.key, 'prev-now-next')!;
    expect(keys(o.now)).toEqual(['0,2']);
    expect(keys(o.next)).toEqual(['2,3']);
    expect(keys(o.prev)).toEqual(['0,5', '1,1']);
  });

  it('is null with nothing selected', () => {
    const { timeline, plan } = fixture();
    expect(selectionOverlay(timeline, plan, null, 'now-next')).toBeNull();
  });

  it('a finger striking the same pad again is a hold, not a move', () => {
    const { timeline, plan } = fixture();
    const again = [...plan, { ...plan[0]!, eventKey: 'n9', startTime: 2 }];
    const t = buildEventTimeline(again);
    const model = buildTransitionModelAt(t, again, 3)!;
    // Event 4 (index 4) is L2 on 0,0 again; from event 3 its last L2 pad is 0,2.
    expect(model.fingerMoves.map(m => [m.fromPad, m.toPad, m.isHold])).toEqual([['0,2', '0,0', false]]);
    const hold = [...again, { ...again[5]!, eventKey: 'n10', startTime: 2.5 }];
    const t2 = buildEventTimeline(hold);
    expect(buildTransitionModelAt(t2, hold, 4)!.fingerMoves.map(m => m.isHold)).toEqual([true]);
    expect(selectionOverlay(t2, hold, t2.events[4]!.key, 'now-next')!.moves).toEqual([]);
  });
});

describe('the playback overlay (the playhead drives it)', () => {
  it('finds the event at the playhead: the last one started, none before the first', () => {
    const { timeline, plan } = fixture();
    expect(playheadEventIndex(timeline, plan, -0.1)).toBeNull();
    expect(playheadEventIndex(timeline, plan, 0)).toBe(0);
    expect(playheadEventIndex(timeline, plan, 0.49)).toBe(0);
    expect(playheadEventIndex(timeline, plan, 0.5)).toBe(1);
    expect(playheadEventIndex(timeline, plan, 9)).toBe(3);
    expect(nextPlayedEventIndex(timeline, plan, null)).toBe(0);
    expect(nextPlayedEventIndex(timeline, plan, 3)).toBeNull();
  });

  it('shows the current strikes and the next ones, never dims, and draws no arrows', () => {
    const { timeline, plan } = fixture();
    const o = playbackOverlayAt(timeline, plan, 1, 'now-next')!;
    expect(keys(o.now)).toEqual(['0,5', '1,1']);
    expect(keys(o.next)).toEqual(['0,2']);
    expect(o.dimOthers).toBe(false);
    expect(o.moves).toEqual([]);
    // Before the first event, only what comes next.
    const before = playbackOverlayAt(timeline, plan, null, 'now-next')!;
    expect(before.now.size).toBe(0);
    expect(keys(before.next)).toEqual(['0,0']);
    // Now alone shows no next strikes.
    expect(playbackOverlayAt(timeline, plan, 1, 'now')!.next.size).toBe(0);
  });
});

describe('the view setting', () => {
  it('O cycles Now → Now + Next → Prev · Now · Next → Now', () => {
    expect(nextMomentView('now')).toBe('now-next');
    expect(nextMomentView('now-next')).toBe('prev-now-next');
    expect(nextMomentView('prev-now-next')).toBe('now');
  });

  it('is remembered per viewer, with Now + Next by default', () => {
    localStorage.clear();
    expect(loadViewSettings().momentView).toBe('now-next');
    localStorage.setItem('pushflow:view-settings', JSON.stringify({ gridLabels: {}, momentView: 'prev-now-next' }));
    expect(loadViewSettings().momentView).toBe('prev-now-next');
    localStorage.setItem('pushflow:view-settings', JSON.stringify({ momentView: 'sideways' }));
    expect(loadViewSettings().momentView).toBe(DEFAULT_VIEW_SETTINGS.momentView);
    localStorage.clear();
  });
});
