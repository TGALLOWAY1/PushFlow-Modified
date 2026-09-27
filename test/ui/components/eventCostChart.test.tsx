// @vitest-environment happy-dom
/**
 * S4.2 · the chart marks an unplayable event (S1b.1's follow-up, T27).
 *
 * An event the plan can't play has no breakdown, so its bar used to be an
 * empty gap. It is now a full-height hatched bar, and its tooltip says how
 * many of its notes can't be played, with no Total.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EventCostChart } from '../../../src/ui/components/panels/EventCostChart';
import { getActivePerformance, getDisplayedExecutionPlan, getDisplayedLayout, type ProjectState } from '../../../src/ui/state/projectState';
import { analyzeLayout } from '../../../src/ui/analysis/analyzeLayout';
import { getEventTimeline } from '../../../src/ui/analysis/eventTimeline';
import { type FingerAssignment } from '../../../src/types/executionPlan';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let state: ProjectState;

beforeAll(async () => {
  const suggested = await suggestedTestMidi1();
  const analysis = await analyzeLayout({
    performance: getActivePerformance(suggested), layout: getDisplayedLayout(suggested)!,
    instrumentConfig: suggested.instrumentConfig, engineConfig: suggested.engineConfig, sections: suggested.sections,
  });
  state = { ...suggested, analysisResult: analysis, analysisStale: false };
}, 60_000);

describe('the event difficulty chart', () => {
  it('draws an unplayable event as a full-height hatched bar, and says why in its tooltip', () => {
    const timeline = getEventTimeline(state);
    const target = timeline.events.find(e => e.soundIds.length >= 2)!;
    // One note of the event can't be played: the whole event is Unplayable.
    const [first] = [...target.noteKeys];
    const notes: FingerAssignment[] = getDisplayedExecutionPlan(state)!.fingerAssignments.map(a => (a.eventKey === first
      ? { ...a, assignedHand: 'Unplayable', finger: null, cost: Infinity, difficulty: 'Unplayable', row: undefined, col: undefined }
      : a));
    render(<EventCostChart fingerAssignments={notes} timeline={timeline} tempo={state.tempo} />);

    const bars = screen.getAllByTestId('event-bar');
    const unplayable = bars.filter(b => b.dataset.unplayable === 'true');
    expect(unplayable.map(b => Number(b.dataset.eventIndex))).toEqual([target.index]);
    const bar = unplayable[0]!;
    expect(bar.style.height).toBe('120px');
    expect(bar.style.background).toContain('repeating-linear-gradient');
    // Playable bars are never full-height stripes.
    expect(bars.filter(b => b !== bar).every(b => !b.style.background.includes('repeating-linear-gradient'))).toBe(true);

    fireEvent.mouseEnter(bar);
    expect(screen.getByText(`Unplayable: 1 of ${target.noteCount} notes can’t be played`)).toBeTruthy();
    expect(screen.queryByText(/^Total:/)).toBeNull();
  });
});
