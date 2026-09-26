/**
 * S4.2 · each event's difficulty, the Events filters and Prev/Next hard (T27; P4-8).
 *
 * "Medium+" shows Medium, Hard and Unplayable events; "Hard" and "Unplayable"
 * are exact, so their counts are the Analysis panel's Hard and Unplay tiles.
 * An event the plan plays no note of shows only under "All". Prev/Next hard
 * visit every Hard event in time order and stop at the ends.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { type FingerAssignment, type DifficultyLevel } from '../../../src/types/executionPlan';
import { buildEventTimeline, getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import {
  adjacentHardEvent,
  eventCostsOf,
  filterCounts,
  filterEvents,
  hardEventSteps,
  matchesFilter,
} from '../../../src/ui/analysis/eventDifficulty';
import { momentDifficultyCounts } from '../../../src/ui/analysis/momentCounts';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getActivePerformance, getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { importTestMidi1 } from '../../helpers/testMidi1';

/** Seven events at 0.5 s steps, each one note of Sound `s<i>`, with these difficulties (null: not in the plan). */
const LEVELS: Array<DifficultyLevel | null> = ['Easy', 'Hard', 'Medium', null, 'Hard', 'Unplayable', 'Hard'];

function fixture() {
  const notes = LEVELS.map((_, i) => ({ startTime: i * 0.5, voiceId: `s${i}`, eventKey: `e${i}` }));
  const timeline = buildEventTimeline(notes);
  const plan: FingerAssignment[] = LEVELS.flatMap((level, i) => level === null ? [] : [{
    eventKey: `e${i}`, voiceId: `s${i}`, startTime: i * 0.5, noteNumber: 36, row: 0, col: i,
    assignedHand: level === 'Unplayable' ? 'Unplayable' : 'left', finger: level === 'Unplayable' ? null : 'index',
    cost: level === 'Unplayable' ? Infinity : 1, difficulty: level,
    costBreakdown: level === 'Unplayable' ? undefined : { fingerPreference: 0, handShapeDeviation: 0, alternation: 0, transitionCost: 1, handBalance: 0, constraintPenalty: 0, total: 1 },
  } as FingerAssignment]);
  return { timeline, costs: eventCostsOf(timeline, plan) };
}

describe('Events filters', () => {
  it('Medium+ takes Medium and worse; Hard and Unplayable are exact; an unanalysed event is only in All', () => {
    const { timeline, costs } = fixture();
    const shown = (filter: Parameters<typeof filterEvents>[2]) => filterEvents(timeline, costs, filter).map(e => e.index);
    expect(shown('all')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(shown('medium-up')).toEqual([1, 2, 4, 5, 6]);
    expect(shown('hard')).toEqual([1, 4, 6]);
    expect(shown('unplayable')).toEqual([5]);
    expect(filterCounts(timeline, costs)).toEqual({ 'all': 7, 'medium-up': 5, 'hard': 3, 'unplayable': 1 });
    expect(matchesFilter(null, 'medium-up')).toBe(false);
    expect(matchesFilter(undefined, 'all')).toBe(true);
  });
});

describe('Prev/Next hard', () => {
  it('visits every Hard event in time order and stops at the ends', () => {
    const { timeline, costs } = fixture();
    const visit = (from: number | null, direction: 1 | -1) => {
      const seen: number[] = [];
      let at = from;
      for (let i = 0; i < 10; i++) {
        const next = adjacentHardEvent(timeline, costs, at, direction);
        if (!next) break;
        seen.push(next.index);
        at = next.index;
      }
      return seen;
    };
    expect(visit(null, 1)).toEqual([1, 4, 6]);
    expect(visit(null, -1)).toEqual([6, 4, 1]);
    // From an event that isn't Hard, the nearest Hard one that way.
    expect(adjacentHardEvent(timeline, costs, 2, 1)?.index).toBe(4);
    expect(adjacentHardEvent(timeline, costs, 2, -1)?.index).toBe(1);
    // At the ends: nothing (never wraps).
    expect(adjacentHardEvent(timeline, costs, 6, 1)).toBeNull();
    expect(adjacentHardEvent(timeline, costs, 1, -1)).toBeNull();
  });
});

describe('on TEST MIDI 1 with Sounds spread over the grid', () => {
  let state: ProjectState;
  let plan: FingerAssignment[];

  beforeAll(async () => {
    state = await importTestMidi1();
    ['0,0', '7,0', '4,3', '3,7', '7,7', '0,7', '5,5'].forEach((padKey, i) => {
      state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });
    });
    const layout = getDisplayedLayout(state)!;
    const analysis = await analyzeLayout({
      performance: getActivePerformance(state), layout,
      instrumentConfig: state.instrumentConfig, engineConfig: state.engineConfig, sections: state.sections,
    });
    plan = analysis.executionPlan.fingerAssignments;
    state = { ...state, analysisResult: analysis, analysisStale: false };
  }, 60_000);

  it('the chips count what the Analysis panel counts', () => {
    const timeline = getEventTimeline(state);
    const chips = filterCounts(timeline, eventCostsOf(timeline, plan));
    const tiles = momentDifficultyCounts(plan);
    expect(chips.all).toBe(32);
    expect(chips.hard).toBe(tiles.hard);
    expect(chips.unplayable).toBe(tiles.unplayable);
    expect(chips['medium-up']).toBe(tiles.medium + tiles.hard + tiles.unplayable);
    // The fixture has Hard events to step through.
    expect(chips.hard).toBeGreaterThan(3);
  });

  it('hardEventSteps reads the plan on screen and the selection', () => {
    const timeline = getEventTimeline(state);
    const hard = filterEvents(timeline, eventCostsOf(timeline, plan), 'hard');
    let steps = hardEventSteps(state);
    expect(steps.total).toBe(hard.length);
    expect(steps.position).toBe(-1);
    expect(steps.next?.index).toBe(hard[0]!.index);
    expect(steps.previous?.index).toBe(hard[hard.length - 1]!.index);
    const second = hard[1]!;
    steps = hardEventSteps({ ...state, selectedMomentKey: second.key });
    expect(steps.position).toBe(1);
    expect(steps.previous?.index).toBe(hard[0]!.index);
    expect(steps.next?.index).toBe(hard[2]!.index);
  });
});
