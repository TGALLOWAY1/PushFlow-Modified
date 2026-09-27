/**
 * S4.2 · the moment inspector's two sentences (T27).
 *
 * "Why it's hard" names the factor carrying most of the event's cost, with its
 * share, from the same FACTOR_META numbers the inspector's bars show. "Next"
 * describes the move to the next event the plan plays, from the engine's
 * transition analysis. Neither ever prints a MIDI note number or raw seconds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { explainMomentCost, explainMomentTransition } from '../../../src/ui/analysis/momentExplanation';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown } from '../../../src/ui/analysis/factorMeta';
import { buildTransitionModelAt } from '../../../src/ui/analysis/selectionModel';
import { findSelectedEvent, getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import { getActivePerformance, getDisplayedExecutionPlan, getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { createZeroV1CostBreakdown } from '../../../src/types/diagnostics';
import { type MomentCost } from '../../../src/engine/structure/momentGrouping';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

function cost(overrides: Partial<MomentCost>): MomentCost {
  return { noteCount: 2, unplayableNoteCount: 0, breakdown: createZeroV1CostBreakdown(), cost: 0, difficulty: 'Easy', ...overrides };
}

describe('why an event is as hard as it is', () => {
  it('names the dominant factor and its share of the cost', () => {
    const breakdown = { ...createZeroV1CostBreakdown(), transitionCost: 6, fingerPreference: 1, handShapeDeviation: 1, handBalance: 2 };
    const why = explainMomentCost(cost({ breakdown, cost: 10, difficulty: 'Hard' }));
    expect(why.dominant).toBe('transition');
    expect(why.share).toBeCloseTo(0.6);
    expect(why.text).toBe(`Mostly Movement (60% of its cost): ${FACTOR_META.transition.description.charAt(0).toLowerCase()}${FACTOR_META.transition.description.slice(1)}`);
  });

  it('counts both grip parts as one factor, as the bars do', () => {
    const breakdown = { ...createZeroV1CostBreakdown(), transitionCost: 3, fingerPreference: 2, handShapeDeviation: 2 };
    expect(explainMomentCost(cost({ breakdown, cost: 7, difficulty: 'Medium' })).dominant).toBe('gripNaturalness');
  });

  it('says so when nothing strains the hands, when it can’t be played, and when nothing is analysed', () => {
    expect(explainMomentCost(cost({})).text).toBe('Nothing here strains the hands.');
    const unplayable = explainMomentCost(cost({ breakdown: null, cost: Infinity, difficulty: 'Unplayable', unplayableNoteCount: 1 }));
    expect(unplayable.text).toBe('1 of 2 notes can’t be played: a Sound has no pad, or no grip reaches it.');
    expect(unplayable.dominant).toBeNull();
    expect(explainMomentCost(null).text).toBe('None of its Sounds is on this layout’s pads, so nothing here is judged yet.');
  });
});

describe('on TEST MIDI 1 with the suggested layout', () => {
  let state: ProjectState;

  beforeAll(async () => {
    const suggested = await suggestedTestMidi1();
    const analysis = await analyzeLayout({
      performance: getActivePerformance(suggested), layout: getDisplayedLayout(suggested)!,
      instrumentConfig: suggested.instrumentConfig, engineConfig: suggested.engineConfig, sections: suggested.sections,
    });
    state = { ...suggested, analysisResult: analysis, analysisStale: false };
  }, 60_000);

  it('every event’s "why" agrees with its factor bars', () => {
    const timeline = getEventTimeline(state);
    const assignments = getDisplayedExecutionPlan(state)!.fingerAssignments;
    for (const event of timeline.events) {
      const { cost: c } = findSelectedEvent(timeline, assignments, event.key)!;
      const why = explainMomentCost(c);
      if (why.dominant) {
        const factors = factorsFromBreakdown(c!.breakdown!);
        expect(Math.max(...FACTOR_KEYS.map(k => factors[k]))).toBe(factors[why.dominant]);
        expect(why.text.startsWith(`Mostly ${FACTOR_META[why.dominant].label} (`)).toBe(true);
      } else {
        expect(why.text).toBe('Nothing here strains the hands.');
      }
    }
  });

  it('every event but the last previews the move to the next, in ms and by event number', () => {
    const timeline = getEventTimeline(state);
    const assignments = getDisplayedExecutionPlan(state)!.fingerAssignments;
    const last = timeline.events.length - 1;
    for (const event of timeline.events) {
      const model = buildTransitionModelAt(timeline, assignments, event.index);
      const next = model?.nextIndex != null ? timeline.events[model.nextIndex]! : null;
      const text = explainMomentTransition(model, next ? `Event ${next.index + 1}` : null);
      if (event.index === last) {
        expect(text).toBe('This is the last event the plan plays.');
        continue;
      }
      expect(text).toMatch(new RegExp(`^Next: Event ${event.index + 2} in \\d+ ms, (easy|slightly difficult|moderately hard|very hard)`));
      // Reasons only for a move that isn't easy; fingers only when one changes pad.
      expect(text).not.toMatch(/easy \(/);
      expect(text).toMatch(/(; (1 finger moves|\d+ fingers move) to another pad)?\.$/);
      const moving = model!.fingerMoves.filter(m => m.fromPad && m.toPad && !m.isHold).length;
      expect(text.includes('to another pad')).toBe(moving > 0);
      // Never seconds or a MIDI note number.
      expect(text).not.toMatch(/\d\.\d+\s*s\b|\bnote \d+|\bMIDI\b/);
    }
  });
});
