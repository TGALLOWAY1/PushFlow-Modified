/**
 * S3.3 · Only placed material is scored (T25).
 *
 * The one scoring request path (scoringRequestFor) filters the performance to
 * the notes of Sounds on the layout's pads, for the plan (auto-analysis and
 * the cache's solve) and the LayoutScore alike, and the cache key follows the
 * filtered notes. A partly placed layout whose placed notes play has no
 * unplayable event; a complete layout is scored on the whole performance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getActivePerformance,
  getDisplayedLayout,
  projectReducer,
  type ProjectAction,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { analyseLayoutCached, hasPlacedNotes, scoringRequestFor } from '../../../src/ui/analysis/layoutAnalysis';
import { analysisCacheKey, hashPerformance } from '../../../src/ui/analysis/analysisCache';
import { importTestMidi1, suggestedTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

let partial: ProjectState;
let placedIds: Set<string>;

beforeAll(async () => {
  const start = await importTestMidi1();
  // Three of seven Sounds placed, well apart.
  partial = reduce(start, ...['3,3', '3,4', '4,5'].map((padKey, i): ProjectAction => ({
    type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: start.soundStreams[i]! },
  })));
  placedIds = new Set(start.soundStreams.slice(0, 3).map(s => s.id));
});

describe('placed-only scoring', () => {
  it('scores only the notes of Sounds on the layout\'s pads, and keys the cache by them', () => {
    const layout = getDisplayedLayout(partial)!;
    const { key, request } = scoringRequestFor(partial, layout);
    const all = getActivePerformance(partial).events;
    const placedNotes = all.filter(e => placedIds.has(e.voiceId!));
    expect(placedNotes.length).toBeGreaterThan(0);
    expect(placedNotes.length).toBeLessThan(all.length);
    expect(request.performance.events).toEqual(placedNotes);
    const context = { engineConfig: partial.engineConfig, instrumentConfig: partial.instrumentConfig, sections: partial.sections };
    expect(key.performanceHash).toBe(hashPerformance(request.performance, context));
    expect(key.performanceHash).not.toBe(hashPerformance(getActivePerformance(partial), context));
  });

  it('a partly placed layout whose placed notes play has no unplayable event; its plan covers the placed notes only', async () => {
    const layout = getDisplayedLayout(partial)!;
    const { analysis, score } = await analyseLayoutCached(partial, layout);
    const plan = analysis.executionPlan;
    expect(plan.fingerAssignments.every(a => placedIds.has(a.voiceId!))).toBe(true);
    expect(plan.fingerAssignments.some(a => a.assignedHand === 'Unplayable')).toBe(false);
    expect(score.unplayableEvents).toBe(0);
    expect(plan.diagnostics?.feasibility.level).not.toBe('infeasible');
  }, 60_000);

  it('a complete layout is scored on the whole performance, under the same key as before', async () => {
    const complete = await suggestedTestMidi1();
    const layout = getDisplayedLayout(complete)!;
    const { key, request } = scoringRequestFor(complete, layout);
    expect(request.performance.events).toEqual(getActivePerformance(complete).events);
    const context = { engineConfig: complete.engineConfig, instrumentConfig: complete.instrumentConfig, sections: complete.sections };
    expect(key.performanceHash).toBe(hashPerformance(getActivePerformance(complete), context));
    // Asking twice gives the same key string (the filtered performance is reused).
    expect(analysisCacheKey(scoringRequestFor(complete, layout).key)).toBe(analysisCacheKey(key));
  });

  it('with no placed note in scope there is nothing to analyse', () => {
    const layout = getDisplayedLayout(partial)!;
    expect(hasPlacedNotes(partial, layout)).toBe(true);
    const allMuted = reduce(partial, ...[...placedIds].map((id): ProjectAction => ({ type: 'TOGGLE_MUTE', payload: id })));
    expect(hasPlacedNotes(allMuted, getDisplayedLayout(allMuted)!)).toBe(false);
  });
});
